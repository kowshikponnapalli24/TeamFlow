import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

import {
  apiRequest,
  clearToken,
  getToken,
  setToken,
} from "../lib/api";

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
  createdAt?: string;
}

export type OrganizationRole = "ADMIN" | "MANAGER" | "DEVELOPER";

export interface Organization {
  id: string;
  name: string;
  description?: string | null;
  role: OrganizationRole;
  joinedAt?: string;
  slug?: string;
}

interface AuthContextType {
  user: User | null;
  organizations: Organization[];
  activeOrganization: Organization | null;
  activeOrganizationId: string;
  role: OrganizationRole | null;
  loading: boolean;
  setActiveOrganizationId: (id: string) => void;
  refreshOrganizations: () => Promise<void>;
  updateUser: (user: User) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [activeOrganizationId, setActiveOrganizationId] = useState("");
  const [loading, setLoading] = useState(true);

  const loadOrganizations = async () => {
    try {
      const data = await apiRequest<{
        success: boolean;
        organizations: Organization[];
      }>("/organizations");

      const fetchedOrganizations = data.organizations ?? [];
      setOrganizations(fetchedOrganizations);

      setActiveOrganizationId((currentId) => {
        if (currentId && fetchedOrganizations.some((org) => org.id === currentId)) {
          return currentId;
        }

        const mainWorkspace = fetchedOrganizations.find(
          (org) => org.name === "TeamFlow Development"
        );

        return mainWorkspace?.id ?? fetchedOrganizations[0]?.id ?? "";
      });
    } catch (error) {
      console.error("Failed to load organizations:", error);
      setOrganizations([]);
      setActiveOrganizationId("");
    }
  };

  useEffect(() => {
    const initializeAuth = async () => {
      if (!getToken()) {
        setLoading(false);
        return;
      }

      try {
        const data = await apiRequest<{ user: User }>("/auth/me");
        setUser(data.user);
        await loadOrganizations();
      } catch {
        clearToken();
        setUser(null);
        setOrganizations([]);
        setActiveOrganizationId("");
      } finally {
        setLoading(false);
      }
    };

    void initializeAuth();
  }, []);

  const refreshOrganizations = async () => {
    if (!getToken()) return;
    await loadOrganizations();
  };

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser);
  };

  const login = async (email: string, password: string) => {
    const data = await apiRequest<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    if (!data.token || !data.user) {
      throw new Error("Invalid login response from server");
    }

    setToken(data.token);
    setUser(data.user);
    await loadOrganizations();
  };

  const register = async (name: string, email: string, password: string) => {
    const data = await apiRequest<{ token: string; user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });

    if (!data.token || !data.user) {
      throw new Error("Invalid registration response from server");
    }

    setToken(data.token);
    setUser(data.user);
    await loadOrganizations();
  };

  const logout = () => {
    clearToken();
    setUser(null);
    setOrganizations([]);
    setActiveOrganizationId("");
  };

  const activeOrganization =
    organizations.find((org) => org.id === activeOrganizationId) ?? null;
  const role = activeOrganization?.role ?? null;

  return (
    <AuthContext.Provider
      value={{
        user,
        organizations,
        activeOrganization,
        activeOrganizationId,
        role,
        loading,
        setActiveOrganizationId,
        refreshOrganizations,
        updateUser,
        login,
        register,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
