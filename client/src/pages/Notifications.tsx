
import { useEffect, useState } from "react";
import { Bell, CheckCheck, Trash2, MessageSquare, ClipboardList } from "lucide-react";
import { apiRequest } from "../lib/api";

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  readAt: string | null;
  createdAt: string;
  task?: {
    id: string;
    title: string;
    project?: {
      id: string;
      name: string;
    };
  };
}

export default function Notifications() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
   const notifySidebarUpdate = () => {
  window.dispatchEvent(new Event("teamflow:notifications-updated"));
};
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadNotifications = async () => {
    try {
      setError("");
      const response = await apiRequest<{
        success: boolean;
        notifications: Notification[];
      }>("/notifications");

      setNotifications(response.notifications ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadNotifications();
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await apiRequest(`/notifications/${id}/read`, { method: "PATCH" });
      setNotifications((items) =>
        items.map((item) =>
          item.id === id ? { ...item, readAt: new Date().toISOString() } : item
        )

      );
      notifySidebarUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not mark notification as read");
    }
  };

  const markAllAsRead = async () => {
    try {
      await apiRequest("/notifications/read-all", { method: "PATCH" });
      setNotifications((items) =>
        items.map((item) => ({ ...item, readAt: new Date().toISOString() }))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not mark all as read");
    }
  };

  const deleteNotification = async (id: string) => {
    try {
      await apiRequest(`/notifications/${id}`, { method: "DELETE" });
      setNotifications((items) => items.filter((item) => item.id !== id));
      notifySidebarUpdate();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete notification");
    }
  };

  const unreadCount = notifications.filter((item) => !item.readAt).length;

  if (loading) return <div className="page-container"><p>Loading notifications...</p></div>;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Notifications</h1>
          <p>You have {unreadCount} unread notification(s).</p>
        </div>
        {unreadCount > 0 && (
          <button className="btn btn-primary" onClick={markAllAsRead}>
            <CheckCheck size={16} /> Mark all as read
          </button>
        )}
      </div>

      {error && <p className="error-message">{error}</p>}

      {notifications.length === 0 ? (
        <div className="empty-state">
          <Bell size={36} />
          <h3>No notifications yet</h3>
          <p>Updates about your tasks and projects will appear here.</p>
        </div>
      ) : (
        <div className="notification-list">
          {notifications.map((item) => (
            <div
              key={item.id}
              className={`notification-card ${!item.readAt ? "unread" : ""}`}
            >
              <div className="notification-icon">
                {item.type === "TASK_ASSIGNED" ? (
                  <ClipboardList size={20} />
                ) : (
                  <MessageSquare size={20} />
                )}
              </div>

              <div className="notification-content">
                <div className="notification-title-row">
                  <h3>{item.title}</h3>
                  {!item.readAt && <span className="unread-dot" />}
                </div>
                <p>{item.message}</p>
                {item.task?.project && (
                  <small>
                    {item.task.project.name} Â· {item.task.title}
                  </small>
                )}
                <small>{new Date(item.createdAt).toLocaleString()}</small>
              </div>

              <div className="notification-actions">
                {!item.readAt && (
                  <button
                    title="Mark as read"
                    onClick={() => markAsRead(item.id)}
                  >
                    <CheckCheck size={17} />
                  </button>
                )}
                <button
                  title="Delete notification"
                  onClick={() => deleteNotification(item.id)}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

}
