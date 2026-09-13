import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@UseGuards(JwtAuthGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  getOverview(@CurrentUser() user: any) {
    return this.dashboardService.getOverview(user.organizationId);
  }

  @Get('tasks-by-priority')
  getTasksByPriority(@CurrentUser() user: any) {
    return this.dashboardService.getTasksByPriority(user.organizationId);
  }

  @Get('tasks-by-status')
  getTasksByStatus(@CurrentUser() user: any) {
    return this.dashboardService.getTasksByStatus(user.organizationId);
  }

  @Get('workload')
  getUserWorkload(@CurrentUser() user: any) {
    return this.dashboardService.getUserWorkload(user.organizationId);
  }

  @Get('project-progress')
  getProjectProgress(@CurrentUser() user: any) {
    return this.dashboardService.getProjectProgress(user.organizationId);
  }

  @Get('completion-trends')
  getCompletionTrends(
    @CurrentUser() user: any,
    @Query('days') days?: string,
  ) {
    return this.dashboardService.getCompletionTrends(
      user.organizationId,
      days ? parseInt(days, 10) : 30,
    );
  }
}
