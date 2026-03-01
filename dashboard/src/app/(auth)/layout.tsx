import { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-950 px-4">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8 animate-fade-in">
          <span className="text-5xl">🐒</span>
          <h1 className="mt-4 text-3xl font-bold bg-gradient-to-r from-brand-400 to-brand-600 bg-clip-text text-transparent">
            MonkeysCloud
          </h1>
          <p className="mt-2 text-sm text-surface-400">
            Git • Tasks • Hosting • AutoDeploy
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-surface-700 bg-surface-800/60 backdrop-blur-sm p-8 shadow-xl animate-slide-up">
          {children}
        </div>
      </div>
    </div>
  );
}
