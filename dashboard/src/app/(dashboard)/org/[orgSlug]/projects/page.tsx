"use client";

import { useEffect, useState } from "react";
import { Button, Card, Badge, EmptyState } from "@/components/ui";
import { FolderKanban, Plus, Loader2 } from "lucide-react";
import Link from "next/link";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";

const stackIcons: Record<string, string> = {
  monkeyslegion: "🐒", laravel: "🔴", wordpress: "📝", nextjs: "▲",
  react: "⚛️", vue: "💚", django: "🐍", go: "🔵", rust: "🦀",
  docker: "🐳", static: "📄", nuxtjs: "💚", flask: "🧪",
  fastapi: "⚡", rails: "💎", drupal: "💧",
};

interface ProjectItem {
  id: number;
  name: string;
  slug: string;
  stack: string;
  status: string;
  created_at: string;
}

export default function ProjectsPage() {
  const { currentOrg } = useAuthStore();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadProjects() {
      if (!currentOrg?.id) return;
      setLoading(true);
      try {
        const res = await api.get<any>(`/api/v1/organizations/${currentOrg.id}/projects`);
        const list = res?.data ?? res;
        if (Array.isArray(list)) {
          setProjects(list);
        }
      } catch (err) {
        console.error("Failed to load projects", err);
      } finally {
        setLoading(false);
      }
    }
    loadProjects();
  }, [currentOrg?.id]);

  const orgBase = `/org/${currentOrg?.slug || "default"}`;

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 text-surface-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Projects</h1>
          <p className="text-sm text-surface-400 mt-1">{projects.length} projects in this organization</p>
        </div>
        <Link href={`${orgBase}/projects/create`}>
          <Button>
            <Plus className="h-4 w-4" /> New Project
          </Button>
        </Link>
      </div>

      {/* Grid */}
      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Create your first project to start deploying code."
          action={
            <Link href={`${orgBase}/projects/create`}>
              <Button><Plus className="h-4 w-4" /> Create Project</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((project) => (
            <Link key={project.id} href={`${orgBase}/projects/${project.slug}`}>
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
                    {project.status || "active"}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs text-surface-400 mt-4 pt-3 border-t border-surface-700/50">
                  <span><FolderKanban className="inline h-3 w-3 mr-1"/>{project.stack}</span>
                  <span>Created {new Date(project.created_at).toLocaleDateString()}</span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
