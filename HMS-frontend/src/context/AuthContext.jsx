import { createContext, useContext, useState, useCallback, useEffect } from "react";
import api, { authApi, directoryLogout } from "@/utils/api";
import SSOCookieManager from "@/utils/ssoManager";
const AuthContext = createContext(void 0);
const LOGOUT_FLAG_KEY = "hms_logout_in_progress";
const USER_STORAGE_KEY = "hms_user";
function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  useEffect(() => {
    sessionStorage.removeItem(USER_STORAGE_KEY);
    const logoutInProgress = localStorage.getItem(LOGOUT_FLAG_KEY);
    if (logoutInProgress) {
      setIsLoading(false);
      localStorage.removeItem(LOGOUT_FLAG_KEY);
      return;
    }
    authApi.me().then((profile) => {
      const authUser = mapProfileToUser(profile);
      setUser(authUser);
    }).catch(() => {
      setUser(null);
    }).finally(() => setIsLoading(false));
  }, []);
  useEffect(() => {
    const verifyOnFocus = async () => {
      if (!user) return;
      try {
        await authApi.me();
      } catch {
        sessionStorage.removeItem(USER_STORAGE_KEY);
        setUser(null);
        window.location.href = "/login?logged_out=1";
      }
    };
    window.addEventListener("focus", verifyOnFocus);
    return () => window.removeEventListener("focus", verifyOnFocus);
  }, [user]);
  useEffect(() => {
    const handleStorageChange = (event) => {
      if (event.key === "sso-logout") {
        sessionStorage.removeItem(USER_STORAGE_KEY);
        SSOCookieManager.clearToken();
        setUser(null);
        window.location.href = "/login?logged_out=1";
      }
    };
    const handleCustomLogout = () => {
      sessionStorage.removeItem(USER_STORAGE_KEY);
      SSOCookieManager.clearToken();
      setUser(null);
      window.location.href = "/login?logged_out=1";
    };
    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("sso-logout", handleCustomLogout);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("sso-logout", handleCustomLogout);
    };
  }, []);
  const login = useCallback(async (email, password) => {
    setIsLoading(true);
    try {
      const response = await authApi.login(email, password);
      const authUser = mapProfileToUser(response);
      setUser(authUser);
    } finally {
      setIsLoading(false);
    }
  }, []);
  const logout = useCallback(async () => {
    localStorage.setItem(LOGOUT_FLAG_KEY, "1");
    sessionStorage.removeItem(USER_STORAGE_KEY);
    SSOCookieManager.clearToken();
    setUser(null);
    try {
      localStorage.setItem("sso-logout", `${Date.now()}`);
      window.dispatchEvent(new Event("sso-logout"));
    } catch (e) {
      console.warn("Failed to broadcast logout:", e);
    }
    try {
      await Promise.all([
        api.post("/auth/logout"),
        directoryLogout()
      ]);
    } catch (e) {
      console.warn("Logout API failed:", e);
    }
    window.location.href = "/login?logged_out=1";
  }, []);
  return <AuthContext.Provider value={{
    user,
    isAuthenticated: !!user,
    isLoading,
    login,
    logout
  }}>{children}</AuthContext.Provider>;
}
function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
function mapProfileToUser(profile) {
  const role = (profile.role || "").toLowerCase();
  return {
    userId: profile.userId?.toString() ?? "",
    email: profile.email ?? "",
    firstName: profile.firstName ?? "",
    lastName: profile.lastName ?? null,
    role,
    roleDisplay: profile.roleDisplay ?? role,
    hospitalId: profile.hospitalId?.toString() ?? null,
    hospitalName: profile.hospitalName ?? null,
    isActive: profile.isActive ?? true
  };
}
export {
  AuthProvider,
  useAuth
};
