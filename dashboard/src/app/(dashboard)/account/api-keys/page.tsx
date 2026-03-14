"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { Card } from "@/components/ui/Card";
import {
  Key,
  Plus,
  Trash2,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Shield,
  Clock,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ApiKeyItem {
  id: number;
  name: string;
  key_prefix: string;
  scopes: string[];
  last_used_at: string | null;
  created_at: string;
  organization_id: number;
}

export default function ApiKeysPage() {
  const { user, organizations } = useAuthStore();
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Create modal state
  const [showCreate, setShowCreate] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyOrgId, setNewKeyOrgId] = useState<number>(0);
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(["read", "write"]);
  const [creating, setCreating] = useState(false);

  // Newly created key (shown once)
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);

  // Revoke state
  const [revoking, setRevoking] = useState<number | null>(null);

  const token =
    typeof window !== "undefined" ? localStorage.getItem("mc_token") : null;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const fetchKeys = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/v1/me/api-keys`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setKeys(Array.isArray(data) ? data : []);
      }
    } catch {
      setError("Failed to load API keys");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchKeys();
  }, [fetchKeys]);

  // Set default org when orgs load
  useEffect(() => {
    if (organizations.length > 0 && newKeyOrgId === 0) {
      setNewKeyOrgId(organizations[0].id);
    }
  }, [organizations, newKeyOrgId]);

  const handleCreate = async () => {
    if (!newKeyName.trim() || !newKeyOrgId) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/v1/me/api-keys`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: newKeyName.trim(),
          organization_id: newKeyOrgId,
          scopes: newKeyScopes,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setCreatedToken(data.token);
        setNewKeyName("");
        setShowCreate(false);
        fetchKeys();
      } else {
        const err = await res.json();
        setError(err.error || "Failed to create API key");
      }
    } catch {
      setError("Failed to create API key");
    }
    setCreating(false);
  };

  const handleRevoke = async (keyId: number) => {
    setRevoking(keyId);
    try {
      await fetch(`${API}/api/v1/api-keys/${keyId}`, {
        method: "DELETE",
        headers,
      });
      setKeys((prev) => prev.filter((k) => k.id !== keyId));
    } catch {
      setError("Failed to revoke API key");
    }
    setRevoking(null);
  };

  const toggleScope = (scope: string) => {
    setNewKeyScopes((prev) =>
      prev.includes(scope)
        ? prev.filter((s) => s !== scope)
        : [...prev, scope]
    );
  };

  const getOrgName = (orgId: number) => {
    const org = organizations.find((o) => o.id === orgId);
    return org?.name || `Org #${orgId}`;
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Key className="h-6 w-6 text-brand-400" />
            API Keys
          </h1>
          <p className="text-surface-400 text-sm mt-1">
            Manage API keys for Git authentication and API access
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-400 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New API Key
        </button>
      </div>

      {/* Newly created token alert */}
      {createdToken && (
        <Card className="!border-green-500/30 !bg-green-500/5">
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <Shield className="h-5 w-5 text-green-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-green-400">
                  API key created successfully!
                </p>
                <p className="text-xs text-surface-400 mt-0.5">
                  Copy this key now. You won&apos;t be able to see it again.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={createdToken}
                className="flex-1 px-3 py-2 rounded-lg border border-green-500/30 bg-surface-900 text-sm text-white font-mono select-all focus:outline-none"
                onClick={(e) => (e.target as HTMLInputElement).select()}
              />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(createdToken);
                  setTokenCopied(true);
                  setTimeout(() => setTokenCopied(false), 2000);
                }}
                className="px-3 py-2 rounded-lg border border-green-500/30 hover:bg-green-500/10 transition-colors text-green-400"
              >
                {tokenCopied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
            <div className="bg-surface-800 rounded-lg p-3 text-xs text-surface-300 font-mono space-y-1">
              <p className="text-surface-500"># Configure git to use this key:</p>
              <p>git clone https://x-token-auth:YOUR_TOKEN@git.monkeys.cloud/org/project.git</p>
            </div>
            <button
              onClick={() => setCreatedToken(null)}
              className="text-xs text-surface-500 hover:text-surface-300 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </Card>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
          <button
            onClick={() => setError("")}
            className="ml-auto text-xs hover:text-red-300"
          >
            ✕
          </button>
        </div>
      )}

      {/* Keys list */}
      <Card className="!p-0 overflow-hidden">
        <div className="px-5 py-3.5 border-b border-surface-700 flex items-center gap-2">
          <Key className="h-4 w-4 text-brand-400" />
          <h3 className="text-sm font-semibold text-white">Active Keys</h3>
          <span className="text-xs text-surface-500 ml-1">
            ({keys.length})
          </span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-5 w-5 animate-spin text-surface-500" />
          </div>
        ) : keys.length === 0 ? (
          <div className="text-center py-12 text-surface-500">
            <Key className="h-8 w-8 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No API keys yet</p>
            <p className="text-xs mt-1">
              Create one to authenticate Git operations
            </p>
          </div>
        ) : (
          <div className="divide-y divide-surface-800">
            {keys.map((k) => (
              <div
                key={k.id}
                className="px-5 py-3.5 flex items-center gap-4 hover:bg-surface-800/30 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white truncate">
                      {k.name}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-700 text-surface-400 font-mono">
                      {k.key_prefix}...
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-surface-500">
                    <span>{getOrgName(k.organization_id)}</span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Shield className="h-3 w-3" />
                      {k.scopes.join(", ")}
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      Created {formatDate(k.created_at)}
                    </span>
                    {k.last_used_at && (
                      <>
                        <span>·</span>
                        <span>Last used {formatDate(k.last_used_at)}</span>
                      </>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleRevoke(k.id)}
                  disabled={revoking === k.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/10 transition-colors disabled:opacity-50"
                >
                  {revoking === k.id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Usage info */}
      <Card>
        <h3 className="text-sm font-semibold text-white mb-3">
          How to use API keys
        </h3>
        <div className="space-y-3 text-xs text-surface-400">
          <div className="bg-surface-800 rounded-lg p-3 font-mono space-y-1">
            <p className="text-surface-500"># Clone a repository</p>
            <p className="text-surface-300">
              git clone https://x-token-auth:mc_YOUR_KEY@git.monkeys.cloud/org/project.git
            </p>
          </div>
          <div className="bg-surface-800 rounded-lg p-3 font-mono space-y-1">
            <p className="text-surface-500"># Or configure credentials globally</p>
            <p className="text-surface-300">
              git config --global credential.helper store
            </p>
            <p className="text-surface-300">
              echo &quot;https://x-token-auth:mc_YOUR_KEY@git.monkeys.cloud&quot; &gt;&gt; ~/.git-credentials
            </p>
          </div>
        </div>
      </Card>

      {/* Create Modal */}
      {showCreate && (
        <>
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowCreate(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-xl border border-surface-600 bg-surface-800 shadow-2xl p-6 space-y-5">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Key className="h-5 w-5 text-brand-400" />
                Create API Key
              </h3>

              {/* Name */}
              <div>
                <label className="text-sm font-medium text-surface-300 mb-1.5 block">
                  Key Name
                </label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g. My Laptop, CI/CD Pipeline"
                  className="w-full rounded-lg border border-surface-600 bg-surface-900 px-3 py-2.5 text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-brand-500/60 transition-all"
                  autoFocus
                />
              </div>

              {/* Organization */}
              <div>
                <label className="text-sm font-medium text-surface-300 mb-1.5 block">
                  Organization
                </label>
                <select
                  value={newKeyOrgId}
                  onChange={(e) => setNewKeyOrgId(Number(e.target.value))}
                  className="w-full rounded-lg border border-surface-600 bg-surface-900 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500/60 transition-all"
                >
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-surface-500 mt-1">
                  This key will only work for repositories in this organization
                </p>
              </div>

              {/* Scopes */}
              <div>
                <label className="text-sm font-medium text-surface-300 mb-2 block">
                  Permissions
                </label>
                <div className="space-y-2">
                  {[
                    { id: "read", label: "Read", desc: "Clone and fetch repositories" },
                    { id: "write", label: "Write", desc: "Push commits to repositories" },
                  ].map((scope) => (
                    <label
                      key={scope.id}
                      className="flex items-center gap-3 p-2.5 rounded-lg border border-surface-700 hover:border-surface-600 cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={newKeyScopes.includes(scope.id)}
                        onChange={() => toggleScope(scope.id)}
                        className="rounded border-surface-600 bg-surface-900 text-brand-500 focus:ring-brand-500/30"
                      />
                      <div>
                        <span className="text-sm font-medium text-white">
                          {scope.label}
                        </span>
                        <p className="text-xs text-surface-500">{scope.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  onClick={() => setShowCreate(false)}
                  className="px-4 py-2 rounded-lg border border-surface-600 text-surface-300 text-sm hover:bg-surface-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreate}
                  disabled={creating || !newKeyName.trim() || newKeyScopes.length === 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creating ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  Create Key
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
