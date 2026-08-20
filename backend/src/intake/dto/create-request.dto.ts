import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateRequestDto {
  @IsString()
  @IsNotEmpty()
  text: string;

  @IsString()
  @IsOptional()
  source?: string = 'direct_api';

  @IsOptional()
  metadata?: Record<string, any>;
}
