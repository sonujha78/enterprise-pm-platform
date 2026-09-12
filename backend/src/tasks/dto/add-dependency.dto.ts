import { IsUUID } from 'class-validator';

export class AddDependencyDto {
  @IsUUID()
  blockingTaskId: string;
}
