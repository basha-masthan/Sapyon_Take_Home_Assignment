import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  Briefcase, CheckCircle2, Clock, Plus, LogOut, X, 
  MessageSquare, Paperclip, User, ShieldAlert, Layers
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

interface UserObj {
  id: number;
  email: string;
  full_name: string;
}

interface Membership {
  agency_id: number;
  agency_name: string;
  role: string;
  client_id: number | null;
}

interface Project {
  id: number;
  name: string;
  description: string;
  agency_id: number;
  client_id: number;
}

interface Task {
  id: number;
  project_id: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  assignee_id: number | null;
  due_date: string | null;
  is_internal: boolean;
}

interface Comment {
  id: number;
  task_id: number;
  author_id: number;
  content: string;
  is_internal: boolean;
  created_at: string;
}

interface TaskFile {
  id: number;
  task_id: number;
  uploader_id: number;
  filename: string;
  file_path: string;
  is_internal: boolean;
  approval_status: 'pending' | 'approved' | 'needs_changes';
  created_at: string;
}

interface TimeEntry {
  id: number;
  task_id: number;
  user_id: number;
  duration_minutes: number;
  note: string;
  date: string;
}

interface DashboardStats {
  task_counts: {
    todo: number;
    in_progress: number;
    done: number;
  };
  hours_logged: number;
}

export default function App() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('ad_token'));
  const [user, setUser] = useState<UserObj | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [activeCtx, setActiveCtx] = useState<Membership | null>(null);
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [projectMembers, setProjectMembers] = useState<UserObj[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  
  // Task detail modal state
  const [comments, setComments] = useState<Comment[]>([]);
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [files, setFiles] = useState<TaskFile[]>([]);
  
  // Forms & Modals
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  
  const [showCreateTask, setShowCreateTask] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('medium');
  const [newTaskInternal, setNewTaskInternal] = useState(false);
  const [newTaskAssignee, setNewTaskAssignee] = useState('');

  const [newComment, setNewComment] = useState('');
  const [newCommentInternal, setNewCommentInternal] = useState(false);

  const [newTimeDuration, setNewTimeDuration] = useState('');
  const [newTimeNote, setNewTimeNote] = useState('');

  const [newFile, setNewFile] = useState<File | null>(null);
  const [newFileInternal, setNewFileInternal] = useState(false);

  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberId, setNewMemberId] = useState('');

  // Setup Axios Defaults
  useEffect(() => {
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axios.defaults.headers.common['Authorization'];
    }
  }, [token]);

  // Set agency context header dynamically
  useEffect(() => {
    if (activeCtx) {
      axios.defaults.headers.common['X-Agency-ID'] = activeCtx.agency_id.toString();
    } else {
      delete axios.defaults.headers.common['X-Agency-ID'];
    }
  }, [activeCtx]);

  // Load User and memberships on token change
  useEffect(() => {
    if (token) {
      fetchUserAndContexts();
    }
  }, [token]);

  // Load projects when active context changes
  useEffect(() => {
    if (activeCtx) {
      fetchProjects();
    } else {
      setProjects([]);
      setSelectedProject(null);
    }
  }, [activeCtx]);

  // Load tasks, members and stats when active project changes
  useEffect(() => {
    if (selectedProject) {
      fetchProjectData();
    } else {
      setTasks([]);
      setProjectMembers([]);
      setDashboardStats(null);
    }
  }, [selectedProject]);

  // Load task sub-resource detail when a task is clicked
  useEffect(() => {
    if (selectedTask && selectedProject) {
      fetchTaskDetails();
    }
  }, [selectedTask]);

  const fetchUserAndContexts = async () => {
    try {
      const userRes = await axios.get(`${API_BASE}/api/auth/me`);
      setUser(userRes.data);
      const memRes = await axios.get(`${API_BASE}/api/auth/memberships`);
      setMemberships(memRes.data);
      if (memRes.data.length > 0) {
        setActiveCtx(memRes.data[0]);
      }
    } catch (err) {
      handleLogout();
    }
  };

  const fetchProjects = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/projects/`);
      setProjects(res.data);
      if (res.data.length > 0) {
        setSelectedProject(res.data[0]);
      } else {
        setSelectedProject(null);
      }
    } catch (err) {
      console.error("Failed to load projects", err);
    }
  };

  const fetchProjectData = async () => {
    if (!selectedProject) return;
    try {
      const tasksRes = await axios.get(`${API_BASE}/api/projects/${selectedProject.id}/tasks/`);
      setTasks(tasksRes.data);
      
      const statsRes = await axios.get(`${API_BASE}/api/projects/${selectedProject.id}/dashboard`);
      setDashboardStats(statsRes.data);

      const membersRes = await axios.get(`${API_BASE}/api/projects/${selectedProject.id}/members`);
      setProjectMembers(membersRes.data);
    } catch (err) {
      console.error("Failed to load project details", err);
    }
  };

  const fetchTaskDetails = async () => {
    if (!selectedProject || !selectedTask) return;
    try {
      const commentsRes = await axios.get(`${API_BASE}/api/projects/${selectedProject.id}/tasks/${selectedTask.id}/comments`);
      setComments(commentsRes.data);

      const timeRes = await axios.get(`${API_BASE}/api/projects/${selectedProject.id}/tasks/${selectedTask.id}/time`);
      setTimeEntries(timeRes.data);

      const filesRes = await axios.get(`${API_BASE}/api/projects/${selectedProject.id}/tasks/${selectedTask.id}/files`);
      setFiles(filesRes.data);
    } catch (err) {
      console.error("Failed to load task details", err);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const params = new URLSearchParams();
      params.append('username', loginEmail);
      params.append('password', loginPassword);

      const res = await axios.post(`${API_BASE}/api/auth/login`, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      localStorage.setItem('ad_token', res.data.access_token);
      setToken(res.data.access_token);
    } catch (err: any) {
      setLoginError(err.response?.data?.detail || "Authentication failed. Make sure server is running.");
    }
  };

  const handleQuickLogin = async (email: string) => {
    setLoginError('');
    try {
      const params = new URLSearchParams();
      params.append('username', email);
      params.append('password', 'password');

      const res = await axios.post(`${API_BASE}/api/auth/login`, params, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
      });
      localStorage.setItem('ad_token', res.data.access_token);
      setToken(res.data.access_token);
    } catch (err: any) {
      setLoginError(err.response?.data?.detail || "Failed to log in.");
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('ad_token');
    setToken(null);
    setUser(null);
    setMemberships([]);
    setActiveCtx(null);
    setProjects([]);
    setSelectedProject(null);
    setTasks([]);
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    try {
      const res = await axios.post(`${API_BASE}/api/projects/${selectedProject.id}/tasks/`, {
        title: newTaskTitle,
        description: newTaskDesc,
        priority: newTaskPriority,
        is_internal: newTaskInternal,
        assignee_id: newTaskAssignee ? parseInt(newTaskAssignee) : null
      });
      setTasks([...tasks, res.data]);
      setShowCreateTask(false);
      setNewTaskTitle('');
      setNewTaskDesc('');
      fetchProjectData(); // Refresh counts and list
    } catch (err) {
      console.error("Failed to create task", err);
    }
  };

  const handleUpdateTaskStatus = async (task: Task, newStatus: string) => {
    if (!selectedProject) return;
    try {
      const res = await axios.patch(`${API_BASE}/api/projects/${selectedProject.id}/tasks/${task.id}`, {
        status: newStatus
      });
      setTasks(tasks.map(t => t.id === task.id ? res.data : t));
      fetchProjectData();
    } catch (err) {
      alert("Error: Only agency admins or members can modify task status.");
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !selectedTask) return;
    try {
      const res = await axios.post(`${API_BASE}/api/projects/${selectedProject.id}/tasks/${selectedTask.id}/comments`, {
        content: newComment,
        is_internal: newCommentInternal
      });
      setComments([...comments, res.data]);
      setNewComment('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleLogTime = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !selectedTask) return;
    try {
      const res = await axios.post(`${API_BASE}/api/projects/${selectedProject.id}/tasks/${selectedTask.id}/time`, {
        duration_minutes: parseInt(newTimeDuration),
        note: newTimeNote
      });
      setTimeEntries([...timeEntries, res.data]);
      setNewTimeDuration('');
      setNewTimeNote('');
      fetchProjectData(); // Update logged hours metric
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject || !selectedTask || !newFile) return;
    try {
      const formData = new FormData();
      formData.append('file', newFile);
      formData.append('is_internal', newFileInternal.toString());

      const res = await axios.post(`${API_BASE}/api/projects/${selectedProject.id}/tasks/${selectedTask.id}/files`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setFiles([...files, res.data]);
      setNewFile(null);
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpdateFileStatus = async (fileId: number, status: string) => {
    if (!selectedProject || !selectedTask) return;
    try {
      const res = await axios.patch(`${API_BASE}/api/projects/${selectedProject.id}/tasks/${selectedTask.id}/files/${fileId}?approval_status=${status}`);
      setFiles(files.map(f => f.id === fileId ? res.data : f));
    } catch (err) {
      console.error(err);
    }
  };

  const handleRemoveMember = async (memberId: number) => {
    if (!selectedProject) return;
    if (!confirm("Are you sure you want to remove this member from the project? This will automatically unassign them from any incomplete tasks.")) return;
    try {
      await axios.delete(`${API_BASE}/api/projects/${selectedProject.id}/members/${memberId}`);
      fetchProjectData(); // Fetch task assignments & project member list again
      if (selectedTask) {
        fetchTaskDetails();
      }
    } catch (err) {
      alert("Error: Only agency admins can manage project members.");
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProject) return;
    try {
      await axios.post(`${API_BASE}/api/projects/${selectedProject.id}/members?user_id=${newMemberId}`);
      setShowAddMember(false);
      setNewMemberId('');
      fetchProjectData();
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to add member. Ensure they belong to this agency.");
    }
  };

  if (!token) {
    return (
      <div className="login-container" style={{
        display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh',
        background: 'radial-gradient(circle at top, #1e1b4b 0%, #0b0d19 100%)', padding: '20px'
      }}>
        <div className="glass-card" style={{ maxWidth: '480px', width: '100%', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ display: 'inline-flex', padding: '12px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '12px', marginBottom: '12px' }}>
              <Layers size={36} color="#6366f1" />
            </div>
            <h1 style={{ fontSize: '2rem', color: '#f8fafc', marginBottom: '6px' }}>AgencyDesk</h1>
            <p style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Multi-Tenant Client & Task Portal</p>
          </div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: '#94a3b8' }}>Email Address</label>
              <input type="email" required value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="name@agency.com" />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '6px', fontSize: '0.85rem', color: '#94a3b8' }}>Password</label>
              <input type="password" required value={loginPassword} onChange={e => setLoginPassword(e.target.value)} placeholder="••••••••" />
            </div>
            
            {loginError && <p style={{ color: '#ef4444', fontSize: '0.85rem', textAlign: 'center' }}>{loginError}</p>}
            
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }}>Sign In</button>
          </form>

          <div style={{ marginTop: '24px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '20px' }}>
            <p style={{ color: '#64748b', fontSize: '0.8rem', marginBottom: '12px', textAlign: 'center', fontWeight: 'bold' }}>QUICK LOGIN FOR EVALUATION</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button onClick={() => handleQuickLogin('admin@agencya.com')} className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '8px' }}>
                Admin A (Agency A)
              </button>
              <button onClick={() => handleQuickLogin('admin@agencyb.com')} className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '8px' }}>
                Admin B (Agency B)
              </button>
              <button onClick={() => handleQuickLogin('member@agencya.com')} className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '8px' }}>
                Member A (Agency A)
              </button>
              <button onClick={() => handleQuickLogin('client@example.com')} className="btn btn-secondary" style={{ fontSize: '0.8rem', padding: '8px', color: '#a21caf' }}>
                Client User (Both Agencies!)
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const roleDisplay = (role: string) => {
    if (role === 'agency_admin') return <span className="badge badge-internal" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>Agency Admin</span>;
    if (role === 'agency_member') return <span className="badge badge-internal">Agency Member</span>;
    return <span className="badge badge-client">Client</span>;
  };

  const isClient = activeCtx?.role === 'client_user';
  const isAdmin = activeCtx?.role === 'agency_admin';

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden', background: '#0b0d19' }}>
      
      {/* SIDEBAR */}
      <aside style={{ width: '280px', height: '100vh', flexShrink: 0, borderRight: '1px solid var(--border-color)', background: 'rgba(19, 23, 42, 0.8)', padding: '24px', display: 'flex', flexDirection: 'column', gap: '24px', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Layers color="#6366f1" size={28} />
          <h2 style={{ fontSize: '1.25rem', color: '#f8fafc' }}>AgencyDesk</h2>
        </div>

        {/* TENANT CONTEXT SWITCHER */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase' }}>Active Workspace</label>
          <select 
            value={activeCtx ? memberships.findIndex(m => m.agency_id === activeCtx.agency_id && m.client_id === activeCtx.client_id) : 0}
            onChange={e => setActiveCtx(memberships[parseInt(e.target.value)])}
            style={{ fontSize: '0.9rem' }}
          >
            {memberships.map((m, idx) => (
              <option key={idx} value={idx}>{m.agency_name}</option>
            ))}
          </select>
        </div>

        {/* PROJECTS LIST */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflowY: 'auto' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 'bold', textTransform: 'uppercase' }}>Projects</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {projects.map(proj => (
              <button 
                key={proj.id}
                onClick={() => setSelectedProject(proj)}
                className={`btn ${selectedProject?.id === proj.id ? 'btn-primary' : 'btn-secondary'}`}
                style={{ justifyContent: 'flex-start', padding: '10px 14px', width: '100%', fontSize: '0.9rem' }}
              >
                <Briefcase size={16} />
                <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{proj.name}</span>
              </button>
            ))}
            {projects.length === 0 && <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No projects found</p>}
          </div>
        </div>

        {/* USER PROFILE */}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px', marginTop: 'auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ padding: '8px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '50%' }}>
              <User size={20} color="var(--text-secondary)" />
            </div>
            <div style={{ overflow: 'hidden' }}>
              <p style={{ fontSize: '0.85rem', fontWeight: 'bold', color: '#f8fafc', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{user?.full_name}</p>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{activeCtx && roleDisplay(activeCtx.role)}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="btn btn-secondary" style={{ width: '100%', gap: '8px', padding: '8px' }}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </aside>

      {/* MAIN VIEW */}
      <main style={{ flex: 1, height: '100vh', padding: '40px', display: 'flex', flexDirection: 'column', gap: '30px', overflowY: 'auto' }}>
        
        {/* HEADER */}
        {selectedProject ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h1 style={{ fontSize: '2.25rem', color: '#f8fafc', marginBottom: '8px' }}>{selectedProject.name}</h1>
                <p style={{ color: 'var(--text-secondary)' }}>{selectedProject.description || "No description provided."}</p>
              </div>

              {!isClient && (
                <button onClick={() => setShowCreateTask(true)} className="btn btn-primary">
                  <Plus size={18} /> New Task
                </button>
              )}
            </div>

            {/* DASHBOARD STATS */}
            {dashboardStats && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ padding: '12px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '12px' }}>
                    <Layers color="#6366f1" size={24} />
                  </div>
                  <div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Total Tasks</p>
                    <h3 style={{ fontSize: '1.75rem', color: '#f8fafc' }}>
                      {dashboardStats.task_counts.todo + dashboardStats.task_counts.in_progress + dashboardStats.task_counts.done}
                    </h3>
                  </div>
                </div>

                <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ padding: '12px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '12px' }}>
                    <CheckCircle2 color="#3b82f6" size={24} />
                  </div>
                  <div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>In Progress</p>
                    <h3 style={{ fontSize: '1.75rem', color: '#f8fafc' }}>{dashboardStats.task_counts.in_progress}</h3>
                  </div>
                </div>

                <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ padding: '12px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px' }}>
                    <CheckCircle2 color="#10b981" size={24} />
                  </div>
                  <div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Completed</p>
                    <h3 style={{ fontSize: '1.75rem', color: '#f8fafc' }}>{dashboardStats.task_counts.done}</h3>
                  </div>
                </div>

                <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ padding: '12px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '12px' }}>
                    <Clock color="#f59e0b" size={24} />
                  </div>
                  <div>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Hours Tracked</p>
                    <h3 style={{ fontSize: '1.75rem', color: '#f8fafc' }}>{dashboardStats.hours_logged}h</h3>
                  </div>
                </div>
              </div>
            )}

            {/* BOARD COLUMNS */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '24px', flex: 1, minHeight: '400px' }}>
              {['todo', 'in_progress', 'done'].map(statusCol => {
                const columnTasks = tasks.filter(t => t.status === statusCol);
                const colTitle = statusCol === 'todo' ? 'To Do' : statusCol === 'in_progress' ? 'In Progress' : 'Completed';
                const colColor = statusCol === 'todo' ? 'var(--status-todo)' : statusCol === 'in_progress' ? 'var(--status-in-progress)' : 'var(--status-done)';
                
                return (
                  <div key={statusCol} style={{ background: 'rgba(19, 23, 42, 0.4)', borderRadius: '16px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: colColor }} />
                      <h3 style={{ color: '#f8fafc', fontSize: '1rem', flex: 1 }}>{colTitle}</h3>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '10px' }}>
                        {columnTasks.length}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1, overflowY: 'auto' }}>
                      {columnTasks.map(task => (
                        <div 
                          key={task.id} 
                          className="glass-card" 
                          onClick={() => setSelectedTask(task)}
                          style={{ padding: '16px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '12px' }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <span className="badge" style={{ 
                              fontSize: '0.65rem', 
                              backgroundColor: task.priority === 'high' ? 'rgba(239, 68, 68, 0.15)' : task.priority === 'medium' ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                              color: task.priority === 'high' ? '#ef4444' : task.priority === 'medium' ? '#f59e0b' : '#10b981'
                            }}>
                              {task.priority}
                            </span>
                            {task.is_internal ? (
                              <span className="badge badge-internal">Internal</span>
                            ) : (
                              <span className="badge badge-client" style={{ opacity: 0.8 }}>Visible</span>
                            )}
                          </div>

                          <h4 style={{ color: '#f8fafc', fontSize: '0.95rem', fontWeight: '500' }}>{task.title}</h4>

                          <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px', display: 'flex', justifySelf: 'flex-end', justifyContent: 'space-between', alignItems: 'center' }}>
                            {!isClient && (
                              <select 
                                value={task.status} 
                                onClick={e => e.stopPropagation()} 
                                onChange={e => handleUpdateTaskStatus(task, e.target.value)}
                                style={{ width: 'auto', padding: '4px 8px', fontSize: '0.75rem', height: '28px' }}
                              >
                                <option value="todo">To Do</option>
                                <option value="in_progress">In Progress</option>
                                <option value="done">Completed</option>
                              </select>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* PROJECT MEMBERS MANAGEMENT SECTION */}
            {!isClient && (
              <div className="glass-card" style={{ marginTop: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '1.2rem', color: '#f8fafc' }}>Project Members</h3>
                  {isAdmin && (
                    <button onClick={() => setShowAddMember(true)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
                      <Plus size={14} /> Add Member
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                  {projectMembers.map(m => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: '20px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                      <span>{m.full_name} ({m.email})</span>
                      {isAdmin && (
                        <button onClick={() => handleRemoveMember(m.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444' }}>
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', flex: 1, color: 'var(--text-muted)', fontStyle: 'italic' }}>
            No project selected. Select context or create a project context.
          </div>
        )}
      </main>

      {/* CREATE TASK MODAL */}
      {showCreateTask && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
          <div className="glass-card" style={{ maxWidth: '500px', width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ color: '#f8fafc' }}>Create New Task</h3>
              <button onClick={() => setShowCreateTask(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateTask} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Task Title</label>
                <input required type="text" value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)} placeholder="Implement access filters" />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Description</label>
                <textarea rows={3} value={newTaskDesc} onChange={e => setNewTaskDesc(e.target.value)} placeholder="Detailed requirements..." />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Priority</label>
                  <select value={newTaskPriority} onChange={e => setNewTaskPriority(e.target.value)}>
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Assignee</label>
                  <select value={newTaskAssignee} onChange={e => setNewTaskAssignee(e.target.value)}>
                    <option value="">Unassigned</option>
                    {projectMembers.map(m => (
                      <option key={m.id} value={m.id}>{m.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
                <input type="checkbox" checked={newTaskInternal} onChange={e => setNewTaskInternal(e.target.checked)} style={{ width: 'auto' }} id="taskInternal" />
                <label htmlFor="taskInternal" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Internal (Agency Only)</label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowCreateTask(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Create Task</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD MEMBER MODAL */}
      {showAddMember && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 100 }}>
          <div className="glass-card" style={{ maxWidth: '400px', width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ color: '#f8fafc' }}>Add Project Member</h3>
              <button onClick={() => setShowAddMember(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddMember} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>Member User ID</label>
                <input required type="number" value={newMemberId} onChange={e => setNewMemberId(e.target.value)} placeholder="e.g. 3" />
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>Enter the user ID from the active agency (e.g. Member A is ID 3).</p>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '10px' }}>
                <button type="button" onClick={() => setShowAddMember(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Add Member</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TASK DETAIL MODAL */}
      {selectedTask && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 90 }}>
          <div className="glass-card" style={{ maxWidth: '800px', width: '90%', maxHeight: '90vh', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '16px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span className="badge" style={{ 
                    backgroundColor: selectedTask.priority === 'high' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)',
                    color: selectedTask.priority === 'high' ? '#ef4444' : '#f59e0b'
                  }}>{selectedTask.priority}</span>
                  {selectedTask.is_internal ? (
                    <span className="badge badge-internal"><ShieldAlert size={12} /> Internal (Agency Only)</span>
                  ) : (
                    <span className="badge badge-client">Client Visible</span>
                  )}
                </div>
                <h2 style={{ color: '#f8fafc', fontSize: '1.5rem' }}>{selectedTask.title}</h2>
              </div>
              <button onClick={() => { setSelectedTask(null); fetchProjectData(); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={24} />
              </button>
            </div>

            {/* Modal Content Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '24px' }}>
              
              {/* Left Column (Details & Comments) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div>
                  <h4 style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>Description</h4>
                  <p style={{ color: '#f8fafc', fontSize: '0.95rem', lineHeight: '1.5', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px' }}>
                    {selectedTask.description || "No description provided."}
                  </p>
                </div>

                {/* COMMENTS SECTION */}
                <div>
                  <h4 style={{ color: 'var(--text-secondary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <MessageSquare size={16} /> Comments
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px', maxHeight: '200px', overflowY: 'auto' }}>
                    {comments.map(c => (
                      <div key={c.id} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-color)', padding: '10px 14px', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 'bold' }}>
                            User #{c.author_id}
                          </span>
                          {c.is_internal && <span className="badge badge-internal" style={{ fontSize: '0.6rem' }}>Internal</span>}
                        </div>
                        <p style={{ fontSize: '0.85rem', color: '#f8fafc' }}>{c.content}</p>
                      </div>
                    ))}
                    {comments.length === 0 && <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No comments yet</p>}
                  </div>

                  <form onSubmit={handleAddComment} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <textarea 
                      required 
                      rows={2} 
                      value={newComment} 
                      onChange={e => setNewComment(e.target.value)} 
                      placeholder="Add a comment..."
                      style={{ fontSize: '0.85rem' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      {!isClient ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <input type="checkbox" checked={newCommentInternal} onChange={e => setNewCommentInternal(e.target.checked)} style={{ width: 'auto' }} id="commentInternal" />
                          <label htmlFor="commentInternal" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Internal (Agency Only)</label>
                        </div>
                      ) : <div />}
                      <button type="submit" className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.8rem' }}>Post Comment</button>
                    </div>
                  </form>
                </div>
              </div>

              {/* Right Column (Files & Time Entries) */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', borderLeft: '1px solid rgba(255,255,255,0.05)', paddingLeft: '24px' }}>
                
                {/* FILES / ATTACHMENTS */}
                <div>
                  <h4 style={{ color: 'var(--text-secondary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Paperclip size={16} /> Attachments
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                    {files.map(f => (
                      <div key={f.id} style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <a href={`${API_BASE}/${f.file_path}`} target="_blank" rel="noreferrer" style={{ fontSize: '0.8rem', color: '#6366f1', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: 'none' }}>{f.filename}</a>
                          {f.is_internal && <span className="badge badge-internal" style={{ fontSize: '0.6rem' }}>Internal</span>}
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ 
                            fontSize: '0.7rem', 
                            color: f.approval_status === 'approved' ? '#10b981' : f.approval_status === 'needs_changes' ? '#ef4444' : '#f59e0b',
                            fontWeight: 'bold', textTransform: 'uppercase'
                          }}>
                            {f.approval_status.replace('_', ' ')}
                          </span>
                          
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button onClick={() => handleUpdateFileStatus(f.id, 'approved')} className="btn btn-secondary" style={{ padding: '4px 6px', fontSize: '0.65rem' }}>
                              Approve
                            </button>
                            <button onClick={() => handleUpdateFileStatus(f.id, 'needs_changes')} className="btn btn-secondary" style={{ padding: '4px 6px', fontSize: '0.65rem', color: '#ef4444' }}>
                              Reject
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {files.length === 0 && <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No attachments</p>}
                  </div>

                  <form onSubmit={handleFileUpload} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <input 
                      required 
                      type="file" 
                      onChange={e => setNewFile(e.target.files ? e.target.files[0] : null)} 
                      style={{ fontSize: '0.8rem', padding: '8px 12px' }}
                    />
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      {!isClient ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <input type="checkbox" checked={newFileInternal} onChange={e => setNewFileInternal(e.target.checked)} style={{ width: 'auto' }} id="fileInternal" />
                          <label htmlFor="fileInternal" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Internal</label>
                        </div>
                      ) : <div />}
                      <button type="submit" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.75rem' }} disabled={!newFile}>Upload File</button>
                    </div>
                  </form>
                </div>

                {/* TIME TRACKING */}
                <div>
                  <h4 style={{ color: 'var(--text-secondary)', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Clock size={16} /> Time Entries
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px', maxHeight: '120px', overflowY: 'auto' }}>
                    {timeEntries.map(t => (
                      <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)', background: 'rgba(255,255,255,0.02)', padding: '6px 10px', borderRadius: '6px' }}>
                        <span>{t.note || 'Logged work'}</span>
                        <span style={{ fontWeight: 'bold', color: '#f8fafc' }}>{round(t.duration_minutes / 60, 2)}h</span>
                      </div>
                    ))}
                    {timeEntries.length === 0 && <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No time tracked</p>}
                  </div>

                  {!isClient && (
                    <form onSubmit={handleLogTime} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '6px' }}>
                        <input required type="number" value={newTimeDuration} onChange={e => setNewTimeDuration(e.target.value)} placeholder="Mins" style={{ fontSize: '0.8rem' }} />
                        <input type="text" value={newTimeNote} onChange={e => setNewTimeNote(e.target.value)} placeholder="Note..." style={{ fontSize: '0.8rem' }} />
                      </div>
                      <button type="submit" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.75rem' }}>Log Hours</button>
                    </form>
                  )}
                </div>

              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}

function round(value: number, decimals: number) {
  return Number(Math.round(Number(value + 'e' + decimals)) + 'e-' + decimals);
}
