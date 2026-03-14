"use client";

import { useEffect, useState, ReactNode } from "react";
import { SocketProvider } from "@/lib/socket";

/**
 * Client-side wrapper that reads the auth token from localStorage
 * and passes it to the SocketProvider.
 * This is needed because the dashboard layout is a server component.
 */
export function SocketWrapper({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | undefined>(undefined);

  useEffect(() => {
    const raw = localStorage.getItem("mc_token");
    console.log("[DEBUG SocketWrapper] mc_token from localStorage:", raw ? `found (${raw.length} chars)` : "NOT FOUND");
    if (raw && raw !== "undefined" && raw !== "null") {
      setToken(raw);
    }
  }, []);

  return (
    <SocketProvider token={token}>
      {children}
    </SocketProvider>
  );
}
