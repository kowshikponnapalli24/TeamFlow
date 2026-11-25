
import { useEffect, useState, type FormEvent } from "react";
import {
  UserRound,
  LockKeyhole,
  Building2,
  Save,
  ShieldCheck,
  Mail,
  CalendarDays,
  Users,
  Crown,
} from "lucide-react";

import { apiRequest } from "../lib/api";
import { useAuth } from "../context/AuthContext";

type SettingsTab = "profile" | "security" | "workspace" | "members";
type MemberRole = "ADMIN" | "MANAGER" | "DEVELOPER";

interface ApiMessage {
  success: boolean;
  message: string;
}

interface OrganizationMember {
  id: string;
  userId: string;
  organizationId: string;
  role: MemberRole;
  joinedAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
}

export default function Settings() {
  const {
    user,
    updateUser,
    activeOrganization,
    activeOrganizationId,
    role,
    refreshOrganizations,
  } = useAuth();

  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");

  const [profileName, setProfileName] = useState(user?.name ?? "");
  const [profileEmail, setProfileEmail] = useState(user?.email ?? "");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [workspaceName, setWorkspaceName] = useState(
    activeOrganization?.name ?? ""
  );
  const [workspaceDescription, setWorkspaceDescription] = useState(
    activeOrganization?.description ?? ""
  );

  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [updatingMemberId, setUpdatingMemberId] = useState<string | null>(
    null
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isAdmin = role === "ADMIN";

  useEffect(() => {
    setProfileName(user?.name ?? "");
    setProfileEmail(user?.email ?? "");
  }, [user]);

  useEffect(() => {
    setWorkspaceName(activeOrganization?.name ?? "");
    setWorkspaceDescription(activeOrganization?.description ?? "");
  }, [activeOrganization]);

  // Load organization members when the Members tab is opened.
  useEffect(() => {
    if (activeTab !== "members" || !activeOrganizationId) {
      return;
    }

    let cancelled = false;

    const loadMembers = async () => {
      try {
        setLoadingMembers(true);
        setError("");

        const response = await apiRequest<{
          success: boolean;
          count: number;
          members: OrganizationMember[];
        }>(`/organizations/${activeOrganizationId}/members`);

        if (!cancelled) {
          setMembers(response.members ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Unable to retrieve organization members."
          );
        }
      } finally {
        if (!cancelled) {
          setLoadingMembers(false);
        }
      }
    };

    void loadMembers();

    return () => {
      cancelled = true;
    };
  }, [activeTab, activeOrganizationId]);

  const resetFeedback = () => {
    setError("");
    setSuccess("");
  };

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetFeedback();

    if (profileName.trim().length < 2) {
      setError("Your name must contain at least 2 characters.");
      return;
    }

    try {
      setSaving(true);

      const response = await apiRequest<{
        success: boolean;
        message: string;
        user: NonNullable<typeof user>;
      }>("/auth/profile", {
        method: "PATCH",
        body: JSON.stringify({
          name: profileName.trim(),
          email: profileEmail.trim(),
        }),
      });

      updateUser(response.user);
      setSuccess(response.message || "Profile updated successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update profile."
      );
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetFeedback();

    if (newPassword.length < 8) {
      setError("Your new password must contain at least 8 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("The new password and confirmation do not match.");
      return;
    }

    try {
      setSaving(true);

      const response = await apiRequest<ApiMessage>("/auth/password", {
        method: "PATCH",
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSuccess(response.message);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to change password."
      );
    } finally {
      setSaving(false);
    }
  };

  const saveWorkspace = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    resetFeedback();

    if (!activeOrganizationId) {
      setError("Select a workspace before editing its settings.");
      return;
    }

    if (workspaceName.trim().length < 2) {
      setError("Workspace name must contain at least 2 characters.");
      return;
    }

    try {
      setSaving(true);

      const response = await apiRequest<ApiMessage>(
        `/organizations/${activeOrganizationId}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            name: workspaceName.trim(),
            description: workspaceDescription.trim(),
          }),
        }
      );

      await refreshOrganizations();
      setSuccess(response.message || "Workspace settings updated.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update workspace."
      );
    } finally {
      setSaving(false);
    }
  };

  // Change a member's organization role (Admin only).
  const updateMemberRole = async (
    member: OrganizationMember,
    newRole: MemberRole
  ) => {
    if (!isAdmin) {
      setError("Only workspace Admins can change member roles.");
      return;
    }

    if (!activeOrganizationId || member.role === newRole) {
      return;
    }

    const confirmed = window.confirm(
      `Change ${member.user.name}'s role from ${member.role} to ${newRole}?`
    );

    if (!confirmed) {
      return;
    }

    try {
      resetFeedback();
      setUpdatingMemberId(member.userId);

      const response = await apiRequest<{
        success: boolean;
        message: string;
        membership: OrganizationMember;
      }>(
        `/organizations/${activeOrganizationId}/members/${member.userId}/role`,
        {
          method: "PATCH",
          body: JSON.stringify({ role: newRole }),
        }
      );

      setMembers((currentMembers) =>
        currentMembers.map((item) =>
          item.userId === member.userId
            ? response.membership
            : item
        )
      );

      // Refresh the current user's organization role and permissions.
      await refreshOrganizations();

      setSuccess(
        response.message || `${member.user.name}'s role was updated.`
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update member role."
      );
    } finally {
      setUpdatingMemberId(null);
    }
  };

  const tabs = [
    { id: "profile" as const, label: "Profile", icon: UserRound },
    { id: "security" as const, label: "Security", icon: LockKeyhole },
    { id: "workspace" as const, label: "Workspace", icon: Building2 },
    { id: "members" as const, label: "Members", icon: Users },
  ];

  const roleDescription: Record<MemberRole, string> = {
    ADMIN: "Full workspace administration",
    MANAGER: "Manage projects, teams and tasks",
    DEVELOPER: "Work on assigned projects and tasks",
  };

  return (
    <div className="settings-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">PREFERENCES</span>
          <h1>Settings</h1>
          <p>Manage your account, security and workspace details.</p>
        </div>
      </div>

      <div className="settings-layout">
        <aside className="settings-sidebar content-card">
          <div className="settings-user-summary">
            <div className="settings-avatar">
              {user?.name?.charAt(0).toUpperCase() || "U"}
            </div>
            <div>
              <strong>{user?.name}</strong>
              <span>{user?.email}</span>
            </div>
          </div>

          <nav className="settings-tabs" aria-label="Settings sections">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                className={`settings-tab ${
                  activeTab === id ? "settings-tab-active" : ""
                }`}
                onClick={() => {
                  setActiveTab(id);
                  resetFeedback();
                }}
              >
                <Icon size={17} />
                {label}
              </button>
            ))}
          </nav>
        </aside>

        <section className="settings-content content-card">
          {error && (
            <div className="settings-alert settings-alert-error">
              {error}
            </div>
          )}

          {success && (
            <div className="settings-alert settings-alert-success">
              {success}
            </div>
          )}

          {activeTab === "profile" && (
            <>
              <div className="settings-section-heading">
                <div className="settings-section-icon">
                  <UserRound size={19} />
                </div>
                <div>
                  <h2>Personal information</h2>
                  <p>
                    Update the name and email address associated with your
                    account.
                  </p>
                </div>
              </div>

              <form className="settings-form" onSubmit={saveProfile}>
                <label htmlFor="profile-name">Full name</label>
                <div className="settings-input-wrap">
                  <UserRound size={17} />
                  <input
                    id="profile-name"
                    value={profileName}
                    onChange={(event) => setProfileName(event.target.value)}
                    minLength={2}
                    maxLength={80}
                    required
                  />
                </div>

                <label htmlFor="profile-email">Email address</label>
                <div className="settings-input-wrap">
                  <Mail size={17} />
                  <input
                    id="profile-email"
                    type="email"
                    value={profileEmail}
                    onChange={(event) => setProfileEmail(event.target.value)}
                    required
                  />
                </div>

                <div className="settings-readonly-row">
                  <CalendarDays size={16} />
                  <span>Account ID</span>
                  <code>{user?.id}</code>
                </div>

                <button
                  className="primary-button settings-submit"
                  disabled={saving}
                >
                  <Save size={16} />
                  {saving ? "Saving..." : "Save profile"}
                </button>
              </form>
            </>
          )}

          {activeTab === "security" && (
            <>
              <div className="settings-section-heading">
                <div className="settings-section-icon">
                  <ShieldCheck size={19} />
                </div>
                <div>
                  <h2>Password & security</h2>
                  <p>
                    Use a strong password that you do not use on other
                    websites.
                  </p>
                </div>
              </div>

              <form className="settings-form" onSubmit={changePassword}>
                <label htmlFor="current-password">Current password</label>
                <input
                  className="settings-input"
                  id="current-password"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(event) =>
                    setCurrentPassword(event.target.value)
                  }
                  required
                />

                <label htmlFor="new-password">New password</label>
                <input
                  className="settings-input"
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                />

                <label htmlFor="confirm-password">
                  Confirm new password
                </label>
                <input
                  className="settings-input"
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(event.target.value)
                  }
                  required
                />

                <p className="settings-help">
                  Minimum 8 characters. Your current password is required to
                  make this change.
                </p>

                <button
                  className="primary-button settings-submit"
                  disabled={saving}
                >
                  <LockKeyhole size={16} />
                  {saving ? "Updating..." : "Change password"}
                </button>
              </form>
            </>
          )}

          {activeTab === "workspace" && (
            <>
              <div className="settings-section-heading">
                <div className="settings-section-icon">
                  <Building2 size={19} />
                </div>
                <div>
                  <h2>Workspace details</h2>
                  <p>
                    Manage the name and description of your active workspace.
                  </p>
                </div>
              </div>

              {!activeOrganization ? (
                <div className="settings-empty">
                  You are not currently part of a workspace.
                </div>
              ) : role !== "ADMIN" ? (
                <div className="settings-permission-note">
                  <ShieldCheck size={20} />
                  <div>
                    <strong>Administrator access required</strong>
                    <p>
                      Only workspace administrators can change workspace
                      details.
                    </p>
                    <span>Your current role: {role ?? "No role"}</span>
                  </div>
                </div>
              ) : (
                <form className="settings-form" onSubmit={saveWorkspace}>
                  <label htmlFor="workspace-name">Workspace name</label>
                  <input
                    className="settings-input"
                    id="workspace-name"
                    value={workspaceName}
                    onChange={(event) =>
                      setWorkspaceName(event.target.value)
                    }
                    minLength={2}
                    maxLength={100}
                    required
                  />

                  <label htmlFor="workspace-description">
                    Description
                  </label>
                  <textarea
                    className="settings-textarea"
                    id="workspace-description"
                    value={workspaceDescription}
                    onChange={(event) =>
                      setWorkspaceDescription(event.target.value)
                    }
                    maxLength={500}
                    rows={5}
                    placeholder="What is this workspace used for?"
                  />

                  <div className="settings-help">
                    Changes apply to everyone who belongs to this workspace.
                  </div>

                  <button
                    className="primary-button settings-submit"
                    disabled={saving}
                  >
                    <Save size={16} />
                    {saving ? "Saving..." : "Save workspace"}
                  </button>
                </form>
              )}
            </>
          )}

          {activeTab === "members" && (
            <>
              <div className="settings-section-heading">
                <div className="settings-section-icon">
                  <Users size={19} />
                </div>
                <div>
                  <h2>Workspace members</h2>
                  <p>
                    View members and manage their workspace roles.
                  </p>
                </div>
              </div>

              {!activeOrganization ? (
                <div className="settings-empty">
                  You are not currently part of a workspace.
                </div>
              ) : (
                <>
                  <div className="settings-members-summary">
                    <div>
                      <strong>{activeOrganization.name}</strong>
                      <span>
                        {members.length}{" "}
                        {members.length === 1 ? "member" : "members"}
                      </span>
                    </div>

                    <span className="settings-current-role">
                      Your role: {role ?? "No role"}
                    </span>
                  </div>

                  {!isAdmin && (
                    <div className="settings-permission-note">
                      <ShieldCheck size={20} />
                      <div>
                        <strong>Read-only member list</strong>
                        <p>
                          Only workspace Admins can change member roles.
                        </p>
                      </div>
                    </div>
                  )}

                  {loadingMembers ? (
                    <div className="settings-empty">
                      Loading workspace members...
                    </div>
                  ) : members.length === 0 ? (
                    <div className="settings-empty">
                      No members found in this workspace.
                    </div>
                  ) : (
                    <div className="settings-members-list">
                      {members.map((member) => (
                        <div
                          className="settings-member-card"
                          key={member.id}
                        >
                          <div className="settings-member-info">
                            <div className="settings-member-avatar">
                              {member.user.name
                                ?.charAt(0)
                                .toUpperCase() || "U"}
                            </div>

                            <div className="settings-member-details">
                              <strong>{member.user.name}</strong>
                              <span>{member.user.email}</span>
                              <small>
                                {roleDescription[member.role]}
                              </small>
                            </div>
                          </div>

                          <div className="settings-member-role">
                            {isAdmin ? (
                              <>
                                <label
                                  className="settings-role-label"
                                  htmlFor={`member-role-${member.userId}`}
                                >
                                  Role
                                </label>

                                <select
                                  id={`member-role-${member.userId}`}
                                  className="settings-input settings-role-select"
                                  value={member.role}
                                  disabled={
                                    updatingMemberId === member.userId
                                  }
                                  onChange={(event) =>
                                    void updateMemberRole(
                                      member,
                                      event.target.value as MemberRole
                                    )
                                  }
                                >
                                  <option value="ADMIN">Admin</option>
                                  <option value="MANAGER">Manager</option>
                                  <option value="DEVELOPER">
                                    Developer
                                  </option>
                                </select>

                                {updatingMemberId === member.userId && (
                                  <small>Updating...</small>
                                )}
                              </>
                            ) : (
                              <span
                                className={`settings-role-badge settings-role-${member.role.toLowerCase()}`}
                              >
                                {member.role === "ADMIN" && (
                                  <Crown size={13} />
                                )}
                                {member.role}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
