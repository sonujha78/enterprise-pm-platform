import { IsUUID, IsIn, IsOptional } from 'class-validator';

export class AddProjectMemberDto {
  @IsUUID()
  userId: string;

  @IsIn(['ADMIN', 'MANAGER', 'DEVELOPER', 'VIEWER'])
  @IsOptional()
  role?: string;
}
