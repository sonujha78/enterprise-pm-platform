import { useEffect, useState, FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Plus, X } from 'lucide-react';
import { apiClient } from '../api/client';
import type { Project } from '../types';

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: '', description: '' });

  const fetchProjects = async () => {
    setLoading(true);
    const { data } = await apiClient.get('/projects');
    setProjects(data.data);
    setLoading(false);
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    await apiClient.post('/projects', form);
    setShowModal(false);
    setForm({ name: '', description: '' });
    fetchProjects();
  };

  const statusClass = (status: string) => `badge badge-${status.toLowerCase()}`;

  if (loading) return <div className="loading">Loading projects...</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Projects</h1>
        <button className="btn-primary" onClick={() => setShowModal(true)}>
          <Plus size={16} /> New Project
        </button>
      </div>

      <div className="project-grid">
        {projects.length === 0 && <p className="empty-state">No projects yet. Create your first one.</p>}
        {projects.map((project) => (
          <Link to={`/projects/${project.id}`} key={project.id} className="project-card">
            <div className="project-card-header">
              <h3>{project.name}</h3>
              <span className={statusClass(project.status)}>{project.status}</span>
            </div>
            <p className="project-desc">{project.description || 'No description'}</p>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${project.progress}%` }} />
            </div>
            <span className="progress-label">{project.progress}% complete</span>
          </Link>
        ))}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>New Project</h2>
              <button onClick={() => setShowModal(false)}><X size={20} /></button>
            </div>
            <form onSubmit={handleCreate}>
              <label>Name</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
              <label>Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
              />
              <button type="submit" className="btn-primary">Create Project</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
