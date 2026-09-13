import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { apiClient } from '../api/client';
import type { DashboardOverview } from '../types';

const STATUS_COLORS: Record<string, string> = {
  TODO: '#94a3b8',
  IN_PROGRESS: '#3b82f6',
  COMPLETED: '#22c55e',
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: '#94a3b8',
  MEDIUM: '#f59e0b',
  HIGH: '#ef4444',
};

export default function Dashboard() {
  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [byStatus, setByStatus] = useState<Record<string, number>>({});
  const [byPriority, setByPriority] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [ov, status, priority] = await Promise.all([
          apiClient.get('/dashboard/overview'),
          apiClient.get('/dashboard/tasks-by-status'),
          apiClient.get('/dashboard/tasks-by-priority'),
        ]);
        setOverview(ov.data);
        setByStatus(status.data);
        setByPriority(priority.data);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  if (loading) return <div className="loading">Loading dashboard...</div>;

  const statusData = Object.entries(byStatus).map(([name, value]) => ({ name, value }));
  const priorityData = Object.entries(byPriority).map(([name, value]) => ({ name, value }));

  return (
    <div className="page">
      <h1>Dashboard</h1>

      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-label">Total Projects</span>
          <span className="stat-value">{overview?.projects.total ?? 0}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Active Projects</span>
          <span className="stat-value">{overview?.projects.active ?? 0}</span>
        </div>
        <div className="stat-card">
          <span className="stat-label">Total Tasks</span>
          <span className="stat-value">{overview?.tasks.total ?? 0}</span>
        </div>
        <div className="stat-card overdue">
          <span className="stat-label">Overdue Tasks</span>
          <span className="stat-value">{overview?.tasks.overdue ?? 0}</span>
        </div>
      </div>

      <div className="chart-grid">
        <div className="chart-card">
          <h3>Tasks by Status</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                {statusData.map((entry) => (
                  <Cell key={entry.name} fill={STATUS_COLORS[entry.name] || '#8884d8'} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card">
          <h3>Tasks by Priority</h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={priorityData}>
              <XAxis dataKey="name" />
              <YAxis allowDecimals={false} />
              <Tooltip />
              <Bar dataKey="value">
                {priorityData.map((entry) => (
                  <Cell key={entry.name} fill={PRIORITY_COLORS[entry.name] || '#8884d8'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
