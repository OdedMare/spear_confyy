import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spear — ידע שפוגע בול",
  description: "מרכז הידע, התיעוד והשיחה של צוות Spear והלקוחות שלו.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
