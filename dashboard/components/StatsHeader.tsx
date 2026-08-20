import React from 'react';
import { Activity, DollarSign, TrendingDown, Brain, CheckCircle, Clock } from 'lucide-react';

interface StatsProps {
  stats: {
    totalRequests: number;
    totalCost: number;
    strongModelBaseline: number;
    costSaved: number;
    costSavedPercentage: number;
    tierDistribution?: {
      cheap: number;
      strong: number;
      cheapPercentage: number;
    };
    approvals?: {
      pending: number;
      approved: number;
      edited: number;
      rejected: number;
    };
    memoryInjectionRate: number;
  } | null;
  isConnected: boolean;
}

export const StatsHeader: React.FC<StatsProps> = ({ stats, isConnected }) => {
  const total = stats?.totalRequests || 0;
  const cost = stats?.totalCost || 0;
  const saved = stats?.costSaved || 0;
  const savedPercent = stats?.costSavedPercentage || 0;
  const memoryRate = stats?.memoryInjectionRate || 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {/* 1. Total Requests & Realtime Status */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Inbound Tasks</span>
          <div className="flex items-center gap-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`}
            />
            <span className="text-[11px] font-mono text-slate-400">
              {isConnected ? 'LIVE SSE' : 'CONNECTING'}
            </span>
          </div>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-bold font-mono text-slate-100">{total}</span>
          <span className="text-xs text-slate-400 font-medium">requests routed</span>
        </div>
        <div className="mt-2 text-xs text-slate-500 flex items-center gap-2">
          <span className="text-emerald-400 font-medium">{stats?.approvals?.approved || 0} Approved</span>
          <span>·</span>
          <span className="text-amber-400 font-medium">{stats?.approvals?.pending || 0} Pending</span>
        </div>
      </div>

      {/* 2. Total Cost */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Model Spend</span>
          <DollarSign className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="mt-3 flex items-baseline gap-1">
          <span className="text-3xl font-bold font-mono text-emerald-400">${cost.toFixed(4)}</span>
          <span className="text-xs text-slate-400 font-mono">USD</span>
        </div>
        <div className="mt-2 text-xs text-slate-400">
          Cheap Tier Rate: <span className="font-mono text-amber-300 font-semibold">{stats?.tierDistribution?.cheapPercentage || 80}%</span> of calls
        </div>
      </div>

      {/* 3. Cost Saved by Tier Routing */}
      <div className="bg-gradient-to-br from-indigo-950/40 via-slate-900/60 to-slate-900/60 border border-indigo-900/40 rounded-xl p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-indigo-300">Cost Savings vs. GPT-4o</span>
          <TrendingDown className="w-4 h-4 text-indigo-400" />
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-bold font-mono text-indigo-300">${saved.toFixed(4)}</span>
          <span className="text-xs bg-indigo-900/60 text-indigo-200 font-bold px-2 py-0.5 rounded-full">
            {savedPercent}% Saved
          </span>
        </div>
        <div className="mt-2 text-xs text-slate-400">
          Baseline if all strong: <span className="font-mono text-slate-300">${(stats?.strongModelBaseline || 0).toFixed(4)}</span>
        </div>
      </div>

      {/* 4. RAG Memory Injection Rate */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">RAG Feedback Loop</span>
          <Brain className="w-4 h-4 text-purple-400" />
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-bold font-mono text-purple-300">{memoryRate}%</span>
          <span className="text-xs text-slate-400">memory-augmented</span>
        </div>
        <div className="mt-2 text-xs text-slate-400">
          384-dim pgvector cosine similarity search
        </div>
      </div>
    </div>
  );
};
