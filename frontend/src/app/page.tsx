"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { ArrowLeft, BookOpenText, Code2, LoaderCircle, MessageCircleQuestion, Sparkles } from "lucide-react";
import { SpearMark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";

type Entry = "customer" | "team";

export default function Home() {
  const router = useRouter();
  const [entry, setEntry] = useState<Entry>("customer");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (entry === "customer") {
      const displayName = name.trim() || "אורח";
      router.push(`/customer?name=${encodeURIComponent(displayName)}`);
      return;
    }
    if (!username.trim() || !password || submitting) return;
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { detail?: string } | null;
        throw new Error(body?.detail || "לא הצלחנו להתחבר. בדקו שה-backend פעיל ונסו שוב.");
      }
      router.push("/team");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "ההתחברות נכשלה");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="entry-page">
      <header className="entry-header">
        <SpearMark />
        <div className="header-tools"><ThemeToggle /><span className="quiet-badge"><span className="status-dot" /> רשת פנימית</span></div>
      </header>

      <section className="entry-hero">
        <div className="entry-copy">
          <span className="eyebrow"><Sparkles size={16} /> סוף סוף, הידע לא תקוע למישהו בראש</span>
          <h1>כל מה שצריך לדעת.<br /><span>בדיוק כשצריך אותו.</span></h1>
          <p>
            תיעוד, שאלות, באגים ושיחות צוות במקום אחד — עם Spearoni שמחבר את הנקודות
            לפני שהקפה מספיק להתקרר.
          </p>
          <div className="hero-points" aria-label="יכולות מרכזיות">
            <span><BookOpenText size={18} /> תיעוד חי</span>
            <span><MessageCircleQuestion size={18} /> תשובות עם מקורות</span>
            <span><Code2 size={18} /> מבין גם קוד</span>
          </div>
        </div>
        <div className="hero-art">
          <Image
            src="/spearoni-team.png"
            alt="Spearoni עוזר לצוות לארגן קוד ותיעוד"
            fill
            priority
            sizes="(max-width: 900px) 100vw, 58vw"
          />
        </div>
      </section>

      <section className="entry-panel" aria-labelledby="entry-title">
        <div className="entry-panel-heading">
          <div>
            <span className="section-kicker">כניסה ל-Spear</span>
            <h2 id="entry-title">לאן נכנסים היום?</h2>
          </div>
          <p>שני מסלולים, אפס טפסים מיותרים.</p>
        </div>

        <div className="entry-tabs" role="tablist" aria-label="סוג כניסה">
          <button
            className={entry === "customer" ? "active" : ""}
            onClick={() => setEntry("customer")}
            role="tab"
            aria-selected={entry === "customer"}
            type="button"
          >
            <BookOpenText size={20} /> מרכז הלקוחות
          </button>
          <button
            className={entry === "team" ? "active" : ""}
            onClick={() => setEntry("team")}
            role="tab"
            aria-selected={entry === "team"}
            type="button"
          >
            <Code2 size={20} /> סביבת צוות Spear
          </button>
        </div>

        <form className="entry-form" onSubmit={submit}>
          {entry === "customer" ? (
            <label>
              <span>איך קוראים לך?</span>
              <input
                autoFocus
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="שם פרטי מספיק לנו"
              />
              <small>בלי סיסמה ובלי דרמה. השם יוצג ליד שאלות ותגובות.</small>
            </label>
          ) : (
            <div className="form-grid">
              <label>
                <span>שם משתמש</span>
                <input
                  autoComplete="username"
                  required
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="oded"
                />
              </label>
              <label>
                <span>סיסמה</span>
                <input
                  autoComplete="current-password"
                  required
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                />
              </label>
            </div>
          )}
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button" type="submit" disabled={submitting}>
            {submitting ? <><LoaderCircle className="spin" size={18} /> מתחברים...</> : <>{entry === "customer" ? "קדימה, לידע" : "פותחים משמרת"}<ArrowLeft size={19} /></>}
          </button>
        </form>
      </section>
    </main>
  );
}
