"use client";

import { ArrowRight, BookOpenText, CalendarDays, FileText } from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { SpearMark } from "@/components/brand";
import { ThemeToggle } from "@/components/theme-toggle";

type PublicDocument = {
  id: number;
  project: string;
  title: string;
  content: string;
  kind: string;
  updated_at: string;
};

export default function CustomerDocumentPage() {
  return (
    <Suspense fallback={<div className="route-loading">פותחים את העמוד...</div>}>
      <CustomerDocument />
    </Suspense>
  );
}

function CustomerDocument() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const name = searchParams.get("name")?.trim() || "אורח";
  const [document, setDocument] = useState<PublicDocument | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch(`/api/public/Atlas/documents/${params.id}`)
      .then(async (response) => {
        if (response.status === 404) throw new Error("העמוד לא נמצא או שאינו מפורסם ללקוחות.");
        if (!response.ok) throw new Error("לא הצלחנו לטעון את העמוד. נסו שוב בעוד רגע.");
        return (await response.json()) as PublicDocument;
      })
      .then((data) => active && setDocument(data))
      .catch((requestError: Error) => active && setError(requestError.message));
    return () => { active = false; };
  }, [params.id]);

  return (
    <div className="reader-page">
      <header className="reader-topbar"><SpearMark /><div><ThemeToggle /><a className="secondary-button" href={`/customer?name=${encodeURIComponent(name)}`}><ArrowRight size={17} /> חזרה למרכז הלקוחות</a></div></header>
      <main className="reader-shell">
        {error && <div className="reader-error"><FileText size={28} /><h1>לא הצלחנו לפתוח את העמוד</h1><p>{error}</p><a className="primary-button" href={`/customer?name=${encodeURIComponent(name)}`}>חזרה לתיעוד</a></div>}
        {!error && !document && <div className="route-loading">טוענים תוכן...</div>}
        {document && <article className="document-reader public-reader">
          <nav className="reader-breadcrumb" aria-label="פירורי לחם"><a href={`/customer?name=${encodeURIComponent(name)}`}>מרכז הלקוחות</a><ArrowRight size={14} /><span>{document.project}</span><ArrowRight size={14} /><strong>{document.title}</strong></nav>
          <div className="reader-meta"><span><BookOpenText size={14} /> {document.kind === "guide" ? "מדריך" : "עמוד ידע"}</span><span><CalendarDays size={14} /> עודכן {new Date(document.updated_at).toLocaleDateString("he-IL")}</span></div>
          <h1>{document.title}</h1>
          <div className="reader-content">{document.content}</div>
        </article>}
      </main>
    </div>
  );
}
