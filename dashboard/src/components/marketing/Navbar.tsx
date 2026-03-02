"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";

/* ─── Data ─── */
const features = [
  { icon: "🔀", title: "Git & Code Review", desc: "Managed repos, PRs, merge queues", href: "/features/git" },
  { icon: "📋", title: "Task Management", desc: "Kanban boards, sprints, time tracking", href: "/features/tasks" },
  { icon: "🚀", title: "Hosting & Deploy", desc: "Multi-stack deploys, zero-downtime", href: "/features/hosting" },
  { icon: "🤖", title: "AI Workflows", desc: "Code review, build analysis, risk scoring", href: "/features/ai" },
  { icon: "🗄️", title: "Databases", desc: "Managed MySQL, PostgreSQL, Redis", href: "/features/databases" },
  { icon: "📊", title: "Monitoring", desc: "Logs, metrics, alerts, uptime checks", href: "/features/monitoring" },
];

const stacks = {
  PHP: [
    { name: "MonkeysLegion", href: "/stacks/monkeyslegion" },
    { name: "Laravel", href: "/stacks/laravel" },
    { name: "WordPress", href: "/stacks/wordpress" },
    { name: "Drupal", href: "/stacks/drupal" },
  ],
  JavaScript: [
    { name: "Next.js", href: "/stacks/nextjs" },
    { name: "Nuxt.js", href: "/stacks/nuxtjs" },
    { name: "React", href: "/stacks/react" },
    { name: "Vue", href: "/stacks/vue" },
  ],
  Python: [
    { name: "Django", href: "/stacks/django" },
    { name: "FastAPI", href: "/stacks/fastapi" },
    { name: "Flask", href: "/stacks/flask" },
  ],
  Other: [
    { name: "Rails", href: "/stacks/rails" },
    { name: "Go", href: "/stacks/go" },
    { name: "Rust", href: "/stacks/rust" },
    { name: "Static", href: "/stacks/static" },
    { name: "Docker", href: "/stacks/docker" },
  ],
};

/* ─── Component ─── */
export default function Navbar() {
  const [open, setOpen] = useState<"features" | "stacks" | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const navRef = useRef<HTMLElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpen(null);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleEnter = (menu: "features" | "stacks") => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(menu);
  };

  const handleLeave = () => {
    timeoutRef.current = setTimeout(() => setOpen(null), 150);
  };

  const cancelLeave = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  };

  return (
    <nav
      ref={navRef}
      className="sticky top-0 z-50 border-b border-surface-200 bg-white/80 mega-backdrop"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 group">
          <Image
            src="/monkeyscloud.svg"
            alt="MonkeysCloud"
            width={220}
            height={24}
            priority
          />
        </Link>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-1">
          {/* Features dropdown */}
          <div
            className="relative"
            onMouseEnter={() => handleEnter("features")}
            onMouseLeave={handleLeave}
          >
            <button
              className={`flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                open === "features"
                  ? "text-primary-500 bg-primary-50"
                  : "text-surface-600 hover:text-dark hover:bg-surface-50"
              }`}
              onClick={() => setOpen(open === "features" ? null : "features")}
            >
              Features
              <svg className={`w-4 h-4 transition-transform ${open === "features" ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {open === "features" && (
              <div
                className="absolute left-1/2 -translate-x-1/2 top-full pt-2"
                onMouseEnter={cancelLeave}
                onMouseLeave={handleLeave}
              >
                <div className="w-[520px] rounded-xl border border-surface-200 bg-white p-4 shadow-xl animate-mega-open">
                  <div className="grid grid-cols-2 gap-1">
                    {features.map((f) => (
                      <Link
                        key={f.title}
                        href={f.href}
                        className="flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-surface-50"
                        onClick={() => setOpen(null)}
                      >
                        <span className="text-xl mt-0.5">{f.icon}</span>
                        <div>
                          <div className="text-sm font-semibold text-dark">{f.title}</div>
                          <div className="text-xs text-surface-500 mt-0.5">{f.desc}</div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Stacks dropdown */}
          <div
            className="relative"
            onMouseEnter={() => handleEnter("stacks")}
            onMouseLeave={handleLeave}
          >
            <button
              className={`flex items-center gap-1 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                open === "stacks"
                  ? "text-primary-500 bg-primary-50"
                  : "text-surface-600 hover:text-dark hover:bg-surface-50"
              }`}
              onClick={() => setOpen(open === "stacks" ? null : "stacks")}
            >
              Stacks
              <svg className={`w-4 h-4 transition-transform ${open === "stacks" ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {open === "stacks" && (
              <div
                className="absolute left-1/2 -translate-x-1/2 top-full pt-2"
                onMouseEnter={cancelLeave}
                onMouseLeave={handleLeave}
              >
                <div className="w-[560px] rounded-xl border border-surface-200 bg-white p-5 shadow-xl animate-mega-open">
                  <div className="grid grid-cols-4 gap-6">
                    {Object.entries(stacks).map(([category, items]) => (
                      <div key={category}>
                        <div className="text-xs font-bold text-primary-500 uppercase tracking-wider mb-2">
                          {category}
                        </div>
                        <div className="space-y-1">
                          {items.map((s) => (
                            <Link
                              key={s.name}
                              href={s.href}
                              className="block text-sm text-surface-600 hover:text-primary-500 hover:translate-x-0.5 transition-all py-1"
                              onClick={() => setOpen(null)}
                            >
                              {s.name}
                            </Link>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <Link href="/pricing" className="px-3 py-2 text-sm font-medium text-surface-600 hover:text-dark hover:bg-surface-50 rounded-lg transition-colors">
            Pricing
          </Link>
          <Link href="/docs" className="px-3 py-2 text-sm font-medium text-surface-600 hover:text-dark hover:bg-surface-50 rounded-lg transition-colors">
            Docs
          </Link>
        </div>

        {/* Desktop CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-medium text-surface-600 hover:text-dark transition-colors px-3 py-2"
          >
            Login
          </Link>
          <Link
            href="/register"
            className="inline-flex items-center px-4 py-2 text-sm font-semibold text-white bg-accent-500 hover:bg-accent-600 rounded-lg shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5"
          >
            Get Started
            <svg className="ml-1.5 w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden p-2 text-surface-600 hover:text-dark rounded-lg"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          ) : (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          )}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-surface-200 bg-white animate-slide-down">
          <div className="px-4 py-4 space-y-2">
            {/* Features accordion */}
            <MobileAccordion title="Features">
              {features.map((f) => (
                <Link key={f.title} href={f.href} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-surface-50" onClick={() => setMobileOpen(false)}>
                  <span>{f.icon}</span>
                  <span className="text-sm text-surface-700">{f.title}</span>
                </Link>
              ))}
            </MobileAccordion>

            {/* Stacks accordion */}
            <MobileAccordion title="Stacks">
              {Object.entries(stacks).map(([category, items]) => (
                <div key={category} className="py-2">
                  <div className="text-xs font-bold text-primary-500 uppercase tracking-wider px-2 mb-1">{category}</div>
                  {items.map((s) => (
                    <Link key={s.name} href={s.href} className="block text-sm text-surface-600 py-1.5 px-2 hover:bg-surface-50 rounded" onClick={() => setMobileOpen(false)}>
                      {s.name}
                    </Link>
                  ))}
                </div>
              ))}
            </MobileAccordion>

            <Link href="/pricing" className="block py-2 px-2 text-sm font-medium text-surface-700 hover:bg-surface-50 rounded-lg" onClick={() => setMobileOpen(false)}>Pricing</Link>
            <Link href="/docs" className="block py-2 px-2 text-sm font-medium text-surface-700 hover:bg-surface-50 rounded-lg" onClick={() => setMobileOpen(false)}>Docs</Link>

            <div className="pt-3 border-t border-surface-200 space-y-2">
              <Link href="/login" className="block w-full text-center py-2.5 text-sm font-medium text-surface-700 border border-surface-300 rounded-lg hover:bg-surface-50" onClick={() => setMobileOpen(false)}>
                Login
              </Link>
              <Link href="/register" className="block w-full text-center py-2.5 text-sm font-semibold text-white bg-accent-500 rounded-lg hover:bg-accent-600" onClick={() => setMobileOpen(false)}>
                Get Started
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}

/* ─── Mobile Accordion ─── */
function MobileAccordion({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        className="flex w-full items-center justify-between py-2 px-2 text-sm font-medium text-surface-700 hover:bg-surface-50 rounded-lg"
        onClick={() => setOpen(!open)}
      >
        {title}
        <svg className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open && <div className="pl-2 pb-2">{children}</div>}
    </div>
  );
}
