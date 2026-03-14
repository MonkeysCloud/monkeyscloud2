"use client";

import {
  Search,
  Bot,
  Bell,
  LogOut,
  User,
  Key,
  Palette,
  BookOpen,
  MessageSquare,
  Menu,
  X,
  Building2,
  Plus,
  GitPullRequest,
  Rocket,
  Hammer,
  ListChecks,
  AtSign,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useNavStore } from "@/stores/nav-store";
import { logout } from "@/lib/auth";
import { clearLastContext } from "@/lib/navigation-context";
import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import clsx from "clsx";

/* ─── Mock notifications ─── */
const NOTIFICATIONS = [
  { type: "pr" as const, text: "Sarah approved PR #17", sub: "project-api", time: "2m", read: false },
  { type: "deploy" as const, text: "Deploy #92 succeeded", sub: "marketing-site → production", time: "15m", read: false },
  { type: "build" as const, text: "Build #103 failed", sub: "mobile-app → feature/auth", time: "1h", read: false },
  { type: "task" as const, text: "You were assigned PROJ-55", sub: "Fix pagination on /users", time: "3h", read: true },
  { type: "mention" as const, text: "@yorch mentioned in PROJ-42", sub: "Can you review the auth flow?", time: "5h", read: true },
];

const typeIcon = { pr: GitPullRequest, deploy: Rocket, build: Hammer, task: ListChecks, mention: AtSign };
const typeColor = { pr: "text-violet-400", deploy: "text-emerald-400", build: "text-red-400", task: "text-blue-400", mention: "text-yellow-400" };

export function Header() {
  const { user } = useAuthStore();
  const { toggleSidebar, sidebarCollapsed, mobileSidebarOpen, setMobileSidebarOpen, setShowCommandPalette, showAiChat, setShowAiChat } = useNavStore();
  const router = useRouter();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) setUserMenuOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // ⌘K shortcut
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowCommandPalette(true);
      }
      if (e.key === "Escape") {
        setShowCommandPalette(false);
        setNotifOpen(false);
        setUserMenuOpen(false);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [setShowCommandPalette]);

  function handleLogout() {
    logout();
    clearLastContext();
    useAuthStore.getState().reset();
    router.push("/login");
  }

  // On mobile, hamburger opens the overlay sidebar; on desktop, it collapses/expands
  function handleHamburger() {
    if (window.innerWidth < 1024) {
      setMobileSidebarOpen(!mobileSidebarOpen);
    } else {
      toggleSidebar();
    }
  }

  const unreadCount = NOTIFICATIONS.filter((n) => !n.read).length;

  return (
    <header className="flex h-[52px] items-center gap-2 border-b border-surface-800 bg-[#0d1220] px-3 select-none">
      {/* Hamburger */}
      <button
        onClick={handleHamburger}
        className="shrink-0 flex items-center justify-center w-8 h-8 rounded-md text-surface-400 hover:text-white hover:bg-surface-800/60 transition-colors"
      >
        <Menu className="h-4 w-4" />
      </button>

      {/* Logo */}
      <div className="flex items-center gap-1.5 mr-2 md:mr-4 shrink-0">
        <img
          src="/monkeyscloud-white-words.svg"
          alt="MonkeysCloud"
          className="h-8 w-20 md:h-20 md:w-40"
        />
      </div>

      {/* Search / Command Palette trigger — full on md+, icon only on mobile */}
      <button
        onClick={() => setShowCommandPalette(true)}
        className="hidden md:flex flex-1 max-w-md items-center gap-2 h-8 px-3 rounded-lg border border-surface-800 bg-[#111827] text-left transition-colors hover:border-surface-700 cursor-text"
      >
        <Search className="h-3.5 w-3.5 text-surface-500 shrink-0" />
        <span className="text-sm text-surface-500 flex-1">Search everything...</span>
        <kbd className="text-xs text-surface-600 border border-surface-700 bg-surface-800/50 rounded px-1.5 py-0.5 shrink-0">
          ⌘K
        </kbd>
      </button>
      <button
        onClick={() => setShowCommandPalette(true)}
        className="md:hidden shrink-0 flex items-center justify-center w-8 h-8 rounded-md text-surface-400 hover:text-white hover:bg-surface-800/60 transition-colors"
      >
        <Search className="h-4 w-4" />
      </button>

      <div className="flex-1" />

      {/* AI Chat toggle */}
      <button
        onClick={() => setShowAiChat(!showAiChat)}
        className={clsx(
          "flex items-center justify-center w-8 h-8 rounded-lg transition-colors",
          showAiChat ? "bg-primary-500/15 text-primary-400" : "text-surface-400 hover:text-white hover:bg-surface-800/60"
        )}
        title="MonkeysAI Chat"
      >
        <Bot className="h-[18px] w-[18px]" />
      </button>

      {/* Notifications */}
      <div ref={notifRef} className="relative">
        <button
          onClick={() => { setNotifOpen(!notifOpen); setUserMenuOpen(false); }}
          className="relative flex items-center justify-center w-8 h-8 rounded-lg text-surface-400 hover:text-white hover:bg-surface-800/60 transition-colors"
        >
          <Bell className="h-[18px] w-[18px]" />
          {unreadCount > 0 && (
            <span className="absolute top-0.5 right-0.5 flex items-center justify-center h-4 w-4 rounded-full bg-red-500 text-xs font-bold text-white">
              {unreadCount}
            </span>
          )}
        </button>

        {notifOpen && (
          <div className="absolute right-0 top-full mt-1.5 w-[360px] rounded-xl border border-surface-800 bg-[#111827] shadow-2xl shadow-black/40 z-50 overflow-hidden animate-slide-down">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-surface-800">
              <span className="text-[13px] font-semibold text-surface-100">Notifications</span>
              <button className="text-[13px] text-primary-400 hover:text-primary-300 transition-colors">
                Mark all read
              </button>
            </div>
            {NOTIFICATIONS.map((n, i) => {
              const IconComp = typeIcon[n.type];
              return (
                <div
                  key={i}
                  className={clsx(
                    "flex gap-3 px-4 py-2.5 cursor-pointer transition-colors hover:bg-surface-800/50",
                    !n.read && "bg-primary-500/5"
                  )}
                >
                  <IconComp className={clsx("h-4 w-4 shrink-0 mt-0.5", typeColor[n.type])} />
                  <div className="flex-1 min-w-0">
                    <p className={clsx("text-sm", n.read ? "text-surface-400" : "text-surface-200 font-medium")}>
                      {n.text}
                    </p>
                    <p className="text-[13px] text-surface-500 mt-0.5 truncate">{n.sub}</p>
                  </div>
                  <span className="text-xs text-surface-600 shrink-0 mt-0.5">{n.time}</span>
                </div>
              );
            })}
            <div className="px-4 py-2.5 border-t border-surface-800 text-center">
              <button className="text-sm text-primary-400 hover:text-primary-300 transition-colors">
                View all notifications →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* User Avatar Menu */}
      <div ref={userMenuRef} className="relative">
        <button
          onClick={() => { setUserMenuOpen(!userMenuOpen); setNotifOpen(false); }}
          className="flex items-center gap-2 rounded-lg px-1.5 py-1 hover:bg-surface-800/60 transition-colors"
        >
          <div className="h-7 w-7 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-[13px] font-bold text-white shrink-0 overflow-hidden">
            {user?.avatar_url ? (
              <img
                src={user.avatar_url.startsWith("http") ? user.avatar_url : `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}${user.avatar_url}`}
                alt={user.name}
                className="w-full h-full object-cover"
              />
            ) : (
              user?.name?.charAt(0) ?? "U"
            )}
          </div>
        </button>

        {userMenuOpen && (
          <div className="absolute right-0 top-full mt-1.5 w-[220px] rounded-xl border border-surface-800 bg-[#111827] shadow-2xl shadow-black/40 z-50 overflow-hidden animate-slide-down">
            {/* User info */}
            <div className="px-4 py-3 border-b border-surface-800">
              <p className="text-[13px] font-semibold text-surface-100">{user?.name ?? "User"}</p>
              <p className="text-[13px] text-surface-500 mt-0.5 truncate">{user?.email ?? ""}</p>
            </div>

            {/* Menu items */}
            <div className="py-1">
              {[
                { icon: User, label: "Account Settings", href: "/account" },
                { icon: Key, label: "API Keys", href: "/account/api-keys" },
                { icon: Palette, label: "Appearance", href: "/account/appearance" },
                { icon: BookOpen, label: "Documentation", href: "#" },
                { icon: MessageSquare, label: "Feedback", href: "#" },
              ].map((item) => (
                <button
                  key={item.label}
                  onClick={() => { if (item.href !== "#") { router.push(item.href); setUserMenuOpen(false); } }}
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-surface-300 hover:bg-surface-800/60 hover:text-white transition-colors"
                >
                  <item.icon className="h-3.5 w-3.5 text-surface-500" />
                  {item.label}
                </button>
              ))}
            </div>

            {/* Orgs */}
            <div className="border-t border-surface-800 py-1">
              <div className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-surface-600">
                Organizations
              </div>
              {useAuthStore.getState().organizations.map((org) => (
                <button
                  key={org.id}
                  onClick={() => { useAuthStore.getState().setCurrentOrg(org); setUserMenuOpen(false); }}
                  className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-surface-300 hover:bg-surface-800/60 transition-colors"
                >
                  <Building2 className="h-3.5 w-3.5 text-surface-500" />
                  <span className="flex-1 text-left">{org.name}</span>
                  {org.id === useAuthStore.getState().currentOrg?.id && (
                    <span className="text-primary-400 text-[13px]">✓</span>
                  )}
                </button>
              ))}
              <button className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-primary-400 hover:bg-surface-800/60 transition-colors">
                <Plus className="h-3.5 w-3.5" />
                New Organization
              </button>
            </div>

            {/* Sign out */}
            <div className="border-t border-surface-800 py-1">
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-red-400 hover:bg-surface-800/60 transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
