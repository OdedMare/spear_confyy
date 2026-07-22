from contextlib import contextmanager
from typing import Any, Dict, Iterator, List, Optional, Sequence

import psycopg
from psycopg.rows import dict_row

from .config import get_settings


@contextmanager
def connection() -> Iterator[psycopg.Connection[Any]]:
    conn = psycopg.connect(get_settings().database_url, row_factory=dict_row)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def execute(sql: str, params: Sequence[Any] = ()) -> None:
    with connection() as conn:
        conn.execute(sql, params)


def fetch_one(sql: str, params: Sequence[Any] = ()) -> Optional[Dict[str, Any]]:
    with connection() as conn:
        row = conn.execute(sql, params).fetchone()
        return dict(row) if row else None


def fetch_all(sql: str, params: Sequence[Any] = ()) -> List[Dict[str, Any]]:
    with connection() as conn:
        return [dict(row) for row in conn.execute(sql, params).fetchall()]


def init_database() -> None:
    schema = """
    CREATE TABLE IF NOT EXISTS documents (
      id BIGSERIAL PRIMARY KEY,
      project TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      visibility TEXT NOT NULL CHECK (visibility IN ('public', 'internal')),
      kind TEXT NOT NULL DEFAULT 'guide',
      source_path TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (project, title, visibility)
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY,
      project TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('question', 'bug', 'idea')),
      title TEXT NOT NULL,
      author TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'חדש',
      comments INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS team_messages (
      id BIGSERIAL PRIMARY KEY,
      project TEXT NOT NULL,
      author TEXT NOT NULL,
      initials TEXT NOT NULL,
      text TEXT NOT NULL,
      agent BOOLEAN NOT NULL DEFAULT FALSE,
      code TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS repository_scans (
      id TEXT PRIMARY KEY,
      project TEXT NOT NULL,
      repository TEXT NOT NULL,
      reference TEXT NOT NULL,
      roots TEXT[] NOT NULL,
      status TEXT NOT NULL,
      files_read INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS documents_project_visibility_idx
      ON documents (project, visibility);
    CREATE INDEX IF NOT EXISTS submissions_project_created_idx
      ON submissions (project, created_at DESC);
    CREATE INDEX IF NOT EXISTS team_messages_project_created_idx
      ON team_messages (project, created_at);
    """
    with connection() as conn:
        conn.execute(schema)
        conn.executemany(
            """
            INSERT INTO documents (project, title, content, visibility, kind)
            VALUES (%s, %s, %s, %s, %s)
            ON CONFLICT (project, title, visibility) DO NOTHING
            """,
            [
                ("Atlas", "Atlas / התחלה מהירה", "פותחים סביבת עבודה, בוחרים פרויקט ומגדירים הרשאות לפני יצירת דוח ראשון.", "public", "guide"),
                ("Atlas", "Atlas / התראות", "כדי ליצור התראה נכנסים להגדרות הפרויקט, בוחרים התראות, מוסיפים כלל ובוחרים ערוץ מסירה.", "public", "guide"),
                ("Atlas", "Atlas / דוחות וייצוא", "במסך דוחות בוחרים טווח זמן ומסננים. אפשר להוריד CSV או לתזמן ייצוא קבוע.", "public", "guide"),
                ("Atlas", "OpenShift deployment", "לפני deploy מעדכנים ConfigMap, מריצים migration פעם אחת ואז בודקים rollout status.", "internal", "cheat-sheet"),
                ("Atlas", "Worker retry policy", "ה-worker משתמש בשלושה ניסיונות עם backoff. אין לבצע retry לשגיאות validation.", "internal", "code"),
            ],
        )
        conn.executemany(
            """
            INSERT INTO submissions (id, project, type, title, author, status, comments)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO NOTHING
            """,
            [
                ("Q-128", "Atlas", "question", "איך מגדירים התראה חדשה בפרויקט?", "נועה", "נענה", 4),
                ("B-074", "Atlas", "bug", "ייצוא דוח נתקע כשבוחרים טווח גדול", "אלון", "בטיפול", 7),
                ("I-031", "Atlas", "idea", "שמירת תצוגה מועדפת לכל משתמש", "מיכל", "בבחינה", 2),
            ],
        )
        count = conn.execute("SELECT COUNT(*) AS count FROM team_messages").fetchone()["count"]
        if count == 0:
            conn.executemany(
                """
                INSERT INTO team_messages (project, author, initials, text, agent, code)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                [
                    ("Atlas", "מיה", "מי", "מישהו זוכר מה צריך לעדכן לפני deploy של notifications-service?", False, None),
                    ("Atlas", "Spearoni+", "+S", "מצאתי את ה-runbook. לפני הפריסה צריך לעדכן ConfigMap ולוודא שה-migration רצה פעם אחת בלבד.", True, "oc apply -f deploy/configmap.yaml\noc rollout status deploy/notifications-service"),
                    ("Atlas", "נועם", "נו", "מעולה. אני הופך את זה ל-cheat sheet לפני שזה שוב בורח ביום חמישי בערב.", False, None),
                ],
            )

