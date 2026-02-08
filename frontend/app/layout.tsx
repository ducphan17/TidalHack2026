import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Present AI – Practice like you have feedback",
  description: "AI-powered presentation coaching for students. Get instant feedback on filler words, pace, and body language.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen font-sans">
        {children}
      </body>
    </html>
  );
}
