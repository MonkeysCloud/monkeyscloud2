"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Trash2,
  Container,
  Terminal,
  FileCode2,
  ToggleLeft,
  ToggleRight,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui";
import { Modal } from "@/components/ui/Modal";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

interface StackConfig {
  id: number;
  name: string;
  display_name: string;
  category: string;
  docker_image: string;
  scaffold_command: string;
  gitignore_template: string;
  post_scaffold_commands: string[] | null;
  enabled: boolean;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = ["PHP", "Node.js", "Python", "Go", "Rust", "Java", ".NET", "Ruby", "Elixir", "Other"];

export default function StackConfigDetailPage() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [config, setConfig] = useState<StackConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Delete modal
  const [showDelete, setShowDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Admin guard
  useEffect(() => {
    if (user && !user.is_admin) router.replace("/");
  }, [user, router]);

  // Fetch
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get<{ data: StackConfig }>(`/api/v1/admin/stack-configs/${id}`);
        setConfig(res.data);
      } catch {
        setError("Stack config not found");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Save
  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      await api.put(`/api/v1/admin/stack-configs/${config.id}`, config);
      setSuccess("Saved successfully");
      setTimeout(() => setSuccess(""), 3000);
    } catch (e: any) {
      setError(e?.data?.error || "Save failed");
    } finally {
      setSaving(false);
    }
  };

  // Delete
  const handleDelete = async () => {
    if (!config) return;
    setDeleting(true);
    try {
      await api.delete(`/api/v1/admin/stack-configs/${config.id}`);
      router.push("/admin/stack-templates");
    } catch (e: any) {
      setError(e?.data?.error || "Delete failed");
      setDeleting(false);
      setShowDelete(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto flex items-center justify-center h-64 text-surface-500">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!config) {
    return (
      <div className="max-w-3xl mx-auto text-center py-16">
        <p className="text-surface-400">Stack config not found</p>
        <button onClick={() => router.push("/admin/stack-templates")} className="text-primary-400 text-sm mt-2 hover:underline">
          ← Back to Stack Configs
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push("/admin/stack-templates")}
            className="p-2 rounded-lg hover:bg-surface-800 text-surface-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white">{config.display_name}</h1>
            <p className="text-xs text-surface-500 font-mono">{config.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="danger" onClick={() => setShowDelete(true)}>
            <Trash2 className="h-3.5 w-3.5" /> Delete
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            <Save className="h-3.5 w-3.5" /> {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2 text-sm text-red-400">{error}</div>
      )}
      {success && (
        <div className="rounded-lg bg-green-500/10 border border-green-500/20 px-4 py-2 text-sm text-green-400">{success}</div>
      )}

      {/* General */}
      <div className="rounded-xl border border-surface-700 bg-surface-800/50 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-white mb-2">General</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-surface-400 mb-1">Name (slug)</label>
            <input
              type="text"
              value={config.name}
              disabled
              className="w-full px-3 py-2 rounded-lg bg-surface-900 border border-surface-700 text-sm text-surface-500 outline-none opacity-60"
            />
          </div>
          <div>
            <label className="block text-xs text-surface-400 mb-1">Display Name</label>
            <input
              type="text"
              value={config.display_name}
              onChange={(e) => setConfig({ ...config, display_name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-surface-900 border border-surface-700 text-sm text-white outline-none focus:border-brand-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-surface-400 mb-1">Category</label>
            <select
              value={config.category}
              onChange={(e) => setConfig({ ...config, category: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-surface-900 border border-surface-700 text-sm text-white outline-none focus:border-brand-500"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <div>
              <label className="block text-xs text-surface-400 mb-1">Status</label>
              <button
                onClick={() => setConfig({ ...config, enabled: !config.enabled })}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-surface-700 bg-surface-900 text-sm"
              >
                {config.enabled ? (
                  <>
                    <ToggleRight className="h-5 w-5 text-green-400" />
                    <span className="text-green-400">Enabled</span>
                  </>
                ) : (
                  <>
                    <ToggleLeft className="h-5 w-5 text-surface-500" />
                    <span className="text-surface-500">Disabled</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Docker & Scaffold */}
      <div className="rounded-xl border border-surface-700 bg-surface-800/50 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
          <Container className="h-4 w-4 text-surface-400" /> Docker & Scaffold
        </h2>

        <div>
          <label className="block text-xs text-surface-400 mb-1">Docker Image</label>
          <input
            type="text"
            value={config.docker_image}
            onChange={(e) => setConfig({ ...config, docker_image: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-surface-900 border border-surface-700 text-sm text-white font-mono outline-none focus:border-brand-500"
            placeholder="e.g. composer:2"
          />
        </div>

        <div>
          <label className="block text-xs text-surface-400 mb-1 flex items-center gap-1">
            <Terminal className="h-3 w-3" /> Scaffold Command
          </label>
          <textarea
            value={config.scaffold_command}
            onChange={(e) => setConfig({ ...config, scaffold_command: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-surface-900 border border-surface-700 text-sm text-white font-mono outline-none focus:border-brand-500 resize-none"
            rows={4}
            placeholder="e.g. composer create-project monkeyscloud/monkeyslegion-skeleton ."
          />
          <p className="text-xs text-surface-500 mt-1">
            Runs inside the Docker container with <code className="text-surface-400">/app</code> as working directory
          </p>
        </div>
      </div>

      {/* .gitignore */}
      <div className="rounded-xl border border-surface-700 bg-surface-800/50 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
          <FileCode2 className="h-4 w-4 text-surface-400" /> .gitignore Template
        </h2>

        <textarea
          value={config.gitignore_template}
          onChange={(e) => setConfig({ ...config, gitignore_template: e.target.value })}
          className="w-full px-3 py-2 rounded-lg bg-surface-900 border border-surface-700 text-sm text-white font-mono outline-none focus:border-brand-500 resize-none"
          rows={8}
          placeholder="/vendor/&#10;/node_modules/&#10;.DS_Store"
        />
      </div>

      {/* Timestamps */}
      <div className="flex items-center gap-4 text-xs text-surface-500 px-1">
        <span>Created: {new Date(config.created_at).toLocaleDateString()}</span>
        <span>Updated: {new Date(config.updated_at).toLocaleDateString()}</span>
      </div>

      {/* Delete Confirmation Modal */}
      <Modal open={showDelete} onClose={() => setShowDelete(false)} title="Delete Stack Config">
        <p className="text-sm text-surface-300">
          Are you sure you want to delete <strong className="text-white">{config.display_name}</strong>?
        </p>
        <p className="text-xs text-surface-500 mt-2">
          Existing projects using this stack will not be affected, but no new projects can use it.
        </p>
        <div className="flex justify-end gap-2 mt-6">
          <Button variant="ghost" onClick={() => setShowDelete(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleDelete} disabled={deleting}>
            {deleting ? "Deleting..." : "Yes, Delete"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
