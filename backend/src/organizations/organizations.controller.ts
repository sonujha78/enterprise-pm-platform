import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { InviteUserDto } from './dto/invite-user.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('organizations')
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get('me')
  getMyOrganization(@CurrentUser() user: any) {
    return this.organizationsService.getOrganization(user.organizationId);
  }

  @Get('users')
  listUsers(@CurrentUser() user: any) {
    return this.organizationsService.listUsers(user.organizationId);
  }

  @Roles('ADMIN', 'MANAGER')
  @Post('invite')
  inviteUser(@CurrentUser() user: any, @Body() dto: InviteUserDto) {
    return this.organizationsService.inviteUser(user.organizationId, dto);
  }

  @Roles('ADMIN')
  @Patch('users/:id/role')
  updateUserRole(
    @CurrentUser() user: any,
    @Param('id') targetUserId: string,
    @Body() dto: UpdateUserRoleDto,
  ) {
    return this.organizationsService.updateUserRole(
      user.organizationId,
      targetUserId,
      dto,
    );
  }

  @Roles('ADMIN')
  @Patch('users/:id/activate')
  activateUser(@CurrentUser() user: any, @Param('id') targetUserId: string) {
    return this.organizationsService.setUserActiveStatus(
      user.organizationId,
      targetUserId,
      user.userId,
      true,
    );
  }

  @Roles('ADMIN')
  @Patch('users/:id/deactivate')
  deactivateUser(@CurrentUser() user: any, @Param('id') targetUserId: string) {
    return this.organizationsService.setUserActiveStatus(
      user.organizationId,
      targetUserId,
      user.userId,
      false,
    );
  }
}
