# Spear

מערכת ידע בעברית ללקוחות ולצוותי FDE: תיעוד, שאלות, באגים, רעיונות, חדרי פרויקט ו־Spearoni / Spearoni+.

## מה כבר עובד

- פורטל לקוחות RTL עם תיעוד ציבורי, קהילה ו־Spearoni שמחזיר מקורות.
- סביבת צוות עם התחברות, חדרי פרויקט שמורים, Spearoni+, cheat sheets ופרסום תיעוד ללקוחות.
- סריקה ידנית של repository/ref/root מתוך GitLab, כולל סינון secrets, binaries, generated ו־vendor.
- PostgreSQL לתיעוד, submissions, הודעות וסריקות.
- OpenAI-compatible client עבור endpoint פנימי ומודל ברירת מחדל `gemma4:31b-cloud`.
- מצב כהה כברירת מחדל ומצב בהיר שנשמר בדפדפן.

## הדרך הקצרה להריץ

```bash
docker compose up --build
```

אם פורט מקומי תפוס: `SPEAR_FRONTEND_PORT=3001 SPEAR_BACKEND_PORT=8001 docker compose up --build`.

לאחר שהשירותים בריאים:

- UI: `http://localhost:3000`
- API docs: `http://localhost:8000/docs`
- Health: `http://localhost:8000/health`

משתמש ה־admin הראשוני הוא `spear1` עם הסיסמה `spear1`. החליפו אותו לפני שימוש אמיתי באמצעות משתני הסביבה המתוארים למטה.

## הגדרות

אפשר להגדיר ב־shell או בקובץ `.env` של Docker Compose:

```dotenv
SPEAR_LLM_BASE_URL=http://llm.internal/v1
OPENAI_API_KEY=
SPEAR_LLM_MODEL=gemma4:31b-cloud
SPEAR_GITLAB_URL=https://gitlab.internal.example
SPEAR_GITLAB_TOKEN=glpat-...
SPEAR_TEAM_USERNAME=spear1
SPEAR_TEAM_PASSWORD=replace-me
SPEAR_TEAM_ROLE=admin
SPEAR_SESSION_SECRET=replace-with-a-long-random-value
```

אפשר להגדיר את אותם ערכים גם מתוך כפתור ההגדרות בסביבת הצוות. בדומה ל־locatoAi, ערכי environment הם ברירות המחדל וה־runtime settings נשמרים בקובץ JSON פרטי ומופעלים מיד. אסימוני LLM ו־GitLab נשארים ב־backend בלבד. שם המודל צריך להיות ה־slug המדויק שמוחזר מ־`/v1/models`.

## פיתוח ללא Docker

נדרש PostgreSQL זמין ו־Python 3.8.10 בדיוק:

```bash
cd backend
python3.8 -m venv .venv
. .venv/bin/activate
pip install -e '.[dev]'
cp .env.example .env
uvicorn app.main:app --reload
```

בטרמינל נוסף:

```bash
cd frontend
npm ci
BACKEND_URL=http://127.0.0.1:8000 npm run dev
```

## בדיקות

```bash
cd frontend && npm run lint && npm run build
cd backend && PYTHONPATH=. python -m pytest
```

מידע מפורט נמצא ב־[`frontend/README.md`](frontend/README.md), [`backend/README.md`](backend/README.md) וב־[`CLAUDE.md`](CLAUDE.md).

## רשת מבודדת

כל התלויות הן רגילות וניתנות למראה פנימית. אין תלות בשירותי CDN, fonts חיצוניים, S3, Redis, Kafka, Celery או vector DB. ברירת המחדל היא FastAPI יחיד, PostgreSQL ודיסק מקומי.
