"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  Container,
  Terminal,
  FileCode2,
  ToggleLeft,
  ToggleRight,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

const CATEGORIES = ["PHP", "Node.js", "Python", "Go", "Rust", "Java", ".NET", "Ruby", "Elixir", "Other"];

export default function NewStackConfigPage() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  const [name, setName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [category, setCategory] = useState("Other");
  const [dockerImage, setDockerImage] = useState("");
  const [scaffoldCommand, setScaffoldCommand] = useState("");
  const [gitignoreTemplate, setGitignoreTemplate] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (user && !user.is_admin) router.replace("/");
  }, [user, router]);

  const handleSave = async () => {
    if (!name.trim()) { setError("Name is required"); return; }
    setSaving(true);
    setError("");
    try {
      await api.post("/api/v1/admin/stack-configs", {
        name: name.trim(),
        display_name: displayName.trim() || name.trim(),
        category,
        docker_image: dockerImage.trim(),
        scaffold_command: scaffoldCommand.trim(),
        gitignore_template: gitignoreTemplate.trim(),
        enabled,
      });
      router.push("/admin/stack-templates");
    } catch (e: any) {
      setError(e?.data?.error || "Create failed");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push("/admin/stack-templates")}
          className="p-2 rounded-lg hover:bg-surface-800 text-surface-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-xl font-bold text-white">New Stack Config</h1>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-2 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {/* General */}
      <div className="rounded-xl border border-surface-700 bg-surface-800/50 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-white mb-2">General</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-surface-400 mb-1">Name (slug)</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              className="w-full px-3 py-2 rounded-lg bg-surface-900 border border-surface-700 text-sm text-white outline-none focus:border-brand-500"
              placeholder="e.g. my-framework"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-xs text-surface-400 mb-1">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-surface-900 border border-surface-700 text-sm text-white outline-none focus:border-brand-500"
              placeholder="e.g. My Framework"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-surface-400 mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
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
                onClick={() => setEnabled(!enabled)}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-surface-700 bg-surface-900 text-sm"
              >
                {enabled ? (
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
            value={dockerImage}
            onChange={(e) => setDockerImage(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-surface-900 border border-surface-700 text-sm text-white font-mono outline-none focus:border-brand-500"
            placeholder="e.g. composer:2"
          />
        </div>

        <div>
          <label className="block text-xs text-surface-400 mb-1 flex items-center gap-1">
            <Terminal className="h-3 w-3" /> Scaffold Command
          </label>
          <textarea
            value={scaffoldCommand}
            onChange={(e) => setScaffoldCommand(e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-surface-900 border border-surface-700 text-sm text-white font-mono outline-none focus:border-brand-500 resize-none"
            rows={4}
            placeholder="e.g. composer create-project monkeyscloud/monkeyslegion-skeleton ."
          />
        </div>
      </div>

      {/* .gitignore */}
      <div className="rounded-xl border border-surface-700 bg-surface-800/50 p-6 space-y-4">
        <h2 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
          <FileCode2 className="h-4 w-4 text-surface-400" /> .gitignore Template
        </h2>

        <textarea
          value={gitignoreTemplate}
          onChange={(e) => setGitignoreTemplate(e.target.value)}
          className="w-full px-3 py-2 rounded-lg bg-surface-900 border border-surface-700 text-sm text-white font-mono outline-none focus:border-brand-500 resize-none"
          rows={8}
          placeholder="/vendor/&#10;/node_modules/&#10;.DS_Store"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => router.push("/admin/stack-templates")}>Cancel</Button>
        <Button onClick={handleSave} disabled={saving || !name.trim()}>
          <Save className="h-3.5 w-3.5" /> {saving ? "Creating..." : "Create Stack"}
        </Button>
      </div>
    </div>
  );
}
