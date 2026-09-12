import { IsEmail, IsIn } from 'class-validator';

export class InviteUserDto {
  @IsEmail()
  email: string;

  @IsIn(['ADMIN', 'MANAGER', 'DEVELOPER', 'VIEWER'])
  role: string;
}
