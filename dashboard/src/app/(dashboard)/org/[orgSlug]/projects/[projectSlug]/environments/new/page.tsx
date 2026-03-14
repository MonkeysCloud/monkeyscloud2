"use client";

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { Card } from "@/components/ui";
import {
  Server,
  Plus,
  Globe,
  GitBranch,
  MapPin,
  Cpu,
  HardDrive,
  Minus,
  ArrowLeft,
  Loader2,
  Search,
  ChevronDown,
  Check,
  AlertCircle,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface MachineType { id: string; vcpus: number; ram_gb: number; monthly_usd: number; }
interface Region { id: string; label: string; }
interface EnvRow {
  key: string;
  name: string;
  type: string;
  region: string;
  machine_type: string;
  branch: string;
}

let rowCounter = 0;
function nextKey(): string { return `row-${++rowCounter}`; }

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/* ------------------------------------------------------------------ */
/*  Branch Selector                                                    */
/* ------------------------------------------------------------------ */

function BranchSelector({
  value, onChange, branches, loading,
}: {
  value: string; onChange: (v: string) => void; branches: string[]; loading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(
    () => filter ? branches.filter((b) => b.toLowerCase().includes(filter.toLowerCase())) : branches,
    [branches, filter]
  );

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { setOpen(!open); setFilter(""); }}
        className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-surface-600 bg-surface-900 text-sm text-white focus:outline-none focus:border-brand-500/60 text-left"
      >
        <span className="flex items-center gap-2 truncate">
          <GitBranch className="h-4 w-4 text-surface-500 shrink-0" />
          {value || "main"}
        </span>
        <ChevronDown className={`h-4 w-4 text-surface-500 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-surface-600 bg-surface-800 shadow-xl max-h-56 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-surface-700/50">
            <div className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-surface-900 border border-surface-600">
              <Search className="h-4 w-4 text-surface-500" />
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter branches…"
                autoFocus
                className="flex-1 bg-transparent text-sm text-white placeholder-surface-500 focus:outline-none"
              />
            </div>
          </div>
          <div className="overflow-y-auto max-h-40">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-4 text-sm text-surface-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : filtered.length === 0 ? (
              <div className="py-3 text-center text-sm text-surface-500">No branches found</div>
            ) : (
              filtered.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => { onChange(b); setOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-surface-700/50 transition-colors flex items-center gap-2 ${
                    value === b ? "text-brand-400" : "text-surface-300"
                  }`}
                >
                  <GitBranch className="h-3.5 w-3.5 shrink-0" />
                  {b}
                  {value === b && <Check className="h-3.5 w-3.5 ml-auto text-brand-400" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Defaults                                                           */
/* ------------------------------------------------------------------ */

function makeDefaultRows(): EnvRow[] {
  return [
    { key: nextKey(), name: "Development", type: "development", region: "us-central1-a", machine_type: "e2-small", branch: "main" },
    { key: nextKey(), name: "Testing", type: "testing", region: "us-central1-a", machine_type: "e2-small", branch: "main" },
    { key: nextKey(), name: "Production", type: "production", region: "us-central1-a", machine_type: "e2-medium", branch: "main" },
  ];
}

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

export default function NewEnvironmentsPage() {
  const params = useParams<{ orgSlug: string; projectSlug: string }>();
  const { currentOrg } = useAuthStore();
  const router = useRouter();

  const [machineTypes, setMachineTypes] = useState<MachineType[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [existingCount, setExistingCount] = useState<number | null>(null);

  const [branches, setBranches] = useState<string[]>(["main"]);
  const [branchesLoading, setBranchesLoading] = useState(false);

  const [rows, setRows] = useState<EnvRow[]>([]);
  const [creating, setCreating] = useState(false);
  const [createProgress, setCreateProgress] = useState<{ done: number; total: number; current: string } | null>(null);
  const [createErrors, setCreateErrors] = useState<string[]>([]);

  const orgId = currentOrg?.slug === params.orgSlug ? currentOrg?.id : undefined;
  const projectSlug = params.projectSlug;
  const orgSlug = params.orgSlug;

  const apiBase =
    typeof window !== "undefined"
      ? process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"
      : "http://localhost:8000";

  const getHeaders = (): Record<string, string> => {
    const token = typeof window !== "undefined" ? localStorage.getItem("mc_token") : null;
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (token) h["Authorization"] = `Bearer ${token}`;
    return h;
  };

  const basePath = `/api/v1/organizations/${orgId}/projects/${projectSlug}/environments`;

  // ─── Load metadata ───────────────────────────────────────────────
  useEffect(() => {
    if (!orgId) return;

    // Fetch machine types + regions + existing count
    fetch(`${apiBase}${basePath}`, { headers: getHeaders() })
      .then((r) => r.json())
      .then((json) => {
        if (json.machine_types) setMachineTypes(json.machine_types);
        if (json.regions) setRegions(json.regions);
        const count = (json.data || []).length;
        setExistingCount(count);
        // Pre-populate rows
        if (count === 0) {
          setRows(makeDefaultRows());
        } else {
          setRows([{ key: nextKey(), name: "", type: "custom", region: "us-central1-a", machine_type: "e2-small", branch: "main" }]);
        }
      })
      .catch(() => {});

    // Fetch branches
    setBranchesLoading(true);
    fetch(`${apiBase}/api/v1/organizations/${orgId}/projects/${projectSlug}/code/branches`, { headers: getHeaders() })
      .then((r) => r.json())
      .then((json) => {
        const list: string[] = [];
        const data = Array.isArray(json.data) ? json.data : Array.isArray(json) ? json : [];
        data.forEach((b: { name?: string } | string) => {
          const name = typeof b === "string" ? b : b.name;
          if (name) list.push(name);
        });
        if (list.length === 0) list.push("main");
        setBranches(list);
        setBranchesLoading(false);
      })
      .catch(() => { setBranches(["main"]); setBranchesLoading(false); });
  }, [orgId, projectSlug, apiBase]);

  // ─── Row manipulation ────────────────────────────────────────────
  const updateRow = (key: string, field: keyof EnvRow, value: string) => {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));
  };

  const removeRow = (key: string) => {
    setRows((prev) => prev.filter((r) => r.key !== key));
  };

  const addRow = () => {
    setRows((prev) => [
      ...prev,
      { key: nextKey(), name: "", type: "custom", region: "us-central1-a", machine_type: "e2-small", branch: "main" },
    ]);
  };

  // ─── Batch Create ────────────────────────────────────────────────
  const handleBatchCreate = async () => {
    const validRows = rows.filter((r) => r.name.trim());
    if (validRows.length === 0) return;
    setCreating(true);
    setCreateErrors([]);
    setCreateProgress({ done: 0, total: validRows.length, current: validRows[0].name });

    const errors: string[] = [];
    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      setCreateProgress({ done: i, total: validRows.length, current: row.name });
      try {
        const res = await fetch(`${apiBase}${basePath}`, {
          method: "POST",
          headers: getHeaders(),
          body: JSON.stringify({
            name: row.name.trim(),
            type: row.type,
            region: row.region,
            machine_type: row.machine_type,
            branch: row.branch || undefined,
          }),
        });
        const json = await res.json();
        if (!res.ok) errors.push(`${row.name}: ${json.error || "Failed"}`);
      } catch {
        errors.push(`${row.name}: Network error`);
      }
    }

    setCreateProgress({ done: validRows.length, total: validRows.length, current: "done" });
    setCreateErrors(errors);
    setCreating(false);

    if (errors.length === 0) {
      router.push(`/org/${orgSlug}/projects/${projectSlug}/environments`);
    }
  };

  const validRowCount = rows.filter((r) => r.name.trim()).length;
  const isSetup = existingCount === 0;

  if (!currentOrg) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.push(`/org/${orgSlug}/projects/${projectSlug}/environments`)}
          className="p-2 rounded-lg text-surface-400 hover:text-white hover:bg-surface-700 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white">
            {isSetup ? "Setup Environments" : "Create Environments"}
          </h1>
          <p className="text-sm text-surface-400 mt-0.5">
            {isSetup
              ? "Configure your initial environments. Remove any you don't need or add more."
              : "Add one or more environments to your project."
            }
          </p>
        </div>
      </div>

      {/* Environment Rows */}
      <div className="space-y-4">
        {rows.map((row, idx) => {
          const slug = slugify(row.name);
          const previewUrl = slug ? `${slug}-${projectSlug}-${orgSlug}.monkeys.cloud` : "";
          return (
            <Card key={row.key} className="!p-5 space-y-4">
              {/* Row header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Server className="h-4 w-4 text-brand-400" />
                  <span className="text-sm font-medium text-white">Environment {idx + 1}</span>
                </div>
                {rows.length > 1 && (
                  <button
                    onClick={() => removeRow(row.key)}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm text-surface-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Remove"
                  >
                    <Minus className="h-4 w-4" />
                    <span>Remove</span>
                  </button>
                )}
              </div>

              {/* Fields — 2 columns on mobile, 4 on desktop */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Name */}
                <div>
                  <label className="block text-sm text-surface-400 mb-1.5">Name</label>
                  <input
                    type="text"
                    value={row.name}
                    onChange={(e) => updateRow(row.key, "name", e.target.value)}
                    placeholder="e.g. Staging"
                    className="w-full px-3 py-2.5 rounded-lg border border-surface-600 bg-surface-900 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-brand-500/60"
                  />
                </div>
                {/* Type */}
                <div>
                  <label className="block text-sm text-surface-400 mb-1.5">Type</label>
                  <select
                    value={row.type}
                    onChange={(e) => updateRow(row.key, "type", e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-surface-600 bg-surface-900 text-sm text-white focus:outline-none focus:border-brand-500/60"
                  >
                    <option value="development">Development</option>
                    <option value="testing">Testing</option>
                    <option value="staging">Staging</option>
                    <option value="production">Production</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                {/* Region */}
                <div>
                  <label className="block text-sm text-surface-400 mb-1.5">Region</label>
                  <select
                    value={row.region}
                    onChange={(e) => updateRow(row.key, "region", e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-surface-600 bg-surface-900 text-sm text-white focus:outline-none focus:border-brand-500/60"
                  >
                    {regions.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                  </select>
                </div>
                {/* Machine */}
                <div>
                  <label className="block text-sm text-surface-400 mb-1.5">Machine</label>
                  <select
                    value={row.machine_type}
                    onChange={(e) => updateRow(row.key, "machine_type", e.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-surface-600 bg-surface-900 text-sm text-white focus:outline-none focus:border-brand-500/60"
                  >
                    {machineTypes.map((m) => (
                      <option key={m.id} value={m.id}>{m.id} — {m.vcpus} vCPU, {m.ram_gb} GB (~${m.monthly_usd}/mo)</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Branch + URL Preview */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-surface-400 mb-1.5">Branch</label>
                  <BranchSelector
                    value={row.branch}
                    onChange={(v) => updateRow(row.key, "branch", v)}
                    branches={branches}
                    loading={branchesLoading}
                  />
                </div>
                <div className="flex items-end">
                  {previewUrl && (
                    <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-surface-900/60 border border-surface-700/50 w-full">
                      <Globe className="h-4 w-4 text-brand-400 shrink-0" />
                      <span className="text-sm text-brand-400/80 font-mono truncate">{previewUrl}</span>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Add more */}
      <button
        onClick={addRow}
        disabled={creating}
        className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-surface-600 text-sm text-surface-400 hover:text-white hover:border-brand-500/40 hover:bg-surface-800/50 transition-colors disabled:opacity-50"
      >
        <Plus className="h-4 w-4" />
        Add another environment
      </button>

      {/* Progress */}
      {createProgress && creating && (
        <Card className="!p-4 space-y-2">
          <div className="flex items-center justify-between text-sm text-surface-400">
            <span className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-brand-400" />
              Creating <strong className="text-white">{createProgress.current}</strong>…
            </span>
            <span>{createProgress.done}/{createProgress.total}</span>
          </div>
          <div className="h-2 rounded-full bg-surface-700 overflow-hidden">
            <div
              className="h-full bg-brand-500 rounded-full transition-all duration-300"
              style={{ width: `${(createProgress.done / createProgress.total) * 100}%` }}
            />
          </div>
        </Card>
      )}

      {/* Errors */}
      {createErrors.length > 0 && (
        <div className="space-y-2">
          {createErrors.map((err, i) => (
            <div key={i} className="flex items-center gap-2 text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2.5">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {err}
            </div>
          ))}
        </div>
      )}

      {/* Actions — sticky at bottom */}
      <div className="sticky bottom-0 bg-surface-900/90 backdrop-blur-sm -mx-4 px-4 py-4 border-t border-surface-700/50 flex items-center justify-between">
        <button
          onClick={() => router.push(`/org/${orgSlug}/projects/${projectSlug}/environments`)}
          disabled={creating}
          className="px-4 py-2 text-sm text-surface-400 hover:text-white rounded-lg hover:bg-surface-700 disabled:opacity-50 transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={handleBatchCreate}
          disabled={creating || validRowCount === 0}
          className="flex items-center gap-2 px-5 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {creating && <Loader2 className="h-4 w-4 animate-spin" />}
          {creating ? "Creating…" : `Create ${validRowCount} environment${validRowCount !== 1 ? "s" : ""}`}
        </button>
      </div>
    </div>
  );
}
