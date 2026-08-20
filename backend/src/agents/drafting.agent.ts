import { Injectable, Logger } from '@nestjs/common';
import { LlmService, ModelTier } from '../llm/llm.service';
import { AgentExecutionContext, AgentExecutionResult, BaseAgent } from './base-agent.interface';

@Injectable()
export class DraftingAgent implements BaseAgent {
  readonly name = 'drafting' as const;
  private readonly logger = new Logger(DraftingAgent.name);

  constructor(private readonly llmService: LlmService) {}

  async execute(text: string, context?: AgentExecutionContext): Promise<AgentExecutionResult> {
    this.logger.log(`Executing DraftingAgent for request: "${text.slice(0, 60)}..."`);

    const tier: ModelTier = context?.complexity === 'high' ? 'strong' : 'cheap';

    let systemPrompt = `You are OpsAgent's specialized Drafting Agent. 
Your role is to write clear, professional, and context-appropriate emails, memos, customer replies, and operational announcements.
Tone guidelines:
- Concise, polite, and actionable.
- Formatted with Subject line and clear paragraphs where applicable.
- Avoid unnecessary corporate fluff; focus on helpfulness and clarity.`;

    if (context?.memorySnippets && context.memorySnippets.length > 0) {
      systemPrompt += `\n\nPast approved human examples & preferences to follow:\n${context.memorySnippets.join('\n---\n')}`;
    }

    const prompt = `Please draft the required response/communication for this task request:\n\n"${text}"`;

    const completion = await this.llmService.complete(prompt, tier, {
      systemPrompt,
      temperature: 0.3,
    });

    return {
      agentName: this.name,
      output: completion.content,
      modelUsed: completion.model,
      tierUsed: completion.tier,
      tokenCount: completion.tokenCount,
      costEstimate: completion.costEstimate,
      metadata: {
        actionType: 'draft_created',
        hasMemoryInjected: Boolean(context?.memorySnippets?.length),
      },
    };
  }
}
