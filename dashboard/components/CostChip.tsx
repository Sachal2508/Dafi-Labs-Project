import React from 'react';
import { DollarSign } from 'lucide-react';

interface CostChipProps {
  cost: number;
  tokens?: number;
  showTokens?: boolean;
}

export const CostChip: React.FC<CostChipProps> = ({ cost, tokens, showTokens = true }) => {
  return (
    <div className="inline-flex items-center gap-1 font-mono text-xs text-slate-400 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800">
      <span className="text-emerald-400 font-semibold flex items-center">
        <DollarSign className="w-3 h-3 -mr-0.5" />
        {cost ? cost.toFixed(5) : '0.00000'}
      </span>
      {showTokens && tokens !== undefined && (
        <>
          <span className="text-slate-600">·</span>
          <span className="text-slate-400 text-[11px]">{tokens.toLocaleString()} tok</span>
        </>
      )}
    </div>
  );
};
