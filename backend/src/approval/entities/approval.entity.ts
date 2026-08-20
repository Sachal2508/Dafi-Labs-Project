export type ApprovalStatus = 'pending' | 'approved' | 'edited' | 'rejected';

export interface ApprovalRecord {
  id: string;
  requestId: string;
  requestText: string;
  draftContent: string;
  slackMessageTs?: string;
  slackChannel?: string;
  status: ApprovalStatus;
  editedContent?: string | null;
  decidedBy?: string | null;
  decidedAt?: string | null;
  createdAt: string;
  metadata?: Record<string, any>;
}
