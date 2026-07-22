from pathlib import PurePosixPath
from typing import Dict, Iterable, List
from urllib.parse import quote

import httpx

from .config import get_settings
from .database import execute
from .runtime_settings import get_runtime_settings


EXCLUDED_PARTS = {".git", "node_modules", "vendor", "dist", "build", ".next", "coverage", "__pycache__"}
SECRET_NAMES = {".env", "id_rsa", "id_ed25519", "credentials", "secrets.yml", "secrets.yaml"}
TEXT_SUFFIXES = {
    ".c", ".cc", ".cpp", ".cs", ".css", ".go", ".h", ".hpp", ".html", ".java", ".js", ".json",
    ".jsx", ".kt", ".md", ".php", ".properties", ".py", ".rb", ".rs", ".sh", ".sql", ".toml",
    ".ts", ".tsx", ".txt", ".vue", ".xml", ".yaml", ".yml",
}
TEXT_NAMES = {"dockerfile", "makefile", "readme", "jenkinsfile", "procfile"}


def _eligible(path: str, roots: Iterable[str]) -> bool:
    file_path = PurePosixPath(path)
    lowered_parts = {part.lower() for part in file_path.parts}
    if lowered_parts.intersection(EXCLUDED_PARTS):
        return False
    if file_path.name.lower() in SECRET_NAMES or "secret" in file_path.name.lower():
        return False
    normalized_roots = [root.strip("/") for root in roots]
    if normalized_roots and "" not in normalized_roots:
        if not any(path == root or path.startswith(root + "/") for root in normalized_roots):
            return False
    return file_path.suffix.lower() in TEXT_SUFFIXES or file_path.name.lower() in TEXT_NAMES


def _tree(client: httpx.Client, project: str, reference: str) -> List[Dict[str, str]]:
    items: List[Dict[str, str]] = []
    page = 1
    project_id = quote(project, safe="")
    while True:
        response = client.get(
            "/api/v4/projects/%s/repository/tree" % project_id,
            params={"ref": reference, "recursive": "true", "per_page": 100, "page": page},
        )
        response.raise_for_status()
        batch = response.json()
        items.extend(batch)
        next_page = response.headers.get("x-next-page")
        if not next_page:
            return items
        page = int(next_page)


def scan_repository(job_id: str, project: str, repository: str, reference: str, roots: List[str]) -> None:
    runtime = get_runtime_settings()
    limits = get_settings()
    if not runtime.gitlab_url or not runtime.gitlab_token:
        execute(
            "UPDATE repository_scans SET status = %s, error = %s, updated_at = NOW() WHERE id = %s",
            ("configuration_required", "יש להגדיר SPEAR_GITLAB_URL ו-SPEAR_GITLAB_TOKEN", job_id),
        )
        return

    execute("UPDATE repository_scans SET status = %s, updated_at = NOW() WHERE id = %s", ("running", job_id))
    files_read = 0
    try:
        with httpx.Client(
            base_url=runtime.gitlab_url.rstrip("/"),
            headers={"PRIVATE-TOKEN": runtime.gitlab_token},
            timeout=30.0,
            follow_redirects=True,
            verify=runtime.gitlab_verify_tls,
        ) as client:
            candidates = [item for item in _tree(client, repository, reference) if item.get("type") == "blob"]
            eligible = [item for item in candidates if _eligible(item["path"], roots)]
            # ponytail: synchronous bounded scan; move to a dedicated worker only when scan volume blocks API throughput.
            for item in eligible[: limits.gitlab_max_files]:
                file_path = item["path"]
                response = client.get(
                    "/api/v4/projects/%s/repository/files/%s/raw"
                    % (quote(repository, safe=""), quote(file_path, safe="")),
                    params={"ref": reference},
                )
                response.raise_for_status()
                if len(response.content) > limits.gitlab_max_file_bytes:
                    continue
                try:
                    content = response.content.decode("utf-8")
                except UnicodeDecodeError:
                    continue
                execute(
                    """
                    INSERT INTO documents (project, title, content, visibility, kind, source_path, updated_at)
                    VALUES (%s, %s, %s, 'internal', 'code', %s, NOW())
                    ON CONFLICT (project, title, visibility)
                    DO UPDATE SET content = EXCLUDED.content, source_path = EXCLUDED.source_path, updated_at = NOW()
                    """,
                    (project, "%s / %s" % (repository, file_path), content, file_path),
                )
                files_read += 1
        execute(
            "UPDATE repository_scans SET status = %s, files_read = %s, updated_at = NOW() WHERE id = %s",
            ("completed", files_read, job_id),
        )
    except Exception as error:
        execute(
            "UPDATE repository_scans SET status = %s, files_read = %s, error = %s, updated_at = NOW() WHERE id = %s",
            ("failed", files_read, str(error)[:500], job_id),
        )
