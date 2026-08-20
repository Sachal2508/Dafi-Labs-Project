import { Module } from '@nestjs/common';
import { AgentsModule } from '../agents/agents.module';
import { ApprovalModule } from '../approval/approval.module';
import { LlmModule } from '../llm/llm.module';
import { SupervisorService } from './supervisor.service';

@Module({
  imports: [LlmModule, AgentsModule, ApprovalModule],
  providers: [SupervisorService],
  exports: [SupervisorService],
})
export class SupervisorModule {}
