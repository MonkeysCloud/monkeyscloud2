"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  Pencil,
  Search,
  ToggleLeft,
  ToggleRight,
  Container,
  Terminal,
  FileCode2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui";
import { Modal } from "@/components/ui/Modal";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

/* ── Types ─────────────────────────────────────────────────────────────── */

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

const CATEGORY_COLORS: Record<string, string> = {
  PHP: "bg-indigo-500/20 text-indigo-300",
  "Node.js": "bg-green-500/20 text-green-300",
  Python: "bg-yellow-500/20 text-yellow-300",
  Ruby: "bg-red-500/20 text-red-300",
  Go: "bg-cyan-500/20 text-cyan-300",
  Rust: "bg-orange-500/20 text-orange-300",
  Java: "bg-amber-500/20 text-amber-300",
  ".NET": "bg-purple-500/20 text-purple-300",
  Elixir: "bg-violet-500/20 text-violet-300",
  Other: "bg-surface-500/20 text-surface-300",
};

/* ── Main Page ─────────────────────────────────────────────────────────── */

export default function StackConfigsPage() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  const [configs, setConfigs] = useState<StackConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Expanded row
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<StackConfig | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Admin guard
  useEffect(() => {
    if (user && !user.is_admin) {
      router.replace("/");
    }
  }, [user, router]);

  /* ── Fetch configs ──────────────────────────────────────────────────── */

  const fetchConfigs = useCallback(async () => {
    try {
      const res = await api.get<{ data: StackConfig[] }>("/api/v1/admin/stack-configs");
      setConfigs(res.data || []);
    } catch (e) {
      console.error("Failed to load stack configs", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfigs();
  }, [fetchConfigs]);

  /* ── Save (create) ─────────────────────────────────────────────────── */

  const createConfig = async (data: Partial<StackConfig>) => {
    try {
      await api.post("/api/v1/admin/stack-configs", data);
      fetchConfigs();
    } catch (e) {
      console.error("Create failed", e);
    }
  };

  /* ── Toggle enabled ─────────────────────────────────────────────────── */

  const toggleEnabled = async (config: StackConfig) => {
    try {
      await api.put(`/api/v1/admin/stack-configs/${config.id}`, {
        enabled: !config.enabled,
      });
      fetchConfigs();
    } catch (e) {
      console.error("Toggle failed", e);
    }
  };

  /* ── Delete ─────────────────────────────────────────────────────────── */

  const deleteConfig = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/api/v1/admin/stack-configs/${deleteTarget.id}`);
      setDeleteTarget(null);
      fetchConfigs();
    } catch (e) {
      console.error("Delete failed", e);
    } finally {
      setDeleting(false);
    }
  };

  /* ── Filtered ───────────────────────────────────────────────────────── */

  const filtered = configs.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.display_name.toLowerCase().includes(search.toLowerCase()) ||
      c.category.toLowerCase().includes(search.toLowerCase())
  );

  /* ── Edit form ──────────────────────────────────────────────────────── */

  /* ── List View ──────────────────────────────────────────────────────── */

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Stack Configs</h1>
          <p className="text-sm text-surface-400 mt-1">
            Manage scaffold configurations for project creation
          </p>
        </div>
        <Button
          onClick={() => {
            router.push("/admin/stack-templates/new");
          }}
        >
          <Plus className="h-4 w-4" /> New Stack
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500" />
        <input
          type="text"
          placeholder="Search stacks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2 rounded-lg bg-surface-800 border border-surface-700 text-sm text-white placeholder-surface-500 outline-none focus:border-brand-500 transition-colors"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-14 rounded-lg bg-surface-800 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-surface-700 overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-12 gap-2 px-4 py-2 bg-surface-800/80 text-xs text-surface-500 uppercase tracking-wider font-medium">
            <div className="col-span-3">Name</div>
            <div className="col-span-2">Category</div>
            <div className="col-span-3">Docker Image</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>

          {/* Rows */}
          {filtered.map((c) => (
            <div key={c.id}>
              <div
                className="grid grid-cols-12 gap-2 px-4 py-3 border-t border-surface-700/50 hover:bg-surface-800/50 transition-colors items-center cursor-pointer"
                onClick={() => router.push(`/admin/stack-templates/${c.id}`)}
              >
                <div className="col-span-3 flex items-center gap-2">
                  <span className="text-sm font-medium text-white">{c.display_name}</span>
                  <span className="text-xs text-surface-500">{c.name}</span>
                </div>
                <div className="col-span-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${CATEGORY_COLORS[c.category] || CATEGORY_COLORS.Other}`}>
                    {c.category}
                  </span>
                </div>
                <div className="col-span-3 flex items-center gap-1.5 text-xs text-surface-400 font-mono">
                  <Container className="h-3 w-3 shrink-0" />
                  <span className="truncate">{c.docker_image}</span>
                </div>
                <div className="col-span-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleEnabled(c); }}
                    className="flex items-center gap-1.5"
                  >
                    {c.enabled ? (
                      <>
                        <ToggleRight className="h-5 w-5 text-green-400" />
                        <span className="text-xs text-green-400">Enabled</span>
                      </>
                    ) : (
                      <>
                        <ToggleLeft className="h-5 w-5 text-surface-500" />
                        <span className="text-xs text-surface-500">Disabled</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="col-span-2 flex items-center justify-end gap-1">
                  <button
                    onClick={(e) => { e.stopPropagation(); router.push(`/admin/stack-templates/${c.id}`); }}
                    className="p-1.5 rounded hover:bg-surface-700 text-surface-400 hover:text-white transition-colors"
                    title="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeleteTarget(c); }}
                    className="p-1.5 rounded hover:bg-red-500/20 text-surface-400 hover:text-red-400 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                  <ChevronDown className="h-4 w-4 text-surface-500" />
                </div>
              </div>

              {/* Expanded details */}
              {expandedId === c.id && (
                <div className="px-4 py-3 border-t border-surface-700/30 bg-surface-900/50 space-y-3">
                  <div>
                    <p className="text-xs text-surface-500 mb-1 flex items-center gap-1">
                      <Terminal className="h-3 w-3" /> Scaffold Command
                    </p>
                    <pre className="text-xs text-surface-300 font-mono bg-surface-900 rounded p-2 whitespace-pre-wrap">
                      {c.scaffold_command}
                    </pre>
                  </div>
                  <div>
                    <p className="text-xs text-surface-500 mb-1 flex items-center gap-1">
                      <FileCode2 className="h-3 w-3" /> .gitignore
                    </p>
                    <pre className="text-xs text-surface-300 font-mono bg-surface-900 rounded p-2 whitespace-pre-wrap max-h-32 overflow-y-auto">
                      {c.gitignore_template}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-8 text-surface-500 border-t border-surface-700/50">
              No stacks found
            </div>
          )}
        </div>
      )}

      {/* Delete Modal */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Stack Config">
        <p className="text-sm text-surface-300 mb-4">
          Are you sure you want to delete <strong className="text-white">{deleteTarget?.display_name}</strong>?
          Existing projects using this stack will not be affected.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" onClick={deleteConfig} disabled={deleting}>
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
