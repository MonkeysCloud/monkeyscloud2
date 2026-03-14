"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { Card } from "@/components/ui";
import { Modal } from "@/components/ui/Modal";
import {
  Server,
  Plus,
  Trash2,
  Copy,
  Check,
  Globe,
  Cpu,
  HardDrive,
  MapPin,
  Terminal,
  Eye,
  EyeOff,
  RefreshCw,
  AlertCircle,
  X,
  GitBranch,
  ExternalLink,
  Play,
  Square,
  Loader2,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface EnvInfo {
  id: number;
  name: string;
  slug: string;
  type: string;
  url: string | null;
  branch: string | null;
  region: string | null;
  machine_type: string;
  disk_size_gb: number;
  ip_address: string | null;
  internal_ip: string | null;
  instance_id: string | null;
  ssh_user: string | null;
  stack_status: string | null;
  status: string;
  is_production: boolean;
  auto_deploy: boolean;
  created_at: string;
}

interface MachineType {
  id: string;
  vcpus: number;
  ram_gb: number;
  monthly_usd: number;
}

interface Region {
  id: string;
  label: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function statusColor(s: string): string {
  switch (s) {
    case "active": return "bg-green-500";
    case "provisioning": case "building": case "deploying": return "bg-amber-500";
    case "pending": return "bg-blue-500";
    case "sleeping": case "stopped": return "bg-surface-500";
    case "error": return "bg-red-500";
    default: return "bg-surface-500";
  }
}

function statusLabel(s: string): string {
  switch (s) {
    case "provisioning": return "Provisioning…";
    case "building": return "Building…";
    case "deploying": return "Deploying…";
    default: return s.charAt(0).toUpperCase() + s.slice(1);
  }
}

function typeBadge(t: string): { bg: string; text: string } {
  switch (t) {
    case "production": return { bg: "bg-red-500/20", text: "text-red-400" };
    case "staging": return { bg: "bg-amber-500/20", text: "text-amber-400" };
    case "development": return { bg: "bg-green-500/20", text: "text-green-400" };
    case "testing": return { bg: "bg-blue-500/20", text: "text-blue-400" };
    default: return { bg: "bg-surface-600/30", text: "text-surface-300" };
  }
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const m = Math.floor(seconds / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function EnvironmentsPage() {
  const params = useParams<{ orgSlug: string; projectSlug: string }>();
  const { currentOrg } = useAuthStore();
  const router = useRouter();

  const [envs, setEnvs] = useState<EnvInfo[]>([]);
  const [machineTypes, setMachineTypes] = useState<MachineType[]>([]);
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState<EnvInfo | null>(null);
  const [deleting, setDeleting] = useState(false);

  // SSH panel
  const [sshEnvId, setSshEnvId] = useState<number | null>(null);
  const [sshInfo, setSshInfo] = useState<Record<string, string> | null>(null);
  const [sshPassword, setSshPassword] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [resettingPassword, setResettingPassword] = useState(false);

  const [provisioning, setProvisioning] = useState<number | null>(null);
  const [destroying, setDestroying] = useState<number | null>(null);

  const pollRef = useRef<NodeJS.Timeout | null>(null);

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
  const newPageUrl = `/org/${orgSlug}/projects/${projectSlug}/environments/new`;

  // ─── Fetch Environments ──────────────────────────────────────────
  const fetchEnvs = useCallback(() => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    fetch(`${apiBase}${basePath}`, { headers: getHeaders() })
      .then((r) => r.json())
      .then((json) => {
        setEnvs(json.data || []);
        if (json.machine_types) setMachineTypes(json.machine_types);
        if (json.regions) setRegions(json.regions);
        setLoading(false);
      })
      .catch(() => {
        setError("Failed to load environments.");
        setLoading(false);
      });
  }, [orgId, projectSlug, apiBase]);

  useEffect(() => { fetchEnvs(); }, [fetchEnvs]);

  // ─── Status Polling ──────────────────────────────────────────────
  useEffect(() => {
    const hasTransitional = envs.some((e) =>
      ["provisioning", "building", "deploying"].includes(e.status)
    );
    if (hasTransitional) {
      pollRef.current = setInterval(() => {
        if (!orgId) return;
        fetch(`${apiBase}${basePath}`, { headers: getHeaders() })
          .then((r) => r.json())
          .then((json) => { if (json.data) setEnvs(json.data); })
          .catch(() => {});
      }, 5000);
    }
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [envs, orgId, apiBase, basePath]);

  // ─── Delete ──────────────────────────────────────────────────────
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetch(`${apiBase}${basePath}/${deleteTarget.id}`, { method: "DELETE", headers: getHeaders() });
      fetchEnvs();
    } catch { /* silent */ }
    finally { setDeleting(false); setDeleteTarget(null); }
  };

  // ─── Provision ───────────────────────────────────────────────────
  const handleProvision = async (id: number) => {
    setProvisioning(id);
    try {
      await fetch(`${apiBase}${basePath}/${id}/provision`, { method: "POST", headers: getHeaders() });
      fetchEnvs();
    } catch { /* silent */ }
    finally { setProvisioning(null); }
  };

  // ─── Destroy ─────────────────────────────────────────────────────
  const handleStop = async (id: number, name: string) => {
    if (!confirm(`Stop "${name}"? This will shut down the server.`)) return;
    setDestroying(id);
    try {
      await fetch(`${apiBase}${basePath}/${id}/destroy`, { method: "POST", headers: getHeaders() });
      fetchEnvs();
    } catch { /* silent */ }
    finally { setDestroying(null); }
  };

  // ─── SSH ─────────────────────────────────────────────────────────
  const openSsh = async (envId: number) => {
    setSshEnvId(envId);
    setSshInfo(null);
    setSshPassword(null);
    try {
      const res = await fetch(`${apiBase}${basePath}/${envId}/ssh-credentials`, { headers: getHeaders() });
      const json = await res.json();
      setSshInfo(json.data || null);
    } catch { /* silent */ }
  };

  const resetPassword = async () => {
    if (!sshEnvId) return;
    setResettingPassword(true);
    try {
      const res = await fetch(`${apiBase}${basePath}/${sshEnvId}/ssh-reset`, { method: "POST", headers: getHeaders() });
      const json = await res.json();
      if (json.ssh_password) setSshPassword(json.ssh_password);
    } catch { /* silent */ }
    finally { setResettingPassword(false); }
  };

  const copyText = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const getMachineInfo = (id: string) => machineTypes.find((m) => m.id === id);
  const getRegionLabel = (id: string) => regions.find((r) => r.id === id)?.label || id;

  if (!currentOrg) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-400 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Server className="h-6 w-6 text-brand-400" />
          <h1 className="text-xl font-bold text-white">Environments</h1>
          <span className="text-sm text-surface-500">{envs.length} environment{envs.length !== 1 ? "s" : ""}</span>
        </div>
        <button
          onClick={() => router.push(newPageUrl)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-400 transition-colors"
        >
          <Plus className="h-4 w-4" />
          {envs.length === 0 ? "Setup Environments" : "New environment"}
        </button>
      </div>

      {/* ── Delete Confirmation Modal ──────────────────────────────── */}
      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Environment" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-surface-300">
            Are you sure you want to delete <strong className="text-white">{deleteTarget?.name}</strong>?
            {deleteTarget?.instance_id && (
              <span className="block mt-1 text-red-400">This will permanently destroy the server and all its data.</span>
            )}
          </p>
          {deleteTarget?.url && (
            <div className="px-3 py-2 rounded-lg bg-red-500/5 border border-red-500/20 text-sm text-red-400 font-mono">
              {deleteTarget.url.replace("https://", "")}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setDeleteTarget(null)} className="px-3 py-1.5 text-sm text-surface-400 hover:text-white rounded-lg hover:bg-surface-700 transition-colors">Cancel</button>
            <button onClick={handleDelete} disabled={deleting}
              className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {deleting && <Loader2 className="h-4 w-4 animate-spin" />}
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </Modal>

      {/* ── SSH Panel ──────────────────────────────────────────────── */}
      {sshEnvId && (sshInfo || sshPassword) && (
        <Card className="!p-4 space-y-3 border-brand-500/30">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Terminal className="h-4 w-4 text-brand-400" /> SSH Connection
            </h3>
            <button onClick={() => { setSshEnvId(null); setSshInfo(null); setSshPassword(null); }} className="text-surface-500 hover:text-white"><X className="h-4 w-4" /></button>
          </div>
          {sshInfo && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 rounded-lg bg-surface-900 border border-surface-700 text-sm text-green-400 font-mono">{sshInfo.connection}</code>
                <button onClick={() => copyText(sshInfo.connection, "ssh")} className="p-2 rounded-lg border border-surface-600 hover:bg-surface-700">
                  {copied === "ssh" ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4 text-surface-400" />}
                </button>
              </div>
              <div className="text-sm text-surface-500">Host: {sshInfo.hostname} · Port: {sshInfo.port} · Key: {sshInfo.has_key ? "✓ uploaded" : "none"}</div>
            </div>
          )}
          {sshPassword && (
            <div className="space-y-1">
              <label className="text-sm text-surface-400">SSH Password <span className="text-amber-400">(save this — shown only once)</span></label>
              <div className="flex items-center gap-2">
                <code className="flex-1 px-3 py-2 rounded-lg bg-surface-900 border border-amber-500/30 text-sm font-mono text-amber-400">
                  {showPassword ? sshPassword : "••••••••••••"}
                </code>
                <button onClick={() => setShowPassword(!showPassword)} className="p-2 rounded-lg border border-surface-600 hover:bg-surface-700">
                  {showPassword ? <EyeOff className="h-4 w-4 text-surface-400" /> : <Eye className="h-4 w-4 text-surface-400" />}
                </button>
                <button onClick={() => copyText(sshPassword, "pwd")} className="p-2 rounded-lg border border-surface-600 hover:bg-surface-700">
                  {copied === "pwd" ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4 text-surface-400" />}
                </button>
              </div>
            </div>
          )}
          {sshEnvId && !sshPassword && (
            <button onClick={resetPassword} disabled={resettingPassword} className="flex items-center gap-2 text-sm text-surface-400 hover:text-white">
              <RefreshCw className={`h-3.5 w-3.5 ${resettingPassword ? "animate-spin" : ""}`} />
              Reset SSH password
            </button>
          )}
        </Card>
      )}

      {/* ── Content ────────────────────────────────────────────────── */}
      {loading ? (
        <Card className="!p-8">
          <div className="flex items-center justify-center gap-3">
            <Loader2 className="h-5 w-5 animate-spin text-brand-400" />
            <span className="text-surface-400 text-sm">Loading environments…</span>
          </div>
        </Card>
      ) : error ? (
        <Card className="!p-8">
          <div className="flex flex-col items-center gap-3 text-center">
            <AlertCircle className="h-10 w-10 text-surface-500" />
            <p className="text-surface-400">{error}</p>
          </div>
        </Card>
      ) : envs.length === 0 ? (
        <Card className="!p-10">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="h-16 w-16 rounded-2xl bg-brand-500/10 flex items-center justify-center">
              <Server className="h-8 w-8 text-brand-400" />
            </div>
            <div>
              <p className="text-white font-medium">No environments yet</p>
              <p className="text-sm text-surface-500 mt-1">Set up your first environments to start deploying your project.</p>
            </div>
            <button
              onClick={() => router.push(newPageUrl)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-400 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Setup Environments
            </button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {envs.map((env) => {
            const machine = getMachineInfo(env.machine_type);
            const badge = typeBadge(env.type);
            const isTransitional = ["provisioning", "building", "deploying"].includes(env.status);
            return (
              <Card key={env.id} className="!p-0 overflow-hidden group">
                {/* Header */}
                <div className="px-4 py-3 border-b border-surface-700/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`h-2.5 w-2.5 rounded-full ${statusColor(env.status)} ${isTransitional ? "animate-pulse" : ""}`} />
                    <span className="text-sm font-semibold text-white">{env.name}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${badge.bg} ${badge.text}`}>{env.type}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isTransitional && <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-400" />}
                    <span className="text-xs text-surface-500 uppercase tracking-wider">{statusLabel(env.status)}</span>
                  </div>
                </div>

                {/* Body */}
                <div className="px-4 py-3 space-y-2">
                  {env.url && (
                    <div className="flex items-center gap-2 text-sm">
                      <Globe className="h-3.5 w-3.5 text-surface-500 shrink-0" />
                      <a href={env.url} target="_blank" rel="noopener" className="text-brand-400 hover:underline truncate">{env.url.replace("https://", "")}</a>
                      <ExternalLink className="h-3 w-3 text-surface-600 shrink-0" />
                    </div>
                  )}
                  {env.region && (
                    <div className="flex items-center gap-2 text-sm text-surface-400">
                      <MapPin className="h-3.5 w-3.5 text-surface-500 shrink-0" />
                      {getRegionLabel(env.region)}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm text-surface-400">
                    <Cpu className="h-3.5 w-3.5 text-surface-500 shrink-0" />
                    {env.machine_type} {machine && `— ${machine.vcpus} vCPU, ${machine.ram_gb} GB`}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-surface-400">
                    <HardDrive className="h-3.5 w-3.5 text-surface-500 shrink-0" />
                    {env.disk_size_gb} GB SSD
                  </div>
                  {env.branch && (
                    <div className="flex items-center gap-2 text-sm text-surface-400">
                      <GitBranch className="h-3.5 w-3.5 text-surface-500 shrink-0" />
                      {env.branch}
                    </div>
                  )}
                  {env.ip_address && (
                    <div className="flex items-center gap-2 text-sm text-surface-400">
                      <Server className="h-3.5 w-3.5 text-surface-500 shrink-0" />
                      {env.ip_address}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="px-4 py-2.5 border-t border-surface-700/50 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    {(env.status === "pending" || env.status === "stopped") && (
                      <button onClick={() => handleProvision(env.id)} disabled={provisioning === env.id}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm text-green-400 bg-green-500/10 hover:bg-green-500/20 transition-colors disabled:opacity-50" title="Provision server">
                        {provisioning === env.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                        {provisioning === env.id ? "Provisioning…" : "Provision"}
                      </button>
                    )}
                    {env.status === "active" && (
                      <button onClick={() => handleStop(env.id, env.name)} disabled={destroying === env.id}
                        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-sm text-amber-400 hover:bg-amber-500/10 transition-colors disabled:opacity-50" title="Stop server">
                        {destroying === env.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5" />}
                      </button>
                    )}
                    <button onClick={() => openSsh(env.id)} className="flex items-center gap-1.5 px-2 py-1 rounded-md text-sm text-surface-400 hover:text-white hover:bg-surface-700 transition-colors" title="SSH credentials">
                      <Terminal className="h-3.5 w-3.5" /> SSH
                    </button>
                    <button onClick={() => setDeleteTarget(env)} className="flex items-center gap-1.5 px-2 py-1 rounded-md text-sm text-surface-500 hover:text-red-400 hover:bg-red-500/10 transition-colors" title="Delete environment">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <span className="text-xs text-surface-600">{timeAgo(env.created_at)}</span>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
