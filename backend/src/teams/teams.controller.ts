import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { TeamsService } from './teams.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { AddTeamMemberDto } from './dto/add-team-member.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('teams')
export class TeamsController {
  constructor(private readonly teamsService: TeamsService) {}

  @Roles('ADMIN', 'MANAGER')
  @Post()
  createTeam(@CurrentUser() user: any, @Body() dto: CreateTeamDto) {
    return this.teamsService.createTeam(user.organizationId, dto);
  }

  @Get()
  listTeams(@CurrentUser() user: any) {
    return this.teamsService.listTeams(user.organizationId);
  }

  @Get(':id')
  getTeam(@CurrentUser() user: any, @Param('id') teamId: string) {
    return this.teamsService.getTeam(user.organizationId, teamId);
  }

  @Roles('ADMIN', 'MANAGER')
  @Post(':id/members')
  addMember(
    @CurrentUser() user: any,
    @Param('id') teamId: string,
    @Body() dto: AddTeamMemberDto,
  ) {
    return this.teamsService.addMember(user.organizationId, teamId, dto);
  }

  @Roles('ADMIN', 'MANAGER')
  @Delete(':id/members/:userId')
  removeMember(
    @CurrentUser() user: any,
    @Param('id') teamId: string,
    @Param('userId') userId: string,
  ) {
    return this.teamsService.removeMember(user.organizationId, teamId, userId);
  }
}
