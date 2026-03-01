"use client";

import { Card, StatusBadge, Button, EmptyState } from "@/components/ui";
import { Hammer, GitBranch, Clock, Filter } from "lucide-react";
import Link from "next/link";

const builds = [
  { id: 248, project: "API Gateway", status: "passed", branch: "main", sha: "a1b2c3d", trigger: "push", duration: "2m 14s", ago: "12 min ago" },
  { id: 247, project: "API Gateway", status: "failed", branch: "feature/auth", sha: "e4f5g6h", trigger: "pr", duration: "1m 42s", ago: "3h ago" },
  { id: 246, project: "Dashboard", status: "running", branch: "main", sha: "m1n2o3p", trigger: "push", duration: "—", ago: "just now" },
  { id: 245, project: "Auth Service", status: "passed", branch: "main", sha: "q4r5s6t", trigger: "manual", duration: "3m 05s", ago: "5h ago" },
  { id: 244, project: "Dashboard", status: "passed", branch: "main", sha: "u7v8w9x", trigger: "push", duration: "1m 58s", ago: "6h ago" },
  { id: 243, project: "ML Pipeline", status: "cancelled", branch: "develop", sha: "y0z1a2b", trigger: "schedule", duration: "0m 12s", ago: "8h ago" },
];

export default function BuildsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Builds</h1>
          <p className="text-sm text-surface-400 mt-1">CI/CD build pipeline</p>
        </div>
        <Button variant="secondary" size="sm"><Filter className="h-4 w-4" /> Filter</Button>
      </div>

      <div className="space-y-2">
        {builds.map((build) => (
          <Link key={build.id} href={`/builds/${build.id}`}>
            <Card hover className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <StatusBadge status={build.status} />
                <div>
                  <p className="text-sm font-medium text-white">
                    Build #{build.id} <span className="text-surface-500">·</span>{" "}
                    <span className="text-surface-300">{build.project}</span>
                  </p>
                  <p className="text-xs text-surface-500 mt-0.5">
                    <GitBranch className="inline h-3 w-3 mr-1" />{build.branch}
                    <span className="mx-1">·</span>
                    <code className="text-surface-400">{build.sha}</code>
                    <span className="mx-1">·</span>
                    {build.trigger}
                  </p>
                </div>
              </div>
              <div className="text-right text-xs text-surface-500">
                <p><Clock className="inline h-3 w-3 mr-1" />{build.duration}</p>
                <p className="mt-0.5">{build.ago}</p>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
