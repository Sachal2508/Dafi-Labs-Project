import { ModelTier } from '../llm/llm.service';

export interface AgentExecutionResult {
  agentName: 'drafting' | 'research' | 'scheduling';
  output: string;
  modelUsed: string;
  tierUsed: ModelTier;
  tokenCount: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  costEstimate: number;
  metadata?: Record<string, any>;
}

export interface AgentExecutionContext {
  requestId: string;
  source?: string;
  complexity?: 'low' | 'high';
  memorySnippets?: string[];
  userPreferences?: Record<string, any>;
}

export interface BaseAgent {
  readonly name: 'drafting' | 'research' | 'scheduling';
  execute(text: string, context?: AgentExecutionContext): Promise<AgentExecutionResult>;
}
