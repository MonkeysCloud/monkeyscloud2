"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { Card } from "@/components/ui/Card";
import {
  User,
  Camera,
  Mail,
  Globe,
  Clock,
  Shield,
  Loader2,
  Check,
  AlertCircle,
  Pencil,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Mexico_City",
  "America/Bogota",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Asia/Dubai",
  "Australia/Sydney",
  "Pacific/Auckland",
];

const LOCALES = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "pt", label: "Português" },
  { value: "de", label: "Deutsch" },
  { value: "ja", label: "日本語" },
  { value: "zh", label: "中文" },
];

export default function AccountSettingsPage() {
  const { user, setUser } = useAuthStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Profile fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [locale, setLocale] = useState("en");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Password fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // State
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState("");
  const [profileError, setProfileError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordError, setPasswordError] = useState("");

  const token =
    typeof window !== "undefined" ? localStorage.getItem("mc_token") : null;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // Initialize from auth store
  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setEmail(user.email || "");
      setAvatarUrl(user.avatar_url || null);
    }
  }, [user]);

  // Fetch full profile with timezone/locale
  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/v1/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const u = data.user;
        setName(u.name || "");
        setEmail(u.email || "");
        setTimezone(u.timezone || "UTC");
        setLocale(u.locale || "en");
        setAvatarUrl(u.avatar_url || null);
      }
    } catch {}
  }, [token]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  // Save profile
  const saveProfile = async () => {
    setSavingProfile(true);
    setProfileError("");
    setProfileSuccess("");
    try {
      const res = await fetch(`${API}/api/v1/auth/me`, {
        method: "PUT",
        headers,
        body: JSON.stringify({ name, timezone, locale }),
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setProfileSuccess("Profile updated successfully");
        setTimeout(() => setProfileSuccess(""), 3000);
      } else {
        const err = await res.json();
        setProfileError(err.error || "Failed to save profile");
      }
    } catch {
      setProfileError("Failed to save profile");
    }
    setSavingProfile(false);
  };

  // Upload avatar
  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    setProfileError("");

    const formData = new FormData();
    formData.append("avatar", file);

    try {
      const res = await fetch(`${API}/api/v1/auth/me/avatar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (res.ok) {
        const data = await res.json();
        setAvatarUrl(data.user.avatar_url);
        setUser(data.user);
        setProfileSuccess("Avatar updated successfully");
        setTimeout(() => setProfileSuccess(""), 3000);
      } else {
        const err = await res.json();
        setProfileError(err.error || "Failed to upload avatar");
      }
    } catch {
      setProfileError("Failed to upload avatar");
    }
    setUploadingAvatar(false);
    // Reset file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Change password
  const changePassword = async () => {
    setPasswordError("");
    setPasswordSuccess("");
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters");
      return;
    }
    setSavingPassword(true);
    try {
      const res = await fetch(`${API}/api/v1/auth/me/password`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      if (res.ok) {
        setPasswordSuccess("Password changed successfully");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setTimeout(() => setPasswordSuccess(""), 3000);
      } else {
        const err = await res.json();
        setPasswordError(err.error || "Failed to change password");
      }
    } catch {
      setPasswordError("Failed to change password");
    }
    setSavingPassword(false);
  };

  const initials = name
    ? name
        .split(" ")
        .map((p) => p[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "U";

  const avatarSrc = avatarUrl
    ? avatarUrl.startsWith("http")
      ? avatarUrl
      : `${API}${avatarUrl}`
    : null;

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-8">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <User className="h-6 w-6 text-brand-400" />
          Account Settings
        </h1>
        <p className="text-surface-400 text-sm mt-1">
          Manage your profile information and security settings
        </p>
      </div>

      {/* Avatar & Profile Card */}
      <Card className="!p-0 overflow-hidden">
        {/* Avatar Section */}
        <div className="relative bg-gradient-to-r from-brand-500/20 via-purple-500/15 to-cyan-500/10 px-6 py-8">
          <div className="flex items-center gap-6">
            {/* Avatar */}
            <div className="relative group">
              <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-surface-800 shadow-xl bg-gradient-to-br from-brand-400 to-purple-500 flex items-center justify-center">
                {avatarSrc ? (
                  <img
                    src={avatarSrc}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-3xl font-bold text-white">
                    {initials}
                  </span>
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute inset-0 w-24 h-24 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                {uploadingAvatar ? (
                  <Loader2 className="h-6 w-6 text-white animate-spin" />
                ) : (
                  <Camera className="h-6 w-6 text-white" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </div>
            {/* Info */}
            <div>
              <h2 className="text-xl font-semibold text-white">{name || "User"}</h2>
              <p className="text-surface-400 text-sm mt-0.5">{email}</p>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="mt-2 text-xs text-brand-400 hover:text-brand-300 transition-colors flex items-center gap-1.5"
              >
                <Pencil className="h-3 w-3" />
                {uploadingAvatar ? "Uploading..." : "Change photo"}
              </button>
            </div>
          </div>
        </div>

        {/* Profile Form */}
        <div className="px-6 py-6 space-y-5">
          {profileSuccess && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
              <Check className="h-4 w-4 shrink-0" />
              {profileSuccess}
            </div>
          )}
          {profileError && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {profileError}
            </div>
          )}

          {/* Name */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-surface-300 mb-1.5">
              <User className="h-3.5 w-3.5 text-surface-500" />
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-surface-600 bg-surface-900 px-3 py-2.5 text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-brand-500/60 transition-all"
            />
          </div>

          {/* Email (read-only) */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-surface-300 mb-1.5">
              <Mail className="h-3.5 w-3.5 text-surface-500" />
              Email Address
            </label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full rounded-lg border border-surface-700 bg-surface-800/50 px-3 py-2.5 text-sm text-surface-400 cursor-not-allowed"
            />
            <p className="text-xs text-surface-500 mt-1">
              Email cannot be changed from here
            </p>
          </div>

          {/* Timezone & Locale */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-surface-300 mb-1.5">
                <Clock className="h-3.5 w-3.5 text-surface-500" />
                Timezone
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full rounded-lg border border-surface-600 bg-surface-900 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500/60 transition-all"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-surface-300 mb-1.5">
                <Globe className="h-3.5 w-3.5 text-surface-500" />
                Language
              </label>
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
                className="w-full rounded-lg border border-surface-600 bg-surface-900 px-3 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500/60 transition-all"
              >
                {LOCALES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-2">
            <button
              onClick={saveProfile}
              disabled={savingProfile}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-brand-500 text-white text-sm font-medium hover:bg-brand-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingProfile ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Save Changes
            </button>
          </div>
        </div>
      </Card>

      {/* Change Password Card */}
      <Card className="!p-0 overflow-hidden">
        <div className="px-6 py-4 border-b border-surface-700 flex items-center gap-2">
          <Shield className="h-4 w-4 text-brand-400" />
          <h3 className="text-base font-semibold text-white">Change Password</h3>
        </div>
        <div className="px-6 py-6 space-y-5">
          {passwordSuccess && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm">
              <Check className="h-4 w-4 shrink-0" />
              {passwordSuccess}
            </div>
          )}
          {passwordError && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {passwordError}
            </div>
          )}

          <div>
            <label className="text-sm font-medium text-surface-300 mb-1.5 block">
              Current Password
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-lg border border-surface-600 bg-surface-900 px-3 py-2.5 text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-brand-500/60 transition-all"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-surface-300 mb-1.5 block">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-surface-600 bg-surface-900 px-3 py-2.5 text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-brand-500/60 transition-all"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-surface-300 mb-1.5 block">
                Confirm New Password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-surface-600 bg-surface-900 px-3 py-2.5 text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-brand-500/60 transition-all"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              onClick={changePassword}
              disabled={
                savingPassword ||
                !currentPassword ||
                !newPassword ||
                !confirmPassword
              }
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-surface-700 text-white text-sm font-medium hover:bg-surface-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {savingPassword ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Shield className="h-4 w-4" />
              )}
              Update Password
            </button>
          </div>
        </div>
      </Card>
    </div>
  );
}
