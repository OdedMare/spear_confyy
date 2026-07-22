import asyncio
import hmac
import uuid
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional

import httpx
from fastapi import BackgroundTasks, Depends, FastAPI, HTTPException, Response, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

from .auth import create_session, read_session, require_team
from .config import get_settings
from .database import execute, fetch_all, fetch_one, init_database
from .gitlab import scan_repository
from .llm_client import chat_completion
from .retrieval import retrieve_documents, sanitize_public_question


settings = get_settings()


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_database()
    yield


app = FastAPI(title="Spear API", version="0.2.0", lifespan=lifespan)


class LoginRequest(BaseModel):
    username: str = Field(min_length=1, max_length=80)
    password: str = Field(min_length=1, max_length=200)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    project: str = Field(default="Atlas", max_length=120)
    name: Optional[str] = Field(default=None, max_length=80)


class ChatResponse(BaseModel):
    answer: str
    sources: List[str] = Field(default_factory=list)
    created_question: Optional[Dict[str, Any]] = None


class SubmissionRequest(BaseModel):
    project: str = Field(default="Atlas", max_length=120)
    type: str = Field(pattern="^(question|bug|idea)$")
    title: str = Field(min_length=3, max_length=500)
    author: str = Field(min_length=1, max_length=80)


class TeamMessageRequest(BaseModel):
    project: str = Field(default="Atlas", max_length=120)
    text: str = Field(min_length=1, max_length=8000)


class KnowledgeRequest(BaseModel):
    project: str = Field(default="Atlas", max_length=120)
    title: str = Field(min_length=3, max_length=200)
    content: str = Field(min_length=3, max_length=100000)
    kind: str = Field(pattern="^(guide|cheat-sheet|code)$")
    visibility: str = Field(pattern="^(public|internal)$")


class RepositoryAnalysisRequest(BaseModel):
    repository: str = Field(min_length=1, max_length=400)
    reference: str = Field(default="main", max_length=200)
    roots: List[str] = Field(default_factory=lambda: ["/"])
    project: str = Field(default="Atlas", max_length=120)


def _documents(project: str, internal: bool) -> List[Dict[str, str]]:
    visibility = "visibility IN ('public', 'internal')" if internal else "visibility = 'public'"
    rows = fetch_all(
        "SELECT title, content FROM documents WHERE project = %s AND %s ORDER BY updated_at DESC" % ("%s", visibility),
        (project,),
    )
    return [{"title": row["title"], "content": row["content"]} for row in rows]


def _llm_answer(message: str, documents: List[Dict[str, str]], internal: bool) -> str:
    scope = "פנימי: קוד, runbooks, דיונים ובאגים" if internal else "ציבורי ללקוחות בלבד"
    context = "\n\n".join("מקור: %s\n%s" % (item["title"], item["content"]) for item in documents)
    prompt = (
        "אתה Spearoni%s, עוזר ידע חם, שיתופי וקצר. ענה בעברית טבעית. "
        "השתמש רק בהקשר המצורף, אל תמציא, וציין כאשר חסר מידע. תחום: %s.\n\n%s"
        % ("+" if internal else "", scope, context)
    )
    return chat_completion(
        messages=[{"role": "system", "content": prompt}, {"role": "user", "content": message}],
        model=settings.llm_model,
        api_key=settings.llm_api_key,
        base_url=settings.llm_base_url,
    )


def _answer(message: str, project: str, internal: bool) -> ChatResponse:
    matches = retrieve_documents(message, _documents(project, internal))
    if not matches:
        return ChatResponse(answer="לא מצאתי מקור מספיק טוב. כדאי להפעיל ניתוח repository או להוסיף תיעוד לפרויקט.")
    try:
        answer = _llm_answer(message, matches, internal)
    except Exception:
        answer = "מצאתי מקור רלוונטי: %s" % matches[0]["content"]
    return ChatResponse(answer=answer, sources=[item["title"] for item in matches])


def _message_row(row: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": row["id"],
        "author": row["author"],
        "initials": row["initials"],
        "text": row["text"],
        "agent": row["agent"],
        "code": row["code"],
        "time": row["created_at"].strftime("%H:%M"),
    }


@app.get("/health")
def health() -> Dict[str, str]:
    fetch_one("SELECT 1 AS ready")
    return {"status": "ok", "service": "spear"}


@app.post("/api/auth/login")
def login(request: LoginRequest, response: Response) -> Dict[str, str]:
    valid_user = hmac.compare_digest(request.username.encode("utf-8"), settings.team_username.encode("utf-8"))
    valid_password = hmac.compare_digest(request.password.encode("utf-8"), settings.team_password.encode("utf-8"))
    if not valid_user or not valid_password:
        raise HTTPException(status_code=401, detail="שם המשתמש או הסיסמה אינם נכונים")
    token = create_session(request.username, settings.team_role)
    response.set_cookie(
        "spear_session",
        token,
        max_age=settings.session_seconds,
        httponly=True,
        samesite="lax",
        secure=False,
    )
    return {"username": request.username, "display_name": settings.team_display_name, "role": settings.team_role}


@app.post("/api/auth/logout")
def logout(response: Response) -> Dict[str, bool]:
    response.delete_cookie("spear_session")
    return {"ok": True}


@app.get("/api/auth/me")
def me(session: Dict[str, str] = Depends(require_team)) -> Dict[str, str]:
    return {"username": session["username"], "display_name": settings.team_display_name, "role": session["role"]}


@app.get("/api/settings/public")
def public_settings() -> Dict[str, object]:
    return {
        "model": settings.llm_model,
        "llm_base_url": settings.llm_base_url,
        "gitlab_configured": bool(settings.gitlab_url and settings.gitlab_token),
    }


@app.get("/api/models")
def list_models(_: Dict[str, str] = Depends(require_team)) -> Dict[str, List[str]]:
    url = "%s/models" % settings.llm_base_url.rstrip("/")
    headers = {"Authorization": "Bearer %s" % (settings.llm_api_key or "null")}
    with httpx.Client(timeout=8.0) as client:
        response = client.get(url, headers=headers)
        response.raise_for_status()
    return {"models": [item["id"] for item in response.json().get("data", []) if item.get("id")]}


@app.get("/api/public/{project}")
def public_project(project: str) -> Dict[str, Any]:
    docs = fetch_all(
        "SELECT id, title, content, kind, updated_at FROM documents WHERE project = %s AND visibility = 'public' ORDER BY updated_at DESC",
        (project,),
    )
    submissions = fetch_all(
        "SELECT id, type, title, author, status, comments, created_at FROM submissions WHERE project = %s ORDER BY created_at DESC",
        (project,),
    )
    return {
        "project": project,
        "version": "4.8",
        "documents": docs,
        "submissions": submissions,
        "metrics": {
            "documents": len(docs),
            "updated_this_week": min(len(docs), 6),
            "open_questions": sum(1 for item in submissions if item["type"] == "question" and item["status"] != "סגור"),
        },
    }


@app.post("/api/submissions")
def create_submission(request: SubmissionRequest) -> Dict[str, Any]:
    prefix = {"question": "Q", "bug": "B", "idea": "I"}[request.type]
    item_id = "%s-%s" % (prefix, uuid.uuid4().hex[:6].upper())
    title = sanitize_public_question(request.title, limit=500)
    row = fetch_one(
        """
        INSERT INTO submissions (id, project, type, title, author)
        VALUES (%s, %s, %s, %s, %s)
        RETURNING id, type, title, author, status, comments, created_at
        """,
        (item_id, request.project, request.type, title, request.author),
    )
    return row or {}


@app.post("/api/chat/customer", response_model=ChatResponse)
def customer_chat(request: ChatRequest) -> ChatResponse:
    matches = retrieve_documents(request.message, _documents(request.project, internal=False))
    if not matches:
        item = create_submission(
            SubmissionRequest(project=request.project, type="question", title=request.message, author=request.name or "אורח")
        )
        return ChatResponse(
            answer="עוד אין לי תשובה בטוחה בתיעוד. פתחתי לצוות שאלה ציבורית — בלי לצרף את השיחה הפרטית — כדי לסגור את הפער.",
            created_question=item,
        )
    try:
        answer = _llm_answer(request.message, matches, internal=False)
    except Exception:
        answer = "מצאתי את הכיוון בתיעוד: %s" % matches[0]["content"]
    return ChatResponse(answer=answer, sources=[item["title"] for item in matches])


@app.post("/api/chat/team", response_model=ChatResponse)
def team_chat(request: ChatRequest, _: Dict[str, str] = Depends(require_team)) -> ChatResponse:
    return _answer(request.message, request.project, internal=True)


@app.get("/api/team/messages/{project}")
def team_messages(project: str, _: Dict[str, str] = Depends(require_team)) -> List[Dict[str, Any]]:
    rows = fetch_all(
        "SELECT id, author, initials, text, agent, code, created_at FROM team_messages WHERE project = %s ORDER BY created_at, id",
        (project,),
    )
    return [_message_row(row) for row in rows]


@app.post("/api/team/messages")
def create_team_message(
    request: TeamMessageRequest,
    session: Dict[str, str] = Depends(require_team),
) -> Dict[str, List[Dict[str, Any]]]:
    display_name = settings.team_display_name
    initials = "".join(word[0] for word in display_name.split()[:2]) or session["username"][:2]
    user_row = fetch_one(
        """
        INSERT INTO team_messages (project, author, initials, text)
        VALUES (%s, %s, %s, %s)
        RETURNING id, author, initials, text, agent, code, created_at
        """,
        (request.project, display_name, initials, request.text),
    )
    created = [_message_row(user_row)] if user_row else []
    if "spearoni" in request.text.lower():
        result = _answer(request.text, request.project, internal=True)
        agent_row = fetch_one(
            """
            INSERT INTO team_messages (project, author, initials, text, agent)
            VALUES (%s, 'Spearoni+', '+S', %s, TRUE)
            RETURNING id, author, initials, text, agent, code, created_at
            """,
            (request.project, result.answer),
        )
        if agent_row:
            created.append(_message_row(agent_row))
    return {"messages": created}


@app.post("/api/team/knowledge")
def save_knowledge(
    request: KnowledgeRequest,
    _: Dict[str, str] = Depends(require_team),
) -> Dict[str, Any]:
    row = fetch_one(
        """
        INSERT INTO documents (project, title, content, visibility, kind, updated_at)
        VALUES (%s, %s, %s, %s, %s, NOW())
        ON CONFLICT (project, title, visibility)
        DO UPDATE SET content = EXCLUDED.content, kind = EXCLUDED.kind, updated_at = NOW()
        RETURNING id, project, title, visibility, kind, updated_at
        """,
        (request.project, request.title, request.content, request.visibility, request.kind),
    )
    return row or {}


@app.post("/api/repositories/analyze")
def analyze_repository(
    request: RepositoryAnalysisRequest,
    background_tasks: BackgroundTasks,
    _: Dict[str, str] = Depends(require_team),
) -> Dict[str, Any]:
    job_id = "scan-%s" % uuid.uuid4().hex[:8]
    row = fetch_one(
        """
        INSERT INTO repository_scans (id, project, repository, reference, roots, status)
        VALUES (%s, %s, %s, %s, %s, 'queued')
        RETURNING *
        """,
        (job_id, request.project, request.repository, request.reference, request.roots),
    )
    background_tasks.add_task(scan_repository, job_id, request.project, request.repository, request.reference, request.roots)
    return row or {}


@app.get("/api/repositories/scans/{job_id}")
def repository_scan(job_id: str, _: Dict[str, str] = Depends(require_team)) -> Dict[str, Any]:
    row = fetch_one("SELECT * FROM repository_scans WHERE id = %s", (job_id,))
    if not row:
        raise HTTPException(status_code=404, detail="הסריקה לא נמצאה")
    return row


class ProjectRooms:
    def __init__(self) -> None:
        self.connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, project: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.connections.setdefault(project, []).append(websocket)

    def disconnect(self, project: str, websocket: WebSocket) -> None:
        room = self.connections.get(project, [])
        if websocket in room:
            room.remove(websocket)

    async def broadcast(self, project: str, payload: Dict[str, str]) -> None:
        room = list(self.connections.get(project, []))
        if room:
            await asyncio.gather(*(socket.send_json(payload) for socket in room), return_exceptions=True)


rooms = ProjectRooms()


@app.websocket("/api/ws/projects/{project}")
async def project_room(websocket: WebSocket, project: str) -> None:
    try:
        read_session(websocket.cookies.get("spear_session", ""))
    except HTTPException:
        await websocket.close(code=4401)
        return
    await rooms.connect(project, websocket)
    try:
        while True:
            payload = await websocket.receive_json()
            await rooms.broadcast(project, {"project": project, "message": str(payload.get("message", ""))})
    except WebSocketDisconnect:
        rooms.disconnect(project, websocket)
