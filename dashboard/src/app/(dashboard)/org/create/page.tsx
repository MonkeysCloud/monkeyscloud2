"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { ImageUpload } from "@/components/ui/ImageUpload";
import {
  Building2,
  ArrowRight,
  Loader2,
  AlertCircle,
  Globe,
  Sparkles,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import clsx from "clsx";

export default function CreateOrganizationPage() {
  const router = useRouter();
  const { setOrganizations, setCurrentOrg } = useAuthStore();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Slug availability state
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [slugChecking, setSlugChecking] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced slug availability check
  const checkSlugAvailability = useCallback((slugValue: string) => {
    // Clear any pending check
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Reset if slug is too short
    if (!slugValue || slugValue.length < 3) {
      setSlugAvailable(null);
      setSlugChecking(false);
      return;
    }

    setSlugChecking(true);
    setSlugAvailable(null);

    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.get<{ available: boolean }>(
          `/api/v1/organizations/check-slug?slug=${encodeURIComponent(slugValue)}`
        );
        setSlugAvailable(res.available);
      } catch {
        setSlugAvailable(null);
      } finally {
        setSlugChecking(false);
      }
    }, 500);
  }, []);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  // Auto-generate slug from name (unless user manually edited it)
  useEffect(() => {
    if (!slugEdited) {
      const generated = name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .slice(0, 60);
      setSlug(generated);
      checkSlugAvailability(generated);
    }
  }, [name, slugEdited, checkSlugAvailability]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Organization name is required.");
      return;
    }
    if (!slug.trim() || slug.length < 3) {
      setError("Slug must be at least 3 characters.");
      return;
    }
    if (slugAvailable === false) {
      setError("This slug is already taken. Please choose a different one.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post<{ data: { id: number; name: string; slug: string } }>(
        "/api/v1/organizations",
        { name: name.trim(), slug: slug.trim(), avatar_url: avatarUrl || null }
      );

      // Refresh organizations list
      const orgs = await api.get<{ data: { id: number; name: string; slug: string }[] }>(
        "/api/v1/organizations"
      );
      const orgList = (orgs as any)?.data ?? orgs;
      if (Array.isArray(orgList)) {
        setOrganizations(orgList);
        const newOrg = orgList.find((o: any) => o.slug === slug.trim());
        if (newOrg) setCurrentOrg(newOrg);
      }

      router.push(`/org/${slug.trim()}`);
    } catch (err: any) {
      setError(err?.data?.error || err?.data?.message || err?.message || "Failed to create organization.");
    } finally {
      setLoading(false);
    }
  }

  const isSubmitDisabled = loading || !name.trim() || slugAvailable === false || slugChecking;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0e17] px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-500 to-violet-600 shadow-lg shadow-primary-500/20">
            <Building2 className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Create your organization
          </h1>
          <p className="mt-2 text-sm text-surface-400">
            Organizations group your projects, teams, and billing. You can invite members after setup.
          </p>
        </div>

        {/* Form Card */}
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-surface-800 bg-[#111827] p-6 shadow-xl"
        >
          {/* Error */}
          {error && (
            <div className="mb-5 flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Logo upload */}
          <div className="mb-5">
            <ImageUpload
              value={avatarUrl}
              onChange={setAvatarUrl}
              entityType="organization"
              entityId="new"
              label="Organization logo"
              sublabel="Optional • JPG, PNG, WebP, SVG"
              size={72}
              shape="circle"
            />
          </div>

          {/* Organization Name */}
          <div className="mb-5">
            <label className="block text-[13px] font-medium text-surface-300 mb-1.5">
              Organization name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Acme Inc."
              className="w-full rounded-lg border border-surface-700 bg-surface-900 px-4 py-2.5 text-sm text-white placeholder:text-surface-500 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 transition-colors"
              autoFocus
              maxLength={100}
            />
          </div>

          {/* Slug */}
          <div className="mb-5">
            <label className="block text-[13px] font-medium text-surface-300 mb-1.5">
              <div className="flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-surface-500" />
                URL slug
              </div>
            </label>
            <div
              className={clsx(
                "flex items-center rounded-lg border bg-surface-900 overflow-hidden transition-colors",
                slugAvailable === false
                  ? "border-red-500/60 focus-within:border-red-500 focus-within:ring-1 focus-within:ring-red-500/30"
                  : slugAvailable === true
                    ? "border-emerald-500/60 focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500/30"
                    : "border-surface-700 focus-within:border-primary-500 focus-within:ring-1 focus-within:ring-primary-500/30"
              )}
            >
              <span className="px-3 text-sm text-surface-500 shrink-0 border-r border-surface-700 py-2.5 bg-surface-800/50">
                monkeyscloud.com/org/
              </span>
              <input
                type="text"
                value={slug}
                onChange={(e) => {
                  const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
                  setSlug(val);
                  setSlugEdited(true);
                  checkSlugAvailability(val);
                }}
                placeholder="acme-inc"
                className="flex-1 bg-transparent px-3 py-2.5 text-sm text-white placeholder:text-surface-500 outline-none"
                maxLength={60}
              />
              {/* Status indicator inside input */}
              {slug.length >= 3 && (
                <span className="pr-3 flex items-center">
                  {slugChecking ? (
                    <Loader2 className="h-4 w-4 text-surface-500 animate-spin" />
                  ) : slugAvailable === true ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                  ) : slugAvailable === false ? (
                    <XCircle className="h-4 w-4 text-red-400" />
                  ) : null}
                </span>
              )}
            </div>

            {/* Slug feedback message */}
            {slug.length >= 3 && !slugChecking && slugAvailable === true && (
              <p className="mt-1.5 text-[13px] text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="h-3 w-3" />
                This slug is available
              </p>
            )}
            {slug.length >= 3 && !slugChecking && slugAvailable === false && (
              <p className="mt-1.5 text-[13px] text-red-400 flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                This slug is already taken. Please choose a different one.
              </p>
            )}
            {slug && slugAvailable !== false && (
              <p className="mt-1.5 text-[13px] text-surface-500">
                Your organization will be available at{" "}
                <span className="text-primary-400 font-mono">monkeyscloud.com/org/{slug}</span>
              </p>
            )}
          </div>

          {/* Features preview */}
          <div className="mb-6 rounded-lg bg-surface-800/40 border border-surface-800 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-yellow-400" />
              <span className="text-sm font-semibold text-surface-300">Included in every organization</span>
            </div>
            <ul className="grid grid-cols-2 gap-2">
              {[
                "Unlimited projects",
                "Git repositories",
                "Task boards",
                "Auto deploys",
                "Team collaboration",
                "AI assistance",
              ].map((feat) => (
                <li key={feat} className="flex items-center gap-1.5 text-[13px] text-surface-400">
                  <span className="text-emerald-400">✓</span>
                  {feat}
                </li>
              ))}
            </ul>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitDisabled}
            className={clsx(
              "flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold transition-all",
              isSubmitDisabled
                ? "bg-surface-800 text-surface-500 cursor-not-allowed"
                : "bg-gradient-to-r from-primary-500 to-violet-600 text-white hover:from-primary-600 hover:to-violet-700 shadow-lg shadow-primary-500/20"
            )}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                Create Organization
                <ArrowRight className="h-4 w-4" />
              </>
            )}
          </button>
        </form>

        {/* Back link */}
        <p className="text-center mt-6 text-[13px] text-surface-500">
          Already have an organization?{" "}
          <button
            onClick={() => router.push("/dashboard")}
            className="text-primary-400 hover:text-primary-300 transition-colors"
          >
            Go to dashboard
          </button>
        </p>
      </div>
    </div>
  );
}
