import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class DashboardService {
  private readonly CACHE_TTL = 60; // seconds

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  private async getCached<T>(key: string, compute: () => Promise<T>): Promise<T> {
    const cached = await this.redis.get(key);
    if (cached) {
      return JSON.parse(cached);
    }
    const result = await compute();
    await this.redis.set(key, JSON.stringify(result), 'EX', this.CACHE_TTL);
    return result;
  }

  async getOverview(organizationId: string) {
    return this.getCached(`dashboard:overview:${organizationId}`, async () => {
      const [totalProjects, activeProjects, completedProjects, onHoldProjects] =
        await this.prisma.$transaction([
          this.prisma.project.count({ where: { organizationId } }),
          this.prisma.project.count({ where: { organizationId, status: 'ACTIVE' } }),
          this.prisma.project.count({ where: { organizationId, status: 'COMPLETED' } }),
          this.prisma.project.count({ where: { organizationId, status: 'ON_HOLD' } }),
        ]);

      const projectIds = (
        await this.prisma.project.findMany({
          where: { organizationId },
          select: { id: true },
        })
      ).map((p) => p.id);

      const [totalTasks, completedTasks, pendingTasks, overdueTasks] =
        await this.prisma.$transaction([
          this.prisma.task.count({ where: { projectId: { in: projectIds } } }),
          this.prisma.task.count({
            where: { projectId: { in: projectIds }, status: 'COMPLETED' },
          }),
          this.prisma.task.count({
            where: {
              projectId: { in: projectIds },
              status: { in: ['TODO', 'IN_PROGRESS'] },
            },
          }),
          this.prisma.task.count({
            where: {
              projectId: { in: projectIds },
              status: { not: 'COMPLETED' },
              dueDate: { lt: new Date() },
            },
          }),
        ]);

      return {
        projects: {
          total: totalProjects,
          active: activeProjects,
          completed: completedProjects,
          onHold: onHoldProjects,
        },
        tasks: {
          total: totalTasks,
          completed: completedTasks,
          pending: pendingTasks,
          overdue: overdueTasks,
        },
      };
    });
  }

  async getTasksByPriority(organizationId: string) {
    return this.getCached(`dashboard:tasks-by-priority:${organizationId}`, async () => {
      const projectIds = (
        await this.prisma.project.findMany({
          where: { organizationId },
          select: { id: true },
        })
      ).map((p) => p.id);

      const grouped = await this.prisma.task.groupBy({
        by: ['priority'],
        where: { projectId: { in: projectIds } },
        _count: true,
      });

      return grouped.reduce(
        (acc, g) => ({ ...acc, [g.priority]: g._count }),
        { LOW: 0, MEDIUM: 0, HIGH: 0 },
      );
    });
  }

  async getTasksByStatus(organizationId: string) {
    return this.getCached(`dashboard:tasks-by-status:${organizationId}`, async () => {
      const projectIds = (
        await this.prisma.project.findMany({
          where: { organizationId },
          select: { id: true },
        })
      ).map((p) => p.id);

      const grouped = await this.prisma.task.groupBy({
        by: ['status'],
        where: { projectId: { in: projectIds } },
        _count: true,
      });

      return grouped.reduce(
        (acc, g) => ({ ...acc, [g.status]: g._count }),
        { TODO: 0, IN_PROGRESS: 0, COMPLETED: 0 },
      );
    });
  }

  async getUserWorkload(organizationId: string) {
    return this.getCached(`dashboard:workload:${organizationId}`, async () => {
      const users = await this.prisma.user.findMany({
        where: { organizationId, isActive: true },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          assignedTasks: {
            where: { status: { not: 'COMPLETED' } },
            select: { id: true, priority: true, dueDate: true },
          },
        },
      });

      return users.map((u) => ({
        userId: u.id,
        name: `${u.firstName} ${u.lastName}`,
        activeTaskCount: u.assignedTasks.length,
        overdueCount: u.assignedTasks.filter(
          (t) => t.dueDate && new Date(t.dueDate) < new Date(),
        ).length,
      }));
    });
  }

  async getProjectProgress(organizationId: string) {
    return this.getCached(`dashboard:project-progress:${organizationId}`, async () => {
      const projects = await this.prisma.project.findMany({
        where: { organizationId },
        select: {
          id: true,
          name: true,
          status: true,
          tasks: { select: { status: true } },
        },
      });

      return projects.map((p) => {
        const total = p.tasks.length;
        const completed = p.tasks.filter((t) => t.status === 'COMPLETED').length;
        return {
          projectId: p.id,
          name: p.name,
          status: p.status,
          progress: total === 0 ? 0 : Math.round((completed / total) * 100),
        };
      });
    });
  }

  async getCompletionTrends(organizationId: string, days = 30) {
    // Not cached — needs to reflect real-time completion for the requested window
    const since = new Date();
    since.setDate(since.getDate() - days);

    const projectIds = (
      await this.prisma.project.findMany({
        where: { organizationId },
        select: { id: true },
      })
    ).map((p) => p.id);

    const completedTasks = await this.prisma.task.findMany({
      where: {
        projectId: { in: projectIds },
        status: 'COMPLETED',
        updatedAt: { gte: since },
      },
      select: { updatedAt: true },
    });

    const trendMap: Record<string, number> = {};
    completedTasks.forEach((t) => {
      const day = t.updatedAt.toISOString().split('T')[0];
      trendMap[day] = (trendMap[day] || 0) + 1;
    });

    return Object.entries(trendMap)
      .map(([date, count]) => ({ date, completed: count }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }
}
