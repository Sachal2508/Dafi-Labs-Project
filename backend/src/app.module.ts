import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AgentsModule } from './agents/agents.module';
import { ApprovalModule } from './approval/approval.module';
import { AuditModule } from './audit/audit.module';
import { validate } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { IntakeModule } from './intake/intake.module';
import { LlmModule } from './llm/llm.module';
import { MemoryModule } from './memory/memory.module';
import { SupervisorModule } from './supervisor/supervisor.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate,
    }),
    DatabaseModule,
    MemoryModule,
    AuditModule,
    LlmModule,
    AgentsModule,
    ApprovalModule,
    SupervisorModule,
    IntakeModule,
  ],
})
export class AppModule {}
