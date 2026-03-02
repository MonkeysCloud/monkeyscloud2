import { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-950 px-4">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-8 animate-fade-in">
          <img
            src="/monkeyscloud.svg"
            alt="MonkeysCloud"
            width={280}
            height={30}
            className="mx-auto brightness-0 invert"
          />
          <p className="mt-4 text-sm text-surface-400">
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
