"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  LayoutDashboard,
  FolderKanban,
  GitBranch,
  Hammer,
  ListChecks,
  Settings,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useState } from "react";
import { OrgSwitcher } from "./OrgSwitcher";

const navGroups = [
  {
    label: "Platform",
    items: [
      { name: "Overview", href: "/", icon: LayoutDashboard },
      { name: "Projects", href: "/projects", icon: FolderKanban },
      { name: "Git", href: "/git", icon: GitBranch },
      { name: "Builds", href: "/builds", icon: Hammer },
      { name: "Tasks", href: "/tasks", icon: ListChecks },
    ],
  },
  {
    label: "Manage",
    items: [
      { name: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside
      className={clsx(
        "flex flex-col h-screen border-r border-surface-700 bg-surface-900 transition-all duration-200",
        collapsed ? "w-16" : "w-64"
      )}
    >
      {/* Org Switcher */}
      <div className={clsx("p-3 border-b border-surface-700", collapsed && "px-2")}>
        {collapsed ? (
          <div className="h-10 w-10 mx-auto rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center text-sm font-bold text-white">
            M
          </div>
        ) : (
          <OrgSwitcher />
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {navGroups.map((group) => (
          <div key={group.label}>
            {!collapsed && (
              <p className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-surface-500">
                {group.label}
              </p>
            )}
            <div className="space-y-1">
              {group.items.map((item) => {
                const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={clsx(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150",
                      isActive
                        ? "bg-brand-600/20 text-brand-400"
                        : "text-surface-400 hover:text-white hover:bg-surface-800"
                    )}
                    title={collapsed ? item.name : undefined}
                  >
                    <item.icon className={clsx("h-5 w-5 shrink-0", isActive && "text-brand-400")} />
                    {!collapsed && <span>{item.name}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      <div className="border-t border-surface-700 p-3">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-center rounded-lg py-2 text-surface-400 hover:text-white hover:bg-surface-800 transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  );
}
