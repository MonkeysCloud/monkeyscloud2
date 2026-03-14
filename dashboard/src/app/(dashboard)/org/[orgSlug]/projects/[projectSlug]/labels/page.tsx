"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import {
  Tag,
  Plus,
  Loader2,
  Pencil,
  Trash2,
  X,
  Check,
  AlertCircle,
} from "lucide-react";
import clsx from "clsx";

interface Label {
  id: number;
  name: string;
  color: string;
}

const PRESET_COLORS = [
  "#EF4444", // Red
  "#F97316", // Orange
  "#F59E0B", // Amber
  "#EAB308", // Yellow
  "#84CC16", // Lime
  "#22C55E", // Green
  "#14B8A6", // Teal
  "#06B6D4", // Cyan
  "#3B82F6", // Blue
  "#6366F1", // Indigo
  "#8B5CF6", // Violet
  "#A855F7", // Purple
  "#D946EF", // Fuchsia
  "#EC4899", // Pink
  "#F43F5E", // Rose
  "#78716C", // Stone
];

export default function LabelsPage() {
  const params = useParams();
  const { currentOrg } = useAuthStore();
  const orgId = currentOrg?.id;

  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // New label form
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("#6366F1");
  const [creating, setCreating] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [saving, setSaving] = useState(false);

  // Delete state
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const loadLabels = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const res = await api.get<any>(`/api/v1/organizations/${orgId}/task-labels`);
      setLabels(res?.data ?? []);
    } catch {
      setError("Failed to load labels.");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadLabels();
  }, [loadLabels]);

  async function handleCreate() {
    if (!newName.trim() || !orgId) return;
    setCreating(true);
    setError("");
    try {
      const res = await api.post<any>(`/api/v1/organizations/${orgId}/task-labels`, {
        name: newName.trim(),
        color: newColor,
      });
      setLabels((prev) => [...prev, res.data]);
      setNewName("");
      setNewColor("#6366F1");
      setShowCreate(false);
    } catch (err: any) {
      setError(err?.data?.error || err?.message || "Failed to create label.");
    } finally {
      setCreating(false);
    }
  }

  async function handleUpdate(id: number) {
    if (!editName.trim() || !orgId) return;
    setSaving(true);
    setError("");
    try {
      const res = await api.put<any>(`/api/v1/organizations/${orgId}/task-labels/${id}`, {
        name: editName.trim(),
        color: editColor,
      });
      setLabels((prev) => prev.map((l) => (l.id === id ? res.data : l)));
      setEditingId(null);
    } catch (err: any) {
      setError(err?.data?.error || err?.message || "Failed to update label.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!orgId) return;
    setDeletingId(id);
    setError("");
    try {
      await api.delete(`/api/v1/organizations/${orgId}/task-labels/${id}`);
      setLabels((prev) => prev.filter((l) => l.id !== id));
    } catch (err: any) {
      setError(err?.data?.error || err?.message || "Failed to delete label.");
    } finally {
      setDeletingId(null);
    }
  }

  function startEdit(label: Label) {
    setEditingId(label.id);
    setEditName(label.name);
    setEditColor(label.color);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary-500/10 flex items-center justify-center">
            <Tag className="h-5 w-5 text-primary-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Labels</h1>
            <p className="text-sm text-surface-400">
              Manage labels to categorize and organize your tasks
            </p>
          </div>
        </div>
        {!showCreate && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary-500 to-violet-600 px-4 py-2 text-sm font-medium text-white hover:from-primary-600 hover:to-violet-700 transition-all shadow-lg shadow-primary-500/20"
          >
            <Plus className="h-4 w-4" />
            New Label
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
          <button onClick={() => setError("")} className="ml-auto">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Create Card */}
      {showCreate && (
        <div className="mb-5 rounded-xl border border-surface-800 bg-[#111827] p-5 animate-in slide-in-from-top-2 duration-200">
          <h3 className="text-sm font-semibold text-white mb-4">Create new label</h3>
          <div className="flex items-end gap-3">
            {/* Color + Name */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-surface-400 mb-1.5">Name</label>
              <div className="flex items-center gap-2">
                <div
                  className="h-9 w-9 shrink-0 rounded-lg border border-surface-700 cursor-pointer relative group"
                  style={{ backgroundColor: newColor }}
                >
                  <input
                    type="color"
                    value={newColor}
                    onChange={(e) => setNewColor(e.target.value)}
                    className="absolute inset-0 opacity-0 cursor-pointer"
                  />
                </div>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                  placeholder="e.g. Bug, Feature, Enhancement"
                  className="flex-1 rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-white placeholder:text-surface-500 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 transition-colors"
                  autoFocus
                  maxLength={50}
                />
              </div>
            </div>
            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={() => { setShowCreate(false); setNewName(""); }}
                className="rounded-lg border border-surface-700 px-3 py-2 text-sm text-surface-400 hover:bg-surface-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                className={clsx(
                  "flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all",
                  creating || !newName.trim()
                    ? "bg-surface-800 text-surface-500 cursor-not-allowed"
                    : "bg-primary-500 text-white hover:bg-primary-600"
                )}
              >
                {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Create
              </button>
            </div>
          </div>

          {/* Preset Colors */}
          <div className="mt-3 flex items-center gap-1.5 flex-wrap">
            <span className="text-xs text-surface-500 mr-1">Presets:</span>
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => setNewColor(c)}
                className={clsx(
                  "h-5 w-5 rounded-full transition-all border-2",
                  newColor === c ? "border-white scale-110" : "border-transparent hover:scale-110"
                )}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>
        </div>
      )}

      {/* Labels List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="animate-pulse h-14 rounded-xl bg-surface-800/40 border border-surface-800" />
          ))}
        </div>
      ) : labels.length === 0 ? (
        <div className="text-center py-16 rounded-2xl border border-dashed border-surface-800 bg-[#111827]/50">
          <Tag className="h-10 w-10 mx-auto text-surface-600 mb-3" />
          <h3 className="text-sm font-medium text-surface-300 mb-1">No labels yet</h3>
          <p className="text-sm text-surface-500 mb-4">
            Create labels to organize and categorize your tasks
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary-500/10 border border-primary-500/20 px-4 py-2 text-sm text-primary-400 hover:bg-primary-500/20 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Create your first label
          </button>
        </div>
      ) : (
        <div className="rounded-xl border border-surface-800 bg-[#111827] overflow-hidden divide-y divide-surface-800">
          {labels.map((label) => (
            <div
              key={label.id}
              className="flex items-center gap-3 px-4 py-3 group hover:bg-surface-800/30 transition-colors"
            >
              {editingId === label.id ? (
                /* ─── Edit Mode ─── */
                <>
                  <div
                    className="h-7 w-7 shrink-0 rounded-md relative cursor-pointer"
                    style={{ backgroundColor: editColor }}
                  >
                    <input
                      type="color"
                      value={editColor}
                      onChange={(e) => setEditColor(e.target.value)}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </div>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleUpdate(label.id);
                      if (e.key === "Escape") setEditingId(null);
                    }}
                    className="flex-1 rounded-md border border-surface-700 bg-surface-900 px-2.5 py-1.5 text-sm text-white outline-none focus:border-primary-500"
                    autoFocus
                    maxLength={50}
                  />
                  <button
                    onClick={() => handleUpdate(label.id)}
                    disabled={saving || !editName.trim()}
                    className="p-1.5 rounded-md text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
                    title="Save"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  </button>
                  <button
                    onClick={() => setEditingId(null)}
                    className="p-1.5 rounded-md text-surface-500 hover:bg-surface-800 transition-colors"
                    title="Cancel"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              ) : (
                /* ─── View Mode ─── */
                <>
                  <div
                    className="h-7 w-7 shrink-0 rounded-md"
                    style={{ backgroundColor: label.color }}
                  />
                  <span className="flex-1 text-sm text-surface-200 font-medium">
                    {label.name}
                  </span>
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[13px] font-medium border"
                    style={{
                      color: label.color,
                      borderColor: label.color + "40",
                      backgroundColor: label.color + "15",
                    }}
                  >
                    <Tag className="h-3 w-3" />
                    {label.name}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => startEdit(label)}
                      className="p-1.5 rounded-md text-surface-500 hover:text-primary-400 hover:bg-surface-800 transition-colors"
                      title="Edit"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(label.id)}
                      disabled={deletingId === label.id}
                      className="p-1.5 rounded-md text-surface-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                      title="Delete"
                    >
                      {deletingId === label.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      {labels.length > 0 && (
        <p className="text-[13px] text-surface-500 mt-3 text-right">
          {labels.length} label{labels.length !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
