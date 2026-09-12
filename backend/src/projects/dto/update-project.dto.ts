import { IsString, IsOptional, IsDateString, IsIn, IsInt } from 'class-validator';

export class UpdateProjectDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsIn(['ACTIVE', 'COMPLETED', 'ON_HOLD'])
  @IsOptional()
  status?: string;

  @IsDateString()
  @IsOptional()
  startDate?: string;

  @IsDateString()
  @IsOptional()
  endDate?: string;

  // Optimistic locking: client must send the version it last read
  @IsInt()
  version: number;
}
