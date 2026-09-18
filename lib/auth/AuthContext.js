"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

const AuthContext = createContext({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  login: async () => ({ success: false }),
  logout: async () => {},
});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Rehydrate session from server on initial load
  const checkSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          setUser(data.user);
          return;
        }
      }
      setUser(null);
    } catch (err) {
      console.warn("[Auth] Session check error:", err);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // Login handler
  const login = async ({ email, password, role, rememberMe }) => {
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, role, rememberMe }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return {
          success: false,
          error: data.error || "Unable to sign in. Please check your credentials.",
        };
      }

      setUser(data.user);
      return { success: true, user: data.user };
    } catch (err) {
      return {
        success: false,
        error: "Something went wrong. Please check your connection and try again.",
      };
    }
  };

  // Logout handler
  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.warn("[Auth] Logout error:", err);
    } finally {
      setUser(null);
      router.push("/login");
      router.refresh();
    }
  };

  // Quick role switcher for instant persona switching
  const quickSwitchRole = async (targetRole) => {
    if (targetRole === "SUPPLIER") {
      const res = await login({
        email: "supplier1@example.com",
        password: "Supplier@2026!",
        role: "SUPPLIER",
      });
      if (res.success) {
        router.push("/supplier");
      }
      return res;
    } else {
      const res = await login({
        email: "admin@pdv.com",
        password: "Admin@PDV2026!",
        role: "ADMIN",
      });
      if (res.success) {
        router.push("/");
      }
      return res;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        checkSession,
        quickSwitchRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
