import { Injectable, Logger } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { SupervisorService, ProcessedRequestResult } from '../supervisor/supervisor.service';
import { CreateRequestDto } from './dto/create-request.dto';

@Injectable()
export class IntakeService {
  private readonly logger = new Logger(IntakeService.name);

  constructor(private readonly supervisorService: SupervisorService) {}

  async handleDirectRequest(dto: CreateRequestDto): Promise<ProcessedRequestResult> {
    const requestId = uuidv4();
    this.logger.log(`Received incoming request [${requestId}] from source: ${dto.source || 'direct_api'}`);

    const result = await this.supervisorService.processRequest(
      requestId,
      dto.text,
      dto.source || 'direct_api',
    );

    return result;
  }
}
