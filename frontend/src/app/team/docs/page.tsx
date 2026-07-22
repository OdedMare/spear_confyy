"use client";

import {
  ArrowRight,
  Check,
  Code2,
  Eye,
  FileText,
  Globe2,
  LoaderCircle,
  LockKeyhole,
  Pencil,
  Plus,
  Save,
  Search,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { SpearMark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";

type Visibility = "public" | "internal";
type Kind = "guide" | "cheat-sheet" | "code";
type DocumentSummary = {
  id: number;
  project: string;
  title: string;
  visibility: Visibility;
  kind: Kind;
  updated_at: string;
};
type DocumentPage = DocumentSummary & { content: string };
type Editor = { title: string; content: string; visibility: Visibility; kind: Kind };

const emptyEditor: Editor = { title: "", content: "", visibility: "internal", kind: "guide" };
const kindLabel: Record<Kind, string> = { guide: "מדריך", "cheat-sheet": "דף עזר", code: "תיעוד קוד" };

export default function DocsWorkspace() {
  return (
    <Suspense fallback={<div className="route-loading">פותחים את בסיס הידע...</div>}>
      <DocsWorkspaceContent />
    </Suspense>
  );
}

function DocsWorkspaceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedId = Number(searchParams.get("id")) || null;
  const [documents, setDocuments] = useState<DocumentSummary[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(requestedId);
  const [editor, setEditor] = useState<Editor>(emptyEditor);
  const [original, setOriginal] = useState<Editor>(emptyEditor);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"edit" | "preview">("edit");
  const [loading, setLoading] = useState(true);
  const [loadingPage, setLoadingPage] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const dirty = JSON.stringify(editor) !== JSON.stringify(original);
  const filtered = useMemo(() => {
    const value = query.trim().toLocaleLowerCase("he");
    return value ? documents.filter((item) => item.title.toLocaleLowerCase("he").includes(value)) : documents;
  }, [documents, query]);

  useEffect(() => {
    let active = true;
    Promise.all([
      fetch("/api/auth/me"),
      fetch("/api/team/documents?project=Atlas"),
      requestedId ? fetch(`/api/team/documents/${requestedId}`) : Promise.resolve(null),
    ])
      .then(async ([authResponse, listResponse, pageResponse]) => {
        if (authResponse.status === 401 || listResponse.status === 401 || pageResponse?.status === 401) {
          router.replace("/");
          return null;
        }
        if (!authResponse.ok || !listResponse.ok) throw new Error("בסיס הידע לא זמין כרגע. נסו לרענן.");
        if (pageResponse && !pageResponse.ok) throw new Error("העמוד שביקשתם לא נמצא.");
        return {
          documents: (await listResponse.json()) as DocumentSummary[],
          page: pageResponse ? (await pageResponse.json()) as DocumentPage : null,
        };
      })
      .then((data) => {
        if (!active || !data) return;
        setDocuments(data.documents);
        if (data.page) applyPage(data.page);
      })
      .catch((requestError: Error) => active && setError(requestError.message))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  // requestedId is intentionally read once; page switches are handled without remounting.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  function applyPage(page: DocumentPage) {
    const next = { title: page.title, content: page.content, visibility: page.visibility, kind: page.kind };
    setSelectedId(page.id);
    setEditor(next);
    setOriginal(next);
    setUpdatedAt(page.updated_at);
    setMode("edit");
    setError("");
    setNotice("");
  }

  function mayLeaveDraft() {
    return !dirty || window.confirm("יש שינויים שלא נשמרו. לעבור לעמוד אחר ולוותר עליהם?");
  }

  async function openPage(id: number) {
    if (id === selectedId || !mayLeaveDraft()) return;
    setLoadingPage(true);
    setError("");
    try {
      const response = await fetch(`/api/team/documents/${id}`);
      if (response.status === 401) return router.replace("/");
      if (!response.ok) throw new Error("לא הצלחנו לפתוח את העמוד.");
      applyPage((await response.json()) as DocumentPage);
      router.replace(`/team/docs?id=${id}`, { scroll: false });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "פתיחת העמוד נכשלה");
    } finally {
      setLoadingPage(false);
    }
  }

  function newPage() {
    if (!mayLeaveDraft()) return;
    setSelectedId(null);
    setEditor(emptyEditor);
    setOriginal(emptyEditor);
    setUpdatedAt(null);
    setMode("edit");
    setError("");
    setNotice("");
    router.replace("/team/docs", { scroll: false });
  }

  async function refreshDocuments() {
    const response = await fetch("/api/team/documents?project=Atlas");
    if (response.ok) setDocuments((await response.json()) as DocumentSummary[]);
  }

  async function savePage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = editor.title.trim();
    const content = editor.content.trim();
    if (title.length < 3 || content.length < 3 || saving) {
      setError("כותרת ותוכן של עמוד צריכים להכיל לפחות 3 תווים.");
      return;
    }
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(selectedId ? `/api/team/documents/${selectedId}` : "/api/team/knowledge", {
        method: selectedId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: "Atlas", ...editor, title, content }),
      });
      if (response.status === 401) return router.replace("/");
      const body = (await response.json().catch(() => null)) as (DocumentPage & { detail?: string }) | null;
      if (!response.ok || !body) throw new Error(body?.detail || "שמירת העמוד נכשלה.");
      applyPage({ ...body, content });
      await refreshDocuments();
      router.replace(`/team/docs?id=${body.id}`, { scroll: false });
      setNotice(body.visibility === "public" ? "העמוד נשמר וגלוי ללקוחות." : "העמוד נשמר כידע פנימי.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "שמירת העמוד נכשלה");
    } finally {
      setSaving(false);
    }
  }

  const wordCount = editor.content.trim() ? editor.content.trim().split(/\s+/).length : 0;

  return (
    <div className="docs-workspace">
      <header className="docs-topbar">
        <div className="docs-branding"><SpearMark /><span className="docs-breadcrumb"><a href="/team">סביבת הצוות</a><ArrowRight size={14} /><strong>בסיס הידע</strong></span></div>
        <div className="docs-top-actions"><ThemeToggle /><a className="secondary-button" href="/team"><ArrowRight size={17} /> חזרה לחדר</a></div>
      </header>

      <div className="docs-layout">
        <aside className="docs-sidebar" aria-label="עמודי ידע">
          <div className="docs-sidebar-heading"><div><span className="section-kicker">Atlas</span><h1>עמודים</h1></div><button className="icon-button" type="button" onClick={newPage} aria-label="יצירת עמוד חדש"><Plus size={18} /></button></div>
          <label className="docs-search"><Search size={17} /><span className="sr-only">חיפוש עמודים</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="חיפוש לפי כותרת..." /></label>
          <button className="new-page-button" type="button" onClick={newPage}><Plus size={17} /> עמוד חדש</button>
          <nav className="docs-list" aria-label="רשימת עמודים">
            {loading && <div className="list-loading"><span className="spin-ring" /> טוענים עמודים...</div>}
            {!loading && filtered.map((item) => (
              <button className={item.id === selectedId ? "active" : ""} type="button" onClick={() => openPage(item.id)} key={item.id}>
                <span className="doc-list-icon">{item.kind === "code" ? <Code2 size={16} /> : <FileText size={16} />}</span>
                <span><strong>{item.title}</strong><small>{kindLabel[item.kind]} · {item.visibility === "public" ? "פורסם" : "פנימי"}</small></span>
                {item.visibility === "public" ? <Globe2 size={14} aria-label="ציבורי" /> : <LockKeyhole size={14} aria-label="פנימי" />}
              </button>
            ))}
            {!loading && filtered.length === 0 && <p className="docs-empty">{query ? "לא נמצאו עמודים מתאימים." : "עוד אין עמודים. זה מקום טוב להתחיל."}</p>}
          </nav>
        </aside>

        <main className="docs-canvas">
          {loadingPage ? <div className="route-loading"><LoaderCircle className="spin" size={22} /> פותחים עמוד...</div> : (
            <form className="page-editor" onSubmit={savePage}>
              <div className="editor-commandbar">
                <div className="editor-mode" role="group" aria-label="מצב עמוד">
                  <button className={mode === "edit" ? "active" : ""} type="button" onClick={() => setMode("edit")} aria-pressed={mode === "edit"}><Pencil size={16} /> עריכה</button>
                  <button className={mode === "preview" ? "active" : ""} type="button" onClick={() => setMode("preview")} aria-pressed={mode === "preview"}><Eye size={16} /> תצוגה</button>
                </div>
                <div className="editor-actions">
                  {dirty && <span className="unsaved-label">שינויים לא נשמרו</span>}
                  <button className="primary-button compact" type="submit" disabled={saving || !dirty || editor.title.trim().length < 3 || editor.content.trim().length < 3}>
                    {saving ? <LoaderCircle className="spin" size={17} /> : dirty ? <Save size={17} /> : <Check size={17} />} {saving ? "שומרים..." : dirty ? "שמירת עמוד" : "נשמר"}
                  </button>
                </div>
              </div>

              {error && <div className="system-banner error" role="alert">{error}</div>}
              {notice && <div className="system-banner success" role="status"><Check size={17} /> {notice}</div>}

              {mode === "edit" ? (
                <article className="editor-paper">
                  <div className="page-meta-fields">
                    <label>סוג עמוד<select value={editor.kind} onChange={(event) => setEditor((current) => ({ ...current, kind: event.target.value as Kind }))}><option value="guide">מדריך</option><option value="cheat-sheet">דף עזר</option><option value="code">תיעוד קוד</option></select></label>
                    <label>הרשאה<select value={editor.visibility} onChange={(event) => setEditor((current) => ({ ...current, visibility: event.target.value as Visibility }))}><option value="internal">פנימי לצוות</option><option value="public">פורסם ללקוחות</option></select></label>
                  </div>
                  <label className="page-title-field"><span className="sr-only">כותרת העמוד</span><input autoFocus value={editor.title} onChange={(event) => setEditor((current) => ({ ...current, title: event.target.value }))} placeholder="כותרת העמוד" maxLength={200} /></label>
                  <label className="page-body-field"><span className="sr-only">תוכן העמוד</span><textarea value={editor.content} onChange={(event) => setEditor((current) => ({ ...current, content: event.target.value }))} placeholder={'כתבו כאן את הידע של הצוות.\n\nמומלץ להתחיל במטרה, להוסיף שלבים ברורים ולסיים בקישורים או פקודות שימושיות.'} /></label>
                  <footer><span>{wordCount} מילים</span><span>{updatedAt ? `עודכן ${new Date(updatedAt).toLocaleString("he-IL")}` : "עמוד חדש"}</span></footer>
                </article>
              ) : (
                <article className="document-reader editor-preview">
                  <div className="reader-meta"><span>{kindLabel[editor.kind]}</span><span>{editor.visibility === "public" ? <><Globe2 size={14} /> גלוי ללקוחות</> : <><LockKeyhole size={14} /> פנימי לצוות</>}</span></div>
                  <h1>{editor.title || "עמוד ללא כותרת"}</h1>
                  <div className="reader-content">{editor.content || "עוד לא נכתב תוכן לעמוד הזה."}</div>
                </article>
              )}
            </form>
          )}
        </main>
      </div>
    </div>
  );
}
