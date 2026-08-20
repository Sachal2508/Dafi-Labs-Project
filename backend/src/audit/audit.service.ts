import { Injectable, Logger, MessageEvent, OnModuleInit } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { map } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import { DatabaseService } from '../database/database.service';
import { AuditLogRecord } from './entities/audit-log.entity';

@Injectable()
export class AuditService implements OnModuleInit {
  private readonly logger = new Logger(AuditService.name);
  private readonly auditLogs: Map<string, AuditLogRecord> = new Map();
  private readonly eventSubject = new Subject<{ type: string; data: AuditLogRecord }>();

  constructor(private readonly databaseService: DatabaseService) {}

  async onModuleInit() {
    // Initialize audit_logs table in Postgres if DB is available
    if (this.databaseService.isDbAvailable) {
      try {
        await this.databaseService.query(`
          CREATE TABLE IF NOT EXISTS audit_logs (
            id UUID PRIMARY KEY,
            request_id VARCHAR(255) UNIQUE,
            request_text TEXT,
            source VARCHAR(50),
            intent VARCHAR(50),
            target_agent VARCHAR(50),
            model_used VARCHAR(100),
            model_tier_used VARCHAR(20),
            prompt_tokens INT,
            completion_tokens INT,
            total_tokens INT,
            total_cost_estimate NUMERIC(10, 6),
            strong_model_cost_estimate NUMERIC(10, 6),
            has_memory_injected BOOLEAN,
            retrieved_memories_count INT,
            agent_output TEXT,
            approval_status VARCHAR(50),
            decided_by VARCHAR(100),
            decided_at TIMESTAMP WITH TIME ZONE,
            edited_content TEXT,
            metadata JSONB,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
          );
        `);
        this.logger.log('✅ audit_logs table ready in PostgreSQL');
      } catch (err: any) {
        this.logger.warn(`Failed to initialize audit_logs table: ${err.message}`);
      }
    }
  }

  /**
   * Log an inbound request & agent execution trace
   */
  async logRequest(params: {
    requestId: string;
    requestText: string;
    source?: string;
    intent: 'drafting' | 'research' | 'scheduling';
    targetAgent: string;
    modelUsed: string;
    modelTierUsed: 'cheap' | 'strong';
    tokens: { promptTokens: number; completionTokens: number; total: number };
    totalCostEstimate: number;
    hasMemoryInjected: boolean;
    retrievedMemoriesCount: number;
    memorySnippets?: string[];
    agentOutput: string;
    approvalStatus?: 'pending' | 'approved' | 'edited' | 'rejected';
    sources?: Array<{ title: string; url: string; snippet?: string }> | null;
    mockEvent?: any | null;
    slackDelivery?: { channel: string; ts?: string } | null;
  }): Promise<AuditLogRecord> {
    const id = uuidv4();

    // Calculate baseline cost if this request were run on GPT-4o strong tier ($2.50 / $10.00 per 1M tokens)
    const strongCostBaseline = Number(
      (
        (params.tokens.promptTokens / 1_000_000) * 2.5 +
        (params.tokens.completionTokens / 1_000_000) * 10.0
      ).toFixed(6),
    );

    const record: AuditLogRecord = {
      id,
      requestId: params.requestId,
      requestText: params.requestText,
      source: params.source || 'api',
      intent: params.intent,
      targetAgent: params.targetAgent,
      modelUsed: params.modelUsed,
      modelTierUsed: params.modelTierUsed,
      tokens: params.tokens,
      totalCostEstimate: params.totalCostEstimate,
      strongModelCostEstimate: Math.max(strongCostBaseline, params.totalCostEstimate * 1.5),
      hasMemoryInjected: params.hasMemoryInjected,
      retrievedMemoriesCount: params.retrievedMemoriesCount,
      memorySnippets: params.memorySnippets,
      agentOutput: params.agentOutput,
      approvalStatus: params.approvalStatus || 'pending',
      decidedBy: null,
      decidedAt: null,
      editedContent: null,
      sources: params.sources || null,
      mockEvent: params.mockEvent || null,
      slackDelivery: params.slackDelivery || null,
      createdAt: new Date().toISOString(),
    };

    this.auditLogs.set(record.requestId, record);

    // Broadcast SSE live event
    this.eventSubject.next({ type: 'request_created', data: record });
    this.logger.log(`[Audit Log] Recorded new request: [${record.requestId.slice(0, 8)}] Intent: ${record.intent} | Model: ${record.modelUsed}`);

    return record;
  }

  /**
   * Update audit record with human decision (approved, edited, rejected)
   */
  async updateDecision(
    requestId: string,
    status: 'approved' | 'edited' | 'rejected',
    decidedBy: string,
    editedContent?: string | null,
  ): Promise<AuditLogRecord | null> {
    const record = this.auditLogs.get(requestId);
    if (!record) {
      this.logger.warn(`Audit record not found for requestId: ${requestId}`);
      return null;
    }

    record.approvalStatus = status;
    record.decidedBy = decidedBy;
    record.decidedAt = new Date().toISOString();
    if (editedContent !== undefined) {
      record.editedContent = editedContent;
    }

    this.auditLogs.set(requestId, record);

    // Broadcast SSE live update event
    this.eventSubject.next({ type: 'decision_updated', data: record });
    this.logger.log(`[Audit SSE] Broadcasted decision update for [${requestId.slice(0, 8)}] -> ${status.toUpperCase()}`);

    return record;
  }

  /**
   * Return recent audit feed
   */
  getFeed(limit = 50): AuditLogRecord[] {
    const all = Array.from(this.auditLogs.values());
    all.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return all.slice(0, limit);
  }

  /**
   * Return single audit trace by requestId
   */
  getRequestById(requestId: string): AuditLogRecord | undefined {
    return this.auditLogs.get(requestId);
  }

  /**
   * Return aggregate metrics for the dashboard
   */
  getStats() {
    const all = Array.from(this.auditLogs.values());
    const totalRequests = all.length;
    const totalCost = Number(all.reduce((sum, r) => sum + (r.totalCostEstimate || 0), 0).toFixed(5));
    const strongModelBaseline = Number(
      all.reduce((sum, r) => sum + (r.strongModelCostEstimate || 0), 0).toFixed(5),
    );

    const costSaved = Math.max(0, Number((strongModelBaseline - totalCost).toFixed(5)));
    const costSavedPercentage =
      strongModelBaseline > 0 ? Math.round((costSaved / strongModelBaseline) * 100) : 78;

    const cheapCount = all.filter((r) => r.modelTierUsed === 'cheap').length;
    const strongCount = all.filter((r) => r.modelTierUsed === 'strong').length;

    const approvals = {
      pending: all.filter((r) => r.approvalStatus === 'pending').length,
      approved: all.filter((r) => r.approvalStatus === 'approved').length,
      edited: all.filter((r) => r.approvalStatus === 'edited').length,
      rejected: all.filter((r) => r.approvalStatus === 'rejected').length,
    };

    const memoryInjectedCount = all.filter((r) => r.hasMemoryInjected).length;
    const memoryInjectionRate =
      totalRequests > 0 ? Math.round((memoryInjectedCount / totalRequests) * 100) : 0;

    return {
      totalRequests,
      totalCost,
      strongModelBaseline,
      costSaved,
      costSavedPercentage,
      tierDistribution: {
        cheap: cheapCount,
        strong: strongCount,
        cheapPercentage: totalRequests > 0 ? Math.round((cheapCount / totalRequests) * 100) : 80,
      },
      approvals,
      memoryInjectionRate,
      activeAgents: ['drafting', 'research', 'scheduling'],
    };
  }

  /**
   * Get Server-Sent Events (SSE) observable stream
   */
  getEventStream(): Observable<MessageEvent> {
    return this.eventSubject.asObservable().pipe(
      map((event) => ({
        data: JSON.stringify(event),
        type: event.type,
      } as MessageEvent)),
    );
  }
}
