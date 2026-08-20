import React from 'react';
import { Mail, Search, Calendar, Cpu, Zap } from 'lucide-react';

interface RoutingBadgeProps {
  agent: string;
  tier: 'cheap' | 'strong';
  model?: string;
}

export const RoutingBadge: React.FC<RoutingBadgeProps> = ({ agent, tier, model }) => {
  const getAgentConfig = (agentName: string) => {
    switch (agentName.toLowerCase()) {
      case 'research':
        return {
          icon: <Search className="w-3.5 h-3.5 text-blue-400" />,
          label: 'Research Agent',
          bg: 'bg-blue-950/60 border-blue-800/60 text-blue-300',
        };
      case 'scheduling':
        return {
          icon: <Calendar className="w-3.5 h-3.5 text-purple-400" />,
          label: 'Scheduling Agent',
          bg: 'bg-purple-950/60 border-purple-800/60 text-purple-300',
        };
      case 'drafting':
      default:
        return {
          icon: <Mail className="w-3.5 h-3.5 text-emerald-400" />,
          label: 'Drafting Agent',
          bg: 'bg-emerald-950/60 border-emerald-800/60 text-emerald-300',
        };
    }
  };

  const agentConfig = getAgentConfig(agent);

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border ${agentConfig.bg}`}>
        {agentConfig.icon}
        {agentConfig.label}
      </span>

      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono border ${
          tier === 'cheap'
            ? 'bg-amber-950/50 border-amber-800/50 text-amber-300'
            : 'bg-indigo-950/50 border-indigo-800/50 text-indigo-300'
        }`}
        title={model || (tier === 'cheap' ? 'Groq Llama-3' : 'Groq Strong 120B / GPT-4o')}
      >
        {tier === 'cheap' ? (
          <Zap className="w-3 h-3 text-amber-400 fill-amber-400/20" />
        ) : (
          <Cpu className="w-3 h-3 text-indigo-400" />
        )}
        {tier.toUpperCase()} TIER
      </span>
    </div>
  );
};
