
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  FolderKanban,
  Plus,
  ArrowUpRight,
  X,
  CalendarDays,
} from "lucide-react";

import { apiRequest } from "../lib/api";
import { useAuth } from "../context/AuthContext";

interface Project {
  id: string;
  name: string;
  description?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  createdAt?: string;
  team?: { id: string; name: string } | null;
}

export default function Projects() {
  const navigate = useNavigate();

  const {
    activeOrganizationId: organizationId,
    role,
  } = useAuth();

  const canManage = role === "ADMIN" || role === "MANAGER";

  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    let cancelled = false;

    const loadProjects = async () => {
      if (!organizationId) {
        setProjects([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const data = await apiRequest<{ projects: Project[] }>(
          `/organizations/${organizationId}/projects`
        );

        if (!cancelled) {
          setProjects(data.projects ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load projects"
          );
          setProjects([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadProjects();

    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  const resetForm = () => {
    setName("");
    setDescription("");
    setStartDate("");
    setDueDate("");
  };

  const createProject = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!canManage) {
      setError("You are not authorized to create projects.");
      return;
    }

    if (!organizationId) {
      setError("Please select a workspace.");
      return;
    }

    if (name.trim().length < 2) {
      setError("Project name must contain at least 2 characters.");
      return;
    }

    if (startDate && dueDate && dueDate < startDate) {
      setError("Due date cannot be earlier than start date.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const data = await apiRequest<{ project: Project }>(
        `/organizations/${organizationId}/projects`,
        {
          method: "POST",
          body: JSON.stringify({
            name: name.trim(),
            description: description.trim() || undefined,
            startDate: startDate || undefined,
            dueDate: dueDate || undefined,
          }),
        }
      );

      setProjects((current) => [data.project, ...current]);
      resetForm();
      setShowForm(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not create project"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="projects-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">PROJECT MANAGEMENT</span>
          <h1>Projects</h1>
          <p>Organize your work and keep your team moving forward.</p>
        </div>

        {canManage && (
          <button
            className="primary-button create-project-button"
            onClick={() => {
              setError("");
              setShowForm(true);
            }}
            disabled={!organizationId}
          >
            <Plus size={18} />
            New project
          </button>
        )}
      </div>

      {error && <div className="error-message">{error}</div>}

      {loading ? (
        <div className="content-card empty-state">Loading projects...</div>
      ) : !organizationId ? (
        <div className="content-card empty-state">
          <FolderKanban size={34} />
          <h3>No workspace selected</h3>
          <p>Select a workspace using the Active Workspace selector above.</p>
        </div>
      ) : projects.length === 0 ? (
        <div className="content-card empty-state">
          <FolderKanban size={34} />
          <h3>No projects yet</h3>
          <p>
            {canManage
              ? "Create your first project in this workspace."
              : "There are no projects in this workspace yet."}
          </p>

          {canManage && (
            <button
              className="primary-button empty-create-button"
              onClick={() => {
                setError("");
                setShowForm(true);
              }}
              disabled={!organizationId}
            >
              <Plus size={17} />
              Create project
            </button>
          )}
        </div>
      ) : (
        <div className="projects-grid">
          {projects.map((project) => (
            <button
              className="project-card"
              key={project.id}
              onClick={() =>
                navigate(`/projects/${organizationId}/${project.id}`)
              }
            >
              <div className="project-card-top">
                <div className="project-icon">
                  <FolderKanban size={21} />
                </div>
                <ArrowUpRight size={18} className="subtle-icon" />
              </div>

              <h3>{project.name}</h3>

              <p>
                {project.description || "No project description provided."}
              </p>

              <div className="project-card-footer">
                <span>
                  <CalendarDays size={14} />
                  {project.dueDate
                    ? `Due ${new Date(project.dueDate).toLocaleDateString("en-IN")}`
                    : "No deadline"}
                </span>

                {project.team && <span>{project.team.name}</span>}
              </div>
            </button>
          ))}
        </div>
      )}

      {showForm && canManage && (
        <div
          className="modal-backdrop"
          onClick={() => {
            if (!saving) setShowForm(false);
          }}
        >
          <section
            className="modal-card"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-heading">
              <div>
                <h2>Create a project</h2>
                <p>Set up a new project in your selected workspace.</p>
              </div>

              <button
                className="icon-button"
                onClick={() => {
                  if (!saving) {
                    setShowForm(false);
                    setError("");
                  }
                }}
                aria-label="Close"
                disabled={saving}
              >
                <X size={20} />
              </button>
            </div>

            <form className="modal-form" onSubmit={createProject}>
              <label htmlFor="project-name">Project name</label>
              <input
                id="project-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Website redesign"
                minLength={2}
                maxLength={100}
                required
              />

              <label htmlFor="project-description">Description</label>
              <textarea
                id="project-description"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="What is this project about?"
                rows={3}
                maxLength={1000}
              />

              <div className="form-two-columns">
                <div>
                  <label htmlFor="project-start">Start date</label>
                  <input
                    id="project-start"
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                  />
                </div>

                <div>
                  <label htmlFor="project-due">Due date</label>
                  <input
                    id="project-due"
                    type="date"
                    value={dueDate}
                    min={startDate || undefined}
                    onChange={(event) => setDueDate(event.target.value)}
                  />
                </div>
              </div>

              {error && <div className="error-message">{error}</div>}

              <button
                className="primary-button modal-submit"
                type="submit"
                disabled={saving}
              >
                {saving ? "Creating..." : "Create project"}
              </button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}
