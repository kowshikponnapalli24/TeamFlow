
import { useCallback, useEffect, useState } from "react";
import {
  Users,
  Plus,
  UserPlus,
  Trash2,
  RefreshCw,
} from "lucide-react";

import { apiRequest } from "../lib/api";
import { useAuth } from "../context/AuthContext";

interface TeamMember {
  id?: string;
  userId?: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
  name?: string;
  email?: string;
}

interface Team {
  id: string;
  name: string;
  description?: string | null;
  _count?: {
    members?: number;
    projects?: number;
  };
}

interface OrganizationMember {
  userId?: string;
  user?: {
    id: string;
    name: string;
    email: string;
  };
  id?: string;
  name?: string;
  email?: string;
}

export default function Teams() {
  const {
    activeOrganizationId: organizationId,
    role,
  } = useAuth();

  const canManage = role === "ADMIN" || role === "MANAGER";
  const canDeleteTeam = role === "ADMIN";

  const [teams, setTeams] = useState<Team[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [organizationMembers, setOrganizationMembers] = useState<
    OrganizationMember[]
  >([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);

  const [teamName, setTeamName] = useState("");
  const [teamDescription, setTeamDescription] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");

  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadTeams = useCallback(async () => {
    if (!organizationId) {
      setTeams([]);
      return;
    }

    try {
      const response = await apiRequest<{ teams: Team[] }>(
        `/organizations/${organizationId}/teams`
      );
      setTeams(response.teams ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load teams");
      setTeams([]);
    }
  }, [organizationId]);

  const loadOrganizationMembers = useCallback(async () => {
    if (!organizationId) {
      setOrganizationMembers([]);
      return;
    }

    try {
      const response = await apiRequest<{
        members: OrganizationMember[];
      }>(`/organizations/${organizationId}/members`);

      setOrganizationMembers(response.members ?? []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load organization members"
      );
      setOrganizationMembers([]);
    }
  }, [organizationId]);

  useEffect(() => {
    let cancelled = false;

    const loadWorkspaceData = async () => {
      if (!organizationId) {
        setTeams([]);
        setMembers([]);
        setOrganizationMembers([]);
        setSelectedTeam(null);
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");
      setSuccess("");
      setSelectedTeam(null);
      setMembers([]);
      setSelectedUserId("");

      try {
        const [teamsResponse, membersResponse] = await Promise.all([
          apiRequest<{ teams: Team[] }>(
            `/organizations/${organizationId}/teams`
          ),
          apiRequest<{ members: OrganizationMember[] }>(
            `/organizations/${organizationId}/members`
          ),
        ]);

        if (!cancelled) {
          setTeams(teamsResponse.teams ?? []);
          setOrganizationMembers(membersResponse.members ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load workspace data"
          );
          setTeams([]);
          setOrganizationMembers([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadWorkspaceData();

    return () => {
      cancelled = true;
    };
  }, [organizationId]);

  const loadTeamMembers = async (team: Team) => {
    if (!organizationId) return;

    setSelectedTeam(team);
    setMembersLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await apiRequest<{ members: TeamMember[] }>(
        `/organizations/${organizationId}/teams/${team.id}/members`
      );

      setMembers(response.members ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load team members"
      );
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  };

  const createTeam = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!canManage) {
      setError("You are not authorized to create teams.");
      return;
    }

    if (!organizationId) {
      setError("Please select a workspace.");
      return;
    }

    if (!teamName.trim()) {
      setError("Please enter a team name.");
      return;
    }

    try {
      setError("");
      setSuccess("");

      await apiRequest(`/organizations/${organizationId}/teams`, {
        method: "POST",
        body: JSON.stringify({
          name: teamName.trim(),
          description: teamDescription.trim() || undefined,
        }),
      });

      setTeamName("");
      setTeamDescription("");
      setSuccess("Team created successfully.");

      await loadTeams();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to create team"
      );
    }
  };

  const getOrganizationMember = (member: OrganizationMember) => ({
    id: member.user?.id ?? member.userId ?? member.id ?? "",
    name: member.user?.name ?? member.name ?? "Member",
    email: member.user?.email ?? member.email ?? "",
  });

  const addMember = async (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    if (!canManage) {
      setError("You are not authorized to add team members.");
      return;
    }

    if (!organizationId || !selectedTeam) {
      setError("Please select a team first.");
      return;
    }

    const selectedMember = organizationMembers
      .map(getOrganizationMember)
      .find((member) => member.id === selectedUserId);

    if (!selectedMember?.email) {
      setError("Please select a valid organization member.");
      return;
    }

    try {
      setError("");
      setSuccess("");

      await apiRequest(
        `/organizations/${organizationId}/teams/${selectedTeam.id}/members`,
        {
          method: "POST",
          body: JSON.stringify({ email: selectedMember.email }),
        }
      );

      setSelectedUserId("");

      await Promise.all([
        loadTeamMembers(selectedTeam),
        loadTeams(),
      ]);

      setSuccess(
        `${selectedMember.name} added to ${selectedTeam.name} successfully!`
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to add team member"
      );
    }
  };

  const removeMember = async (member: TeamMember) => {
    if (!canManage) {
      setError("You are not authorized to remove team members.");
      return;
    }

    if (!organizationId || !selectedTeam) return;

    const userId = member.userId ?? member.user?.id ?? member.id;

    if (!userId) {
      setError("Could not identify this team member.");
      return;
    }

    if (!window.confirm("Remove this member from the team?")) return;

    try {
      setError("");
      setSuccess("");

      await apiRequest(
        `/organizations/${organizationId}/teams/${selectedTeam.id}/members/${userId}`,
        { method: "DELETE" }
      );

      setSuccess("Member removed successfully.");

      await Promise.all([
        loadTeamMembers(selectedTeam),
        loadTeams(),
      ]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to remove team member"
      );
    }
  };
  const deleteTeam = async (team: Team) => {
  if (!canDeleteTeam) {
    setError("Only Admins can delete teams.");
    return;
  }

  if (!organizationId) return;

  const confirmed = window.confirm(
    `Are you sure you want to delete "${team.name}"?\n\nTeam memberships will be removed. Projects and tasks will be preserved.`
  );

  if (!confirmed) return;

  try {
    setError("");
    setSuccess("");

    await apiRequest(
      `/organizations/${organizationId}/teams/${team.id}`,
      { method: "DELETE" }
    );

    if (selectedTeam?.id === team.id) {
      setSelectedTeam(null);
      setMembers([]);
    }

    await loadTeams();

    setSuccess(`Team "${team.name}" deleted successfully.`);
  } catch (err) {
    setError(
      err instanceof Error ? err.message : "Failed to delete team"
    );
  }
};

  const getMemberName = (member: TeamMember) =>
    member.user?.name ?? member.name ?? "Team member";

  const getMemberEmail = (member: TeamMember) =>
    member.user?.email ?? member.email ?? "";

  if (loading) {
    return (
      <div className="teams-page">
        <p>Loading teams...</p>
      </div>
    );
  }

  return (
    <div className="teams-page">
      <div className="teams-header">
        <div>
          <h1>Teams</h1>
          <p>Organize people and manage team membership.</p>
        </div>

        <button
          className="teams-refresh"
          onClick={() => {
            setError("");
            void loadTeams();
            void loadOrganizationMembers();

            if (selectedTeam) {
              void loadTeamMembers(selectedTeam);
            }
          }}
          disabled={!organizationId}
        >
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {error && (
        <div className="teams-message teams-error">{error}</div>
      )}

      {success && (
        <div className="teams-message teams-success">{success}</div>
      )}

      {!organizationId ? (
        <div className="teams-empty">
          <Users size={32} />
          <h3>No workspace selected</h3>
          <p>Select a workspace using the Active Workspace selector above.</p>
        </div>
      ) : (
        <>
          {canManage && (
            <form className="team-create-form" onSubmit={createTeam}>
              <h2>
                <Plus size={19} /> Create a team
              </h2>

              <div className="team-form-fields">
                <input
                  value={teamName}
                  onChange={(event) => setTeamName(event.target.value)}
                  placeholder="Team name"
                  required
                />

                <input
                  value={teamDescription}
                  onChange={(event) =>
                    setTeamDescription(event.target.value)
                  }
                  placeholder="Description (optional)"
                />

                <button type="submit" className="teams-primary-button">
                  Create team
                </button>
              </div>
            </form>
          )}

          <div className="teams-layout">
            <section className="teams-list-section">
              <h2>Your teams ({teams.length})</h2>

              {teams.length === 0 ? (
                <div className="teams-empty">
                  <Users size={32} />
                  <h3>No teams yet</h3>
                  <p>
                    {canManage
                      ? "Create a team to start organizing your workspace."
                      : "There are no teams in this workspace yet."}
                  </p>
                </div>
              ) : (
                <div className="teams-grid">
                  {teams.map((team) => (
                    <button
                      key={team.id}
                      className={`team-card ${
                        selectedTeam?.id === team.id
                          ? "team-card-selected"
                          : ""
                      }`}
                      onClick={() => void loadTeamMembers(team)}
                    >
                      <div className="team-card-icon">
                        <Users size={21} />
                      </div>

                      <div className="team-card-info">
                        <strong>{team.name}</strong>
                        <span>{team.description || "No description"}</span>
                        <small>
                          {team._count?.members ?? 0} members ·{" "}
                          {team._count?.projects ?? 0} projects
                        </small>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="team-members-section">
              {selectedTeam ? (
                <>
                  <div className="team-members-header">
  <div>
    <h2>{selectedTeam.name}</h2>
    <p>Team members</p>
  </div>

  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
    <span>{members.length} members</span>

    {canDeleteTeam && (
      <button
        type="button"
        className="team-remove-button"
        title="Delete team"
        onClick={() => void deleteTeam(selectedTeam)}
      >
        <Trash2 size={17} />
      </button>
    )}
  </div>
</div>
                  {canManage && (
                    <form
                      className="team-add-member-form"
                      onSubmit={addMember}
                    >
                      <select
                        value={selectedUserId}
                        onChange={(event) =>
                          setSelectedUserId(event.target.value)
                        }
                        required
                      >
                        <option value="">Select organization member</option>

                        {organizationMembers.map((member) => {
                          const person = getOrganizationMember(member);

                          return person.id ? (
                            <option key={person.id} value={person.id}>
                              {person.name} ({person.email})
                            </option>
                          ) : null;
                        })}
                      </select>

                      <button
                        type="submit"
                        className="teams-primary-button"
                      >
                        <UserPlus size={16} /> Add member
                      </button>
                    </form>
                  )}

                  {membersLoading ? (
                    <p>Loading members...</p>
                  ) : members.length === 0 ? (
                    <div className="teams-empty">
                      <Users size={28} />
                      <p>No members in this team yet.</p>
                    </div>
                  ) : (
                    <div className="team-member-list">
                      {members.map((member, index) => (
                        <div
                          className="team-member-row"
                          key={
                            member.userId ??
                            member.user?.id ??
                            member.id ??
                            index
                          }
                        >
                          <div className="team-member-avatar">
                            {getMemberName(member).charAt(0).toUpperCase()}
                          </div>

                          <div className="team-member-info">
                            <strong>{getMemberName(member)}</strong>
                            <span>{getMemberEmail(member)}</span>
                          </div>

                          {canManage && (
                            <button
                              className="team-remove-button"
                              title="Remove member"
                              onClick={() => void removeMember(member)}
                            >
                              <Trash2 size={17} />
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="teams-empty team-select-prompt">
                  <Users size={34} />
                  <h3>Select a team</h3>
                  <p>Choose a team to view its members.</p>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
