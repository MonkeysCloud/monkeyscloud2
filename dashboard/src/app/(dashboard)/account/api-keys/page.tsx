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
  Shield,
  Clock,
  Upload,
  Fingerprint,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface ApiKeyItem {
  id: number;
  name: string;
  key_id: string;
  scopes: string[];
  last_used_at: string | null;
  created_at: string;
}

interface SshKeyItem {
  id: number;
  name: string;
  fingerprint: string;
  last_used_at: string | null;
  created_at: string;
}

export default function ApiKeysPage() {
  const [activeTab, setActiveTab] = useState<"api" | "ssh">("api");

  // API Keys state
  const [keys, setKeys] = useState<ApiKeyItem[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);

  // SSH Keys state
  const [sshKeys, setSshKeys] = useState<SshKeyItem[]>([]);
  const [loadingSshKeys, setLoadingSshKeys] = useState(true);

  // General
  const [error, setError] = useState("");

  // Create API key modal
  const [showCreateKey, setShowCreateKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyScopes, setNewKeyScopes] = useState<string[]>(["read", "write"]);
  const [creatingKey, setCreatingKey] = useState(false);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [tokenCopied, setTokenCopied] = useState(false);

  // Upload SSH key modal
  const [showUploadSsh, setShowUploadSsh] = useState(false);
  const [sshKeyName, setSshKeyName] = useState("");
  const [sshPublicKey, setSshPublicKey] = useState("");
  const [uploadingSsh, setUploadingSsh] = useState(false);

  // Delete state
  const [deleting, setDeleting] = useState<number | null>(null);

  const token =
    typeof window !== "undefined" ? localStorage.getItem("mc_token") : null;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // Fetch API keys
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
      setLoadingKeys(false);
    }
  }, [token]);

  // Fetch SSH keys
  const fetchSshKeys = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/v1/me/ssh-keys`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setSshKeys(Array.isArray(data) ? data : []);
      }
    } catch {
      setError("Failed to load SSH keys");
    } finally {
      setLoadingSshKeys(false);
    }
  }, [token]);

  useEffect(() => {
    fetchKeys();
    fetchSshKeys();
  }, [fetchKeys, fetchSshKeys]);

  // Create API key
  const handleCreateKey = async () => {
    if (!newKeyName.trim()) return;
    setCreatingKey(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/v1/me/api-keys`, {
        method: "POST",
        headers,
        body: JSON.stringify({ name: newKeyName.trim(), scopes: newKeyScopes }),
      });
      if (res.ok) {
        const data = await res.json();
        setCreatedToken(data.token);
        setNewKeyName("");
        setShowCreateKey(false);
        fetchKeys();
      } else {
        const err = await res.json();
        setError(err.error || "Failed to create API key");
      }
    } catch {
      setError("Failed to create API key");
    }
    setCreatingKey(false);
  };

  // Upload SSH key
  const handleUploadSsh = async () => {
    if (!sshKeyName.trim() || !sshPublicKey.trim()) return;
    setUploadingSsh(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/v1/me/ssh-keys`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: sshKeyName.trim(),
          public_key: sshPublicKey.trim(),
        }),
      });
      if (res.ok) {
        setSshKeyName("");
        setSshPublicKey("");
        setShowUploadSsh(false);
        fetchSshKeys();
      } else {
        const err = await res.json();
        setError(err.error || "Failed to upload SSH key");
      }
    } catch {
      setError("Failed to upload SSH key");
    }
    setUploadingSsh(false);
  };

  // Delete API key
  const handleDeleteKey = async (keyId: number) => {
    setDeleting(keyId);
    try {
      await fetch(`${API}/api/v1/api-keys/${keyId}`, {
        method: "DELETE",
        headers,
      });
      setKeys((prev) => prev.filter((k) => k.id !== keyId));
    } catch {
      setError("Failed to delete API key");
    }
    setDeleting(null);
  };

  // Delete SSH key
  const handleDeleteSsh = async (sshKeyId: number) => {
    setDeleting(sshKeyId);
    try {
      await fetch(`${API}/api/v1/ssh-keys/${sshKeyId}`, {
        method: "DELETE",
        headers,
      });
      setSshKeys((prev) => prev.filter((k) => k.id !== sshKeyId));
    } catch {
      setError("Failed to delete SSH key");
    }
    setDeleting(null);
  };

  const toggleScope = (scope: string) => {
    setNewKeyScopes((prev) =>
      prev.includes(scope)
        ? prev.filter((s) => s !== scope)
        : [...prev, scope]
    );
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
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Key className="h-6 w-6 text-brand-400" />
          API Keys &amp; SSH Keys
        </h1>
        <p className="text-surface-400 text-sm mt-1">
          Manage authentication for Git operations and API access
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-surface-800 rounded-lg p-1 border border-surface-700">
        <button
          onClick={() => setActiveTab("api")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-colors ${
            activeTab === "api"
              ? "bg-brand-500/15 text-brand-400 border border-brand-500/30"
              : "text-surface-400 hover:text-surface-300 border border-transparent"
          }`}
        >
          <Key className="h-4 w-4" />
          API Keys ({keys.length})
        </button>
        <button
          onClick={() => setActiveTab("ssh")}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-md text-sm font-medium transition-colors ${
            activeTab === "ssh"
              ? "bg-brand-500/15 text-brand-400 border border-brand-500/30"
              : "text-surface-400 hover:text-surface-300 border border-transparent"
          }`}
        >
          <Fingerprint className="h-4 w-4" />
          SSH Keys ({sshKeys.length})
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
              <p className="text-surface-500"># Use this token for HTTPS git operations:</p>
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
          <button onClick={() => setError("")} className="ml-auto text-xs hover:text-red-300">✕</button>
        </div>
      )}

      {/* ============ API Keys Tab ============ */}
      {activeTab === "api" && (
        <>
          <div className="flex justify-end">
            <button
              onClick={() => setShowCreateKey(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-400 transition-colors"
            >
              <Plus className="h-4 w-4" />
              New API Key
            </button>
          </div>

          <Card className="!p-0 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-surface-700 flex items-center gap-2">
              <Key className="h-4 w-4 text-brand-400" />
              <h3 className="text-sm font-semibold text-white">Personal Access Tokens</h3>
              <span className="text-xs text-surface-500 ml-1">Works across all your organizations</span>
            </div>

            {loadingKeys ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-surface-500" />
              </div>
            ) : keys.length === 0 ? (
              <div className="text-center py-12 text-surface-500">
                <Key className="h-8 w-8 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No API keys yet</p>
                <p className="text-xs mt-1">Create one to authenticate Git clone and push via HTTPS</p>
              </div>
            ) : (
              <div className="divide-y divide-surface-800">
                {keys.map((k) => (
                  <div key={k.id} className="px-5 py-3.5 flex items-center gap-4 hover:bg-surface-800/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white truncate">{k.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-700 text-surface-400 font-mono">
                          {k.key_id.substring(0, 8)}...
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-surface-500">
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
                      onClick={() => handleDeleteKey(k.id)}
                      disabled={deleting === k.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/10 transition-colors disabled:opacity-50"
                    >
                      {deleting === k.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Usage info */}
          <Card>
            <h3 className="text-sm font-semibold text-white mb-3">How to use API keys</h3>
            <div className="space-y-3 text-xs text-surface-400">
              <div className="bg-surface-800 rounded-lg p-3 font-mono space-y-1">
                <p className="text-surface-500"># Clone a repository</p>
                <p className="text-surface-300">git clone https://x-token-auth:mc_YOUR_KEY@git.monkeys.cloud/org/project.git</p>
              </div>
              <div className="bg-surface-800 rounded-lg p-3 font-mono space-y-1">
                <p className="text-surface-500"># Store credentials so you don&apos;t have to enter them each time</p>
                <p className="text-surface-300">git config --global credential.helper store</p>
              </div>
            </div>
          </Card>
        </>
      )}

      {/* ============ SSH Keys Tab ============ */}
      {activeTab === "ssh" && (
        <>
          <div className="flex justify-end">
            <button
              onClick={() => setShowUploadSsh(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-400 transition-colors"
            >
              <Upload className="h-4 w-4" />
              Add SSH Key
            </button>
          </div>

          <Card className="!p-0 overflow-hidden">
            <div className="px-5 py-3.5 border-b border-surface-700 flex items-center gap-2">
              <Fingerprint className="h-4 w-4 text-brand-400" />
              <h3 className="text-sm font-semibold text-white">SSH Public Keys</h3>
              <span className="text-xs text-surface-500 ml-1">For password-less git operations</span>
            </div>

            {loadingSshKeys ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-surface-500" />
              </div>
            ) : sshKeys.length === 0 ? (
              <div className="text-center py-12 text-surface-500">
                <Fingerprint className="h-8 w-8 mx-auto mb-3 opacity-40" />
                <p className="text-sm">No SSH keys yet</p>
                <p className="text-xs mt-1">Upload your public key to clone and push via SSH</p>
              </div>
            ) : (
              <div className="divide-y divide-surface-800">
                {sshKeys.map((k) => (
                  <div key={k.id} className="px-5 py-3.5 flex items-center gap-4 hover:bg-surface-800/30 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white truncate">{k.name}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-surface-500">
                        <span className="font-mono">{k.fingerprint}</span>
                        <span>·</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          Added {formatDate(k.created_at)}
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
                      onClick={() => handleDeleteSsh(k.id)}
                      disabled={deleting === k.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/10 transition-colors disabled:opacity-50"
                    >
                      {deleting === k.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Usage info */}
          <Card>
            <h3 className="text-sm font-semibold text-white mb-3">How to add your SSH key</h3>
            <div className="space-y-3 text-xs text-surface-400">
              <div className="bg-surface-800 rounded-lg p-3 font-mono space-y-1">
                <p className="text-surface-500"># Check for existing keys</p>
                <p className="text-surface-300">ls -la ~/.ssh/</p>
              </div>
              <div className="bg-surface-800 rounded-lg p-3 font-mono space-y-1">
                <p className="text-surface-500"># Generate a new key (if you don&apos;t have one)</p>
                <p className="text-surface-300">ssh-keygen -t ed25519 -C &quot;your@email.com&quot;</p>
              </div>
              <div className="bg-surface-800 rounded-lg p-3 font-mono space-y-1">
                <p className="text-surface-500"># Copy your public key</p>
                <p className="text-surface-300">cat ~/.ssh/id_ed25519.pub</p>
              </div>
              <p>Paste the output above into the &quot;Add SSH Key&quot; form. Then clone using:</p>
              <div className="bg-surface-800 rounded-lg p-3 font-mono">
                <p className="text-surface-300">git clone git@git.monkeys.cloud:org/project.git</p>
              </div>
            </div>
          </Card>
        </>
      )}

      {/* ============ Create API Key Modal ============ */}
      {showCreateKey && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateKey(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-xl border border-surface-600 bg-surface-800 shadow-2xl p-6 space-y-5">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Key className="h-5 w-5 text-brand-400" />
                Create API Key
              </h3>
              <div>
                <label className="text-sm font-medium text-surface-300 mb-1.5 block">Key Name</label>
                <input
                  type="text"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                  placeholder="e.g. My Laptop, CI/CD Pipeline"
                  className="w-full rounded-lg border border-surface-600 bg-surface-900 px-3 py-2.5 text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-brand-500/60 transition-all"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium text-surface-300 mb-2 block">Permissions</label>
                <div className="space-y-2">
                  {[
                    { id: "read", label: "Read", desc: "Clone and fetch repositories" },
                    { id: "write", label: "Write", desc: "Push commits to repositories" },
                  ].map((scope) => (
                    <label key={scope.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-surface-700 hover:border-surface-600 cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={newKeyScopes.includes(scope.id)}
                        onChange={() => toggleScope(scope.id)}
                        className="rounded border-surface-600 bg-surface-900 text-brand-500 focus:ring-brand-500/30"
                      />
                      <div>
                        <span className="text-sm font-medium text-white">{scope.label}</span>
                        <p className="text-xs text-surface-500">{scope.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowCreateKey(false)} className="px-4 py-2 rounded-lg border border-surface-600 text-surface-300 text-sm hover:bg-surface-700 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleCreateKey}
                  disabled={creatingKey || !newKeyName.trim() || newKeyScopes.length === 0}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {creatingKey ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Create Key
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ============ Upload SSH Key Modal ============ */}
      {showUploadSsh && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setShowUploadSsh(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-xl border border-surface-600 bg-surface-800 shadow-2xl p-6 space-y-5">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Fingerprint className="h-5 w-5 text-brand-400" />
                Add SSH Key
              </h3>
              <div>
                <label className="text-sm font-medium text-surface-300 mb-1.5 block">Key Name</label>
                <input
                  type="text"
                  value={sshKeyName}
                  onChange={(e) => setSshKeyName(e.target.value)}
                  placeholder="e.g. MacBook Pro, Work Desktop"
                  className="w-full rounded-lg border border-surface-600 bg-surface-900 px-3 py-2.5 text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-brand-500/60 transition-all"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-sm font-medium text-surface-300 mb-1.5 block">Public Key</label>
                <textarea
                  value={sshPublicKey}
                  onChange={(e) => setSshPublicKey(e.target.value)}
                  placeholder="ssh-ed25519 AAAA... your@email.com"
                  rows={4}
                  className="w-full rounded-lg border border-surface-600 bg-surface-900 px-3 py-2.5 text-sm text-white font-mono placeholder:text-surface-500 focus:outline-none focus:border-brand-500/60 transition-all resize-none"
                />
                <p className="text-xs text-surface-500 mt-1">
                  Paste the contents of your <code className="bg-surface-700 px-1 rounded">~/.ssh/id_ed25519.pub</code> or <code className="bg-surface-700 px-1 rounded">~/.ssh/id_rsa.pub</code> file
                </p>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowUploadSsh(false)} className="px-4 py-2 rounded-lg border border-surface-600 text-surface-300 text-sm hover:bg-surface-700 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={handleUploadSsh}
                  disabled={uploadingSsh || !sshKeyName.trim() || !sshPublicKey.trim()}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploadingSsh ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Add Key
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
