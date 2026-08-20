import { Controller, Get, Param, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import { AuditService } from './audit.service';

@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('feed')
  getFeed() {
    return this.auditService.getFeed(50);
  }

  @Sse('stream')
  stream(): Observable<any> {
    return this.auditService.getEventStream();
  }

  @Get('stats')
  getStats() {
    return this.auditService.getStats();
  }

  @Get('requests/:id')
  getRequestById(@Param('id') id: string) {
    const record = this.auditService.getRequestById(id);
    if (!record) {
      return { error: 'Audit record not found', requestId: id };
    }
    return record;
  }
}
