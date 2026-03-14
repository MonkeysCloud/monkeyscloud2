"use client";

import { Card, CardTitle, Badge, StatusBadge, Button } from "@/components/ui";
import { GitBranch, Clock, ExternalLink, Settings, Rocket, Hammer } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

// Mock project detail
const project = {
  id: 1, name: "API Gateway", slug: "api-gateway", stack: "monkeyslegion",
  status: "active", defaultBranch: "main", customDomain: "api.monkeys.cloud",
  description: "MonkeysLegion-powered REST + gRPC API serving the entire platform.",
};

const environments = [
  { name: "Production", branch: "main", status: "active", url: "https://api.monkeys.cloud", replicas: 3 },
  { name: "Staging", branch: "staging", status: "active", url: "https://staging-api.monkeys.cloud", replicas: 1 },
  { name: "Development", branch: "develop", status: "active", url: "https://dev-api.monkeys.cloud", replicas: 1 },
];

const recentBuilds = [
  { id: 248, status: "passed", branch: "main", sha: "a1b2c3d", duration: "2m 14s", ago: "12 min ago" },
  { id: 247, status: "failed", branch: "feature/auth", sha: "e4f5g6h", duration: "1m 42s", ago: "3h ago" },
  { id: 246, status: "passed", branch: "main", sha: "i7j8k9l", duration: "2m 08s", ago: "6h ago" },
];

export default function ProjectDetailPage() {
  const params = useParams<{ projectId: string }>();
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-3xl">🐒</span>
            <div>
              <h1 className="text-2xl font-bold text-white">{project.name}</h1>
              <p className="text-sm text-surface-400">{project.description}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/projects/${params.projectId}/settings`}>
            <Button variant="secondary" size="sm">
              <Settings className="h-4 w-4" /> Settings
            </Button>
          </Link>
          <Button size="sm">
            <Rocket className="h-4 w-4" /> Deploy
          </Button>
        </div>
      </div>

      {/* Environments */}
      <Card>
        <CardTitle>Environments</CardTitle>
        <div className="mt-4 divide-y divide-surface-700/50">
          {environments.map((env) => (
            <div key={env.name} className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <StatusBadge status={env.status} />
                <div>
                  <p className="text-sm font-medium text-white">{env.name}</p>
                  <p className="text-xs text-surface-500">
                    <GitBranch className="inline h-3 w-3 mr-1" />{env.branch} · {env.replicas} replica{env.replicas > 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              {env.url && (
                <a href={env.url} target="_blank" rel="noopener" className="text-xs text-brand-400 hover:text-brand-300 flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" /> {env.url.replace("https://", "")}
                </a>
              )}
            </div>
          ))}
        </div>
      </Card>

      {/* Recent Builds */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <CardTitle>Recent Builds</CardTitle>
          <Link href="/builds" className="text-xs text-brand-400 hover:text-brand-300">View all →</Link>
        </div>
        <div className="divide-y divide-surface-700/50">
          {recentBuilds.map((build) => (
            <Link key={build.id} href={`/builds/${build.id}`} className="flex items-center justify-between py-3 hover:bg-surface-800/50 -mx-5 px-5 transition-colors">
              <div className="flex items-center gap-3">
                <StatusBadge status={build.status} />
                <div>
                  <p className="text-sm text-white">Build #{build.id}</p>
                  <p className="text-xs text-surface-500">
                    <GitBranch className="inline h-3 w-3 mr-1" />{build.branch}
                    <span className="mx-1">·</span>
                    <code className="text-surface-400">{build.sha}</code>
                  </p>
                </div>
              </div>
              <div className="text-right text-xs text-surface-500">
                <p><Clock className="inline h-3 w-3 mr-1" />{build.duration}</p>
                <p>{build.ago}</p>
              </div>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}
