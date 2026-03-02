import Link from "next/link";

export default function HomePage() {
  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-accent-50/30" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24 lg:py-36">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-50 border border-primary-200 text-primary-600 text-sm font-medium mb-6">
              <span>🚀</span> Now with AI-powered code review & deploy risk assessment
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-dark tracking-tight leading-tight font-heading">
              Ship faster with
              <span className="text-primary-500"> one platform</span>
              <br />
              for your entire stack
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-surface-500 max-w-2xl mx-auto leading-relaxed">
              Git hosting, task management, multi-stack hosting & auto-deploy,
              AI-powered workflows — all from one dashboard with zero vendor lock-in.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="inline-flex items-center px-8 py-3.5 text-base font-semibold text-white bg-accent-500 hover:bg-accent-600 rounded-lg shadow-lg shadow-accent-500/25 hover:shadow-xl hover:shadow-accent-500/30 transition-all hover:-translate-y-0.5"
              >
                Get Started — Free
                <svg className="ml-2 w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <Link
                href="/docs"
                className="inline-flex items-center px-8 py-3.5 text-base font-semibold text-dark border-2 border-surface-200 hover:border-surface-300 rounded-lg transition-all hover:bg-surface-50"
              >
                Read the Docs
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Trusted by */}
      <section className="border-y border-surface-200 bg-surface-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-center text-sm text-surface-400 font-medium uppercase tracking-wider">
            Trusted by teams shipping production code
          </p>
        </div>
      </section>

      {/* Features grid */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-dark font-heading">
              Everything you need to ship
            </h2>
            <p className="mt-4 text-lg text-surface-500 max-w-2xl mx-auto">
              Stop juggling five different tools. MonkeysCloud brings your entire workflow under one roof.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              { icon: "🔀", title: "Git & Code Review", desc: "Managed repos with pull requests, code review, merge queues, and AI-powered suggestions." },
              { icon: "📋", title: "Task Management", desc: "Kanban boards, sprints, time tracking, and automated workflows linked to your code." },
              { icon: "🚀", title: "Hosting & Deploy", desc: "Auto-deploy 16+ stacks with zero-downtime rolling, blue-green, and canary strategies." },
              { icon: "🤖", title: "AI Workflows", desc: "AI code review, PR summaries, build failure analysis, and deploy risk assessment." },
              { icon: "🗄️", title: "Databases", desc: "Managed MySQL, PostgreSQL, and Redis with automated backups and scaling." },
              { icon: "📊", title: "Monitoring", desc: "Real-time logs, metrics, alerting, and uptime checks for all your services." },
            ].map((f) => (
              <div key={f.title} className="group p-6 rounded-xl border border-surface-200 hover:border-primary-200 hover:shadow-lg hover:shadow-primary-500/5 transition-all">
                <span className="text-3xl">{f.icon}</span>
                <h3 className="mt-4 text-lg font-bold text-dark font-heading">{f.title}</h3>
                <p className="mt-2 text-sm text-surface-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-dark">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white font-heading">
            Ready to simplify your dev workflow?
          </h2>
          <p className="mt-4 text-lg text-surface-400 max-w-xl mx-auto">
            Start free, no credit card required. Deploy your first project in under 5 minutes.
          </p>
          <div className="mt-10">
            <Link
              href="/register"
              className="inline-flex items-center px-8 py-3.5 text-base font-semibold text-white bg-accent-500 hover:bg-accent-600 rounded-lg shadow-lg shadow-accent-500/25 transition-all hover:-translate-y-0.5"
            >
              Get Started — Free
              <svg className="ml-2 w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
