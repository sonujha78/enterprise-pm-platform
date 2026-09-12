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
import { TasksService } from './tasks.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { QueryTasksDto } from './dto/query-tasks.dto';
import { AddCommentDto } from './dto/add-comment.dto';
import { AddDependencyDto } from './dto/add-dependency.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('projects/:projectId/tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Post()
  createTask(
    @CurrentUser() user: any,
    @Param('projectId') projectId: string,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasksService.createTask(
      user.organizationId,
      projectId,
      user.userId,
      dto,
    );
  }

  @Get()
  listTasks(
    @CurrentUser() user: any,
    @Param('projectId') projectId: string,
    @Query() query: QueryTasksDto,
  ) {
    return this.tasksService.listTasks(user.organizationId, projectId, query);
  }

  @Get(':taskId')
  getTask(
    @CurrentUser() user: any,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
  ) {
    return this.tasksService.getTask(user.organizationId, projectId, taskId);
  }

  @Patch(':taskId')
  updateTask(
    @CurrentUser() user: any,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasksService.updateTask(
      user.organizationId,
      projectId,
      taskId,
      user.userId,
      dto,
    );
  }

  @Delete(':taskId')
  deleteTask(
    @CurrentUser() user: any,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
  ) {
    return this.tasksService.deleteTask(user.organizationId, projectId, taskId);
  }

  @Post(':taskId/comments')
  addComment(
    @CurrentUser() user: any,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Body() dto: AddCommentDto,
  ) {
    return this.tasksService.addComment(
      user.organizationId,
      projectId,
      taskId,
      user.userId,
      dto,
    );
  }

  @Post(':taskId/dependencies')
  addDependency(
    @CurrentUser() user: any,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Body() dto: AddDependencyDto,
  ) {
    return this.tasksService.addDependency(
      user.organizationId,
      projectId,
      taskId,
      dto,
    );
  }

  @Delete(':taskId/dependencies/:blockingTaskId')
  removeDependency(
    @CurrentUser() user: any,
    @Param('projectId') projectId: string,
    @Param('taskId') taskId: string,
    @Param('blockingTaskId') blockingTaskId: string,
  ) {
    return this.tasksService.removeDependency(
      user.organizationId,
      projectId,
      taskId,
      blockingTaskId,
    );
  }
}
