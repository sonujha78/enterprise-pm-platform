import { IsIn } from 'class-validator';

export class UpdateUserRoleDto {
  @IsIn(['ADMIN', 'MANAGER', 'DEVELOPER', 'VIEWER'])
  role: string;
}
