"use client";

import { Card, CardTitle, Button, Input, Badge } from "@/components/ui";
import { Trash2, Loader2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import { useState, useEffect } from "react";

interface ProjectDetail {
  id: number;
  name: string;
  slug: string;
  stack: string;
  status: string;
}

export default function ProjectSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const { currentOrg, organizations } = useAuthStore();
  const orgSlug = params.orgSlug as string;
  const projectSlug = params.projectSlug as string;
  const targetOrg = organizations.find((o) => o.slug === orgSlug) || currentOrg;

  const [project, setProject] = useState<ProjectDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [showConfirm, setShowConfirm] = useState(false);

  useEffect(() => {
    async function load() {
      if (!targetOrg?.id) return;
      try {
        const res = await api.get<any>(`/api/v1/organizations/${targetOrg.id}/projects`);
        const list = res?.data ?? res;
        if (Array.isArray(list)) {
          const match = list.find((p: any) => p.slug === projectSlug);
          if (match) setProject(match);
        }
      } catch (e) {
        console.error("Failed to load project", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [targetOrg?.id, projectSlug]);

  const handleDelete = async () => {
    if (!project || confirmText !== project.slug) return;
    setDeleting(true);
    try {
      await api.delete(`/api/v1/projects/${project.id}`);
      router.push(`/org/${orgSlug}/projects`);
    } catch (e) {
      console.error("Failed to delete project", e);
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 text-surface-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Project Settings</h1>
        <p className="text-sm text-surface-400 mt-1">Manage your project configuration</p>
      </div>

      {/* General */}
      <Card>
        <CardTitle>General</CardTitle>
        <div className="mt-4 space-y-4">
          <Input id="name" label="Project Name" defaultValue={project?.name || ""} />
          <Input id="slug" label="Slug" defaultValue={project?.slug || ""} />
          <div>
            <label className="block text-sm font-medium text-surface-300 mb-1.5">Stack</label>
            <Badge variant="info">{project?.stack || "unknown"}</Badge>
          </div>
          <Button size="sm">Save Changes</Button>
        </div>
      </Card>

      {/* Danger Zone */}
      <Card className="border-red-900/50">
        <CardTitle className="text-red-400">Danger Zone</CardTitle>
        <p className="text-sm text-surface-400 mt-2 mb-4">
          This action will permanently delete the project and all associated data including tasks, environments, builds, and repositories.
        </p>

        {!showConfirm ? (
          <Button variant="danger" size="sm" onClick={() => setShowConfirm(true)}>
            <Trash2 className="h-4 w-4" /> Delete Project
          </Button>
        ) : (
          <div className="space-y-3 p-4 rounded-lg bg-red-950/30 border border-red-900/50">
            <p className="text-sm text-red-300">
              To confirm, type <strong className="text-red-200">{project?.slug}</strong> below:
            </p>
            <Input
              id="confirm-delete"
              placeholder={project?.slug || ""}
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
            />
            <div className="flex gap-2">
              <Button
                variant="danger"
                size="sm"
                disabled={confirmText !== project?.slug || deleting}
                onClick={handleDelete}
              >
                {deleting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Deleting…</>
                ) : (
                  <><Trash2 className="h-4 w-4" /> Permanently Delete</>
                )}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => { setShowConfirm(false); setConfirmText(""); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
