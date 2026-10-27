import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "EduBase", description: "University digital twin" };
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
