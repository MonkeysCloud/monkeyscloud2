"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import {
  Settings2,
  Plus,
  Loader2,
  Check,
  X,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Trash2,
  Eye,
  EyeOff,
  Shield,
  Lock,
  Asterisk,
  Type,
  Hash,
  Calendar,
  List,
  ListChecks,
  ToggleLeft,
  Link,
  Mail,
} from "lucide-react";
import clsx from "clsx";

interface FieldConfig {
  id: number;
  board_id: number;
  field_key: string;
  field_label: string;
  field_type: string;
  enabled: boolean;
  required: boolean;
  is_system: boolean;
  position: number;
  options: any[] | null;
}

const FIELD_TYPE_ICONS: Record<string, { icon: typeof Type; label: string }> = {
  text:        { icon: Type,       label: "Text" },
  number:      { icon: Hash,       label: "Number" },
  date:        { icon: Calendar,   label: "Date" },
  select:      { icon: List,       label: "Select" },
  multiselect: { icon: ListChecks, label: "Multi-select" },
  checkbox:    { icon: ToggleLeft, label: "Checkbox" },
  url:         { icon: Link,       label: "URL" },
  email:       { icon: Mail,       label: "Email" },
};

const ALWAYS_REQUIRED = ["title", "status", "type"];

export default function FieldConfigPage() {
  const params = useParams();
  const { currentOrg } = useAuthStore();
  const projectSlug = params.projectSlug as string;
  const orgSlug = params.orgSlug as string;
  const orgId = currentOrg?.id;

  const [projectId, setProjectId] = useState<number | null>(null);
  const [fields, setFields] = useState<FieldConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState<number | null>(null);

  // New custom field
  const [showCreate, setShowCreate] = useState(false);
  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState("text");
  const [newRequired, setNewRequired] = useState(false);
  const [newOptions, setNewOptions] = useState("");
  const [creating, setCreating] = useState(false);

  // Resolve project
  useEffect(() => {
    async function resolve() {
      if (!orgId) return;
      try {
        const res = await api.get<any>(`/api/v1/organizations/${orgId}/projects`);
        const proj = (res?.data ?? []).find((p: any) => p.slug === projectSlug);
        if (proj) setProjectId(proj.id);
      } catch {}
    }
    resolve();
  }, [orgId, projectSlug]);

  // Load field configs
  const loadFields = useCallback(async () => {
    if (!projectId || !orgId) return;
    setLoading(true);
    try {
      const res = await api.get<any>(`/api/v1/organizations/${orgId}/projects/${projectId}/field-configs`);
      setFields(res?.data ?? []);
    } catch {
      setError("Failed to load field configuration.");
    } finally {
      setLoading(false);
    }
  }, [projectId, orgId]);

  useEffect(() => { loadFields(); }, [loadFields]);

  async function toggleEnabled(field: FieldConfig) {
    if (ALWAYS_REQUIRED.includes(field.field_key)) return;
    setSaving(field.id);
    try {
      const res = await api.put<any>(`/api/v1/field-configs/${field.id}`, { enabled: !field.enabled });
      setFields((prev) => prev.map((f) => f.id === field.id ? { ...f, ...res.data } : f));
    } catch {} finally { setSaving(null); }
  }

  async function toggleRequired(field: FieldConfig) {
    if (ALWAYS_REQUIRED.includes(field.field_key)) return;
    setSaving(field.id);
    try {
      const res = await api.put<any>(`/api/v1/field-configs/${field.id}`, { required: !field.required });
      setFields((prev) => prev.map((f) => f.id === field.id ? { ...f, ...res.data } : f));
    } catch {} finally { setSaving(null); }
  }

  async function moveField(field: FieldConfig, dir: -1 | 1) {
    const sorted = [...fields].sort((a, b) => a.position - b.position);
    const idx = sorted.findIndex((f) => f.id === field.id);
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    const newOrder = sorted.map((f) => f.id);
    [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];

    // Optimistic update
    const reordered = newOrder.map((id, pos) => {
      const f = fields.find((ff) => ff.id === id)!;
      return { ...f, position: pos };
    });
    setFields(reordered);

    try {
      await api.put<any>(`/api/v1/organizations/${orgId}/projects/${projectId}/field-configs/reorder`, { order: newOrder });
    } catch {}
  }

  async function deleteField(fieldId: number) {
    try {
      await api.delete(`/api/v1/field-configs/${fieldId}`);
      setFields((prev) => prev.filter((f) => f.id !== fieldId));
    } catch (err: any) { setError(err?.data?.error || "Failed to delete field."); }
  }

  async function createField() {
    if (!newKey.trim() || !newLabel.trim() || !projectId || !orgId) return;
    setCreating(true); setError("");
    try {
      const payload: any = {
        field_key: newKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_"),
        field_label: newLabel.trim(),
        field_type: newType,
        required: newRequired,
      };
      if (newType === "select" || newType === "multiselect") {
        const opts = newOptions.split("\n").map((o) => o.trim()).filter(Boolean);
        if (opts.length > 0) payload.options = opts;
      }
      const res = await api.post<any>(`/api/v1/organizations/${orgId}/projects/${projectId}/field-configs`, payload);
      setFields((prev) => [...prev, res.data]);
      setNewKey(""); setNewLabel(""); setNewType("text"); setNewRequired(false); setNewOptions(""); setShowCreate(false);
    } catch (err: any) { setError(err?.data?.error || "Failed to create field."); }
    finally { setCreating(false); }
  }

  const sorted = [...fields].sort((a, b) => a.position - b.position);
  const systemFields = sorted.filter((f) => f.is_system);
  const customFields = sorted.filter((f) => !f.is_system);
  const enabledCount = fields.filter((f) => f.enabled).length;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <Settings2 className="h-5 w-5 text-amber-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Field Configuration</h1>
            <p className="text-sm text-surface-400">
              {enabledCount} of {fields.length} fields enabled
            </p>
          </div>
        </div>
        {!showCreate && (
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500 to-orange-600 px-4 py-2 text-sm font-medium text-white hover:from-amber-600 hover:to-orange-700 transition-all shadow-lg shadow-amber-500/20">
            <Plus className="h-4 w-4" /> Custom Field
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" /><span>{error}</span>
          <button onClick={() => setError("")} className="ml-auto"><X className="h-4 w-4" /></button>
        </div>
      )}

      {/* Create Custom Field */}
      {showCreate && (
        <div className="mb-6 rounded-xl border border-surface-800 bg-[#111827] p-5 animate-in slide-in-from-top-2">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <Plus className="h-4 w-4 text-amber-400" /> Create Custom Field
          </h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[13px] font-medium text-surface-400 mb-1 uppercase tracking-wider">Field Key</label>
                <input type="text" value={newKey} onChange={(e) => setNewKey(e.target.value)} placeholder="e.g. estimated_hours" className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-white placeholder:text-surface-500 outline-none focus:border-amber-500" />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-surface-400 mb-1 uppercase tracking-wider">Display Label</label>
                <input type="text" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g. Estimated Hours" className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-white placeholder:text-surface-500 outline-none focus:border-amber-500" />
              </div>
            </div>
            <div>
              <label className="block text-[13px] font-medium text-surface-400 mb-1 uppercase tracking-wider">Field Type</label>
              <div className="grid grid-cols-4 gap-1.5">
                {Object.entries(FIELD_TYPE_ICONS).map(([key, cfg]) => {
                  const Icon = cfg.icon;
                  return (
                    <button key={key} onClick={() => setNewType(key)} className={clsx("flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] border transition-all", newType === key ? "bg-amber-500/10 text-amber-400 border-amber-500/30" : "text-surface-400 border-surface-700 hover:bg-surface-800")}>
                      <Icon className="h-4 w-4" /> {cfg.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {(newType === "select" || newType === "multiselect") && (
              <div>
                <label className="block text-[13px] font-medium text-surface-400 mb-1 uppercase tracking-wider">Options (one per line)</label>
                <textarea value={newOptions} onChange={(e) => setNewOptions(e.target.value)} placeholder="Option 1&#10;Option 2&#10;Option 3" rows={3} className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-white placeholder:text-surface-500 outline-none resize-none" />
              </div>
            )}
            <div className="flex items-center gap-2">
              <button onClick={() => setNewRequired(!newRequired)} className={clsx("flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[13px] border transition-all", newRequired ? "bg-red-500/10 text-red-400 border-red-500/30" : "text-surface-400 border-surface-700 hover:bg-surface-800")}>
                <Asterisk className="h-4 w-4" /> {newRequired ? "Required" : "Optional"}
              </button>
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <button onClick={() => { setShowCreate(false); setNewKey(""); setNewLabel(""); }} className="rounded-lg border border-surface-700 px-3 py-2 text-sm text-surface-400 hover:bg-surface-800">Cancel</button>
              <button onClick={createField} disabled={creating || !newKey.trim() || !newLabel.trim()} className={clsx("flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-medium transition-all", creating || !newKey.trim() ? "bg-surface-800 text-surface-500 cursor-not-allowed" : "bg-amber-500 text-white hover:bg-amber-600")}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Create Field
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="space-y-2">{[1, 2, 3, 4, 5].map((i) => <div key={i} className="animate-pulse h-12 rounded-lg bg-surface-800/40 border border-surface-800" />)}</div>
      ) : (
        <div className="space-y-6">
          {/* System Fields */}
          <div>
            <h3 className="text-[13px] font-semibold text-surface-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Shield className="h-4 w-4" /> System Fields ({systemFields.length})
            </h3>
            <div className="rounded-xl border border-surface-800 overflow-hidden">
              {systemFields.map((field, idx) => {
                const typeInfo = FIELD_TYPE_ICONS[field.field_type] ?? FIELD_TYPE_ICONS.text;
                const TypeIcon = typeInfo.icon;
                const isLocked = ALWAYS_REQUIRED.includes(field.field_key);

                return (
                  <div key={field.id} className={clsx("flex items-center gap-3 px-4 py-2.5 group transition-colors hover:bg-surface-800/20", idx < systemFields.length - 1 && "border-b border-surface-800/50")}>
                    {/* Reorder */}
                    <div className="flex flex-col gap-0.5">
                      <button onClick={() => moveField(field, -1)} disabled={idx === 0} className="p-0.5 text-surface-600 hover:text-surface-300 disabled:opacity-20"><ArrowUp className="h-4 w-4" /></button>
                      <button onClick={() => moveField(field, 1)} disabled={idx === systemFields.length - 1} className="p-0.5 text-surface-600 hover:text-surface-300 disabled:opacity-20"><ArrowDown className="h-4 w-4" /></button>
                    </div>

                    {/* Type icon */}
                    <TypeIcon className="h-4 w-4 text-surface-500 shrink-0" />

                    {/* Label + key */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-surface-200 font-medium">{field.field_label}</span>
                        <code className="text-xs text-surface-600 bg-surface-800/60 px-1 py-0.5 rounded font-mono">{field.field_key}</code>
                        {isLocked && <Lock className="h-4 w-4 text-surface-600" />}
                      </div>
                    </div>

                    {/* Type badge */}
                    <span className="text-xs text-surface-500 bg-surface-800/40 px-1.5 py-0.5 rounded">{typeInfo.label}</span>

                    {/* Required toggle */}
                    <button
                      onClick={() => toggleRequired(field)}
                      disabled={isLocked || saving === field.id}
                      className={clsx("flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium border transition-all", field.required ? "bg-red-500/10 text-red-400 border-red-500/20" : "text-surface-500 border-surface-700 hover:bg-surface-800", isLocked && "opacity-50 cursor-not-allowed")}
                    >
                      <Asterisk className="h-2.5 w-2.5" /> {field.required ? "Required" : "Optional"}
                    </button>

                    {/* Enabled toggle */}
                    <button
                      onClick={() => toggleEnabled(field)}
                      disabled={isLocked || saving === field.id}
                      className={clsx("flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium border transition-all", field.enabled ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-surface-800/40 text-surface-500 border-surface-700", isLocked && "opacity-50 cursor-not-allowed")}
                    >
                      {saving === field.id ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : field.enabled ? <Eye className="h-2.5 w-2.5" /> : <EyeOff className="h-2.5 w-2.5" />}
                      {field.enabled ? "Visible" : "Hidden"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Custom Fields */}
          <div>
            <h3 className="text-[13px] font-semibold text-surface-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Plus className="h-4 w-4" /> Custom Fields ({customFields.length})
            </h3>
            {customFields.length === 0 ? (
              <div className="text-center py-10 rounded-xl border border-dashed border-surface-800 bg-[#111827]/50">
                <Settings2 className="h-8 w-8 mx-auto text-surface-600 mb-2" />
                <p className="text-sm text-surface-400 mb-1">No custom fields yet</p>
                <p className="text-sm text-surface-500 mb-3">Create custom fields to track additional data on tasks</p>
                <button onClick={() => setShowCreate(true)} className="inline-flex items-center gap-1 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 text-sm text-amber-400 hover:bg-amber-500/20">
                  <Plus className="h-4 w-4" /> Add custom field
                </button>
              </div>
            ) : (
              <div className="rounded-xl border border-surface-800 overflow-hidden">
                {customFields.map((field, idx) => {
                  const typeInfo = FIELD_TYPE_ICONS[field.field_type] ?? FIELD_TYPE_ICONS.text;
                  const TypeIcon = typeInfo.icon;

                  return (
                    <div key={field.id} className={clsx("flex items-center gap-3 px-4 py-2.5 group transition-colors hover:bg-surface-800/20", idx < customFields.length - 1 && "border-b border-surface-800/50")}>
                      {/* Reorder */}
                      <div className="flex flex-col gap-0.5">
                        <button onClick={() => moveField(field, -1)} className="p-0.5 text-surface-600 hover:text-surface-300"><ArrowUp className="h-4 w-4" /></button>
                        <button onClick={() => moveField(field, 1)} className="p-0.5 text-surface-600 hover:text-surface-300"><ArrowDown className="h-4 w-4" /></button>
                      </div>

                      <TypeIcon className="h-4 w-4 text-amber-400 shrink-0" />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-surface-200 font-medium">{field.field_label}</span>
                          <code className="text-xs text-surface-600 bg-surface-800/60 px-1 py-0.5 rounded font-mono">{field.field_key}</code>
                        </div>
                      </div>

                      <span className="text-xs text-amber-400/60 bg-amber-500/5 px-1.5 py-0.5 rounded border border-amber-500/10">{typeInfo.label}</span>

                      {field.options && field.options.length > 0 && (
                        <span className="text-xs text-surface-500">{field.options.length} opts</span>
                      )}

                      <button onClick={() => toggleRequired(field)} disabled={saving === field.id} className={clsx("flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium border transition-all", field.required ? "bg-red-500/10 text-red-400 border-red-500/20" : "text-surface-500 border-surface-700 hover:bg-surface-800")}>
                        <Asterisk className="h-2.5 w-2.5" /> {field.required ? "Required" : "Optional"}
                      </button>

                      <button onClick={() => toggleEnabled(field)} disabled={saving === field.id} className={clsx("flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium border transition-all", field.enabled ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-surface-800/40 text-surface-500 border-surface-700")}>
                        {saving === field.id ? <Loader2 className="h-2.5 w-2.5 animate-spin" /> : field.enabled ? <Eye className="h-2.5 w-2.5" /> : <EyeOff className="h-2.5 w-2.5" />}
                        {field.enabled ? "Visible" : "Hidden"}
                      </button>

                      <button onClick={() => deleteField(field.id)} className="p-1.5 rounded-md text-surface-600 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Info */}
      <div className="mt-6 rounded-lg border border-surface-800 bg-surface-900/30 px-4 py-3 text-[13px] text-surface-500">
        <p className="flex items-center gap-1.5 mb-1"><Shield className="h-4 w-4 text-surface-600" /><strong className="text-surface-400">System fields</strong> can be hidden but not deleted. Title, Status, and Type are always required.</p>
        <p className="flex items-center gap-1.5"><Plus className="h-4 w-4 text-amber-400/50" /><strong className="text-surface-400">Custom fields</strong> can be created, reordered, and deleted. They support 8 data types.</p>
      </div>
    </div>
  );
}
