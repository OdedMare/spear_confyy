import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spear — ידע שפוגע בול",
  description: "מרכז הידע, התיעוד והשיחה של צוות Spear והלקוחות שלו.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const themeScript = `try{const t=localStorage.getItem('spear-theme')||'dark';document.documentElement.dataset.theme=t}catch(e){document.documentElement.dataset.theme='dark'}`;
  return (
    <html lang="he" dir="rtl" data-theme="dark" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body>{children}</body>
    </html>
  );
}
