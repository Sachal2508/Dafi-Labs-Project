export interface MemoryEntry {
  id: string;
  requestId: string;
  requestText: string;
  agentUsed: string;
  output: string;
  decision: 'approved' | 'edited' | 'rejected';
  editedContent?: string | null;
  embedding?: number[]; // 384-dimensional vector
  createdAt: string;
  similarity?: number;
}
