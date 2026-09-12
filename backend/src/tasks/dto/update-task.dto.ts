import {
  IsString,
  IsOptional,
  IsDateString,
  IsUUID,
  IsIn,
  IsArray,
  IsInt,
} from 'class-validator';

export class UpdateTaskDto {
  @IsString()
  @IsOptional()
  title?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsIn(['TODO', 'IN_PROGRESS', 'COMPLETED'])
  @IsOptional()
  status?: string;

  @IsIn(['LOW', 'MEDIUM', 'HIGH'])
  @IsOptional()
  priority?: string;

  @IsDateString()
  @IsOptional()
  dueDate?: string;

  @IsArray()
  @IsOptional()
  tags?: string[];

  @IsUUID()
  @IsOptional()
  assigneeId?: string;

  // Optimistic locking
  @IsInt()
  version: number;
}
