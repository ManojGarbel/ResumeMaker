import './globals.css';
import { ReactNode } from 'react';

export const metadata = {
  title: 'Resume Builder | Hakkan',
  description: 'Modern, ATS-friendly resume builder for B.Tech students and freshers',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-mono bg-white text-slate-900 dark:bg-[#0b1220] dark:text-slate-200 transition-colors tech-grid min-h-screen">
        {children}
      </body>
    </html>
  );
}
