"use client";

import { Card, CardTitle, StatusBadge, Badge } from "@/components/ui";
import { GitBranch, GitPullRequest, GitCommit } from "lucide-react";
import Link from "next/link";

const recentCommits = [
  { sha: "a1b2c3d", message: "feat: add rate limiting to API endpoints", author: "Jorge", branch: "main", project: "API Gateway", ago: "30m ago" },
  { sha: "e4f5g6h", message: "fix: resolve token refresh race condition", author: "Maria", branch: "main", project: "Auth Service", ago: "2h ago" },
  { sha: "i7j8k9l", message: "chore: update dependencies to latest versions", author: "Jorge", branch: "develop", project: "Dashboard", ago: "4h ago" },
  { sha: "m1n2o3p", message: "feat: implement PR inline comments", author: "David", branch: "feature/pr-comments", project: "Dashboard", ago: "5h ago" },
];

const openPRs = [
  { id: 42, number: 42, title: "Add rate limiting middleware", project: "API Gateway", author: "Jorge", source: "feature/rate-limit", target: "main", status: "open", reviews: 1, comments: 3 },
  { id: 41, number: 41, title: "Implement 2FA backup codes", project: "Auth Service", author: "Maria", source: "feature/2fa-backup", target: "main", status: "open", reviews: 0, comments: 1 },
  { id: 40, number: 40, title: "Dashboard dark mode improvements", project: "Dashboard", author: "David", source: "fix/dark-mode", target: "main", status: "draft", reviews: 0, comments: 0 },
];

export default function GitPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Git</h1>
        <p className="text-sm text-surface-400 mt-1">Commits, pull requests, and code review</p>
      </div>

      {/* Open PRs */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <GitPullRequest className="h-5 w-5 text-emerald-400" />
          <CardTitle>Open Pull Requests</CardTitle>
          <Badge>{openPRs.length}</Badge>
        </div>
        <div className="divide-y divide-surface-700/50">
          {openPRs.map((pr) => (
            <Link key={pr.id} href={`/git/pull-requests/${pr.id}`} className="flex items-center justify-between py-3 hover:bg-surface-800/50 -mx-5 px-5 transition-colors">
              <div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={pr.status} />
                  <p className="text-sm font-medium text-white">#{pr.number} {pr.title}</p>
                </div>
                <p className="text-xs text-surface-500 mt-0.5">
                  {pr.project} · {pr.author} · {pr.source} → {pr.target}
                </p>
              </div>
              <div className="text-xs text-surface-500">
                {pr.reviews > 0 && <span className="mr-3">✅ {pr.reviews}</span>}
                {pr.comments > 0 && <span>💬 {pr.comments}</span>}
              </div>
            </Link>
          ))}
        </div>
      </Card>

      {/* Recent Commits */}
      <Card>
        <div className="flex items-center gap-2 mb-4">
          <GitCommit className="h-5 w-5 text-surface-400" />
          <CardTitle>Recent Commits</CardTitle>
        </div>
        <div className="divide-y divide-surface-700/50">
          {recentCommits.map((commit) => (
            <div key={commit.sha} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm text-surface-200">{commit.message}</p>
                <p className="text-xs text-surface-500 mt-0.5">
                  <code className="text-surface-400">{commit.sha}</code>
                  <span className="mx-1">·</span>{commit.author}
                  <span className="mx-1">·</span>
                  <GitBranch className="inline h-3 w-3" /> {commit.branch}
                  <span className="mx-1">·</span>{commit.project}
                </p>
              </div>
              <span className="text-xs text-surface-500 shrink-0">{commit.ago}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
