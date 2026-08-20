'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  Brain,
  CheckCircle2,
  Clock,
  Edit3,
  ExternalLink,
  Search,
  Mail,
  Calendar,
  User,
  XCircle,
  Zap,
  Cpu,
  Layers,
} from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

export default function RequestTracePage() {
  const params = useParams();
  const requestId = params?.id as string;
  const [record, setRecord] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!requestId) return;
    fetch(`${API_BASE}/audit/requests/${requestId}`)
      .then((r) => r.json())
      .then(setRecord)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [requestId]);

  if (loading) {
    return (
      <div className="flex justify-center py-20 text-sm text-slate-400">
        Loading execution trace...
      </div>
    );
  }

  if (!record || record.error) {
    return (
      <div className="text-center py-16 space-y-3">
        <p className="text-slate-300 font-medium">Trace not found</p>
        <Link href="/" className="text-xs text-indigo-400 hover:underline">
          ← Back to Feed
        </Link>
      </div>
    );
  }

  const statusConfig = {
    approved: {
      label: 'Approved',
      badge: 'bg-emerald-950/70 border-emerald-800 text-emerald-300',
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-400" />,
    },
    edited: {
      label: 'Edited & Approved',
      badge: 'bg-blue-950/70 border-blue-800 text-blue-300',
      icon: <Edit3 className="w-4 h-4 text-blue-400" />,
    },
    rejected: {
      label: 'Rejected',
      badge: 'bg-rose-950/70 border-rose-800 text-rose-300',
      icon: <XCircle className="w-4 h-4 text-rose-400" />,
    },
    pending: {
      label: 'Pending Human Review',
      badge: 'bg-amber-950/70 border-amber-800 text-amber-300',
      icon: <Clock className="w-4 h-4 text-amber-400" />,
    },
  }[record.approvalStatus] || {
    label: record.approvalStatus,
    badge: 'bg-slate-800 border-slate-700 text-slate-300',
    icon: null,
  };

  const agentName =
    record.targetAgent === 'research'
      ? 'Research Agent'
      : record.targetAgent === 'scheduling'
      ? 'Scheduling Agent'
      : 'Drafting Agent';

  return (
    <div className="space-y-5">
      {/* Back button */}
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Live Feed
        </Link>
      </div>

      {/* Header Card */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <span className="text-[11px] font-mono text-slate-500 uppercase">Request Trace</span>
            <h1 className="text-base font-semibold text-white">"{record.requestText}"</h1>
            <p className="text-xs text-slate-400">
              {new Date(record.createdAt).toLocaleString()} • ID: <span className="font-mono text-slate-500">{record.requestId.slice(0, 8)}</span>
            </p>
          </div>

          <div className={`px-3 py-1.5 rounded-lg border flex items-center gap-2 text-xs font-medium ${statusConfig.badge}`}>
            {statusConfig.icon}
            {statusConfig.label}
          </div>
        </div>

        {/* Quick Meta Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-800/80 text-xs">
          <div>
            <span className="text-slate-500">Agent:</span>
            <p className="font-medium text-slate-200">{agentName}</p>
          </div>
          <div>
            <span className="text-slate-500">Model:</span>
            <p className="font-medium text-slate-200 font-mono text-[11px]">{record.modelUsed}</p>
          </div>
          <div>
            <span className="text-slate-500">Actual Cost:</span>
            <p className="font-medium text-emerald-400 font-mono">${record.totalCostEstimate?.toFixed(5)}</p>
          </div>
          <div>
            <span className="text-slate-500">GPT-4o Baseline:</span>
            <p className="font-medium text-slate-400 font-mono">${record.strongModelCostEstimate?.toFixed(5)}</p>
          </div>
        </div>
      </div>

      {/* RAG Memory Injected */}
      {record.hasMemoryInjected && record.memorySnippets?.length > 0 && (
        <div className="bg-slate-900/40 border border-purple-900/40 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-purple-300">
            <Brain className="w-3.5 h-3.5" /> Past Memory Context Injected ({record.memorySnippets.length})
          </div>
          <div className="space-y-1.5">
            {record.memorySnippets.map((snippet: string, i: number) => (
              <div key={i} className="text-xs text-slate-300 bg-slate-950/60 border border-slate-800/80 rounded-lg p-2.5 font-mono">
                {snippet}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Web Sources (If Research Agent) */}
      {record.sources && record.sources.length > 0 && (
        <div className="bg-slate-900/40 border border-cyan-900/40 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-cyan-300">
            <Search className="w-3.5 h-3.5" /> Cited Sources ({record.sources.length})
          </div>
          <div className="space-y-1">
            {record.sources.map((src: any, i: number) => (
              <a
                key={i}
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-cyan-400 hover:underline"
              >
                <ExternalLink className="w-3 h-3 shrink-0" />
                <span className="truncate">{src.title || src.url}</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Calendar Details (If Scheduling Agent) */}
      {record.mockEvent && (
        <div className="bg-slate-900/40 border border-purple-900/40 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-purple-300">
            <Calendar className="w-3.5 h-3.5" /> Calendar Event Data
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-300 bg-slate-950/60 p-3 rounded-lg border border-slate-800/80">
            <div><span className="text-slate-500">Title:</span> {record.mockEvent.title}</div>
            <div><span className="text-slate-500">Date/Time:</span> {record.mockEvent.proposedDateTime}</div>
            <div><span className="text-slate-500">Duration:</span> {record.mockEvent.durationMinutes} min</div>
            <div><span className="text-slate-500">Location:</span> {record.mockEvent.location}</div>
          </div>
        </div>
      )}

      {/* AI Deliverable Output */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 space-y-2">
        <span className="text-xs font-semibold text-slate-300">AI Generated Deliverable</span>
        <div className="bg-slate-950 border border-slate-800/90 rounded-lg p-4 text-xs text-slate-200 font-mono whitespace-pre-wrap leading-relaxed">
          {record.agentOutput}
        </div>
      </div>

      {/* Slack Human Decision Outcome */}
      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-300">Human Decision in Slack</span>
          {record.decidedBy && (
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-slate-500" /> @{record.decidedBy}
            </span>
          )}
        </div>

        {record.editedContent ? (
          <div className="space-y-1.5">
            <span className="text-[11px] text-blue-400 font-medium">Human-Edited Final Content:</span>
            <div className="bg-blue-950/20 border border-blue-900/50 rounded-lg p-3 text-xs text-slate-200 font-mono whitespace-pre-wrap">
              {record.editedContent}
            </div>
          </div>
        ) : record.approvalStatus === 'approved' ? (
          <p className="text-xs text-emerald-400 font-medium">
            ✓ Approved without edits. Decision saved to pgvector memory.
          </p>
        ) : record.approvalStatus === 'rejected' ? (
          <p className="text-xs text-rose-400 font-medium">
            ✗ Rejected by operator. Not sent.
          </p>
        ) : (
          <p className="text-xs text-amber-400 font-medium">
            ⏳ Waiting for operator to click Approve, Edit, or Reject in Slack.
          </p>
        )}
      </div>
    </div>
  );
}
