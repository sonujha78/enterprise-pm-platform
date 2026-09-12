import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';
import { AddProjectMemberDto } from './dto/add-project-member.dto';
import { QueryProjectsDto } from './dto/query-projects.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Roles('ADMIN', 'MANAGER')
  @Post()
  createProject(@CurrentUser() user: any, @Body() dto: CreateProjectDto) {
    return this.projectsService.createProject(
      user.organizationId,
      user.userId,
      dto,
    );
  }

  @Get()
  listProjects(@CurrentUser() user: any, @Query() query: QueryProjectsDto) {
    return this.projectsService.listProjects(user.organizationId, query);
  }

  @Get(':id')
  getProject(@CurrentUser() user: any, @Param('id') id: string) {
    return this.projectsService.getProject(user.organizationId, id);
  }

  @Roles('ADMIN', 'MANAGER')
  @Patch(':id')
  updateProject(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
  ) {
    return this.projectsService.updateProject(user.organizationId, id, dto);
  }

  @Roles('ADMIN', 'MANAGER')
  @Delete(':id')
  archiveProject(@CurrentUser() user: any, @Param('id') id: string) {
    return this.projectsService.archiveProject(user.organizationId, id);
  }

  @Roles('ADMIN', 'MANAGER')
  @Post(':id/members')
  addMember(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: AddProjectMemberDto,
  ) {
    return this.projectsService.addMember(user.organizationId, id, dto);
  }

  @Roles('ADMIN', 'MANAGER')
  @Delete(':id/members/:userId')
  removeMember(
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Param('userId') userId: string,
  ) {
    return this.projectsService.removeMember(user.organizationId, id, userId);
  }
}
