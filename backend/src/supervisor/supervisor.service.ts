import { Injectable, Logger } from '@nestjs/common';
import { DraftingAgent } from '../agents/drafting.agent';
import { ResearchAgent } from '../agents/research.agent';
import { SchedulingAgent } from '../agents/scheduling.agent';
import { AgentExecutionResult } from '../agents/base-agent.interface';
import { ApprovalService } from '../approval/approval.service';
import { AuditService } from '../audit/audit.service';
import { LlmService, ModelTier } from '../llm/llm.service';
import { MemoryService } from '../memory/memory.service';
import { RouteDecisionDto } from './dto/route-decision.dto';

export interface ProcessedRequestResult {
  requestId: string;
  approvalId?: string;
  requestText: string;
  source: string;
  routing: RouteDecisionDto;
  agentResult: AgentExecutionResult;
  totalCostEstimate: number;
  totalTokens: {
    promptTokens: number;
    completionTokens: number;
    total: number;
  };
  status: 'pending_approval' | 'completed';
  retrievedMemories?: {
    count: number;
    snippets: string[];
  };
  slackDelivery?: {
    channel: string;
    ts?: string;
  };
  createdAt: string;
}

@Injectable()
export class SupervisorService {
  private readonly logger = new Logger(SupervisorService.name);

  constructor(
    private readonly llmService: LlmService,
    private readonly draftingAgent: DraftingAgent,
    private readonly researchAgent: ResearchAgent,
    private readonly schedulingAgent: SchedulingAgent,
    private readonly approvalService: ApprovalService,
    private readonly memoryService: MemoryService,
    private readonly auditService: AuditService,
  ) {}

  /**
   * Classify request intent, retrieve RAG memory, execute agent, log audit trace, and dispatch for Slack HITL approval
   */
  async processRequest(
    requestId: string,
    text: string,
    source = 'api',
  ): Promise<ProcessedRequestResult> {
    this.logger.log(`[Supervisor] Ingesting request ${requestId}: "${text.slice(0, 70)}..."`);

    // 1. Retrieve relevant past human decisions from vector RAG memory
    const similarMemories = await this.memoryService.retrieveSimilar(text, 3);
    const memorySnippets: string[] = similarMemories.map(
      (m) =>
        `[PAST HUMAN DECISION - ${m.decision.toUpperCase()}] Request: "${m.requestText}"\nHuman Accepted Output: "${m.editedContent || m.output}"`,
    );

    if (memorySnippets.length > 0) {
      this.logger.log(`[Supervisor RAG] Injected ${memorySnippets.length} past human decisions into prompt context`);
    }

    // 2. Classification using cheap model (Groq / Llama-3)
    const routingDecision = await this.classifyRequest(text);

    // 3. Dispatch to designated sub-agent with memory context
    let agentResult: AgentExecutionResult;
    const executionContext = {
      requestId,
      source,
      complexity: routingDecision.complexity,
      memorySnippets,
    };

    switch (routingDecision.targetAgent) {
      case 'research':
        agentResult = await this.researchAgent.execute(text, executionContext);
        break;
      case 'scheduling':
        agentResult = await this.schedulingAgent.execute(text, executionContext);
        break;
      case 'drafting':
      default:
        agentResult = await this.draftingAgent.execute(text, executionContext);
        break;
    }

    const totalCost = Number(
      (routingDecision.routingCostEstimate + agentResult.costEstimate).toFixed(6),
    );

    const totalTokens = {
      promptTokens: agentResult.tokenCount.promptTokens,
      completionTokens: agentResult.tokenCount.completionTokens,
      total: agentResult.tokenCount.totalTokens,
    };

    // 4. Log to Audit Log and broadcast live SSE stream event
    await this.auditService.logRequest({
      requestId,
      requestText: text,
      source,
      intent: routingDecision.intent,
      targetAgent: agentResult.agentName,
      modelUsed: agentResult.modelUsed,
      modelTierUsed: agentResult.tierUsed,
      tokens: totalTokens,
      totalCostEstimate: totalCost,
      hasMemoryInjected: memorySnippets.length > 0,
      retrievedMemoriesCount: memorySnippets.length,
      memorySnippets,
      agentOutput: agentResult.output,
      approvalStatus: 'pending',
      sources: agentResult.metadata?.sources,
      mockEvent: agentResult.metadata?.mockEvent,
    });

    // 5. Post for Slack Human-in-the-Loop approval
    const approvalRecord = await this.approvalService.postForApproval(
      requestId,
      agentResult.output,
      text,
      {
        agentName: agentResult.agentName,
        tier: agentResult.tierUsed,
        model: agentResult.modelUsed,
        cost: totalCost,
        hasMemoryInjected: memorySnippets.length > 0,
      },
    );

    return {
      requestId,
      approvalId: approvalRecord.id,
      requestText: text,
      source,
      routing: routingDecision,
      agentResult,
      totalCostEstimate: totalCost,
      totalTokens,
      status: 'pending_approval',
      retrievedMemories: {
        count: memorySnippets.length,
        snippets: memorySnippets,
      },
      slackDelivery: {
        channel: approvalRecord.slackChannel || 'operations-approvals',
        ts: approvalRecord.slackMessageTs,
      },
      createdAt: new Date().toISOString(),
    };
  }

  private async classifyRequest(text: string): Promise<RouteDecisionDto> {
    const systemPrompt = `You are the OpsAgent Supervisor. Analyze incoming operations requests and output JSON ONLY with:
- "intent": one of ["drafting", "research", "scheduling"]
- "complexity": "low" (straightforward task) or "high" (complex reasoning, ambiguity, edge cases)
- "confidence": number between 0.0 and 1.0
- "targetAgent": one of ["drafting", "research", "scheduling"]
- "recommendedTier": "cheap" (simple/formulaic) or "strong" (nuanced/multi-step)
- "reasoning": 1 sentence explaining the routing rationale`;

    const prompt = `Classify this operations request:\n"${text}"`;

    const completion = await this.llmService.complete(prompt, 'cheap', {
      systemPrompt,
      temperature: 0.1,
      jsonMode: true,
    });

    try {
      let cleaned = completion.content.trim();
      if (cleaned.startsWith('```')) {
        cleaned = cleaned.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }

      const parsed = JSON.parse(cleaned);
      const targetAgent = ['drafting', 'research', 'scheduling'].includes(parsed.targetAgent)
        ? parsed.targetAgent
        : 'drafting';
      const complexity = parsed.complexity === 'high' ? 'high' : 'low';
      const recommendedTier: ModelTier = parsed.recommendedTier === 'strong' ? 'strong' : 'cheap';

      return {
        intent: targetAgent,
        complexity,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.95,
        targetAgent,
        recommendedTier,
        reasoning: parsed.reasoning || 'Classified based on operational keyword analysis',
        routingModelUsed: completion.model,
        routingCostEstimate: completion.costEstimate,
      };
    } catch (parseErr) {
      this.logger.warn(`Could not parse JSON classification, using heuristic fallback`);
      return {
        intent: 'drafting',
        complexity: 'low',
        confidence: 0.9,
        targetAgent: 'drafting',
        recommendedTier: 'cheap',
        reasoning: 'Heuristic routing default to drafting agent',
        routingModelUsed: completion.model,
        routingCostEstimate: completion.costEstimate,
      };
    }
  }
}
