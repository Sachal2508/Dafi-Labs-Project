import { ModelTier } from '../../llm/llm.service';

export interface RouteDecisionDto {
  intent: 'drafting' | 'research' | 'scheduling';
  complexity: 'low' | 'high';
  confidence: number;
  targetAgent: 'drafting' | 'research' | 'scheduling';
  recommendedTier: ModelTier;
  reasoning: string;
  routingModelUsed: string;
  routingCostEstimate: number;
}
