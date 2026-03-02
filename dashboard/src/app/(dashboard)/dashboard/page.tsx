"use client";

import { Card, CardTitle, CardContent, StatusBadge } from "@/components/ui";
import { useAuthStore } from "@/stores/auth-store";
import { GitBranch, Hammer, Rocket, ListChecks, Activity, FolderKanban } from "lucide-react";
import Link from "next/link";

const quickStats = [
  { label: "Projects", value: "12", icon: FolderKanban, href: "/projects", color: "text-brand-400" },
  { label: "Active Builds", value: "3", icon: Hammer, href: "/builds", color: "text-amber-400" },
  { label: "Open PRs", value: "8", icon: GitBranch, href: "/git", color: "text-emerald-400" },
  { label: "My Tasks", value: "15", icon: ListChecks, href: "/tasks", color: "text-purple-400" },
];

const recentActivity = [
  { action: "Deployed v2.4.1 to production", project: "api-gateway", time: "5 min ago", status: "live" },
  { action: "Build #248 passed", project: "dashboard", time: "12 min ago", status: "passed" },
  { action: "PR #42 merged", project: "auth-service", time: "1h ago", status: "merged" },
  { action: "Task MC-128 moved to In Review", project: "mobile-app", time: "2h ago", status: "in_review" },
  { action: "Build #247 failed", project: "api-gateway", time: "3h ago", status: "failed" },
];

export default function DashboardPage() {
  const { user, currentOrg } = useAuthStore();

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          Welcome back, {user?.name?.split(" ")[0] ?? "there"} 👋
        </h1>
        <p className="text-surface-400 mt-1">
          Here&apos;s what&apos;s happening in{" "}
          <span className="text-surface-200 font-medium">{currentOrg?.name ?? "your workspace"}</span>
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {quickStats.map((stat) => (
          <Link key={stat.label} href={stat.href}>
            <Card hover>
              <div className="flex items-center gap-4">
                <div className="rounded-xl bg-surface-800 p-3">
                  <stat.icon className={`h-6 w-6 ${stat.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                  <p className="text-xs text-surface-400">{stat.label}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* Recent Activity */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <Activity className="h-5 w-5 text-surface-400" />
          <h2 className="text-lg font-semibold text-white">Recent Activity</h2>
        </div>
        <div className="divide-y divide-surface-700/50">
          {recentActivity.map((item, i) => (
            <div key={i} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm text-surface-200">{item.action}</p>
                <p className="text-xs text-surface-500 mt-0.5">{item.project} · {item.time}</p>
              </div>
              <StatusBadge status={item.status} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
