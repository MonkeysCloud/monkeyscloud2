"use client";

import { Bell, Search, LogOut } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { logout } from "@/lib/auth";
import { useRouter } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";

export function Header() {
  const { user } = useAuthStore();
  const router = useRouter();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  function handleLogout() {
    logout();
    useAuthStore.getState().reset();
    router.push("/login");
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-surface-700 bg-surface-900/80 backdrop-blur-sm px-6">
      {/* Search */}
      <div className="relative w-80">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500" />
        <input
          type="text"
          placeholder="Search projects, tasks, builds…"
          className="w-full rounded-lg border border-surface-700 bg-surface-800 pl-9 pr-4 py-2 text-sm text-white placeholder:text-surface-500 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 transition-colors"
        />
        <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-surface-500 border border-surface-600 rounded px-1.5 py-0.5">
          ⌘K
        </kbd>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-3">
        {/* Notifications */}
        <button className="relative rounded-lg p-2 text-surface-400 hover:text-white hover:bg-surface-800 transition-colors">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-brand-500" />
        </button>

        {/* User menu */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-800 transition-colors"
          >
            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-xs font-bold text-white">
              {user?.name?.charAt(0) ?? "U"}
            </div>
            <span className="text-sm text-surface-300 hidden sm:block">
              {user?.name ?? "User"}
            </span>
          </button>

          {userMenuOpen && (
            <div className="absolute right-0 top-full mt-1 w-48 rounded-xl border border-surface-700 bg-surface-800 shadow-xl overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-surface-700">
                <p className="text-sm font-medium text-white">{user?.name}</p>
                <p className="text-xs text-surface-400 truncate">{user?.email}</p>
              </div>
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-surface-700 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign Out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
