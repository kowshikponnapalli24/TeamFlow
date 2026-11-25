import { useCallback, useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Bell,
  LayoutDashboard,
  FolderKanban,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  ChevronDown,
  Sparkles,
  BarChart3,
} from "lucide-react";

import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../lib/api";

const navigation = [
  { label: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
  { label: "Projects", path: "/projects", icon: FolderKanban },
  { label: "Teams", path: "/teams", icon: Users },
  { label: "AI Assistant", path: "/ai-assistant", icon: Sparkles },
  { label: "Reports", path: "/reports", icon: BarChart3 },
  { label: "Notifications", path: "/notifications", icon: Bell },
];

export default function AppLayout() {
  const {
    user,
    logout,
    organizations,
    activeOrganizationId,
    setActiveOrganizationId,
    role,
  } = useAuth();

  const navigate = useNavigate();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const response = await apiRequest<{
        success: boolean;
        count?: number;
        unreadCount?: number;
      }>("/notifications/unread-count");

      setUnreadCount(response.unreadCount ?? response.count ?? 0);
    } catch (error) {
      console.error("Failed to fetch unread notifications:", error);
    }
  }, []);

  useEffect(() => {
    void fetchUnreadCount();

    const handleNotificationUpdate = () => {
      void fetchUnreadCount();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void fetchUnreadCount();
      }
    };

    window.addEventListener(
      "teamflow:notifications-updated",
      handleNotificationUpdate
    );

    document.addEventListener("visibilitychange", handleVisibilityChange);

    const interval = window.setInterval(fetchUnreadCount, 15000);

    return () => {
      window.removeEventListener(
        "teamflow:notifications-updated",
        handleNotificationUpdate
      );
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.clearInterval(interval);
    };
  }, [fetchUnreadCount]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const handleOrganizationChange = (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    setActiveOrganizationId(event.target.value);
  };

  const formattedRole = role
    ? role.charAt(0) + role.slice(1).toLowerCase()
    : "No role";

  return (
    <div className="app-shell">
      {mobileOpen && (
        <button
          className="mobile-overlay"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <div className="brand-mark">T</div>
          <span>TeamFlow</span>
          <button
            className="icon-button mobile-close"
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        <div className="workspace-label">WORKSPACE</div>

        <nav className="sidebar-nav">
          {navigation.map(({ label, path, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              className={({ isActive }) =>
                `nav-link ${isActive ? "nav-link-active" : ""}`
              }
              onClick={() => setMobileOpen(false)}
            >
              <Icon size={19} />
              <span>{label}</span>
              {label === "Notifications" && unreadCount > 0 && (
                <span className="notification-badge">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <NavLink
            to="/settings"
            className={({ isActive }) =>
              `nav-link ${isActive ? "nav-link-active" : ""}`
            }
            onClick={() => setMobileOpen(false)}
          >
            <Settings size={19} />
            <span>Settings</span>
          </NavLink>

          <button className="nav-link logout-link" onClick={handleLogout}>
            <LogOut size={19} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      <div className="main-area">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>

          <div className="topbar-title">Workspace</div>

          <div className="topbar-user">
            <div className="avatar">
              {user?.name?.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="topbar-user-info">
              <strong>{user?.name}</strong>
              <span>{user?.email}</span>
            </div>
            <ChevronDown size={16} />
          </div>
        </header>

        <div className="workspace-role-bar">
          <div className="workspace-selector">
            <label htmlFor="active-workspace">Active workspace</label>
            <select
              id="active-workspace"
              value={activeOrganizationId ?? ""}
              onChange={handleOrganizationChange}
              disabled={organizations.length === 0}
            >
              {organizations.map((organization) => (
                <option key={organization.id} value={organization.id}>
                  {organization.name}
                </option>
              ))}
            </select>
          </div>

          <div className="current-role">
            <span>Role</span>
            <strong
              className={`role-badge role-${role?.toLowerCase() ?? "none"}`}
            >
              {formattedRole}
            </strong>
          </div>
        </div>

        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
