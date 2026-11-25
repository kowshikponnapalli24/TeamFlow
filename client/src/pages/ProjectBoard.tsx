
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type DragEvent,
} from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  X,
  MessageSquare,
  CalendarDays,
  UserRound,
  Trash2,
  Activity as ActivityIcon,
  Clock3,
  RefreshCw,
  Users,
  UserPlus,
  ShieldCheck,
  Link2,
  AlertTriangle,
  CheckCircle2,
  Paperclip,
  Upload,
  Download,
  FileText,
} from "lucide-react";

import { apiRequest, getToken } from "../lib/api";
import { useAuth } from "../context/AuthContext";

type TaskStatus =
  | "TODO"
  | "IN_PROGRESS"
  | "IN_REVIEW"
  | "DONE"
  | "BLOCKED";

type TaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

interface User {
  id: string;
  name: string;
  email: string;
}

interface OrganizationMember {
  id: string;
  userId: string;
  role: string;
  user: User;
}

interface ProjectMember {
  id: string;
  projectId: string;
  userId: string;
  joinedAt: string;
  user: User;
}

interface DependencyTask {
  id: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  projectId?: string;
}

interface Task {
  id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: string | null;
  labels: string[];
  assignee?: User | null;
  comments?: { id: string }[];
  _count?: {
    comments: number;
  };
  dependsOn?: DependencyTask[];
  blocks?: DependencyTask[];
  createdAt?: string;
}

interface Project {
  id: string;
  name: string;
  description?: string | null;
  dueDate?: string | null;
  members?: ProjectMember[];
  _count?: {
    members: number;
    tasks: number;
  };
}

interface Comment {
  id: string;
  content: string;
  createdAt: string;
  author: {
    id: string;
    name: string;
  };
}

interface TaskAttachment {
  id: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
  uploadedBy: {
    id: string;
    name: string;
  };
}

interface Activity {
  id: string;
  action: string;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    email?: string;
  } | null;
  task?: {
    id: string;
    title: string;
  } | null;
}

const columns: { status: TaskStatus; label: string }[] = [
  { status: "TODO", label: "To do" },
  { status: "IN_PROGRESS", label: "In progress" },
  { status: "IN_REVIEW", label: "In review" },
  { status: "DONE", label: "Done" },
  { status: "BLOCKED", label: "Blocked" },
];

const priorities: TaskPriority[] = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "URGENT",
];

const activityLabels: Record<string, string> = {
  TASK_CREATED: "created a task",
  TASK_UPDATED: "updated a task",
  TASK_DELETED: "deleted a task",
  COMMENT_ADDED: "commented on a task",
  TASK_ASSIGNED: "assigned a task",
  PROJECT_UPDATED: "updated the project",
};

function getActivityLabel(action: string) {
  return (
    activityLabels[action] ??
    action.replace(/_/g, " ").toLowerCase()
  );
}

export default function ProjectBoard() {
  const { organizationId, projectId } = useParams<{
    organizationId: string;
    projectId: string;
  }>();

  const { role, user } = useAuth();

  const canManage = role === "ADMIN" || role === "MANAGER";

  const basePath = `/organizations/${organizationId}/projects/${projectId}`;

  const [project, setProject] = useState<Project | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);

  const [activities, setActivities] = useState<Activity[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [activityError, setActivityError] = useState("");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const [saving, setSaving] = useState(false);
  const [commentSaving, setCommentSaving] = useState(false);

  // Project member management
  const [selectedMemberEmail, setSelectedMemberEmail] = useState("");
  const [memberSaving, setMemberSaving] = useState(false);
  const [memberError, setMemberError] = useState("");
  const [memberSuccess, setMemberSuccess] = useState("");

  // Create task form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("MEDIUM");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [labels, setLabels] = useState("");

  // Comments
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");

  // Task attachments
  const [attachments, setAttachments] = useState<TaskAttachment[]>([]);
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentLoading, setAttachmentLoading] = useState(false);
  const [attachmentUploading, setAttachmentUploading] = useState(false);
  const [attachmentError, setAttachmentError] = useState("");
  const [deletingAttachmentId, setDeletingAttachmentId] = useState("");

  // Task dependencies
  const [dependencyTaskId, setDependencyTaskId] = useState("");
  const [dependencySaving, setDependencySaving] = useState(false);
  const [dependencyError, setDependencyError] = useState("");

  // ---------------- LOAD ACTIVITY TIMELINE ----------------

  const loadActivity = useCallback(async () => {
    if (!organizationId || !projectId) return;

    setActivityLoading(true);
    setActivityError("");

    try {
      const data = await apiRequest<{
        activities: Activity[];
      }>(`${basePath}/activity`);

      setActivities(data.activities ?? []);
    } catch (err) {
      setActivityError(
        err instanceof Error
          ? err.message
          : "Could not load project activity"
      );
    } finally {
      setActivityLoading(false);
    }
  }, [basePath, organizationId, projectId]);

  // ---------------- LOAD PROJECT MEMBERS ----------------

  const loadProjectMembers = useCallback(async () => {
    if (!organizationId || !projectId) return;

    const data = await apiRequest<{
      project: Project;
    }>(basePath);

    const loadedMembers = data.project.members ?? [];

    setProjectMembers(loadedMembers);
    setProject(data.project);
  }, [basePath, organizationId, projectId]);

  // ---------------- LOAD BOARD ----------------

  const loadBoard = useCallback(async () => {
    if (!organizationId || !projectId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const [projectData, taskData, memberData] = await Promise.all([
        apiRequest<{ project: Project }>(basePath),

        apiRequest<{ tasks: Task[] }>(
          `${basePath}/tasks`
        ),

        apiRequest<{ members: OrganizationMember[] }>(
          `/organizations/${organizationId}/members`
        ),
      ]);

      setProject(projectData.project);
      setProjectMembers(projectData.project.members ?? []);
      setTasks(taskData.tasks ?? []);
      setMembers(memberData.members ?? []);

      await loadActivity();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load project"
      );
    } finally {
      setLoading(false);
    }
  }, [basePath, organizationId, projectId, loadActivity]);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  // ---------------- ADD PROJECT MEMBER ----------------

  const addProjectMember = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!canManage) {
      setMemberError("Only admins and managers can add project members.");
      return;
    }

    if (!selectedMemberEmail) {
      setMemberError("Please select a member.");
      return;
    }

    setMemberSaving(true);
    setMemberError("");
    setMemberSuccess("");

    try {
      const data = await apiRequest<{
        success: boolean;
        message: string;
      }>(`${basePath}/members`, {
        method: "POST",
        body: JSON.stringify({
          email: selectedMemberEmail,
        }),
      });

      await loadProjectMembers();

      setSelectedMemberEmail("");
      setMemberSuccess(data.message || "Project member added successfully.");
    } catch (err) {
      setMemberError(
        err instanceof Error
          ? err.message
          : "Could not add project member"
      );
    } finally {
      setMemberSaving(false);
    }
  };

  // ---------------- REMOVE PROJECT MEMBER ----------------

  const removeProjectMember = async (member: ProjectMember) => {
    if (!canManage) {
      setMemberError("Only admins and managers can remove project members.");
      return;
    }

    const confirmed = window.confirm(
      `Remove ${member.user.name} from this project?`
    );

    if (!confirmed) return;

    setMemberSaving(true);
    setMemberError("");
    setMemberSuccess("");

    try {
      const data = await apiRequest<{
        success: boolean;
        message: string;
      }>(
        `${basePath}/members/${member.userId}`,
        {
          method: "DELETE",
        }
      );

      await loadProjectMembers();

      setMemberSuccess(data.message || "Project member removed successfully.");
    } catch (err) {
      setMemberError(
        err instanceof Error
          ? err.message
          : "Could not remove project member"
      );
    } finally {
      setMemberSaving(false);
    }
  };

  // Members of the organization who have not yet joined this project
  const availableMembers = members.filter(
    (member) =>
      !projectMembers.some(
        (projectMember) => projectMember.userId === member.user.id
      )
  );

  // ---------------- CREATE TASK ----------------

  const resetCreateForm = () => {
    setTitle("");
    setDescription("");
    setPriority("MEDIUM");
    setAssigneeId("");
    setDueDate("");
    setLabels("");
  };

  const createTask = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!canManage) {
      setError("Only admins and managers can create tasks.");
      return;
    }

    if (!title.trim()) {
      setError("Please enter a task title.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const data = await apiRequest<{ task: Task }>(
        `${basePath}/tasks`,
        {
          method: "POST",
          body: JSON.stringify({
            title: title.trim(),
            description: description.trim() || undefined,
            priority,
            status: "TODO",
            assigneeId: assigneeId || undefined,
            dueDate: dueDate
              ? new Date(`${dueDate}T12:00:00`).toISOString()
              : undefined,
            labels: labels
              .split(",")
              .map((label) => label.trim())
              .filter(Boolean),
          }),
        }
      );

      setTasks((current) => [data.task, ...current]);

      resetCreateForm();
      setShowCreate(false);

      void loadActivity();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not create task"
      );
    } finally {
      setSaving(false);
    }
  };

  // ---------------- UPDATE TASK ----------------

  const updateTask = async (
    task: Task,
    updates: {
      status?: TaskStatus;
      priority?: TaskPriority;
      assigneeId?: string | null;
    }
  ) => {
    if (
      !canManage &&
      (updates.priority !== undefined ||
        updates.assigneeId !== undefined)
    ) {
      setError("You are not authorized to edit these task fields.");
      return;
    }

    const previousTasks = [...tasks];
    const previousSelectedTask = selectedTask;

    const optimisticTask: Task = {
      ...task,
      ...updates,
      assignee:
        updates.assigneeId !== undefined
          ? members.find(
              (member) => member.user.id === updates.assigneeId
            )?.user ?? null
          : task.assignee,
    };

    setTasks((current) =>
      current.map((item) =>
        item.id === task.id ? optimisticTask : item
      )
    );

    setSelectedTask((current) =>
      current?.id === task.id ? optimisticTask : current
    );

    setError("");

    try {
      const data = await apiRequest<{ task: Task }>(
        `${basePath}/tasks/${task.id}`,
        {
          method: "PATCH",
          body: JSON.stringify(updates),
        }
      );

      const updatedTask: Task = {
        ...data.task,
        dependsOn: data.task.dependsOn ?? task.dependsOn ?? [],
        blocks: data.task.blocks ?? task.blocks ?? [],
      };

      setTasks((current) =>
        current.map((item) =>
          item.id === task.id ? updatedTask : item
        )
      );

      setSelectedTask((current) =>
        current?.id === task.id ? updatedTask : current
      );

      void loadActivity();
    } catch (err) {
      setTasks(previousTasks);
      setSelectedTask(previousSelectedTask);

      setError(
        err instanceof Error
          ? err.message
          : "Could not update task"
      );
    }
  };

  const changeTaskStatus = async (
    task: Task,
    status: TaskStatus
  ) => {
    if (task.status === status) return;

    await updateTask(task, { status });
  };

  const changeTaskPriority = async (
    task: Task,
    nextPriority: TaskPriority
  ) => {
    if (task.priority === nextPriority) return;

    await updateTask(task, { priority: nextPriority });
  };

  const changeTaskAssignee = async (
    task: Task,
    nextAssigneeId: string
  ) => {
    const currentAssigneeId = task.assignee?.id ?? "";

    if (currentAssigneeId === nextAssigneeId) return;

    await updateTask(task, {
      assigneeId: nextAssigneeId || null,
    });
  };

  // ---------------- DELETE TASK ----------------

  const deleteTask = async (task: Task) => {
    if (!canManage) {
      setError("Only admins and managers can delete tasks.");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete "${task.title}"?`
    );

    if (!confirmed) return;

    setSaving(true);
    setError("");

    try {
      await apiRequest(
        `${basePath}/tasks/${task.id}`,
        {
          method: "DELETE",
        }
      );

      setTasks((current) =>
        current.filter((item) => item.id !== task.id)
      );

      setSelectedTask(null);
      setComments([]);

      void loadActivity();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not delete task"
      );
    } finally {
      setSaving(false);
    }
  };

  // ---------------- OPEN TASK ----------------

  const openTask = async (task: Task) => {
    setSelectedTask(task);
    setComments([]);
    setCommentText("");
    setError("");
    setDependencyError("");
    setDependencyTaskId("");
    setAttachments([]);
    setAttachmentFile(null);
    setAttachmentError("");
    setAttachmentLoading(true);

    try {
      const [detailData, commentData] = await Promise.all([
        apiRequest<{ task: Task }>(
          `${basePath}/tasks/${task.id}`
        ),
        apiRequest<{ comments: Comment[] }>(
          `${basePath}/tasks/${task.id}/comments`
        ),
      ]);

      const detailedTask = detailData.task;
      setSelectedTask(detailedTask);
      setTasks((current) =>
        current.map((item) =>
          item.id === detailedTask.id
            ? { ...item, ...detailedTask }
            : item
        )
      );
      setComments(commentData.comments ?? []);
      try {
        const attachmentData = await apiRequest<{ attachments: TaskAttachment[] }>(
          `${basePath}/tasks/${task.id}/attachments`
        );
        setAttachments(attachmentData.attachments ?? []);
      } catch (attachmentErr) {
        setAttachments([]);
        setAttachmentError(
          attachmentErr instanceof Error
            ? attachmentErr.message
            : "Could not load task attachments"
        );
      }
    } catch (err) {
      setComments([]);
      setError(
        err instanceof Error
          ? err.message
          : "Could not load task details"
      );
    } finally {
      setAttachmentLoading(false);
    }
  };

  // ---------------- TASK ATTACHMENTS ----------------

  const uploadAttachment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedTask || !attachmentFile) return;

    setAttachmentUploading(true);
    setAttachmentError("");

    try {
      const formData = new FormData();
      formData.append("file", attachmentFile);
      const token = getToken();
      const response = await fetch(
        `/api${basePath}/tasks/${selectedTask.id}/attachments`,
        {
          method: "POST",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "Could not upload attachment");
      }

      const refreshed = await apiRequest<{ attachments: TaskAttachment[] }>(
        `${basePath}/tasks/${selectedTask.id}/attachments`
      );
      setAttachments(refreshed.attachments ?? []);
      setAttachmentFile(null);
      const fileInput = document.getElementById("task-attachment-file") as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";
      void loadActivity();
    } catch (err) {
      setAttachmentError(
        err instanceof Error ? err.message : "Could not upload attachment"
      );
    } finally {
      setAttachmentUploading(false);
    }
  };

  const downloadAttachment = async (attachment: TaskAttachment) => {
    if (!selectedTask) return;
    setAttachmentError("");

    try {
      const token = getToken();
      const response = await fetch(
        `/api${basePath}/tasks/${selectedTask.id}/attachments/${attachment.id}/download`,
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "Could not download attachment");
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = attachment.originalName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch (err) {
      setAttachmentError(
        err instanceof Error ? err.message : "Could not download attachment"
      );
    }
  };

  const deleteAttachment = async (attachment: TaskAttachment) => {
    if (!selectedTask) return;
    const allowed = canManage || attachment.uploadedBy?.id === user?.id;
    if (!allowed) return;

    if (!window.confirm(`Delete attachment "${attachment.originalName}"?`)) return;

    setDeletingAttachmentId(attachment.id);
    setAttachmentError("");
    try {
      await apiRequest(
        `${basePath}/tasks/${selectedTask.id}/attachments/${attachment.id}`,
        { method: "DELETE" }
      );
      setAttachments((current) => current.filter((item) => item.id !== attachment.id));
      void loadActivity();
    } catch (err) {
      setAttachmentError(
        err instanceof Error ? err.message : "Could not delete attachment"
      );
    } finally {
      setDeletingAttachmentId("");
    }
  };

  const formatAttachmentSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // ---------------- TASK DEPENDENCIES ----------------

  const refreshTaskDetails = async (taskId: string) => {
    const data = await apiRequest<{ task: Task }>(
      `${basePath}/tasks/${taskId}`
    );

    setSelectedTask(data.task);
    setTasks((current) =>
      current.map((item) =>
        item.id === taskId ? { ...item, ...data.task } : item
      )
    );
  };

  const addDependency = async () => {
    if (!selectedTask || !dependencyTaskId || !canManage) return;

    setDependencySaving(true);
    setDependencyError("");

    try {
      await apiRequest(
        `${basePath}/tasks/${selectedTask.id}/dependencies`,
        {
          method: "POST",
          body: JSON.stringify({ dependencyTaskId }),
        }
      );

      await refreshTaskDetails(selectedTask.id);
      setDependencyTaskId("");
      void loadActivity();
    } catch (err) {
      setDependencyError(
        err instanceof Error
          ? err.message
          : "Could not add task dependency"
      );
    } finally {
      setDependencySaving(false);
    }
  };

  const removeDependency = async (dependency: DependencyTask) => {
    if (!selectedTask || !canManage) return;

    setDependencySaving(true);
    setDependencyError("");

    try {
      await apiRequest(
        `${basePath}/tasks/${selectedTask.id}/dependencies/${dependency.id}`,
        { method: "DELETE" }
      );

      await refreshTaskDetails(selectedTask.id);
      void loadActivity();
    } catch (err) {
      setDependencyError(
        err instanceof Error
          ? err.message
          : "Could not remove task dependency"
      );
    } finally {
      setDependencySaving(false);
    }
  };

  // ---------------- ADD COMMENT ----------------

  const addComment = async (
    event: FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!selectedTask || !commentText.trim()) return;

    setCommentSaving(true);
    setError("");

    try {
      const data = await apiRequest<{
        comment: Comment;
      }>(
        `${basePath}/tasks/${selectedTask.id}/comments`,
        {
          method: "POST",
          body: JSON.stringify({
            content: commentText.trim(),
          }),
        }
      );

      setComments((current) => [
        ...current,
        data.comment,
      ]);

      setCommentText("");

      setTasks((current) =>
        current.map((task) =>
          task.id === selectedTask.id
            ? {
                ...task,
                _count: {
                  comments: (task._count?.comments ?? 0) + 1,
                },
              }
            : task
        )
      );

      void loadActivity();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not add comment"
      );
    } finally {
      setCommentSaving(false);
    }
  };

  // ---------------- DRAG AND DROP ----------------

  const handleDrop = (
    event: DragEvent<HTMLDivElement>,
    status: TaskStatus
  ) => {
    event.preventDefault();

    const taskId = event.dataTransfer.getData("taskId");
    const task = tasks.find(
      (item) => item.id === taskId
    );

    if (task && task.status !== status) {
      void changeTaskStatus(task, status);
    }
  };

  // ---------------- LOADING / ERROR ----------------

  if (loading) {
    return (
      <div className="loading-screen">
        Loading project...
      </div>
    );
  }

  if (error && !project) {
    return (
      <div className="content-card">
        <p className="error-message">{error}</p>
        <Link to="/projects">Back to projects</Link>
      </div>
    );
  }

  // ---------------- MAIN UI ----------------

  return (
    <div className="board-page">
      <Link to="/projects" className="back-link">
        <ArrowLeft size={17} />
        Back to projects
      </Link>

      <div className="board-heading">
        <div>
          <span className="eyebrow">
            PROJECT WORKSPACE
          </span>

          <h1>{project?.name || "Project board"}</h1>

          <p>
            {project?.description ||
              "Manage tasks and track progress."}
          </p>
        </div>

        {canManage && (
          <button
            className="primary-button create-project-button"
            onClick={() => {
              setError("");
              setShowCreate(true);
            }}
          >
            <Plus size={18} />
            Add task
          </button>
        )}
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="board-summary">
        <span>{tasks.length} total tasks</span>

        <span>
          {tasks.filter(
            (task) => task.status === "DONE"
          ).length}{" "}
          completed
        </span>

        <span>
          <Users size={14} />
          {projectMembers.length} project members
        </span>

        {project?.dueDate && (
          <span>
            Due{" "}
            {new Date(project.dueDate).toLocaleDateString("en-IN")}
          </span>
        )}
      </div>

      {/* PROJECT MEMBERS */}

      <section className="content-card project-members-section">
        <div className="project-members-heading">
          <div>
            <span className="eyebrow">
              TEAM COLLABORATION
            </span>

            <h2>
              <Users size={21} />
              Project members
              <span className="member-count">
                {projectMembers.length}
              </span>
            </h2>

            <p>
              People who have access to this project.
            </p>
          </div>
        </div>

        {memberError && (
          <div className="error-message">
            {memberError}
          </div>
        )}

        {memberSuccess && (
          <div className="success-message">
            {memberSuccess}
          </div>
        )}

        {canManage && (
          <form
            className="add-project-member-form"
            onSubmit={addProjectMember}
          >
            <div className="member-select-wrapper">
              <label htmlFor="project-member-select">
                Add organization member
              </label>

              <select
                id="project-member-select"
                value={selectedMemberEmail}
                onChange={(event) => {
                  setSelectedMemberEmail(event.target.value);
                  setMemberError("");
                  setMemberSuccess("");
                }}
                disabled={memberSaving || availableMembers.length === 0}
              >
                <option value="">
                  {availableMembers.length === 0
                    ? "All organization members are already added"
                    : "Select a member"}
                </option>

                {availableMembers.map((member) => (
                  <option
                    key={member.user.id}
                    value={member.user.email}
                  >
                    {member.user.name} ({member.role})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="primary-button add-member-button"
              disabled={
                memberSaving ||
                !selectedMemberEmail ||
                availableMembers.length === 0
              }
            >
              <UserPlus size={17} />
              {memberSaving ? "Please wait..." : "Add member"}
            </button>
          </form>
        )}

        {projectMembers.length === 0 ? (
          <div className="members-empty">
            <Users size={28} />
            <strong>No project members yet</strong>
            <span>
              {canManage
                ? "Add people from your organization to collaborate on this project."
                : "Project members will appear here when they are added."}
            </span>
          </div>
        ) : (
          <div className="project-member-list">
            {projectMembers.map((projectMember) => {
              const organizationMember = members.find(
                (member) => member.user.id === projectMember.userId
              );

              const memberRole = organizationMember?.role ?? "MEMBER";

              return (
                <div
                  className="project-member-item"
                  key={projectMember.id}
                >
                  <div className="project-member-avatar">
                    {projectMember.user.name
                      .charAt(0)
                      .toUpperCase()}
                  </div>

                  <div className="project-member-info">
                    <strong>{projectMember.user.name}</strong>
                    <span>{projectMember.user.email}</span>
                  </div>

                  <div className="project-member-role">
                    <ShieldCheck size={14} />
                    {memberRole}
                  </div>

                  {canManage && (
                    <button
                      type="button"
                      className="icon-button remove-member-button"
                      title={`Remove ${projectMember.user.name}`}
                      aria-label={`Remove ${projectMember.user.name}`}
                      disabled={memberSaving}
                      onClick={() =>
                        void removeProjectMember(projectMember)
                      }
                    >
                      <Trash2 size={17} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* KANBAN BOARD */}

      <section className="kanban-board">
        {columns.map((column) => {
          const columnTasks = tasks.filter(
            (task) => task.status === column.status
          );

          return (
            <div
              className="kanban-column"
              key={column.status}
              onDragOver={(event) =>
                event.preventDefault()
              }
              onDrop={(event) =>
                handleDrop(event, column.status)
              }
            >
              <div className="kanban-column-heading">
                <div>
                  <span
                    className={`status-dot status-${column.status}`}
                  />
                  <strong>{column.label}</strong>
                </div>

                <span className="task-count">
                  {columnTasks.length}
                </span>
              </div>

              <div className="kanban-task-list">
                {columnTasks.map((task) => (
                  <article
                    className="task-card"
                    key={task.id}
                    draggable
                    onDragStart={(event) =>
                      event.dataTransfer.setData(
                        "taskId",
                        task.id
                      )
                    }
                    onClick={() => void openTask(task)}
                  >
                    <div className="task-card-top">
                      <span
                        className={`priority-badge priority-${task.priority}`}
                      >
                        {task.priority}
                      </span>

                      <span className="task-drag-hint">
                        ⠿
                      </span>
                    </div>

                    <h3>{task.title}</h3>

                    {task.description && (
                      <p>{task.description}</p>
                    )}

                    {task.labels?.length > 0 && (
                      <div className="task-labels">
                        {task.labels.map((label) => (
                          <span key={label}>
                            {label}
                          </span>
                        ))}
                      </div>
                    )}

                    <div className="task-card-footer">
                      <span>
                        <MessageSquare size={14} />
                        {task._count?.comments ??
                          task.comments?.length ??
                          0}
                      </span>

                      {task.dueDate && (
                        <span>
                          <CalendarDays size={14} />
                          {new Date(
                            task.dueDate
                          ).toLocaleDateString("en-IN")}
                        </span>
                      )}

                      {task.assignee && (
                        <span
                          className="task-assignee"
                          title={task.assignee.name}
                        >
                          {task.assignee.name
                            .charAt(0)
                            .toUpperCase()}
                        </span>
                      )}
                    </div>
                  </article>
                ))}

                {columnTasks.length === 0 && (
                  <div className="column-empty">
                    Drop tasks here
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </section>

      {/* PROJECT ACTIVITY TIMELINE */}

      <section className="content-card project-activity-section">
        <div className="activity-heading">
          <div>
            <span className="eyebrow">
              PROJECT HISTORY
            </span>

            <h2>
              <ActivityIcon size={21} />
              Activity timeline
            </h2>

            <p>
              Track changes and updates made by your team.
            </p>
          </div>

          <button
            type="button"
            className="icon-button"
            onClick={() => void loadActivity()}
            disabled={activityLoading}
            title="Refresh activity"
            aria-label="Refresh activity"
          >
            <RefreshCw
              size={18}
              className={activityLoading ? "spin-icon" : ""}
            />
          </button>
        </div>

        {activityError && (
          <div className="error-message">
            {activityError}
          </div>
        )}

        {activityLoading ? (
          <p className="muted-text">
            Loading project activity...
          </p>
        ) : activities.length === 0 ? (
          <div className="activity-empty">
            <ActivityIcon size={28} />
            <p>No project activity yet.</p>
            <span>
              Task creation, updates and comments will appear here.
            </span>
          </div>
        ) : (
          <div className="activity-timeline">
            {activities.map((activity) => (
              <div
                className="activity-item"
                key={activity.id}
              >
                <div className="activity-marker">
                  <Clock3 size={15} />
                </div>

                <div className="activity-content">
                  <p>
                    <strong>
                      {activity.user?.name || "A team member"}
                    </strong>{" "}
                    {getActivityLabel(activity.action)}

                    {activity.task?.title && (
                      <>
                        {" "}
                        <span className="activity-task-name">
                          "{activity.task.title}"
                        </span>
                      </>
                    )}
                  </p>

                  <span className="activity-time">
                    {new Date(
                      activity.createdAt
                    ).toLocaleString("en-IN", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* CREATE TASK MODAL */}

      {showCreate && canManage && (
        <div
          className="modal-backdrop"
          onClick={() => {
            if (!saving) setShowCreate(false);
          }}
        >
          <section
            className="modal-card"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="modal-heading">
              <div>
                <h2>Create task</h2>
                <p>
                  Add a task to this project.
                </p>
              </div>

              <button
                className="icon-button"
                onClick={() => setShowCreate(false)}
                aria-label="Close"
                disabled={saving}
              >
                <X size={20} />
              </button>
            </div>

            <form
              className="modal-form"
              onSubmit={createTask}
            >
              <label htmlFor="task-title">
                Task title
              </label>

              <input
                id="task-title"
                value={title}
                onChange={(event) =>
                  setTitle(event.target.value)
                }
                placeholder="What needs to be done?"
                maxLength={200}
                required
              />

              <label htmlFor="task-description">
                Description
              </label>

              <textarea
                id="task-description"
                value={description}
                onChange={(event) =>
                  setDescription(event.target.value)
                }
                rows={3}
                maxLength={5000}
                placeholder="Add task details..."
              />

              <label htmlFor="task-priority">
                Priority
              </label>

              <select
                id="task-priority"
                value={priority}
                onChange={(event) =>
                  setPriority(
                    event.target.value as TaskPriority
                  )
                }
              >
                {priorities.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              <label htmlFor="task-assignee">
                Assign to
              </label>

              <select
                id="task-assignee"
                value={assigneeId}
                onChange={(event) =>
                  setAssigneeId(event.target.value)
                }
              >
                <option value="">
                  Unassigned
                </option>

                {members.map((member) => (
                  <option
                    key={member.user.id}
                    value={member.user.id}
                  >
                    {member.user.name} ({member.role})
                  </option>
                ))}
              </select>

              <label htmlFor="task-due">
                Due date
              </label>

              <input
                id="task-due"
                type="date"
                value={dueDate}
                onChange={(event) =>
                  setDueDate(event.target.value)
                }
              />

              <label htmlFor="task-labels">
                Labels
              </label>

              <input
                id="task-labels"
                value={labels}
                onChange={(event) =>
                  setLabels(event.target.value)
                }
                placeholder="frontend, urgent, design"
              />

              <button
                className="primary-button modal-submit"
                type="submit"
                disabled={saving}
              >
                {saving
                  ? "Creating..."
                  : "Create task"}
              </button>
            </form>
          </section>
        </div>
      )}

      {/* TASK DETAILS MODAL */}

      {selectedTask && (
        <div
          className="modal-backdrop"
          onClick={() => {
            if (!saving && !commentSaving && !attachmentUploading && !deletingAttachmentId) {
              setSelectedTask(null);
            }
          }}
        >
          <section
            className="modal-card task-detail-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="modal-heading">
              <div>
                <span className="eyebrow">
                  TASK DETAILS
                </span>

                <h2>{selectedTask.title}</h2>
              </div>

              <div className="task-modal-actions">
                {canManage && (
                  <button
                    className="icon-button"
                    onClick={() =>
                      void deleteTask(selectedTask)
                    }
                    aria-label="Delete task"
                    title="Delete task"
                    disabled={saving}
                  >
                    <Trash2 size={19} />
                  </button>
                )}

                <button
                  className="icon-button"
                  onClick={() =>
                    setSelectedTask(null)
                  }
                  aria-label="Close"
                  disabled={saving || commentSaving || attachmentUploading || !!deletingAttachmentId}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <p className="task-detail-description">
              {selectedTask.description ||
                "No description provided."}
            </p>

            <div className="task-detail-fields">
              <div>
                <label>Status</label>

                <select
                  value={selectedTask.status}
                  onChange={(event) =>
                    void changeTaskStatus(
                      selectedTask,
                      event.target.value as TaskStatus
                    )
                  }
                >
                  {columns.map((column) => (
                    <option
                      key={column.status}
                      value={column.status}
                    >
                      {column.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label>Priority</label>

                {canManage ? (
                  <select
                    value={selectedTask.priority}
                    onChange={(event) =>
                      void changeTaskPriority(
                        selectedTask,
                        event.target.value as TaskPriority
                      )
                    }
                  >
                    {priorities.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span
                    className={`priority-badge priority-${selectedTask.priority}`}
                  >
                    {selectedTask.priority}
                  </span>
                )}
              </div>

              <div>
                <label>Assignee</label>

                {canManage ? (
                  <select
                    value={selectedTask.assignee?.id ?? ""}
                    onChange={(event) =>
                      void changeTaskAssignee(
                        selectedTask,
                        event.target.value
                      )
                    }
                  >
                    <option value="">
                      Unassigned
                    </option>

                    {members.map((member) => (
                      <option
                        key={member.user.id}
                        value={member.user.id}
                      >
                        {member.user.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <span className="detail-assignee">
                    <UserRound size={15} />
                    {selectedTask.assignee?.name ||
                      "Unassigned"}
                  </span>
                )}
              </div>
            </div>

            {/* COMMENTS */}

                        {/* TASK DEPENDENCIES */}
            {(() => {
              const prerequisites = selectedTask.dependsOn ?? [];
              const downstreamTasks = selectedTask.blocks ?? [];
              const unfinished = prerequisites.filter(
                (dependency) => dependency.status !== "DONE"
              );
              const availableTasks = tasks.filter(
                (task) =>
                  task.id !== selectedTask.id &&
                  !prerequisites.some(
                    (dependency) => dependency.id === task.id
                  )
              );

              return (
                <div className="task-dependencies-section">
                  <div className="task-dependencies-heading">
                    <h3>
                      <Link2 size={17} />
                      Dependencies ({prerequisites.length})
                    </h3>
                    <span
                      className={`dependency-status ${
                        unfinished.length > 0
                          ? "dependency-status-blocked"
                          : "dependency-status-ready"
                      }`}
                    >
                      {unfinished.length > 0
                        ? "Blocked"
                        : prerequisites.length > 0
                          ? "Ready"
                          : "No blockers"}
                    </span>
                  </div>

                  {unfinished.length > 0 && (
                    <div className="dependency-warning">
                      <AlertTriangle size={17} />
                      <span>
                        This task is waiting on {unfinished.length} unfinished
                        prerequisite{unfinished.length === 1 ? "" : "s"}.
                      </span>
                    </div>
                  )}

                  <div className="dependency-list">
                    {prerequisites.map((dependency) => (
                      <div className="dependency-item" key={dependency.id}>
                        <div className="dependency-task-info">
                          <strong>{dependency.title}</strong>
                          <span
                            className={`dependency-task-status dependency-${dependency.status}`}
                          >
                            {dependency.status.replace(/_/g, " ")}
                          </span>
                        </div>
                        {canManage && (
                          <button
                            type="button"
                            className="icon-button dependency-remove"
                            onClick={() => void removeDependency(dependency)}
                            disabled={dependencySaving}
                            aria-label={`Remove ${dependency.title} dependency`}
                            title="Remove dependency"
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                    {prerequisites.length === 0 && (
                      <p className="muted-text">
                        No prerequisite tasks linked.
                      </p>
                    )}
                  </div>

                  {canManage && availableTasks.length > 0 && (
                    <div className="dependency-add-row">
                      <select
                        value={dependencyTaskId}
                        onChange={(event) =>
                          setDependencyTaskId(event.target.value)
                        }
                        disabled={dependencySaving}
                      >
                        <option value="">Choose a prerequisite task</option>
                        {availableTasks.map((task) => (
                          <option key={task.id} value={task.id}>
                            {task.title}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className="primary-button"
                        onClick={() => void addDependency()}
                        disabled={dependencySaving || !dependencyTaskId}
                      >
                        {dependencySaving ? "Saving..." : "Add"}
                      </button>
                    </div>
                  )}

                  {dependencyError && (
                    <p className="dependency-error">{dependencyError}</p>
                  )}

                  <div className="dependency-blocks">
                    <h4>
                      <CheckCircle2 size={16} />
                      Blocks ({downstreamTasks.length})
                    </h4>
                    {downstreamTasks.length > 0 ? (
                      <div className="dependency-list">
                        {downstreamTasks.map((blockedTask) => (
                          <div className="dependency-item" key={blockedTask.id}>
                            <div className="dependency-task-info">
                              <strong>{blockedTask.title}</strong>
                              <span
                                className={`dependency-task-status dependency-${blockedTask.status}`}
                              >
                                {blockedTask.status.replace(/_/g, " ")}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="muted-text">
                        This task is not a prerequisite for other tasks.
                      </p>
                    )}
                  </div>
                </div>
              );
            })()}

<section className="task-attachments-section">
              <div className="task-attachments-heading">
                <h3>
                  <Paperclip size={17} />
                  Attachments ({attachments.length})
                </h3>
                <span>Maximum file size: 10 MB</span>
              </div>

              <form className="task-attachment-upload" onSubmit={uploadAttachment}>
                <label className="task-attachment-picker" htmlFor="task-attachment-file">
                  <FileText size={17} />
                  <span>{attachmentFile ? attachmentFile.name : "Choose a file to attach"}</span>
                </label>
                <input
                  id="task-attachment-file"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.txt,.csv,.doc,.docx,.xls,.xlsx"
                  onChange={(event) => {
                    setAttachmentFile(event.target.files?.[0] ?? null);
                    setAttachmentError("");
                  }}
                  disabled={attachmentUploading}
                />
                <button
                  type="submit"
                  className="primary-button"
                  disabled={!attachmentFile || attachmentUploading}
                >
                  <Upload size={15} />
                  {attachmentUploading ? "Uploading..." : "Upload"}
                </button>
              </form>
              <p className="task-attachment-hint">
                Supported: PDF, images, TXT, CSV, Word and Excel files.
              </p>

              {attachmentError && <p className="task-attachment-error">{attachmentError}</p>}

              {attachmentLoading ? (
                <p className="muted-text">Loading attachments...</p>
              ) : attachments.length > 0 ? (
                <div className="task-attachment-list">
                  {attachments.map((attachment) => {
                    const canDeleteAttachment =
                      canManage || attachment.uploadedBy?.id === user?.id;
                    return (
                      <div className="task-attachment-item" key={attachment.id}>
                        <div className="task-attachment-icon"><FileText size={18} /></div>
                        <div className="task-attachment-info">
                          <strong title={attachment.originalName}>{attachment.originalName}</strong>
                          <span>
                            {formatAttachmentSize(attachment.sizeBytes)} · Uploaded by {attachment.uploadedBy?.name || "Member"}
                          </span>
                          <small>{new Date(attachment.createdAt).toLocaleString("en-IN")}</small>
                        </div>
                        <div className="task-attachment-actions">
                          <button
                            type="button"
                            className="icon-button"
                            onClick={() => void downloadAttachment(attachment)}
                            title="Download attachment"
                            aria-label={`Download ${attachment.originalName}`}
                          >
                            <Download size={17} />
                          </button>
                          {canDeleteAttachment && (
                            <button
                              type="button"
                              className="icon-button task-attachment-delete"
                              onClick={() => void deleteAttachment(attachment)}
                              disabled={deletingAttachmentId === attachment.id}
                              title="Delete attachment"
                              aria-label={`Delete ${attachment.originalName}`}
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="muted-text">No files attached to this task yet.</p>
              )}
            </section>

            <div className="comments-section">
              <h3>
                Comments ({comments.length})
              </h3>

              <div className="comment-list">
                {comments.map((comment) => (
                  <div
                    className="comment-item"
                    key={comment.id}
                  >
                    <strong>
                      {comment.author?.name || "Member"}
                    </strong>

                    <p>{comment.content}</p>

                    <small>
                      {new Date(
                        comment.createdAt
                      ).toLocaleString("en-IN")}
                    </small>
                  </div>
                ))}

                {comments.length === 0 && (
                  <p className="muted-text">
                    No comments yet.
                  </p>
                )}
              </div>

              <form
                className="comment-form"
                onSubmit={addComment}
              >
                <input
                  value={commentText}
                  onChange={(event) =>
                    setCommentText(event.target.value)
                  }
                  placeholder="Write a comment..."
                  maxLength={3000}
                  required
                />

                <button
                  className="primary-button"
                  type="submit"
                  disabled={
                    commentSaving || !commentText.trim()
                  }
                >
                  {commentSaving ? "Sending..." : "Send"}
                </button>
              </form>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
