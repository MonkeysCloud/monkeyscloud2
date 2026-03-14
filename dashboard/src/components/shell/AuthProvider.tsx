"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/stores/auth-store";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/**
 * Fetches the current user profile on mount and populates the auth store.
 * This ensures avatar_url, timezone, locale etc. are available after page refresh.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { setUser, setOrganizations, setLoading } = useAuthStore();

  useEffect(() => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("mc_token") : null;
    if (!token || token === "undefined" || token === "null") {
      setLoading(false);
      return;
    }

    async function fetchMe() {
      try {
        const res = await fetch(`${API}/api/v1/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          if (data.organizations) {
            setOrganizations(data.organizations);
          }
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false);
      }
    }

    fetchMe();
  }, [setUser, setOrganizations, setLoading]);

  return <>{children}</>;
}
