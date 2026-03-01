"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Input } from "@/components/ui";
import { register } from "@/lib/auth";
import { useAuthStore } from "@/stores/auth-store";
import toast from "react-hot-toast";

export default function RegisterPage() {
  const router = useRouter();
  const { setUser } = useAuthStore();
  const [form, setForm] = useState({ name: "", email: "", password: "", orgName: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const update = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await register({
        name: form.name,
        email: form.email,
        password: form.password,
        organization_name: form.orgName || undefined,
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
      <h2 className="text-xl font-semibold text-white mb-6">Create your account</h2>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input id="name" label="Full Name" placeholder="Jane Doe" value={form.name} onChange={update("name")} required />
        <Input id="email" label="Email" type="email" placeholder="jane@company.com" value={form.email} onChange={update("email")} required />
        <Input id="password" label="Password" type="password" placeholder="Min 8 characters" value={form.password} onChange={update("password")} required minLength={8} />
        <Input id="orgName" label="Organization (optional)" placeholder="Acme Corp" value={form.orgName} onChange={update("orgName")} />

        {error && (
          <div className="rounded-lg bg-red-900/30 border border-red-800 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <Button type="submit" loading={loading} className="w-full">
          Create Account
        </Button>
      </form>

      <div className="mt-6 text-center text-sm text-surface-400">
        Already have an account?{" "}
        <Link href="/login" className="text-brand-400 hover:text-brand-300 font-medium">
          Sign in
        </Link>
      </div>
    </>
  );
}
