"use client";

import { Card, CardTitle, StatusBadge, Badge, Button } from "@/components/ui";
import { GitBranch, GitMerge, MessageSquare, CheckCircle2 } from "lucide-react";

const pr = {
  id: 42, number: 42, title: "Add rate limiting middleware",
  description: "Implements token bucket rate limiting on all authenticated endpoints. Configurable per-org via `rate_limit` settings.\n\n## Changes\n- Added `RateLimitMiddleware`\n- Added `rate_limit` config table\n- Per-org rate limit overrides\n- Redis-backed token bucket",
  project: "API Gateway", author: "Jorge", status: "open",
  source: "feature/rate-limit", target: "main",
  additions: 342, deletions: 18, filesChanged: 8,
  mergeStrategy: "squash",
};

const reviews = [
  { reviewer: "Maria", status: "approved", body: "LGTM! Clean implementation.", ago: "1h ago" },
];

const comments = [
  { user: "David", body: "Should we add a burst limit too?", file: "src/Middleware/RateLimitMiddleware.php", line: 42, ago: "2h ago", resolved: false },
  { user: "Jorge", body: "Good call — added `burst_size` option in the config.", file: null, line: null, ago: "1h ago", resolved: false },
];

export default function PullRequestDetailPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <StatusBadge status={pr.status} />
          <h1 className="text-2xl font-bold text-white">#{pr.number} {pr.title}</h1>
        </div>
        <p className="text-sm text-surface-400">
          {pr.author} wants to merge <Badge variant="info"><GitBranch className="h-3 w-3" /> {pr.source}</Badge>{" "}
          into <Badge><GitBranch className="h-3 w-3" /> {pr.target}</Badge>
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Description */}
          <Card>
            <CardTitle>Description</CardTitle>
            <div className="mt-3 prose prose-invert prose-sm max-w-none text-surface-300">
              <pre className="whitespace-pre-wrap text-sm text-surface-300 font-sans">{pr.description}</pre>
            </div>
          </Card>

          {/* Comments */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <MessageSquare className="h-5 w-5 text-surface-400" />
              <CardTitle>Discussion</CardTitle>
              <Badge>{comments.length}</Badge>
            </div>
            <div className="space-y-4">
              {comments.map((c, i) => (
                <div key={i} className="rounded-lg border border-surface-700/50 bg-surface-900/30 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-white">{c.user}</span>
                    <span className="text-xs text-surface-500">{c.ago}</span>
                  </div>
                  {c.file && (
                    <p className="text-xs text-surface-500 mb-2">
                      📄 {c.file}:{c.line}
                    </p>
                  )}
                  <p className="text-sm text-surface-300">{c.body}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Merge */}
          <Card>
            <Button className="w-full" size="lg">
              <GitMerge className="h-4 w-4" /> Squash & Merge
            </Button>
            <p className="text-xs text-surface-500 text-center mt-2">
              Strategy: {pr.mergeStrategy}
            </p>
          </Card>

          {/* Reviews */}
          <Card>
            <CardTitle>Reviews</CardTitle>
            <div className="mt-3 space-y-2">
              {reviews.map((r, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span className="text-sm text-surface-200">{r.reviewer}</span>
                  </div>
                  <Badge variant="success">Approved</Badge>
                </div>
              ))}
            </div>
          </Card>

          {/* Stats */}
          <Card>
            <CardTitle>Changes</CardTitle>
            <div className="mt-3 space-y-1 text-sm">
              <p className="text-emerald-400">+{pr.additions} additions</p>
              <p className="text-red-400">-{pr.deletions} deletions</p>
              <p className="text-surface-400">{pr.filesChanged} files changed</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
