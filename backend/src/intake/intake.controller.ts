import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { CreateRequestDto } from './dto/create-request.dto';
import { IntakeService } from './intake.service';

@Controller()
export class IntakeController {
  constructor(private readonly intakeService: IntakeService) {}

  @Post('requests')
  @HttpCode(HttpStatus.OK)
  async handleRequest(@Body() dto: CreateRequestDto) {
    return this.intakeService.handleDirectRequest(dto);
  }
}
