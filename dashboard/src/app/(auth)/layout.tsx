import { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex bg-surface-950">
      {/* Left — Gradient hero panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary-600 via-dark-800 to-surface-900" />

        {/* Animated mesh pattern overlay */}
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `radial-gradient(circle at 25% 25%, rgba(255,255,255,0.15) 1px, transparent 1px),
                              radial-gradient(circle at 75% 75%, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
          }}
        />

        {/* Floating shapes */}
        <div className="absolute top-20 left-20 w-72 h-72 bg-primary-400/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-32 right-16 w-96 h-96 bg-cyan-400/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "2s" }} />
        <div className="absolute top-1/2 left-1/3 w-48 h-48 bg-accent-400/15 rounded-full blur-2xl animate-pulse" style={{ animationDelay: "4s" }} />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo + tagline */}
          <div>
            <img
              src="/monkeyscloud-white.svg"
              alt="MonkeysCloud"
              width={300}
              height={30}
            />
            <p className="mt-3 text-sm text-white/60 tracking-wide">
              Git • Tasks • Hosting • AutoDeploy
            </p>
          </div>

          {/* Feature highlights */}
          <div className="space-y-6">
            <FeatureItem
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 7.5l3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0021 18V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12a2.25 2.25 0 002.25 2.25z" />
                </svg>
              }
              title="Git Repositories & CI/CD"
              description="Push, branch, and deploy with built-in pipelines"
            />
            <FeatureItem
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15a2.25 2.25 0 012.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
                </svg>
              }
              title="Task Management"
              description="Kanban boards, sprints, and time tracking in one place"
            />
            <FeatureItem
              icon={
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
                </svg>
              }
              title="Cloud Hosting & Auto-Deploy"
              description="Zero-config deploys with SSL, domains, and scaling"
            />
          </div>

          {/* Social proof / trust */}
          <div className="text-white/40 text-xs">
            <p>Trusted by developers worldwide 🚀</p>
          </div>
        </div>
      </div>

      {/* Right — Auth form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 lg:px-16">
        <div className="w-full max-w-[420px]">
          {/* Mobile logo (hidden on desktop) */}
          <div className="lg:hidden text-center mb-10 animate-fade-in">
            <img
              src="/monkeyscloud-white.svg"
              alt="MonkeysCloud"
              width={300}
              height={30}
            />
            <p className="mt-3 text-sm text-surface-400">
              Git • Tasks • Hosting • AutoDeploy
            </p>
          </div>

          {/* Form card */}
          <div className="animate-slide-up">{children}</div>
        </div>
      </div>
    </div>
  );
}

function FeatureItem({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-4 group">
      <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center text-white group-hover:bg-white/20 transition-colors">
        {icon}
      </div>
      <div>
        <h3 className="text-white font-medium text-sm">{title}</h3>
        <p className="text-white/50 text-xs mt-0.5">{description}</p>
      </div>
    </div>
  );
}
