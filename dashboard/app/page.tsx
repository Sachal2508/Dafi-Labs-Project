'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  Bot,
  Brain,
  CheckCircle2,
  Clock,
  Edit3,
  ExternalLink,
  Search,
  Mail,
  Calendar,
  Send,
  Sparkles,
  TrendingDown,
  XCircle,
  Zap,
  RotateCw,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

interface AuditItem {
  id: string;
  requestId: string;
  requestText: string;
  intent: 'drafting' | 'research' | 'scheduling';
  targetAgent: string;
  modelUsed: string;
  modelTierUsed: 'cheap' | 'strong';
  tokens: { promptTokens: number; completionTokens: number; total: number };
  totalCostEstimate: number;
  strongModelCostEstimate: number;
  hasMemoryInjected: boolean;
  retrievedMemoriesCount: number;
  agentOutput: string;
  approvalStatus: 'pending' | 'approved' | 'edited' | 'rejected';
  decidedBy?: string | null;
  decidedAt?: string | null;
  editedContent?: string | null;
  sources?: Array<{ title: string; url: string }> | null;
  createdAt: string;
}

export default function DashboardPage() {
  const [feed, setFeed] = useState<AuditItem[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [prompt, setPrompt] = useState('');

  const fetchData = async () => {
    try {
      const [f, s] = await Promise.all([
        fetch(`${API_BASE}/audit/feed`).then((r) => r.json()),
        fetch(`${API_BASE}/audit/stats`).then((r) => r.json()),
      ]);
      setFeed(Array.isArray(f) ? f : []);
      setStats(s);
    } catch {}
  };

  useEffect(() => {
    fetchData();
    let es: EventSource;
    try {
      es = new EventSource(`${API_BASE}/audit/stream`);
      es.onopen = () => setIsConnected(true);
      es.onerror = () => setIsConnected(false);
      es.onmessage = (e) => {
        try {
          const { type, data } = JSON.parse(e.data);
          if (type === 'request_created') {
            setFeed((prev) => [data, ...prev.filter((i) => i.requestId !== data.requestId)]);
          } else if (type === 'decision_updated') {
            setFeed((prev) =>
              prev.map((i) => (i.requestId === data.requestId ? { ...i, ...data } : i)),
            );
          }
          fetchData();
        } catch {}
      };
    } catch {}
    return () => es?.close();
  }, []);

  const dispatch = async (text: string) => {
    if (!text.trim()) return;
    setIsSubmitting(true);
    try {
      await fetch(`${API_BASE}/requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      setPrompt('');
      await fetchData();
    } catch {}
    setIsSubmitting(false);
  };

  const filtered = feed.filter((i) =>
    filter === 'all' ? true : (i.targetAgent || i.intent) === filter,
  );

  return (
    <div className="space-y-6">
      {/* ─── Metric Cards ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {/* Total Tasks */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium">Total Tasks</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-semibold text-white">{stats?.totalRequests ?? 0}</span>
            <span className="text-xs text-slate-400">
              {stats?.approvals?.pending > 0 ? (
                <span className="text-amber-400 font-medium">{stats.approvals.pending} pending</span>
              ) : (
                'All clear'
              )}
            </span>
          </div>
        </div>

        {/* Cost Saved */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium">Savings vs GPT-4o</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-semibold text-emerald-400">
              ${stats ? stats.costSaved?.toFixed(3) : '0.000'}
            </span>
            <span className="text-xs text-emerald-500/90 font-medium">
              {stats?.costSavedPercentage ?? 0}% saved
            </span>
          </div>
        </div>

        {/* Total Cost */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium">API Spend</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-semibold text-slate-200">
              ${stats ? stats.totalCost?.toFixed(4) : '0.0000'}
            </span>
            <span className="text-[11px] text-slate-500 font-mono">Groq tier</span>
          </div>
        </div>

        {/* Memory Recall */}
        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
          <span className="text-xs text-slate-400 font-medium">RAG Memory Recall</span>
          <div className="mt-2 flex items-baseline justify-between">
            <span className="text-2xl font-semibold text-purple-400">
              {stats?.memoryInjectionRate ?? 0}%
            </span>
            <span className="text-xs text-slate-500">pgvector</span>
          </div>
        </div>
      </div>

      {/* ─── Dispatch Input ─── */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-xl p-4 space-y-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            dispatch(prompt);
          }}
          className="flex gap-2"
        >
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Type a request (e.g. 'Draft a welcome email', 'Research AI agents', 'Schedule 30m sync Friday')..."
            disabled={isSubmitting}
            className="flex-1 bg-slate-950 border border-slate-700/80 rounded-lg px-3.5 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 transition"
          />
          <button
            type="submit"
            disabled={isSubmitting || !prompt.trim()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white text-sm font-medium rounded-lg flex items-center gap-1.5 transition shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            {isSubmitting ? 'Routing...' : 'Send'}
          </button>
        </form>

        <div className="flex items-center gap-2 flex-wrap text-xs text-slate-400">
          <span className="text-slate-500">Presets:</span>
          {[
            {
              label: 'Draft Email',
              text: 'Draft a partnership outreach email to Acme Corp proposing a joint AI webinar',
            },
            {
              label: 'Research Market',
              text: 'Research latest enterprise AI agent pricing models and summarize findings',
            },
            {
              label: 'Schedule Meeting',
              text: 'Schedule a 30-minute sync with the Product Lead next Friday at 3 PM',
            },
          ].map(({ label, text }) => (
            <button
              key={label}
              onClick={() => dispatch(text)}
              disabled={isSubmitting}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition text-xs border border-slate-700/60"
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ─── Feed Section ─── */}
      <div className="space-y-3">
        {/* Header & Filter Bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-white">Operations Feed</h2>
            <span className="flex items-center gap-1 text-[11px] text-slate-400 bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-700">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isConnected ? 'bg-emerald-400' : 'bg-slate-500'
                }`}
              />
              {isConnected ? 'Live' : 'Syncing'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs">
              {[
                { id: 'all', label: 'All' },
                { id: 'drafting', label: 'Drafting' },
                { id: 'research', label: 'Research' },
                { id: 'scheduling', label: 'Scheduling' },
              ].map((t) => (
                <button
                  key={t.id}
                  onClick={() => setFilter(t.id)}
                  className={`px-2.5 py-1 rounded-md transition ${
                    filter === t.id
                      ? 'bg-slate-800 text-white font-medium shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <button
              onClick={fetchData}
              className="p-1.5 text-slate-400 hover:text-white bg-slate-900 border border-slate-800 rounded-lg transition"
              title="Refresh"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* List of Cards */}
        {filtered.length === 0 ? (
          <div className="text-center py-12 bg-slate-900/30 border border-slate-800 rounded-xl text-slate-400 text-sm">
            No tasks found. Send one above to get started.
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((item) => {
              const statusConfig = {
                approved: {
                  label: 'Approved',
                  color: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80',
                  icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
                },
                edited: {
                  label: 'Edited & Approved',
                  color: 'bg-blue-950/60 text-blue-300 border-blue-800/80',
                  icon: <Edit3 className="w-3.5 h-3.5 text-blue-400" />,
                },
                rejected: {
                  label: 'Rejected',
                  color: 'bg-rose-950/60 text-rose-300 border-rose-800/80',
                  icon: <XCircle className="w-3.5 h-3.5 text-rose-400" />,
                },
                pending: {
                  label: 'Pending Slack Review',
                  color: 'bg-amber-950/60 text-amber-300 border-amber-800/80',
                  icon: <Clock className="w-3.5 h-3.5 text-amber-400" />,
                },
              }[item.approvalStatus] || {
                label: item.approvalStatus,
                color: 'bg-slate-800 text-slate-300 border-slate-700',
                icon: null,
              };

              const agentLabel =
                item.targetAgent === 'research'
                  ? 'Research'
                  : item.targetAgent === 'scheduling'
                  ? 'Scheduling'
                  : 'Drafting';

              return (
                <div
                  key={item.requestId}
                  className="bg-slate-900/40 hover:bg-slate-900/70 border border-slate-800/80 hover:border-slate-700 rounded-xl p-4 transition space-y-2.5"
                >
                  {/* Card Header: Agent + Meta Badges + Status + Timestamp */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-800 text-slate-200 border border-slate-700">
                        {agentLabel}
                      </span>
                      {item.hasMemoryInjected && (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-purple-950/60 text-purple-300 border border-purple-800/60 flex items-center gap-1">
                          <Brain className="w-3 h-3" /> Memory
                        </span>
                      )}
                      {item.sources && item.sources.length > 0 && (
                        <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-cyan-950/60 text-cyan-300 border border-cyan-800/60 flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" /> {item.sources.length} sources
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full border flex items-center gap-1.5 font-medium ${statusConfig.color}`}
                      >
                        {statusConfig.icon}
                        {statusConfig.label}
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono">
                        {new Date(item.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  </div>

                  {/* Task Request Text */}
                  <p className="text-sm font-medium text-slate-200">{item.requestText}</p>

                  {/* Clean Deliverable Preview */}
                  <div className="text-xs text-slate-300 bg-slate-950/70 border border-slate-800/90 rounded-lg p-2.5 font-mono line-clamp-2 leading-relaxed">
                    {item.editedContent || item.agentOutput}
                  </div>

                  {/* Card Footer: Cost + View Trace */}
                  <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-800/40">
                    <div className="flex items-center gap-3 text-slate-400">
                      <span>
                        Cost: <span className="text-emerald-400 font-mono font-medium">${item.totalCostEstimate?.toFixed(5)}</span>
                      </span>
                      <span>•</span>
                      <span>{item.tokens?.total?.toLocaleString()} tokens</span>
                    </div>

                    <Link
                      href={`/request/${item.requestId}`}
                      className="text-xs text-indigo-400 hover:text-indigo-300 font-medium flex items-center gap-1 transition"
                    >
                      Trace Details <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
