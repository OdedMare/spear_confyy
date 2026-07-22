"use client";

import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  function toggleTheme() {
    const root = document.documentElement;
    const next = root.dataset.theme === "light" ? "dark" : "light";
    root.dataset.theme = next;
    localStorage.setItem("spear-theme", next);
  }

  return (
    <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label="החלפת מצב כהה ובהיר">
      <Sun className="theme-icon-light" size={17} aria-hidden="true" />
      <Moon className="theme-icon-dark" size={17} aria-hidden="true" />
      <span>ערכת נושא</span>
    </button>
  );
}
