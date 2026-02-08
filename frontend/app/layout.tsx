import type { Metadata } from "next";
import "./globals.css";
import { Starfield } from "@/components/Starfield";

export const metadata: Metadata = {
  title: "Presently.ai – Practice like you have feedback",
  description: "AI-powered presentation coaching for students. Get instant feedback on filler words, pace, and body language.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="antialiased min-h-screen font-sans bg-[#77A5C6]">
        {/* Layer 1: Base - body */}
        {/* Layer 2: Starfield canvas */}
        <Starfield />
        {/* Layer 3: Gradient blurs */}
        <div
          className="fixed top-0 left-0 w-[600px] h-[600px] bg-gradient-to-br from-blue-600/50 to-transparent blur-[100px] pointer-events-none z-0"
          aria-hidden
        />
        <div
          className="fixed bottom-0 right-0 w-[600px] h-[500px] bg-gradient-to-tl from-purple-600/30 to-transparent blur-[100px] pointer-events-none z-0"
          aria-hidden
        />
        {/* Content */}
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
