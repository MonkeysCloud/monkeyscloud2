"use client";

import { useEffect, useState } from "react";
import { Button, Card, Badge, EmptyState } from "@/components/ui";
import { 
  FolderKanban, Plus, Loader2, Cpu, Database, FileText, 
  Triangle, Atom, TerminalSquare, Hexagon, Cog, Container, 
  FileJson, Beaker, Zap, Gem, Droplets, Box,
  Banana, PenLine, FileCode, Leaf, Flame, Sparkles,
  Terminal, Component, Compass, Bolt, FlaskConical, BarChart3,
  Circle, Coffee, Layers
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";

const getStackIcon = (stack: string) => {
  const stackIcons: Record<string, React.ReactNode> = {
    // PHP
    monkeyslegion: <Banana className="h-6 w-6 text-yellow-500" />,
    laravel: <Triangle className="h-6 w-6 text-red-500" />,
    symfony: <Hexagon className="h-6 w-6 text-zinc-900 dark:text-zinc-100" />,
    wordpress: <PenLine className="h-6 w-6 text-blue-500" />,
    drupal: <Droplets className="h-6 w-6 text-blue-600" />,
    "php-generic": <FileCode className="h-6 w-6 text-purple-500" />,
    
    // JS/TS
    nextjs: <Hexagon className="h-6 w-6 text-zinc-900 dark:text-zinc-100" />,
    nuxtjs: <Leaf className="h-6 w-6 text-emerald-500" />,
    remix: <Zap className="h-6 w-6 text-indigo-500" />,
    sveltekit: <Flame className="h-6 w-6 text-orange-500" />,
    astro: <Sparkles className="h-6 w-6 text-orange-400" />,
    express: <Terminal className="h-6 w-6 text-green-500" />,
    nestjs: <Component className="h-6 w-6 text-red-600" />,
    react: <Atom className="h-6 w-6 text-cyan-400" />,
    vue: <Component className="h-6 w-6 text-emerald-500" />,
    angular: <Triangle className="h-6 w-6 text-red-600" />,
    
    // Python
    django: <Compass className="h-6 w-6 text-emerald-700" />,
    fastapi: <Bolt className="h-6 w-6 text-teal-500" />,
    flask: <FlaskConical className="h-6 w-6 text-zinc-900 dark:text-zinc-100" />,
    streamlit: <BarChart3 className="h-6 w-6 text-red-500" />,
    "python-generic": <FileCode className="h-6 w-6 text-yellow-500" />,
    
    // Ruby
    rails: <Gem className="h-6 w-6 text-red-600" />,
    "ruby-generic": <Gem className="h-6 w-6 text-red-500" />,
    
    // Go
    go: <Circle className="h-6 w-6 text-cyan-500" />,
    
    // Rust
    rust: <Cog className="h-6 w-6 text-orange-600" />,
    
    // Java
    "spring-boot": <Leaf className="h-6 w-6 text-green-500" />,
    "java-generic": <Coffee className="h-6 w-6 text-orange-500" />,
    
    // .NET
    dotnet: <Layers className="h-6 w-6 text-purple-600" />,
    
    // Elixir
    phoenix: <Flame className="h-6 w-6 text-orange-500" />,
    
    // Static & Docker
    static: <FileCode className="h-6 w-6 text-zinc-400" />,
    docker: <Container className="h-6 w-6 text-blue-500" />,
    "docker-compose": <Container className="h-6 w-6 text-blue-500" />,
  };
  return stackIcons[stack.toLowerCase()] || <Box className="h-6 w-6 text-surface-400" />;
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
  const params = useParams();
  const orgSlugParam = params.orgSlug as string;
  const { currentOrg, organizations } = useAuthStore();
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Derive the target Org instance from the URL slug so we don't fetch the 
  // localStorage cached org first and then double-fetch when Sidebar syncs it.
  const targetOrg = orgSlugParam 
    ? organizations.find((o) => o.slug === orgSlugParam)
    : currentOrg;

  useEffect(() => {
    async function loadProjects() {
      if (!targetOrg?.id) return;
      setLoading(true);
      try {
        const res = await api.get<any>(`/api/v1/organizations/${targetOrg.id}/projects`);
        const list = res?.data ?? res;
        if (Array.isArray(list)) {
          setProjects(list.filter((p: any) => p.status !== 'deleting'));
        }
      } catch (err) {
        console.error("Failed to load projects", err);
      } finally {
        setLoading(false);
      }
    }
    loadProjects();
  }, [targetOrg?.id]);

  const orgBase = `/org/${targetOrg?.slug || orgSlugParam || "default"}`;

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
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-md bg-surface-800/50 border border-surface-700">
                      {getStackIcon(project.stack)}
                    </div>
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
