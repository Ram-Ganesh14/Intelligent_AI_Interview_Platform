import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "InterviewAI — Intelligent Adaptive AI Interviewing Platform",
  description:
    "AI-powered interview platform with adaptive questioning, computer vision proctoring, anti-cheating detection, resume analysis, and multi-factor scoring.",
  keywords: [
    "AI interview",
    "adaptive testing",
    "proctoring",
    "resume analysis",
    "coding interview",
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
