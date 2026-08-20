import { Module } from '@nestjs/common';
import { SupervisorModule } from '../supervisor/supervisor.module';
import { IntakeController } from './intake.controller';
import { IntakeService } from './intake.service';

@Module({
  imports: [SupervisorModule],
  controllers: [IntakeController],
  providers: [IntakeService],
  exports: [IntakeService],
})
export class IntakeModule {}
