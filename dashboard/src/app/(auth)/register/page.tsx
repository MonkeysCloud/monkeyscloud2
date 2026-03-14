"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Input } from "@/components/ui";
import { register } from "@/lib/auth";
import { useAuthStore } from "@/stores/auth-store";
import toast from "react-hot-toast";

function getPasswordStrength(password: string) {
  if (!password) return { score: 0, label: "", color: "" };

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const levels = [
    { label: "Weak", color: "bg-red-500" },
    { label: "Fair", color: "bg-orange-500" },
    { label: "Good", color: "bg-yellow-500" },
    { label: "Strong", color: "bg-emerald-500" },
    { label: "Excellent", color: "bg-brand-500" },
  ];

  const level = levels[Math.min(score, levels.length) - 1] || levels[0];
  return { score, ...level };
}

export default function RegisterPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [agreed, setAgreed] = useState(false);

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  const strength = useMemo(() => getPasswordStrength(form.password), [form.password]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await register({
        name: form.name,
        email: form.email,
        password: form.password,
      });
      setUser(data.user);
      toast.success("Account created!");
      router.push("/");
    } catch (err: any) {
      setError(err.data?.error || "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white tracking-tight">
          Create your account
        </h2>
        <p className="mt-2 text-sm text-surface-400">
          Start building and deploying in minutes
        </p>
      </div>

      {/* Social signup */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <button
          type="button"
          className="flex items-center justify-center gap-2 rounded-lg border border-surface-700 bg-surface-800/50 px-4 py-2.5 text-sm font-medium text-surface-300 hover:bg-surface-700/50 hover:text-white hover:border-surface-600 transition-all"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
          </svg>
          GitHub
        </button>
        <button
          type="button"
          className="flex items-center justify-center gap-2 rounded-lg border border-surface-700 bg-surface-800/50 px-4 py-2.5 text-sm font-medium text-surface-300 hover:bg-surface-700/50 hover:text-white hover:border-surface-600 transition-all"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Google
        </button>
      </div>

      {/* Divider */}
      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-surface-700" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-surface-950 lg:bg-surface-950 px-3 text-surface-500">
            Or sign up with email
          </span>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          id="register-name"
          label="Full name"
          placeholder="Jane Doe"
          value={form.name}
          onChange={update("name")}
          required
          autoComplete="name"
        />

        <Input
          id="register-email"
          label="Email address"
          type="email"
          placeholder="jane@company.com"
          value={form.email}
          onChange={update("email")}
          required
          autoComplete="email"
        />

        <div>
          <div className="relative">
            <Input
              id="register-password"
              label="Password"
              type={showPassword ? "text" : "password"}
              placeholder="Minimum 8 characters"
              value={form.password}
              onChange={update("password")}
              required
              minLength={8}
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-[34px] text-surface-400 hover:text-white transition-colors"
              tabIndex={-1}
            >
              {showPassword ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              )}
            </button>
          </div>

          {/* Password strength meter */}
          {form.password && (
            <div className="mt-2 animate-slide-up">
              <div className="flex gap-1 mb-1">
                {[1, 2, 3, 4, 5].map((level) => (
                  <div
                    key={level}
                    className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                      level <= strength.score ? strength.color : "bg-surface-700"
                    }`}
                  />
                ))}
              </div>
              <p className="text-xs text-surface-400">
                Password strength:{" "}
                <span className={`font-medium ${
                  strength.score <= 1 ? "text-red-400" :
                  strength.score <= 2 ? "text-orange-400" :
                  strength.score <= 3 ? "text-yellow-400" :
                  "text-emerald-400"
                }`}>
                  {strength.label}
                </span>
              </p>
            </div>
          )}
        </div>

        {/* Terms agreement */}
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-surface-600 bg-surface-800 text-accent-600 focus:ring-accent-500 focus:ring-offset-0"
          />
          <span className="text-xs text-surface-400 leading-relaxed group-hover:text-surface-300 transition-colors">
            I agree to the{" "}
            <a href="#" className="text-primary-400 hover:text-primary-300 underline">Terms of Service</a>
            {" "}and{" "}
            <a href="#" className="text-primary-400 hover:text-primary-300 underline">Privacy Policy</a>
          </span>
        </label>

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 rounded-lg bg-red-950/50 border border-red-900/50 px-4 py-3 text-sm text-red-400 animate-slide-up">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
            {error}
          </div>
        )}

        {/* Submit */}
        <Button
          type="submit"
          loading={loading}
          disabled={!agreed}
          className="w-full !py-2.5 !text-sm font-semibold bg-accent-500 hover:bg-accent-600 shadow-lg shadow-accent-500/25 hover:shadow-xl hover:shadow-accent-500/30 hover:-translate-y-0.5 transition-all"
        >
          Create Account
        </Button>
      </form>

      {/* Footer */}
      <p className="mt-8 text-center text-sm text-surface-400">
        Already have an account?{" "}
        <Link href="/login" className="text-primary-400 hover:text-primary-300 font-semibold transition-colors">
          Sign in
        </Link>
      </p>
    </>
  );
}
