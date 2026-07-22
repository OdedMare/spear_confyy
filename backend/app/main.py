import asyncio
import uuid
from datetime import datetime
from typing import Dict, List, Optional

import httpx
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, Field

from .config import get_settings
from .llm_client import chat_completion
from .retrieval import retrieve_documents, sanitize_public_question


app = FastAPI(title="Spear API", version="0.1.0")
settings = get_settings()


CUSTOMER_DOCUMENTS = [
    {
        "project": "Atlas",
        "title": "Atlas / התחלה מהירה",
        "content": "פותחים סביבת עבודה, בוחרים פרויקט, ומגדירים הרשאות לחברי הצוות לפני יצירת דוח ראשון.",
    },
    {
        "project": "Atlas",
        "title": "Atlas / התראות",
        "content": "כדי ליצור התראה נכנסים להגדרות הפרויקט, בוחרים התראות, מוסיפים כלל ובוחרים ערוץ מסירה.",
    },
    {
        "project": "Atlas",
        "title": "Atlas / דוחות וייצוא",
        "content": "במסך דוחות בוחרים טווח זמן ומסננים. אפשר להוריד CSV או לתזמן ייצוא קבוע.",
    },
]

INTERNAL_DOCUMENTS = CUSTOMER_DOCUMENTS + [
    {
        "project": "Atlas",
        "title": "atlas-platform / deploy / OpenShift",
        "content": "לפני deploy מעדכנים ConfigMap, מריצים migration פעם אחת ואז בודקים rollout status.",
    },
    {
        "project": "Atlas",
        "title": "atlas-api / worker retry policy",
        "content": "ה-worker משתמש בשלושה ניסיונות עם backoff. אין לבצע retry לשגיאות validation.",
    },
]

PUBLIC_SUBMISSIONS: List[Dict[str, str]] = []


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=4000)
    project: str = Field(default="Atlas", max_length=120)
    name: Optional[str] = Field(default=None, max_length=80)


class ChatResponse(BaseModel):
    answer: str
    sources: List[str] = []
    created_question: Optional[Dict[str, str]] = None


class RepositoryAnalysisRequest(BaseModel):
    repository: str = Field(min_length=1, max_length=400)
    reference: str = Field(default="main", max_length=200)
    roots: List[str] = Field(default_factory=lambda: ["/"])
    project: str = Field(default="Atlas", max_length=120)


def _llm_answer(message: str, documents: List[Dict[str, str]], internal: bool) -> str:
    scope = "פנימי: קוד, runbooks, דיונים ובאגים" if internal else "ציבורי ללקוחות בלבד"
    context = "\n\n".join(
        "מקור: %s\n%s" % (document["title"], document["content"])
        for document in documents
    )
    system_prompt = (
        "אתה Spearoni%s, עוזר ידע חם, שיתופי וקצר. ענה בעברית טבעית. "
        "השתמש רק בהקשר המצורף, אל תמציא, וציין כאשר חסר מידע. תחום: %s.\n\n%s"
        % ("+" if internal else "", scope, context)
    )
    return chat_completion(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": message},
        ],
        model=settings.llm_model,
        api_key=settings.llm_api_key,
        base_url=settings.llm_base_url,
    )


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok", "service": "spear"}


@app.get("/api/settings/public")
def public_settings() -> Dict[str, object]:
    return {
        "model": settings.llm_model,
        "llm_base_url": settings.llm_base_url,
        "llm_api_key_configured": bool(settings.llm_api_key and settings.llm_api_key != "null"),
        "gitlab_configured": bool(settings.gitlab_url and settings.gitlab_token),
    }


@app.get("/api/models")
def list_models() -> Dict[str, List[str]]:
    url = "%s/models" % settings.llm_base_url.rstrip("/")
    headers = {"Authorization": "Bearer %s" % (settings.llm_api_key or "null")}
    with httpx.Client(timeout=8.0) as client:
        response = client.get(url, headers=headers)
        response.raise_for_status()
    payload = response.json()
    return {"models": [item["id"] for item in payload.get("data", []) if item.get("id")]}


@app.post("/api/chat/customer", response_model=ChatResponse)
def customer_chat(request: ChatRequest) -> ChatResponse:
    documents = [item for item in CUSTOMER_DOCUMENTS if item["project"] == request.project]
    matches = retrieve_documents(request.message, documents)
    if not matches:
        question = {
            "id": "Q-%s" % uuid.uuid4().hex[:6].upper(),
            "project": request.project,
            "author": request.name or "אורח",
            "title": sanitize_public_question(request.message),
            "status": "חדש",
            "created_at": datetime.utcnow().isoformat() + "Z",
        }
        PUBLIC_SUBMISSIONS.append(question)
        return ChatResponse(
            answer="עוד אין לי תשובה בטוחה בתיעוד. פתחתי לצוות שאלה ציבורית בפרויקט %s — בלי לצרף את השיחה הפרטית — כדי שנוכל לסגור את הפער." % request.project,
            created_question=question,
        )

    try:
        answer = _llm_answer(request.message, matches, internal=False)
    except Exception:
        answer = "מצאתי את הכיוון בתיעוד: %s" % matches[0]["content"]
    return ChatResponse(answer=answer, sources=[item["title"] for item in matches])


@app.post("/api/chat/team", response_model=ChatResponse)
def team_chat(request: ChatRequest) -> ChatResponse:
    documents = [item for item in INTERNAL_DOCUMENTS if item["project"] == request.project]
    matches = retrieve_documents(request.message, documents)
    if not matches:
        return ChatResponse(
            answer="לא מצאתי מקור מספיק טוב בקוד או בידע של %s. כדאי לפתוח שאלה פנימית או להפעיל מחדש את ניתוח המאגר." % request.project
        )
    try:
        answer = _llm_answer(request.message, matches, internal=True)
    except Exception:
        answer = "מצאתי מקור פנימי רלוונטי: %s" % matches[0]["content"]
    return ChatResponse(answer=answer, sources=[item["title"] for item in matches])


@app.post("/api/repositories/analyze")
def analyze_repository(request: RepositoryAnalysisRequest) -> Dict[str, object]:
    return {
        "job_id": "scan-%s" % uuid.uuid4().hex[:8],
        "status": "queued",
        "project": request.project,
        "repository": request.repository,
        "reference": request.reference,
        "roots": request.roots,
        "excludes": [".git", "binaries", "vendor", "generated", "secret-like files", "huge files"],
    }


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
    await rooms.connect(project, websocket)
    try:
        while True:
            payload = await websocket.receive_json()
            await rooms.broadcast(project, {"project": project, "message": str(payload.get("message", ""))})
    except WebSocketDisconnect:
        rooms.disconnect(project, websocket)

