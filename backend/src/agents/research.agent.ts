import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { LlmService, ModelTier } from '../llm/llm.service';
import { AgentExecutionContext, AgentExecutionResult, BaseAgent } from './base-agent.interface';

@Injectable()
export class ResearchAgent implements BaseAgent {
  readonly name = 'research' as const;
  private readonly logger = new Logger(ResearchAgent.name);

  constructor(
    private readonly llmService: LlmService,
    private readonly configService: ConfigService,
  ) {}

  async execute(text: string, context?: AgentExecutionContext): Promise<AgentExecutionResult> {
    this.logger.log(`Executing ResearchAgent for request: "${text.slice(0, 60)}..."`);

    const tavilyKey = this.configService.get<string>('TAVILY_API_KEY');
    let searchResultsContext = '';
    let sources: Array<{ title: string; url: string; snippet?: string }> = [];

    // 1. Query Tavily Search API with query derived from request text
    if (tavilyKey) {
      try {
        const searchRes = await axios.post(
          'https://api.tavily.com/search',
          {
            api_key: tavilyKey,
            query: text,
            search_depth: 'advanced',
            include_answer: true,
            max_results: 5,
          },
          { timeout: 12000 },
        );

        const data = searchRes.data;
        if (data.results && data.results.length > 0) {
          sources = data.results.map((r: any) => ({
            title: r.title,
            url: r.url,
            snippet: r.content?.slice(0, 200),
          }));

          searchResultsContext = data.results
            .map(
              (r: any, i: number) =>
                `[Source ${i + 1}] Title: ${r.title}\nURL: ${r.url}\nExcerpt: ${r.content}`,
            )
            .join('\n\n');

          this.logger.log(`Tavily search retrieved ${data.results.length} live sources for: "${text.slice(0, 40)}"`);
        }
      } catch (err: any) {
        this.logger.warn(`Tavily search API error: ${err.message}. Synthesizing from available intelligence.`);
      }
    }

    // 2. Synthesize using Groq LLM (Strong tier)
    const tier: ModelTier = 'strong';

    let systemPrompt = `You are OpsAgent's specialized Executive Research Agent.
Your role is to synthesize real-time web search results into a concise, factual, and executive-ready research brief.
Formatting rules:
- Provide an Executive Summary.
- Detail the Top Findings with specific data points, statistics, and trends found in the search context.
- Cite the source titles and URLs directly where relevant.
- Do not output generic placeholder text; use only verified information from the context.`;

    if (context?.memorySnippets && context.memorySnippets.length > 0) {
      systemPrompt += `\n\nPast approved research guidelines & feedback:\n${context.memorySnippets.join('\n---\n')}`;
    }

    let prompt = `User Research Request:\n"${text}"`;
    if (searchResultsContext) {
      prompt += `\n\nVerified Live Web Search Context:\n${searchResultsContext}\n\nPlease synthesize the findings into a clear, structured executive summary with citations.`;
    }

    const completion = await this.llmService.complete(prompt, tier, {
      systemPrompt,
      temperature: 0.2,
    });

    return {
      agentName: this.name,
      output: completion.content,
      modelUsed: completion.model,
      tierUsed: completion.tier,
      tokenCount: completion.tokenCount,
      costEstimate: completion.costEstimate,
      metadata: {
        actionType: 'research_synthesized',
        sourcesCount: sources.length,
        sources,
        hasMemoryInjected: Boolean(context?.memorySnippets?.length),
      },
    };
  }
}
