"use client";

import {
  Archive,
  BookOpenText,
  Bug,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Code2,
  FileCode2,
  Files,
  GitBranch,
  GitPullRequestArrow,
  Hash,
  Lightbulb,
  LoaderCircle,
  Network,
  Plus,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  TerminalSquare,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { SpearMark } from "@/components/brand";
import { SettingsPanel } from "@/components/settings-panel";
import { ThemeToggle } from "@/components/theme-toggle";

type TeamMessage = {
  id?: number;
  author: string;
  initials: string;
  time: string;
  text: string;
  agent?: boolean;
  code?: string;
};

type ScanState = { id: string; status: string; files_read: number; error?: string };

export default function TeamWorkspace() {
  const router = useRouter();
  const [messages, setMessages] = useState<TeamMessage[]>([]);
  const [message, setMessage] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [scan, setScan] = useState<ScanState | null>(null);
  const [repository, setRepository] = useState("group/atlas-platform");
  const [reference, setReference] = useState("main");
  const [root, setRoot] = useState("services/api");
  const [teamError, setTeamError] = useState("");
  const [notice, setNotice] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profile, setProfile] = useState({ display_name: "צוות Spear", role: "fde" });

  useEffect(() => {
    let active = true;
    Promise.all([fetch("/api/auth/me"), fetch("/api/team/messages/Atlas")])
      .then(async ([authResponse, messagesResponse]) => {
        if (authResponse.status === 401 || messagesResponse.status === 401) {
          router.replace("/");
          return null;
        }
        if (!authResponse.ok || !messagesResponse.ok) throw new Error("סביבת הצוות לא זמינה כרגע");
        return {
          profile: (await authResponse.json()) as { display_name: string; role: string },
          messages: (await messagesResponse.json()) as TeamMessage[],
        };
      })
      .then((data) => {
        if (!active || !data) return;
        setProfile(data.profile);
        setMessages(data.messages);
      })
      .catch((requestError: Error) => active && setTeamError(requestError.message))
      .finally(() => active && setLoadingMessages(false));
    return () => { active = false; };
  }, [router]);

  async function analyzeRepository() {
    if (analyzing) return;
    setAnalyzing(true);
    setTeamError("");
    setScan(null);
    try {
      const response = await fetch("/api/repositories/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: "Atlas", repository, reference, roots: [root || "/"] }),
      });
      if (response.status === 401) return router.replace("/");
      if (!response.ok) throw new Error("לא הצלחנו להתחיל סריקה");
      let current = (await response.json()) as ScanState;
      setScan(current);
      for (let attempt = 0; attempt < 60 && ["queued", "running"].includes(current.status); attempt += 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 1000));
        const statusResponse = await fetch(`/api/repositories/scans/${current.id}`);
        if (!statusResponse.ok) throw new Error("איבדנו את סטטוס הסריקה");
        current = (await statusResponse.json()) as ScanState;
        setScan(current);
      }
    } catch (requestError) {
      setTeamError(requestError instanceof Error ? requestError.message : "הסריקה נכשלה");
    } finally {
      setAnalyzing(false);
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = message.trim();
    if (!text || sending) return;
    setSending(true);
    setTeamError("");
    setMessage("");
    try {
      const response = await fetch("/api/team/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: "Atlas", text }),
      });
      if (response.status === 401) return router.replace("/");
      if (!response.ok) throw new Error("ההודעה לא נשמרה. נסו שוב.");
      const result = (await response.json()) as { messages: TeamMessage[] };
      setMessages((current) => [...current, ...result.messages]);
    } catch (requestError) {
      setTeamError(requestError instanceof Error ? requestError.message : "שליחת ההודעה נכשלה");
      setMessage(text);
    } finally {
      setSending(false);
    }
  }

  async function saveAgentResult(item: TeamMessage, kind: "cheat-sheet" | "guide" | "bug") {
    setNotice("");
    setTeamError("");
    try {
      const isBug = kind === "bug";
      const response = await fetch(isBug ? "/api/submissions" : "/api/team/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(isBug
          ? { project: "Atlas", type: "bug", title: item.text, author: profile.display_name }
          : { project: "Atlas", title: item.text.slice(0, 90), content: item.text, kind, visibility: kind === "guide" ? "public" : "internal" }),
      });
      if (!response.ok) throw new Error("save failed");
      setNotice(kind === "bug" ? "הבאג נפתח ונכנס לתור הציבורי." : kind === "guide" ? "התיעוד פורסם ללקוחות." : "נשמר כ-cheat sheet פנימי.");
    } catch {
      setTeamError("לא הצלחנו לשמור את הידע. נסו שוב.");
    }
  }

  return (
    <div className="team-shell">
      <aside className="team-sidebar">
        <div className="team-brand-row">
          <SpearMark />
          <button className="icon-button" aria-label="כיווץ תפריט" type="button"><ChevronRight size={18} /></button>
        </div>

        <button className="project-switcher" type="button">
          <span className="project-glyph">A</span>
          <span><strong>Atlas</strong><small>3 repositories</small></span>
          <ChevronDown size={17} />
        </button>

        <nav className="team-nav" aria-label="ניווט סביבת הצוות">
          <a className="active" href="#room"><Hash size={18} /> חדר הפרויקט</a>
          <a href="/team/docs"><BookOpenText size={18} /> בסיס הידע</a>
          <a href="#repos"><GitBranch size={18} /> מאגרי קוד <span className="nav-count">3</span></a>
          <a href="#issues"><Bug size={18} /> משימות פתוחות <span className="nav-count warning">8</span></a>
          <a href="#team"><Users size={18} /> חברי הצוות</a>
        </nav>

        <div className="repo-tree" id="repos">
          <div className="sidebar-section-title"><span>פרויקטים ונתיבים</span><button aria-label="הוספת מאגר" type="button"><Plus size={15} /></button></div>
          <details open>
            <summary><ChevronLeft size={15} /> <Network size={16} /> atlas-platform</summary>
            <a className="tree-item active" href="#room"><FileCode2 size={15} /> /services/api</a>
            <a className="tree-item" href="#room"><FileCode2 size={15} /> /services/notifications</a>
            <a className="tree-item" href="#room"><Files size={15} /> /deploy</a>
          </details>
          <details>
            <summary><ChevronLeft size={15} /> <Network size={16} /> atlas-web</summary>
          </details>
          <details>
            <summary><ChevronLeft size={15} /> <Network size={16} /> shared-infra</summary>
          </details>
        </div>

        <div className="team-profile">
          <span className="avatar">{profile.display_name.slice(0, 1)}</span>
          <span><strong>{profile.display_name}</strong><small>{profile.role.toUpperCase()} · עובד קשה מדי</small></span>
          <button className="profile-settings" type="button" onClick={() => setSettingsOpen(true)} aria-label="פתיחת הגדרות"><Settings size={17} /></button>
        </div>
      </aside>

      <main className="team-main">
        <header className="team-topbar">
          <div className="room-title">
            <span className="room-icon"><Hash size={22} /></span>
            <div><h1>atlas-api</h1><p>קוד, החלטות, באגים וקצת הומור הישרדותי</p></div>
          </div>
          <div className="topbar-actions">
            <label className="global-search compact-search">
              <Search size={17} />
              <span className="sr-only">חיפוש בפרויקט</span>
              <input placeholder="חיפוש בפרויקט..." />
              <kbd>⌘ K</kbd>
            </label>
            <ThemeToggle />
            <button className="icon-button settings-trigger" type="button" onClick={() => setSettingsOpen(true)} aria-label="פתיחת הגדרות מערכת"><Settings size={17} /></button>
            <span className="team-online"><i /> 6 מחוברים</span>
          </div>
        </header>

        <div className="team-content">
          <section className="room-panel" id="room">
            {teamError && <div className="system-banner error" role="alert">{teamError}</div>}
            {notice && <div className="system-banner success" role="status"><Check size={17} /> {notice}</div>}
            <div className="room-banner">
              <div><span className="eyebrow"><Sparkles size={15} /> Spearoni+ מאזין רק כשקוראים לו</span><h2>החדר של Atlas API</h2><p>השיחה נשמרת כידע פרויקטלי. בלי DM, בלי ״מי זוכר איפה כתבנו את זה״.</p></div>
              <button className="secondary-button" type="button"><Users size={17} /> פרטי החדר</button>
            </div>

            <div className="team-chat" aria-live="polite">
              <div className="day-divider"><span>היום</span></div>
              {loadingMessages && <div className="list-loading"><span className="spin-ring" /> טוענים את שיחת הפרויקט...</div>}
              {messages.map((item, index) => (
                <article className={`team-message ${item.agent ? "agent" : ""}`} key={`${item.author}-${index}`}>
                  <span className="message-avatar">{item.initials}</span>
                  <div className="message-body">
                    <header><strong>{item.author}</strong>{item.agent && <span className="agent-label"><Sparkles size={12} /> עוזר צוות</span>}<time>{item.time}</time></header>
                    <p>{item.text}</p>
                    {item.code && <pre dir="ltr"><code>{item.code}</code></pre>}
                    {item.agent && (
                      <div className="agent-actions">
                        <button type="button" onClick={() => saveAgentResult(item, "cheat-sheet")}><Archive size={14} /> שמירה כ-cheat sheet</button>
                        <button type="button" onClick={() => saveAgentResult(item, "guide")}><BookOpenText size={14} /> פרסום כתיעוד</button>
                        <button type="button" onClick={() => saveAgentResult(item, "bug")}><Bug size={14} /> פתיחת באג</button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>

            <form className="team-composer" onSubmit={sendMessage}>
              <div className="composer-tools"><button type="button" aria-label="הוספת קוד"><Code2 size={17} /></button><button type="button" aria-label="צירוף קובץ"><Plus size={17} /></button><span>כתבו <b dir="ltr">@Spearoni+</b> כדי לשאול את כל הידע של הפרויקט</span></div>
              <label><span className="sr-only">הודעה לחדר Atlas API</span><textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={2} placeholder="משתפים ידע, שאלה או בדיחה בינונית על YAML..." /></label>
              <button className="send-button" type="submit" disabled={!message.trim() || sending} aria-label="שליחת הודעה">{sending ? <LoaderCircle className="spin" size={19} /> : <Send size={19} />}</button>
            </form>
          </section>

          <aside className="team-rail">
            <section className="rail-card repo-scan">
              <header><span className="rail-icon"><GitPullRequestArrow size={18} /></span><div><h2>מיפוי GitLab</h2><p>{scan ? `job ${scan.id}` : "סריקה ידנית ומבוקרת"}</p></div></header>
              <label>GitLab project<input dir="ltr" value={repository} onChange={(event) => setRepository(event.target.value)} placeholder="group/project" /></label>
              <label>Branch / tag<input dir="ltr" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="main" /></label>
              <label>שורש לניתוח<input dir="ltr" value={root} onChange={(event) => setRoot(event.target.value)} placeholder="services/api" /></label>
              <button className={`scan-button ${scan?.status === "completed" ? "done" : ""}`} type="button" onClick={analyzeRepository} disabled={analyzing || !repository.trim()}>
                {analyzing ? <><LoaderCircle className="spin" size={17} /> קורא כל קובץ שפוי...</> : scan?.status === "completed" ? <><Check size={17} /> נקראו {scan.files_read} קבצים</> : <><TerminalSquare size={17} /> ניתוח ידני עכשיו</>}
              </button>
              {scan?.error && <p className="inline-error">{scan.error}</p>}
              <small><ShieldCheck size={14} /> סודות, binaries ותיקיות vendor נשארים בחוץ.</small>
            </section>

            <section className="rail-card" id="knowledge">
              <div className="rail-heading"><div><span className="section-kicker">ידע חם</span><h2>שימושי השבוע</h2></div><a className="icon-button" href="/team/docs" aria-label="הוספת עמוד ידע"><Plus size={17} /></a></div>
              <a className="knowledge-item" href="/team/docs"><span className="type-icon code"><TerminalSquare size={16} /></span><span><strong>Deploy ל-OpenShift</strong><small>cheat sheet · עודכן היום</small></span></a>
              <a className="knowledge-item" href="/team/docs"><span className="type-icon question"><CircleHelp size={16} /></span><span><strong>למה ה-worker נתקע?</strong><small>שאלה · 5 תגובות</small></span></a>
              <a className="knowledge-item" href="/team/docs"><span className="type-icon idea"><Lightbulb size={16} /></span><span><strong>Retry policy אחידה</strong><small>רעיון · בבחינה</small></span></a>
            </section>

            <section className="rail-card pulse-card" id="issues">
              <div className="rail-heading"><div><span className="section-kicker">דופק הפרויקט</span><h2>לאן נועצים עכשיו?</h2></div></div>
              <div className="pulse-row"><span><Bug size={16} /> באגים בטיפול</span><strong>4</strong></div>
              <div className="pulse-row"><span><CircleHelp size={16} /> שאלות פתוחות</span><strong>3</strong></div>
              <div className="pulse-row"><span><BookOpenText size={16} /> טיוטות לפרסום</span><strong>2</strong></div>
            </section>
          </aside>
        </div>
      </main>
      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
