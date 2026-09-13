import { useEffect, useState, FormEvent } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Plus, X } from 'lucide-react';
import { apiClient } from '../api/client';
import type { Project, Task } from '../types';

const COLUMNS: Task['status'][] = ['TODO', 'IN_PROGRESS', 'COMPLETED'];
const COLUMN_LABELS: Record<Task['status'], string> = {
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  COMPLETED: 'Completed',
};

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ title: '', priority: 'MEDIUM' });

  const fetchData = async () => {
    const [projectRes, tasksRes] = await Promise.all([
      apiClient.get(`/projects/${id}`),
      apiClient.get(`/projects/${id}/tasks`),
    ]);
    setProject(projectRes.data);
    setTasks(tasksRes.data.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleCreateTask = async (e: FormEvent) => {
    e.preventDefault();
    await apiClient.post(`/projects/${id}/tasks`, form);
    setShowModal(false);
    setForm({ title: '', priority: 'MEDIUM' });
    fetchData();
  };

  const moveTask = async (task: Task, newStatus: Task['status']) => {
    await apiClient.patch(`/projects/${id}/tasks/${task.id}`, {
      status: newStatus,
      version: task.version,
    });
    fetchData();
  };

  if (loading) return <div className="loading">Loading project...</div>;

  return (
    <div className="page">
      <Link to="/projects" className="back-link">
        <ArrowLeft size={16} /> Back to Projects
      </Link>

      <div className="page-header">
        <div>
          <h1>{project?.name}</h1>
          <p className="project-desc">{project?.description}</p>
        </div>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={16} /> New Task
        </button>
      </div>

      <div className="progress-bar" style={{ marginBottom: '2rem' }}>
        <div className="progress-fill" style={{ width: `${project?.progress}%` }} />
      </div>

      <div className="kanban-board">
        {COLUMNS.map((status) => (
          <div className="kanban-column" key={status}>
            <h3>{COLUMN_LABELS[status]} ({tasks.filter((t) => t.status === status).length})</h3>
            {tasks
              .filter((t) => t.status === status)
              .map((task) => (
                <div className="task-card" key={task.id}>
                  <div className="task-title">{task.title}</div>
                  <span className={`badge badge-priority-${task.priority.toLowerCase()}`}>
                    {task.priority}
                  </span>
                  <div className="task-actions">
                    {COLUMNS.filter((s) => s !== status).map((s) => (
                      <button key={s} onClick={() => moveTask(task, s)}>
                        → {COLUMN_LABELS[s]}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>New Task</h2>
              <button onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreateTask}>
              <label>Title</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                required
              />
              <label>Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
              </select>
              <button type="submit" className="btn-primary">Create Task</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
