import React from 'react';
import Link from 'next/link';
import { Clock, CheckCircle2, Edit3, XCircle, ArrowRight, Brain, Link2 } from 'lucide-react';
import { RoutingBadge } from './RoutingBadge';
import { CostChip } from './CostChip';

export interface AuditItem {
  id: string;
  requestId: string;
  requestText: string;
  source: string;
  intent: 'drafting' | 'research' | 'scheduling';
  targetAgent: string;
  modelUsed: string;
  modelTierUsed: 'cheap' | 'strong';
  tokens: { promptTokens: number; completionTokens: number; total: number };
  totalCostEstimate: number;
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

interface FeedItemProps {
  item: AuditItem;
  isNew?: boolean;
}

export const FeedItem: React.FC<FeedItemProps> = ({ item, isNew }) => {
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950/80 border border-emerald-800 text-emerald-300">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Approved
          </span>
        );
      case 'edited':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-950/80 border border-blue-800 text-blue-300">
            <Edit3 className="w-3.5 h-3.5" />
            Edited & Approved
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-950/80 border border-rose-800 text-rose-300">
            <XCircle className="w-3.5 h-3.5" />
            Rejected
          </span>
        );
      case 'pending':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-950/80 border border-amber-800 text-amber-300 animate-pulse-subtle">
            <Clock className="w-3.5 h-3.5" />
            Pending Approval
          </span>
        );
    }
  };

  const formattedTime = new Date(item.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div
      className={`group relative bg-slate-900/60 hover:bg-slate-900/90 border border-slate-800 hover:border-slate-700 rounded-xl p-5 transition-all duration-200 ${
        isNew ? 'animate-fade-in ring-1 ring-primary-500/40' : ''
      }`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left: Request info & badges */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            <RoutingBadge
              agent={item.targetAgent || item.intent}
              tier={item.modelTierUsed}
              model={item.modelUsed}
            />

            {item.hasMemoryInjected && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono bg-purple-950/60 border border-purple-800/60 text-purple-300">
                <Brain className="w-3 h-3 text-purple-400" />
                RAG Memory ({item.retrievedMemoriesCount || 1})
              </span>
            )}

            {item.sources && item.sources.length > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono bg-cyan-950/60 border border-cyan-800/60 text-cyan-300">
                <Link2 className="w-3 h-3 text-cyan-400" />
                {item.sources.length} Web Sources
              </span>
            )}

            <span className="text-xs text-slate-500 font-mono ml-auto lg:ml-0">{formattedTime}</span>
          </div>

          <p className="text-sm font-medium text-slate-200 line-clamp-2 leading-relaxed">
            "{item.requestText}"
          </p>

          <div className="mt-2.5 text-xs text-slate-400 line-clamp-1 font-mono bg-slate-950/50 px-2.5 py-1 rounded border border-slate-800/50">
            <span className="text-slate-500 select-none">Output: </span>
            {item.editedContent || item.agentOutput}
          </div>
        </div>

        {/* Right: Status, Cost & Action Link */}
        <div className="flex items-center justify-between lg:justify-end gap-3 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-800/60">
          <CostChip cost={item.totalCostEstimate} tokens={item.tokens?.total} />
          {getStatusBadge(item.approvalStatus)}
          
          <Link
            href={`/request/${item.requestId}`}
            className="p-2 rounded-lg bg-slate-800 hover:bg-primary-600/20 text-slate-400 hover:text-primary-400 transition-colors"
            title="View Full Execution Trace"
          >
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
};
