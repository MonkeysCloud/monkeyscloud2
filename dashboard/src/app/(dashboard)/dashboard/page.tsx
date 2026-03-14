"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { isAuthenticated } from "@/lib/auth";
import { saveLastOrg, saveLastProject } from "@/lib/navigation-context";
import {
  Building2,
  FolderKanban,
  Plus,
  ArrowRight,
  Sparkles,
} from "lucide-react";

interface Org {
  id: number;
  name: string;
  slug: string;
  avatar_url?: string;
}

interface Project {
  id: number;
  name: string;
  slug: string;
  status?: string;
}

export default function DashboardHubPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [orgProjects, setOrgProjects] = useState<Record<number, Project[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated()) {
      router.push("/login");
      return;
    }

    async function loadData() {
      try {
        const res = await api.get<any>("/api/v1/organizations");
        const orgList: Org[] = res?.data ?? [];
        setOrgs(orgList);

        if (orgList.length === 0) {
          router.push("/org/create");
          return;
        }

        // Load projects for each org
        const projectMap: Record<number, Project[]> = {};
        await Promise.all(
          orgList.slice(0, 5).map(async (org) => {
            try {
              const pRes = await api.get<any>(`/api/v1/organizations/${org.id}/projects`);
              projectMap[org.id] = pRes?.data ?? [];
            } catch {
              projectMap[org.id] = [];
            }
          })
        );
        setOrgProjects(projectMap);
      } catch {
        router.push("/login");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  function goToOrg(org: Org) {
    saveLastOrg(org.slug);
    router.push(`/org/${org.slug}`);
  }

  function goToProject(org: Org, project: Project) {
    saveLastOrg(org.slug);
    saveLastProject(project.slug);
    router.push(`/org/${org.slug}/projects/${project.slug}/board`);
  }

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
          <p className="text-sm text-surface-400">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary-400" />
            Welcome back{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
          </h1>
          <p className="text-sm text-surface-400 mt-1">
            Choose an organization or project to get started
          </p>
        </div>
        <button
          onClick={() => router.push("/org/create")}
          className="flex items-center gap-2 rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-400 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Organization
        </button>
      </div>

      {/* Org Cards */}
      <div className="space-y-5">
        {orgs.map((org) => {
          const projects = orgProjects[org.id] ?? [];
          return (
            <div
              key={org.id}
              className="rounded-xl border border-surface-800 bg-surface-900/40 overflow-hidden hover:border-surface-700 transition-colors"
            >
              {/* Org Header */}
              <button
                onClick={() => goToOrg(org)}
                className="w-full flex items-center gap-3 px-5 py-4 hover:bg-surface-800/30 transition-colors group text-left"
              >
                <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-primary-500/20 to-primary-600/10 border border-primary-500/20 flex items-center justify-center">
                  {org.avatar_url ? (
                    <img src={org.avatar_url} alt={org.name} className="h-10 w-10 rounded-lg object-cover" />
                  ) : (
                    <Building2 className="h-5 w-5 text-primary-400" />
                  )}
                </div>
                <div className="flex-1">
                  <h2 className="text-base font-semibold text-white group-hover:text-primary-300 transition-colors">
                    {org.name}
                  </h2>
                  <p className="text-xs text-surface-500">
                    {projects.length} project{projects.length !== 1 ? "s" : ""} · /{org.slug}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-surface-600 group-hover:text-primary-400 transition-colors" />
              </button>

              {/* Projects */}
              {projects.length > 0 && (
                <div className="border-t border-surface-800/50 px-5 py-3 space-y-1">
                  {projects.map((project) => (
                    <button
                      key={project.id}
                      onClick={() => goToProject(org, project)}
                      className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-surface-800/50 transition-colors group text-left"
                    >
                      <FolderKanban className="h-4 w-4 text-surface-500 group-hover:text-primary-400 transition-colors" />
                      <span className="flex-1 text-sm text-surface-300 group-hover:text-white transition-colors">
                        {project.name}
                      </span>
                      {project.status && (
                        <span className="text-xs text-surface-600 bg-surface-800 rounded px-1.5 py-0.5">
                          {project.status}
                        </span>
                      )}
                      <ArrowRight className="h-3.5 w-3.5 text-surface-700 group-hover:text-primary-400 transition-colors opacity-0 group-hover:opacity-100" />
                    </button>
                  ))}
                </div>
              )}

              {/* Empty state */}
              {projects.length === 0 && (
                <div className="border-t border-surface-800/50 px-5 py-4">
                  <p className="text-sm text-surface-500 italic">No projects yet</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
