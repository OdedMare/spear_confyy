"use client";

import {
  Archive,
  Bot,
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
  MessageSquareText,
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
import { FormEvent, useState } from "react";
import { SpearMark } from "@/components/brand";

type TeamMessage = {
  author: string;
  initials: string;
  time: string;
  text: string;
  agent?: boolean;
  code?: string;
};

const initialMessages: TeamMessage[] = [
  {
    author: "מיה",
    initials: "מי",
    time: "09:41",
    text: "מישהו זוכר מה צריך לעדכן לפני deploy של notifications-service?",
  },
  {
    author: "Spearoni+",
    initials: "+S",
    time: "09:42",
    agent: true,
    text: "מצאתי את ה-runbook ואת השינוי האחרון ב-GitLab. לפני הפריסה צריך לעדכן את ConfigMap ולוודא שה-migration רצה פעם אחת בלבד.",
    code: "oc apply -f deploy/configmap.yaml\noc rollout status deploy/notifications-service",
  },
  {
    author: "נועם",
    initials: "נו",
    time: "09:45",
    text: "מעולה. אני הופך את זה ל-cheat sheet לפני שזה שוב בורח לנו ביום חמישי בערב.",
  },
];

export default function TeamWorkspace() {
  const [messages, setMessages] = useState<TeamMessage[]>(initialMessages);
  const [message, setMessage] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisDone, setAnalysisDone] = useState(false);

  function analyzeRepository() {
    if (analyzing) return;
    setAnalyzing(true);
    setAnalysisDone(false);
    window.setTimeout(() => {
      setAnalyzing(false);
      setAnalysisDone(true);
    }, 1400);
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = message.trim();
    if (!text) return;
    setMessages((current) => [
      ...current,
      { author: "אור", initials: "או", time: "עכשיו", text },
    ]);
    setMessage("");

    if (!text.toLowerCase().includes("spearoni")) return;

    try {
      const response = await fetch("/api/chat/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project: "Atlas", message: text }),
      });
      if (!response.ok) throw new Error("backend unavailable");
      const result = (await response.json()) as { answer: string; sources?: string[] };
      setMessages((current) => [
        ...current,
        { author: "Spearoni+", initials: "+S", time: "עכשיו", text: result.answer, agent: true },
      ]);
    } catch {
      setMessages((current) => [
        ...current,
        {
          author: "Spearoni+",
          initials: "+S",
          time: "עכשיו",
          agent: true,
          text: "קלטתי. כרגע אני במצב הדגמה, אבל בחיבור המלא אחפש בקוד, בתיעוד הפנימי, ב-cheat sheets ובבאגים של Atlas — ואחזיר גם מקורות.",
        },
      ]);
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
          <a href="#knowledge"><BookOpenText size={18} /> בסיס הידע</a>
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
          <span className="avatar">או</span>
          <span><strong>אור דגן</strong><small>FDE · עובד קשה מדי</small></span>
          <Settings size={17} />
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
            <span className="team-online"><i /> 6 מחוברים</span>
          </div>
        </header>

        <div className="team-content">
          <section className="room-panel" id="room">
            <div className="room-banner">
              <div><span className="eyebrow"><Sparkles size={15} /> Spearoni+ מאזין רק כשקוראים לו</span><h2>החדר של Atlas API</h2><p>השיחה נשמרת כידע פרויקטלי. בלי DM, בלי ״מי זוכר איפה כתבנו את זה״.</p></div>
              <button className="secondary-button" type="button"><Users size={17} /> פרטי החדר</button>
            </div>

            <div className="team-chat" aria-live="polite">
              <div className="day-divider"><span>היום</span></div>
              {messages.map((item, index) => (
                <article className={`team-message ${item.agent ? "agent" : ""}`} key={`${item.author}-${index}`}>
                  <span className="message-avatar">{item.initials}</span>
                  <div className="message-body">
                    <header><strong>{item.author}</strong>{item.agent && <span className="agent-label"><Sparkles size={12} /> עוזר צוות</span>}<time>{item.time}</time></header>
                    <p>{item.text}</p>
                    {item.code && <pre dir="ltr"><code>{item.code}</code></pre>}
                    {item.agent && (
                      <div className="agent-actions">
                        <button type="button"><Archive size={14} /> שמירה כ-cheat sheet</button>
                        <button type="button"><BookOpenText size={14} /> טיוטת תיעוד</button>
                        <button type="button"><Bug size={14} /> פתיחת באג</button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>

            <form className="team-composer" onSubmit={sendMessage}>
              <div className="composer-tools"><button type="button" aria-label="הוספת קוד"><Code2 size={17} /></button><button type="button" aria-label="צירוף קובץ"><Plus size={17} /></button><span>כתבו <b dir="ltr">@Spearoni+</b> כדי לשאול את כל הידע של הפרויקט</span></div>
              <label><span className="sr-only">הודעה לחדר Atlas API</span><textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={2} placeholder="משתפים ידע, שאלה או בדיחה בינונית על YAML..." /></label>
              <button className="send-button" type="submit" disabled={!message.trim()} aria-label="שליחת הודעה"><Send size={19} /></button>
            </form>
          </section>

          <aside className="team-rail">
            <section className="rail-card repo-scan">
              <header><span className="rail-icon"><GitPullRequestArrow size={18} /></span><div><h2>מיפוי המאגר</h2><p>atlas-platform</p></div></header>
              <label>Branch / tag<select defaultValue="main"><option>main</option><option>release/4.8</option><option>v4.8.2</option></select></label>
              <label>שורש לניתוח<select defaultValue="/services/api"><option>/services/api</option><option>/services/notifications</option><option>/deploy</option></select></label>
              <button className={`scan-button ${analysisDone ? "done" : ""}`} type="button" onClick={analyzeRepository} disabled={analyzing}>
                {analyzing ? <><LoaderCircle className="spin" size={17} /> קורא כל קובץ שפוי...</> : analysisDone ? <><Check size={17} /> המיפוי הושלם</> : <><TerminalSquare size={17} /> ניתוח ידני עכשיו</>}
              </button>
              <small><ShieldCheck size={14} /> סודות, binaries ותיקיות vendor נשארים בחוץ.</small>
            </section>

            <section className="rail-card" id="knowledge">
              <div className="rail-heading"><div><span className="section-kicker">ידע חם</span><h2>שימושי השבוע</h2></div><button className="icon-button" aria-label="הוספת פריט ידע" type="button"><Plus size={17} /></button></div>
              <a className="knowledge-item" href="#room"><span className="type-icon code"><TerminalSquare size={16} /></span><span><strong>Deploy ל-OpenShift</strong><small>cheat sheet · עודכן היום</small></span></a>
              <a className="knowledge-item" href="#room"><span className="type-icon question"><CircleHelp size={16} /></span><span><strong>למה ה-worker נתקע?</strong><small>שאלה · 5 תגובות</small></span></a>
              <a className="knowledge-item" href="#room"><span className="type-icon idea"><Lightbulb size={16} /></span><span><strong>Retry policy אחידה</strong><small>רעיון · בבחינה</small></span></a>
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
    </div>
  );
}
