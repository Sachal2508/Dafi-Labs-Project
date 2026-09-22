import './globals.css';
import React from 'react';
import { Bot, Shield, Zap } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'OpsAgent — AI Operations Dashboard',
  description: 'Real-time observability and audit log for OpsAgent.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-[#0B0F17] text-slate-100 antialiased font-sans flex flex-col">
        {/* Clean Header */}
        <header className="border-b border-slate-800/60 bg-[#0B0F17]/80 backdrop-blur sticky top-0 z-50">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm">
                <Bot className="w-4 h-4" />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-white tracking-tight">OpsAgent</span>
                <span className="text-[10px] font-medium bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded border border-slate-700">
                  Dashboard
                </span>
              </div>
            </Link>

            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                HITL Email Approval Required
              </span>
              <span className="text-slate-700">•</span>
              <span className="inline-flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                Groq Llama-3
              </span>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-6">
          {children}
        </main>
      </body>
    </html>
  );
}
