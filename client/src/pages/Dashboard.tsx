
import { useEffect, useState } from "react";
import { apiRequest } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import {
  FolderKanban,
  ListTodo,
  CheckCircle2,
  Clock,
  AlertCircle,
  Users,
  CalendarDays,
  Activity as ActivityIcon,
} from "lucide-react";

interface Project {
  id: string;
  name: string;
  description?: string;
  status?: string;
  dueDate?: string;
  _count?: {
    tasks: number;
  };
}

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate?: string;
  projectId?: string;
  project?: {
    id: string;
    name: string;
  };
}

interface Team {
  id: string;
  name: string;
  description?: string;
  _count?: {
    members: number;
    projects: number;
  };
}

interface OrganizationMember {
  id: string;
  userId?: string;
  role: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
}

interface Activity {
  id: string;
  action: string;
  description?: string;
  createdAt: string;
  user?: {
    name: string;
  };
}

export default function Dashboard() {
  const { activeOrganizationId: organizationId } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadDashboard = async () => {
      if (!organizationId) {
        setProjects([]);
        setTasks([]);
        setTeams([]);
        setMembers([]);
        setActivities([]);
        setError("");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      // Clear previous workspace data while the new workspace loads.
      setProjects([]);
      setTasks([]);
      setTeams([]);
      setMembers([]);
      setActivities([]);

      try {
        const [projectResponse, teamResponse, memberResponse] =
          await Promise.all([
            apiRequest<{ projects?: Project[] }>(
              `/organizations/${organizationId}/projects`
            ),
            apiRequest<{ teams?: Team[] }>(
              `/organizations/${organizationId}/teams`
            ),
            apiRequest<{ members?: OrganizationMember[] }>(
              `/organizations/${organizationId}/members`
            ),
          ]);

        if (cancelled) return;

        const projectList = projectResponse.projects ?? [];
        setProjects(projectList);
        setTeams(teamResponse.teams ?? []);
        setMembers(memberResponse.members ?? []);

        const taskResponses = await Promise.all(
          projectList.map((project) =>
            apiRequest<{ tasks?: Task[] }>(
              `/organizations/${organizationId}/projects/${project.id}/tasks`
            )
          )
        );

        if (cancelled) return;

        const allTasks = taskResponses.flatMap(
          (response) => response.tasks ?? []
        );
        setTasks(allTasks);

        const activityResponses = await Promise.all(
          projectList.map((project) =>
            apiRequest<{ activities?: Activity[] }>(
              `/organizations/${organizationId}/projects/${project.id}/activity`
            )
          )
        );

        if (cancelled) return;

        const allActivities = activityResponses
          .flatMap((response) => response.activities ?? [])
          .sort(
            (a, b) =>
              new Date(b.createdAt).getTime() -
              new Date(a.createdAt).getTime()
          )
          .slice(0, 8);

        setActivities(allActivities);
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load dashboard"
          );
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  const totalTasks = tasks.length;

  const completedTasks = tasks.filter(
    (task) => task.status === "DONE"
  ).length;

  const inProgressTasks = tasks.filter(
    (task) => task.status === "IN_PROGRESS"
  ).length;

  const blockedTasks = tasks.filter(
    (task) => task.status === "BLOCKED"
  ).length;

  const todoTasks = tasks.filter(
    (task) => task.status === "TODO"
  ).length;

  const reviewTasks = tasks.filter(
    (task) => task.status === "IN_REVIEW"
  ).length;

  const completionPercentage =
    totalTasks > 0
      ? Math.round((completedTasks / totalTasks) * 100)
      : 0;

  const upcomingTasks = tasks
    .filter(
      (task) =>
        task.dueDate &&
        task.status !== "DONE" &&
        new Date(task.dueDate).getTime() >= Date.now()
    )
    .sort(
      (a, b) =>
        new Date(a.dueDate!).getTime() -
        new Date(b.dueDate!).getTime()
    )
    .slice(0, 5);

  const recentProjects = [...projects].slice(-5).reverse();

  const formatDate = (date?: string) => {
    if (!date) return "No deadline";

    return new Date(date).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const formatActivityDate = (date: string) =>
    new Date(date).toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      hour: "numeric",
      minute: "2-digit",
    });

  if (loading) {
    return (
      <div className="dashboard-loading">
        Loading dashboard...
      </div>
    );
  }

  if (!organizationId) {
    return (
      <div className="dashboard-error">
        <AlertCircle size={20} />
        <span>Please select a workspace using the Active Workspace selector.</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="dashboard-error">
        <AlertCircle size={20} />
        <span>{error}</span>
        <button onClick={() => window.location.reload()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <div>
          <h1>Dashboard</h1>
          <p>
            Welcome back! Here's an overview of your workspace.
          </p>
        </div>
      </div>

      <div className="dashboard-stats">
        <div className="stat-card">
          <div className="stat-icon purple">
            <FolderKanban />
          </div>
          <div>
            <p>Total Projects</p>
            <h2>{projects.length}</h2>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon blue">
            <ListTodo />
          </div>
          <div>
            <p>Total Tasks</p>
            <h2>{totalTasks}</h2>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green">
            <CheckCircle2 />
          </div>
          <div>
            <p>Completed Tasks</p>
            <h2>{completedTasks}</h2>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon orange">
            <Clock />
          </div>
          <div>
            <p>In Progress</p>
            <h2>{inProgressTasks}</h2>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon red">
            <AlertCircle />
          </div>
          <div>
            <p>Blocked Tasks</p>
            <h2>{blockedTasks}</h2>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon teal">
            <Users />
          </div>
          <div>
            <p>Team Members</p>
            <h2>{members.length}</h2>
          </div>
        </div>
      </div>

      <section className="dashboard-section">
        <div className="section-heading">
          <div>
            <h2>Task Progress</h2>
            <p>Overall progress across your projects</p>
          </div>
          <strong>{completionPercentage}% completed</strong>
        </div>

        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: `${completionPercentage}%` }}
          />
        </div>

        <div className="task-status-summary">
          <span>To Do: <strong>{todoTasks}</strong></span>
          <span>In Progress: <strong>{inProgressTasks}</strong></span>
          <span>In Review: <strong>{reviewTasks}</strong></span>
          <span>Completed: <strong>{completedTasks}</strong></span>
          <span>Blocked: <strong>{blockedTasks}</strong></span>
        </div>
      </section>

      <section className="dashboard-section">
        <div className="section-heading">
          <div>
            <h2>Upcoming Deadlines</h2>
            <p>Tasks that need your attention</p>
          </div>
          <CalendarDays size={21} />
        </div>

        {upcomingTasks.length === 0 ? (
          <p className="empty-state">No upcoming deadlines.</p>
        ) : (
          <div className="dashboard-list">
            {upcomingTasks.map((task) => (
              <div className="dashboard-list-item" key={task.id}>
                <div>
                  <strong>{task.title}</strong>
                  <p>{task.project?.name ?? "Project task"}</p>
                </div>

                <div className="deadline-info">
                  <span>{formatDate(task.dueDate)}</span>
                  <span
                    className={`priority priority-${task.priority?.toLowerCase()}`}
                  >
                    {task.priority}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="dashboard-section">
        <div className="section-heading">
          <div>
            <h2>Recent Projects</h2>
            <p>Your latest workspace projects</p>
          </div>
        </div>

        {recentProjects.length === 0 ? (
          <p className="empty-state">No projects created yet.</p>
        ) : (
          <div className="dashboard-project-grid">
            {recentProjects.map((project) => (
              <div
                className="dashboard-project-card"
                key={project.id}
              >
                <div className="project-card-icon">
                  <FolderKanban />
                </div>

                <h3>{project.name}</h3>
                <p>
                  {project.description || "No project description available."}
                </p>

                <div className="project-card-footer">
                  <span>
                    {project._count?.tasks ??
                      tasks.filter(
                        (task) => task.projectId === project.id
                      ).length}{" "}
                    tasks
                  </span>
                  <span>{project.status ?? "ACTIVE"}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="dashboard-section">
        <div className="section-heading">
          <div>
            <h2>Team Overview</h2>
            <p>Teams in your organization</p>
          </div>
          <Users size={21} />
        </div>

        {teams.length === 0 ? (
          <p className="empty-state">No teams created yet.</p>
        ) : (
          <div className="dashboard-list">
            {teams.map((team) => (
              <div className="dashboard-list-item" key={team.id}>
                <div>
                  <strong>{team.name}</strong>
                  <p>{team.description || "Team workspace"}</p>
                </div>

                <div className="team-count">
                  <Users size={16} />
                  {team._count?.members ?? 0} members
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="dashboard-section">
        <div className="section-heading">
          <div>
            <h2>Recent Activity</h2>
            <p>Latest updates across your projects</p>
          </div>
          <ActivityIcon size={21} />
        </div>

        {activities.length === 0 ? (
          <p className="empty-state">No recent activity available.</p>
        ) : (
          <div className="dashboard-list">
            {activities.map((activity) => (
              <div className="dashboard-list-item" key={activity.id}>
                <div>
                  <strong>{activity.user?.name ?? "A team member"}</strong>
                  <p>{activity.description ?? activity.action}</p>
                </div>

                <span className="activity-date">
                  {formatActivityDate(activity.createdAt)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
