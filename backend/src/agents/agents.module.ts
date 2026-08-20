import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { DraftingAgent } from './drafting.agent';
import { ResearchAgent } from './research.agent';
import { SchedulingAgent } from './scheduling.agent';

@Module({
  imports: [LlmModule],
  providers: [DraftingAgent, ResearchAgent, SchedulingAgent],
  exports: [DraftingAgent, ResearchAgent, SchedulingAgent],
})
export class AgentsModule {}
