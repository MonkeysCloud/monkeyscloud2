"use client";

import { Button, Card, Badge, EmptyState } from "@/components/ui";
import { FolderKanban, Plus, ExternalLink } from "lucide-react";
import Link from "next/link";

const stackIcons: Record<string, string> = {
  monkeyslegion: "🐒", laravel: "🔴", wordpress: "📝", nextjs: "▲",
  react: "⚛️", vue: "💚", django: "🐍", go: "🔵", rust: "🦀",
  docker: "🐳", static: "📄", nuxtjs: "💚", flask: "🧪",
  fastapi: "⚡", rails: "💎", drupal: "💧",
};

// Mock data
const projects = [
  { id: 1, name: "API Gateway", slug: "api-gateway", stack: "monkeyslegion", status: "active", lastDeploy: "2h ago", branch: "main" },
  { id: 2, name: "Dashboard", slug: "dashboard", stack: "nextjs", status: "active", lastDeploy: "30m ago", branch: "main" },
  { id: 3, name: "Auth Service", slug: "auth-service", stack: "go", status: "active", lastDeploy: "1d ago", branch: "main" },
  { id: 4, name: "Mobile App", slug: "mobile-app", stack: "react", status: "active", lastDeploy: "3d ago", branch: "develop" },
  { id: 5, name: "Landing Page", slug: "landing", stack: "static", status: "archived", lastDeploy: "2w ago", branch: "main" },
  { id: 6, name: "ML Pipeline", slug: "ml-pipeline", stack: "django", status: "active", lastDeploy: "5h ago", branch: "main" },
];

export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Projects</h1>
          <p className="text-sm text-surface-400 mt-1">{projects.length} projects in this organization</p>
        </div>
        <Button>
          <Plus className="h-4 w-4" /> New Project
        </Button>
      </div>

      {/* Grid */}
      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Create your first project to start deploying code."
          action={<Button><Plus className="h-4 w-4" /> Create Project</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((project) => (
            <Link key={project.id} href={`/projects/${project.id}`}>
              <Card hover className="h-full">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{stackIcons[project.stack] ?? "📦"}</span>
                    <div>
                      <h3 className="text-base font-semibold text-white">{project.name}</h3>
                      <p className="text-xs text-surface-500">{project.slug}</p>
                    </div>
                  </div>
                  <Badge variant={project.status === "active" ? "success" : "default"}>
                    {project.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-surface-400 mt-4 pt-3 border-t border-surface-700/50">
                  <span>🔀 {project.branch}</span>
                  <span>Last deployed {project.lastDeploy}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
