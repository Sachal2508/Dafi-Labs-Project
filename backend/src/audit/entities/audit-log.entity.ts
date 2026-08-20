export interface AuditLogRecord {
  id: string;
  requestId: string;
  requestText: string;
  source: string;
  intent: 'drafting' | 'research' | 'scheduling';
  targetAgent: string;
  modelUsed: string;
  modelTierUsed: 'cheap' | 'strong';
  tokens: {
    promptTokens: number;
    completionTokens: number;
    total: number;
  };
  totalCostEstimate: number;
  strongModelCostEstimate: number; // For ROI & cost savings analytics
  hasMemoryInjected: boolean;
  retrievedMemoriesCount: number;
  memorySnippets?: string[];
  agentOutput: string;
  approvalStatus: 'pending' | 'approved' | 'edited' | 'rejected';
  decidedBy?: string | null;
  decidedAt?: string | null;
  editedContent?: string | null;
  sources?: Array<{ title: string; url: string; snippet?: string }> | null;
  mockEvent?: any | null;
  slackDelivery?: {
    channel: string;
    ts?: string;
  } | null;
  createdAt: string;
}
