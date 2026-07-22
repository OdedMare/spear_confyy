"use client";

import {
  ArrowLeft,
  BookOpenText,
  Bot,
  Bug,
  CircleHelp,
  ExternalLink,
  FileText,
  Home,
  Lightbulb,
  MessageSquareText,
  Plus,
  RefreshCw,
  Search,
  Send,
  Sparkles,
} from "lucide-react";
import { useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useMemo, useState } from "react";
import { SpearMark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";

type ChatMessage = { from: "user" | "agent"; text: string; sources?: string[] };
type CommunityItem = {
  id: string;
  type: "question" | "bug" | "idea";
  title: string;
  author: string;
  status: string;
  comments: number;
};
type DocumentItem = { id: number; title: string; content: string; kind: string };
type ProjectData = {
  version: string;
  documents: DocumentItem[];
  submissions: CommunityItem[];
  metrics: { documents: number; updated_this_week: number; open_questions: number };
};

const typeMeta = {
  question: { label: "שאלה", icon: CircleHelp },
  bug: { label: "באג", icon: Bug },
  idea: { label: "רעיון", icon: Lightbulb },
};

export default function CustomerPortal() {
  return (
    <Suspense fallback={<div className="route-loading">פותחים את מרכז הלקוחות...</div>}>
      <CustomerPortalContent />
    </Suspense>
  );
}

function CustomerPortalContent() {
  const searchParams = useSearchParams();
  const name = searchParams.get("name")?.trim() || "אורח";
  const [question, setQuestion] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    { from: "agent", text: "היי! אני Spearoni. אשמח למצוא מדריך מדויק או לפתוח שאלה לצוות אם התיעוד עוד לא מכסה אותה." },
  ]);
  const [items, setItems] = useState<CommunityItem[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [metrics, setMetrics] = useState({ documents: 0, updated_this_week: 0, open_questions: 0 });
  const [version, setVersion] = useState("—");
  const [itemType, setItemType] = useState<CommunityItem["type"]>("question");
  const [itemTitle, setItemTitle] = useState("");
  const [dataError, setDataError] = useState("");
  const [loadingData, setLoadingData] = useState(true);
  const [savingItem, setSavingItem] = useState(false);
  const greeting = useMemo(() => `שלום ${name}, מה נרצה לפתור היום?`, [name]);

  useEffect(() => {
    let active = true;
    fetch("/api/public/Atlas")
      .then(async (response) => {
        if (!response.ok) throw new Error("מרכז הידע לא זמין כרגע. הפעילו את ה-backend ונסו שוב.");
        return (await response.json()) as ProjectData;
      })
      .then((data) => {
        if (!active) return;
        setItems(data.submissions);
        setDocuments(data.documents);
        setMetrics(data.metrics);
        setVersion(data.version);
        setDataError("");
      })
      .catch((requestError: Error) => active && setDataError(requestError.message))
      .finally(() => active && setLoadingData(false));
    return () => { active = false; };
  }, []);

  async function askSpearoni(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = question.trim();
    if (!prompt || isThinking) return;
    setMessages((current) => [...current, { from: "user", text: prompt }]);
    setQuestion("");
    setIsThinking(true);
    try {
      const response = await fetch("/api/chat/customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, project: "Atlas", message: prompt }),
      });
      if (!response.ok) throw new Error("backend unavailable");
      const answer = (await response.json()) as { answer: string; sources?: string[]; created_question?: CommunityItem };
      setMessages((current) => [...current, { from: "agent", text: answer.answer, sources: answer.sources }]);
      if (answer.created_question) setItems((current) => [answer.created_question as CommunityItem, ...current]);
    } catch {
      setMessages((current) => [...current, { from: "agent", text: "לא הצלחתי להגיע לשרת הידע. בדקו שה-backend מחובר ונסו שוב — אני לא אמציא תשובה רק כדי להיראות עסוק." }]);
    } finally {
      setIsThinking(false);
    }
  }

  async function createItem(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const title = itemTitle.trim();
    if (!title || savingItem) return;
    setSavingItem(true);
    setDataError("");
    try {
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: "Atlas", type: itemType, title, author: name }),
      });
      if (!response.ok) throw new Error("לא הצלחנו לפרסם. נסו שוב בעוד רגע.");
      const created = (await response.json()) as CommunityItem;
      setItems((current) => [created, ...current]);
      setItemTitle("");
    } catch (requestError) {
      setDataError(requestError instanceof Error ? requestError.message : "הפרסום נכשל");
    } finally {
      setSavingItem(false);
    }
  }

  return (
    <div className="portal customer-portal">
      <aside className="portal-sidebar">
        <SpearMark />
        <nav aria-label="ניווט מרכז הלקוחות">
          <a className="active" href="#home"><Home size={19} /> הבית</a>
          <a href="#spearoni"><Sparkles size={19} /> Spearoni</a>
          <a href="#docs"><BookOpenText size={19} /> תיעוד</a>
          <a href="#community"><MessageSquareText size={19} /> שאלות ועדכונים <span className="nav-count">{items.length}</span></a>
        </nav>
        <div className="sidebar-note"><span className="mini-spear" aria-hidden="true" /><strong>לא מצאת תשובה?</strong><p>Spearoni יפתח שאלה לצוות ויחזור אליך כשיש עדכון.</p></div>
      </aside>

      <main className="portal-main" id="home">
        <header className="portal-topbar">
          <div><span className="section-kicker">מרכז הלקוחות</span><h1>{greeting}</h1></div>
          <div className="topbar-actions">
            <label className="global-search"><Search size={18} /><span className="sr-only">חיפוש בכל התיעוד</span><input placeholder="חיפוש בכל התיעוד..." /><kbd>⌘ K</kbd></label>
            <ThemeToggle />
            <span className="avatar" aria-label={`מחובר בתור ${name}`}>{name.slice(0, 1)}</span>
          </div>
        </header>

        {dataError && <div className="system-banner error" role="alert"><RefreshCw size={17} /> {dataError}</div>}

        <section className="customer-grid">
          <article className="spearoni-card" id="spearoni">
            <div className="spearoni-heading">
              <span className="agent-avatar"><Bot size={24} /></span>
              <div><h2>Spearoni</h2><p><span className="status-dot" /> מחובר לתיעוד הציבורי של Atlas</p></div>
              <span className="soft-badge">תמיד עם מקורות</span>
            </div>
            <div className="chat-log" aria-live="polite">
              {messages.map((message, index) => (
                <div className={`chat-message ${message.from}`} key={`${message.from}-${index}`}>
                  <p>{message.text}</p>
                  {message.sources && <div className="message-sources">{message.sources.map((source) => <a href="#docs" key={source}><FileText size={14} /> {source}</a>)}</div>}
                </div>
              ))}
              {isThinking && <div className="thinking"><i /><i /><i /><span>Spearoni מחפש איפה הידע מתחבא</span></div>}
            </div>
            <form className="chat-composer" onSubmit={askSpearoni}>
              <label><span className="sr-only">שאלה ל-Spearoni</span><textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="למשל: איך מגדירים התראה בפרויקט?" rows={2} /></label>
              <button type="submit" aria-label="שליחת שאלה" disabled={isThinking || !question.trim()}><Send size={19} /></button>
            </form>
            <div className="suggestion-row" aria-label="שאלות מוצעות">{["איך מתחילים?", "איך מפיקים דוח?", "מה חדש בגרסה?"].map((suggestion) => <button type="button" onClick={() => setQuestion(suggestion)} key={suggestion}>{suggestion}</button>)}</div>
          </article>

          <aside className="project-pulse">
            <span className="section-kicker">הפרויקט שלך</span>
            <div className="project-title"><span className="project-glyph">A</span><div><h2>Atlas</h2><p>גרסה {version}</p></div></div>
            <dl><div><dt>מדריכים</dt><dd>{metrics.documents}</dd></div><div><dt>עודכנו השבוע</dt><dd>{metrics.updated_this_week}</dd></div><div><dt>שאלות פתוחות</dt><dd>{metrics.open_questions}</dd></div></dl>
            <a className="text-link" href="#docs">לכל התיעוד <ArrowLeft size={16} /></a>
          </aside>
        </section>

        <section className="content-section" id="docs">
          <div className="section-heading"><div><span className="section-kicker">תיעוד פופולרי</span><h2>המקומות שכולם מחפשים</h2></div><a href="#docs">כל המדריכים <ArrowLeft size={17} /></a></div>
          <div className="doc-grid">
            {loadingData && [1, 2, 3].map((item) => <span className="doc-card skeleton" key={item} />)}
            {!loadingData && documents.slice(0, 3).map((document) => (
              <a className="doc-card" href="#spearoni" key={document.id}>
                <span className="doc-glyph">{document.title.slice(0, 1)}</span>
                <span><strong>{document.title}</strong><small>{document.content}</small></span>
                <span className="read-time">תיעוד חי <ExternalLink size={14} /></span>
              </a>
            ))}
            {!loadingData && documents.length === 0 && <p className="empty-state">עוד אין מסמכים שפורסמו ללקוחות.</p>}
          </div>
        </section>

        <section className="content-section" id="community">
          <div className="section-heading">
            <div><span className="section-kicker">מה קורה עכשיו</span><h2>שאלות, באגים ורעיונות</h2></div>
            <details className="quick-submit">
              <summary><Plus size={17} /> מוסיפים משהו</summary>
              <form onSubmit={createItem}>
                <label>סוג<select value={itemType} onChange={(event) => setItemType(event.target.value as CommunityItem["type"])}><option value="question">שאלה</option><option value="bug">באג</option><option value="idea">רעיון</option></select></label>
                <label>מה תרצו לשתף?<input value={itemTitle} onChange={(event) => setItemTitle(event.target.value)} required /></label>
                <button className="primary-button compact" type="submit" disabled={savingItem}>{savingItem ? "מפרסמים..." : "פרסום"}</button>
              </form>
            </details>
          </div>
          <div className="community-list">
            {loadingData && <div className="list-loading"><span className="spin-ring" /> טוענים עדכונים אמיתיים...</div>}
            {items.map((item) => {
              const meta = typeMeta[item.type];
              const Icon = meta.icon;
              return <article className="community-row" key={item.id}><span className={`type-icon ${item.type}`}><Icon size={18} /></span><div className="community-copy"><strong>{item.title}</strong><small>{item.id} · {meta.label} · מאת {item.author}</small></div><span className="status-pill">{item.status}</span><span className="comment-count"><MessageSquareText size={15} /> {item.comments}</span></article>;
            })}
            {!loadingData && items.length === 0 && <p className="empty-state">שקט כאן. אפשר להיות הראשונים ששואלים משהו טוב.</p>}
          </div>
        </section>
      </main>
    </div>
  );
}
