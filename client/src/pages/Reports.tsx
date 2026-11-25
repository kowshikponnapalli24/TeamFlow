import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  Clock3,
  Download,
  FolderKanban,
  ListTodo,
  RefreshCw,
  Target,
  Users,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../lib/api";

type ReportData = {
  success: boolean;
  organization: { id: string; name: string };
  scope: "workspace" | "personal";
  generatedAt: string;
  summary: {
    totalProjects: number;
    totalTasks: number;
    completedTasks: number;
    todoTasks: number;
    inProgressTasks: number;
    inReviewTasks: number;
    blockedTasks: number;
    overdueTasks: number;
    urgentTasks: number;
    completionRate: number;
  };
  statusBreakdown: { status: string; label: string; count: number }[];
  priorityBreakdown: { priority: string; label: string; count: number }[];
  projects: {
    id: string;
    name: string;
    teamName: string;
    dueDate: string | null;
    totalTasks: number;
    completedTasks: number;
    completionRate: number;
    overdueTasks: number;
  }[];
  members: {
    userId: string;
    name: string;
    email: string;
    role: string;
    assignedTasks: number;
    completedTasks: number;
    inProgressTasks: number;
    overdueTasks: number;
  }[];
  upcomingDeadlines: {
    id: string;
    title: string;
    projectName: string;
    dueDate: string;
    status: string;
    priority: string;
    assigneeName: string;
  }[];
};

const formatDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "No deadline";

const csvCell = (value: unknown) =>
  `"${String(value ?? "").replace(/"/g, '""')}"`;

export default function Reports() {
  const { activeOrganizationId, activeOrganization, role } = useAuth();
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadReports = async () => {
    if (!activeOrganizationId) {
      setReport(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const data = await apiRequest<ReportData>(
        `/organizations/${activeOrganizationId}/reports`
      );
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load reports.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadReports();
  }, [activeOrganizationId]);

  const exportCsv = () => {
    if (!report) return;
    const rows: unknown[][] = [
      ["TeamFlow Report", report.organization.name],
      ["Generated", new Date(report.generatedAt).toLocaleString("en-IN")],
      ["Scope", report.scope === "personal" ? "Personal tasks" : "Workspace"],
      [],
      ["Summary", "Count"],
      ["Projects", report.summary.totalProjects],
      ["Tasks", report.summary.totalTasks],
      ["Completed", report.summary.completedTasks],
      ["To do", report.summary.todoTasks],
      ["In progress", report.summary.inProgressTasks],
      ["In review", report.summary.inReviewTasks],
      ["Blocked", report.summary.blockedTasks],
      ["Overdue", report.summary.overdueTasks],
      ["Urgent", report.summary.urgentTasks],
      ["Completion rate", `${report.summary.completionRate}%`],
      [],
      ["Project", "Team", "Total tasks", "Completed", "Progress", "Overdue", "Due date"],
      ...report.projects.map((project) => [
        project.name,
        project.teamName,
        project.totalTasks,
        project.completedTasks,
        `${project.completionRate}%`,
        project.overdueTasks,
        formatDate(project.dueDate),
      ]),
      [],
      ["Member", "Role", "Assigned", "Completed", "In progress", "Overdue"],
      ...report.members.map((member) => [
        member.name,
        member.role,
        member.assignedTasks,
        member.completedTasks,
        member.inProgressTasks,
        member.overdueTasks,
      ]),
    ];

    const csv = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `teamflow-report-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const maxStatusCount = useMemo(
    () => Math.max(1, ...(report?.statusBreakdown.map((item) => item.count) ?? [])),
    [report]
  );

  if (loading) {
    return <div className="reports-loading"><RefreshCw size={18} /> Loading reports...</div>;
  }

  if (!activeOrganizationId) {
    return <div className="reports-empty"><AlertCircle size={20} /> Select a workspace to view reports.</div>;
  }

  if (error) {
    return (
      <div className="reports-error">
        <AlertCircle size={19} />
        <span>{error}</span>
        <button type="button" onClick={() => void loadReports()}>Retry</button>
      </div>
    );
  }

  if (!report) return null;

  const { summary } = report;

  return (
    <div className="reports-page">
      <div className="page-heading reports-heading">
        <div>
          <span className="eyebrow">WORKSPACE INSIGHTS</span>
          <h1>Reports & Analytics</h1>
          <p>
            {report.scope === "personal"
              ? "A summary of tasks assigned to you."
              : `Track project progress and team delivery in ${activeOrganization?.name ?? report.organization.name}.`}
          </p>
        </div>
        <div className="reports-actions">
          <button className="reports-secondary-button" type="button" onClick={() => void loadReports()}>
            <RefreshCw size={15} /> Refresh
          </button>
          <button className="reports-export-button" type="button" onClick={exportCsv}>
            <Download size={15} /> Export CSV
          </button>
        </div>
      </div>

      <div className="reports-scope-note">
        <BarChart3 size={16} />
        {report.scope === "personal"
          ? "Personal report · Only your assigned tasks are included"
          : `Workspace report · ${role ?? "Member"} access`}
        <span>Updated {new Date(report.generatedAt).toLocaleString("en-IN")}</span>
      </div>

      <div className="reports-stat-grid">
        <article className="reports-stat-card">
          <div className="reports-stat-icon purple"><FolderKanban size={19} /></div>
          <span>Total projects</span>
          <strong>{summary.totalProjects}</strong>
        </article>
        <article className="reports-stat-card">
          <div className="reports-stat-icon blue"><ListTodo size={19} /></div>
          <span>Total tasks</span>
          <strong>{summary.totalTasks}</strong>
        </article>
        <article className="reports-stat-card">
          <div className="reports-stat-icon green"><CheckCircle2 size={19} /></div>
          <span>Completed</span>
          <strong>{summary.completedTasks}</strong>
        </article>
        <article className="reports-stat-card">
          <div className="reports-stat-icon orange"><Clock3 size={19} /></div>
          <span>Overdue</span>
          <strong>{summary.overdueTasks}</strong>
        </article>
        <article className="reports-stat-card">
          <div className="reports-stat-icon red"><AlertCircle size={19} /></div>
          <span>Blocked</span>
          <strong>{summary.blockedTasks}</strong>
        </article>
        <article className="reports-stat-card">
          <div className="reports-stat-icon teal"><Target size={19} /></div>
          <span>Urgent</span>
          <strong>{summary.urgentTasks}</strong>
        </article>
      </div>

      <div className="reports-main-grid">
        <section className="reports-panel reports-progress-panel">
          <div className="reports-panel-heading">
            <div><h2>Overall completion</h2><p>Completed tasks against all tracked tasks</p></div>
            <strong>{summary.completionRate}%</strong>
          </div>
          <div className="reports-large-progress">
            <div style={{ width: `${summary.completionRate}%` }} />
          </div>
          <div className="reports-progress-foot">
            <span>{summary.completedTasks} completed</span>
            <span>{Math.max(0, summary.totalTasks - summary.completedTasks)} remaining</span>
          </div>
          <div className="reports-status-list">
            {report.statusBreakdown.map((item) => (
              <div className="reports-status-row" key={item.status}>
                <div className="reports-status-label"><span className={`reports-status-dot status-${item.status.toLowerCase()}`} />{item.label}</div>
                <div className="reports-status-track">
                  <div style={{ width: `${(item.count / maxStatusCount) * 100}%` }} />
                </div>
                <strong>{item.count}</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="reports-panel">
          <div className="reports-panel-heading">
            <div><h2>Priority distribution</h2><p>Tasks grouped by priority</p></div>
          </div>
          <div className="reports-priority-list">
            {report.priorityBreakdown.map((item) => {
              const percentage = summary.totalTasks
                ? Math.round((item.count / summary.totalTasks) * 100)
                : 0;
              return (
                <div className="reports-priority-item" key={item.priority}>
                  <div className="reports-priority-top">
                    <span className={`priority priority-${item.priority.toLowerCase()}`}>{item.label}</span>
                    <strong>{item.count} <small>({percentage}%)</small></strong>
                  </div>
                  <div className="reports-priority-track">
                    <div className={`priority-fill priority-fill-${item.priority.toLowerCase()}`} style={{ width: `${percentage}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <section className="reports-panel">
        <div className="reports-panel-heading">
          <div><h2>Project performance</h2><p>Completion and overdue task counts by project</p></div>
        </div>
        {report.projects.length === 0 ? (
          <p className="reports-no-data">No projects with reportable tasks yet.</p>
        ) : (
          <div className="reports-table-wrap">
            <table className="reports-table">
              <thead><tr><th>Project</th><th>Team</th><th>Tasks</th><th>Progress</th><th>Overdue</th><th>Deadline</th></tr></thead>
              <tbody>
                {report.projects.map((project) => (
                  <tr key={project.id}>
                    <td><strong>{project.name}</strong></td>
                    <td>{project.teamName}</td>
                    <td>{project.completedTasks}/{project.totalTasks}</td>
                    <td>
                      <div className="reports-table-progress">
                        <div><span style={{ width: `${project.completionRate}%` }} /></div>
                        <strong>{project.completionRate}%</strong>
                      </div>
                    </td>
                    <td><span className={project.overdueTasks ? "reports-danger-count" : ""}>{project.overdueTasks}</span></td>
                    <td>{formatDate(project.dueDate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="reports-bottom-grid">
        <section className="reports-panel">
          <div className="reports-panel-heading">
            <div><h2>{report.scope === "personal" ? "My workload" : "Team performance"}</h2><p>Assigned work and completion by member</p></div>
            <Users size={19} />
          </div>
          {report.members.length === 0 ? (
            <p className="reports-no-data">No member data available.</p>
          ) : (
            <div className="reports-member-list">
              {report.members.map((member) => (
                <div className="reports-member-row" key={member.userId}>
                  <div className="reports-member-avatar">{member.name.charAt(0).toUpperCase()}</div>
                  <div className="reports-member-info">
                    <strong>{member.name}</strong>
                    <span>{member.role} · {member.assignedTasks} assigned</span>
                    <div className="reports-member-track"><div style={{ width: `${member.assignedTasks ? (member.completedTasks / member.assignedTasks) * 100 : 0}%` }} /></div>
                  </div>
                  <div className="reports-member-numbers">
                    <strong>{member.completedTasks}/{member.assignedTasks}</strong>
                    <span>{member.overdueTasks} overdue</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="reports-panel">
          <div className="reports-panel-heading">
            <div><h2>Upcoming deadlines</h2><p>Open tasks with a due date</p></div>
            <Clock3 size={19} />
          </div>
          {report.upcomingDeadlines.length === 0 ? (
            <p className="reports-no-data">No open tasks with deadlines.</p>
          ) : (
            <div className="reports-deadline-list">
              {report.upcomingDeadlines.map((task) => (
                <div className="reports-deadline-row" key={task.id}>
                  <div className="reports-deadline-date">{new Date(task.dueDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</div>
                  <div className="reports-deadline-info">
                    <strong>{task.title}</strong>
                    <span>{task.projectName} · {task.assigneeName}</span>
                  </div>
                  <span className={`priority priority-${task.priority.toLowerCase()}`}>{task.priority}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
