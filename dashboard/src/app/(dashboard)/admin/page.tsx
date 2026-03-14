"use client";

import Link from "next/link";
import { FileCode2, Shield } from "lucide-react";
import { Card } from "@/components/ui";
import { useAuthStore } from "@/stores/auth-store";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AdminPage() {
  const user = useAuthStore((s) => s.user);
  const router = useRouter();

  useEffect(() => {
    if (user && !user.is_admin) {
      router.push("/");
    }
  }, [user, router]);

  if (!user?.is_admin) {
    return (
      <div className="flex items-center justify-center h-64 text-surface-500">
        <Shield className="h-8 w-8 mr-2" /> Access denied
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Platform Admin</h1>
        <p className="text-sm text-surface-400 mt-1">
          Manage MonkeysCloud platform settings
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link href="/admin/stack-templates">
          <Card hover>
            <FileCode2 className="h-8 w-8 text-brand-400 mb-3" />
            <h3 className="text-base font-semibold text-white">Stack Configs</h3>
            <p className="text-xs text-surface-400 mt-1">
              Manage scaffold configurations for project creation
            </p>
          </Card>
        </Link>
      </div>
    </div>
  );
}
