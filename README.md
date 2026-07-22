# Spear

מרכז ידע בעברית ללקוחות ולצוותי FDE: תיעוד, שאלות, באגים, רעיונות, חדרי פרויקט ו־Spearoni / Spearoni+.

## הרצה מקומית

Frontend:

```bash
cd frontend
npm install
npm run dev
```

Backend (נדרש Python 3.8.10 בדיוק):

```bash
cd backend
python3.8 -m venv .venv
. .venv/bin/activate
pip install -e .
cp .env.example .env
uvicorn app.main:app --reload
```

Next.js מעביר `/api/*` אל `http://127.0.0.1:8000` כברירת מחדל. אפשר לשנות עם `BACKEND_URL`.

## רשת מבודדת

- כתובת ה־OpenAI-compatible endpoint, המפתח ושם המודל מוגדרים ב־`.env`. ברירת המחדל למודל היא `gemma4-31b`; יש להתאים ל־slug המדויק שמוחזר מ־`/v1/models`.
- אסימון GitLab נשאר רק ב־backend. הוא לעולם לא מוחזר ל־browser.
- V1 מתוכנן כ־FastAPI יחיד, PostgreSQL ודיסק מקומי. אין Redis, Kafka, Celery, S3 או vector DB עד שתימדד הצדקה אמיתית.
- רכיבי התצוגה כוללים כרגע נתוני seed. נקודות ה־API של הצ׳אט, רשימת המודלים, תור ניתוח repository ו־WebSocket לחדר פרויקט כבר קיימות; persistence וסורק GitLab בפועל הם השכבה הבאה.

## בדיקות קצרות

```bash
cd backend
PYTHONPATH=. python -m unittest discover -s tests
```
