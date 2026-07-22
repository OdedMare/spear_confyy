import Link from "next/link";

export function SpearMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link className="brand" href="/" aria-label="Spear — דף הבית">
      <span className="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 40 40" role="img">
          <path d="M21 3 30 18l-6 1-3 18-4-1 3-18-5-3L21 3Z" fill="currentColor" />
          <path d="m20 18 5-4" fill="none" stroke="white" strokeLinecap="round" strokeWidth="2" />
        </svg>
      </span>
      {!compact && (
        <span className="brand-copy">
          <strong>Spear</strong>
          <small>ידע שפוגע בול</small>
        </span>
      )}
    </Link>
  );
}
