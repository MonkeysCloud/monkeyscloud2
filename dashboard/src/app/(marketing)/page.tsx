import Link from "next/link";

/* ─── Data ─── */
const stacks = [
  { name: "MonkeysLegion", runtime: "PHP 8.4 / FrankenPHP", time: "~45s", color: "from-violet-500 to-purple-600" },
  { name: "Laravel", runtime: "PHP 8.4 / FrankenPHP", time: "~60s", color: "from-red-500 to-rose-600" },
  { name: "WordPress", runtime: "PHP 8.4 / PHP-FPM + Nginx", time: "~50s", color: "from-blue-500 to-cyan-600" },
  { name: "Next.js", runtime: "Node 22", time: "~40s", color: "from-gray-700 to-gray-900" },
  { name: "Django", runtime: "Python 3.13 / Gunicorn", time: "~55s", color: "from-green-600 to-emerald-700" },
  { name: "Go", runtime: "Compiled binary", time: "~30s", color: "from-cyan-500 to-blue-600" },
];

const aiFeatures = [
  { icon: "🔍", title: "AI Code Review", desc: "Every PR gets an automated review: bugs, security, performance. Inline comments posted directly." },
  { icon: "✨", title: "Smart Task Creation", desc: "Describe what you need in plain English. AI structures it into a task with title, labels, and estimates." },
  { icon: "🛡️", title: "Deploy Risk Score", desc: "Before production deploys, AI assesses risk from diff size, test coverage, and historical patterns." },
  { icon: "🔧", title: "Build Failure Analysis", desc: "When builds fail, AI reads the logs and explains the root cause with a suggested fix." },
  { icon: "📊", title: "Sprint Planning", desc: "AI analyzes your backlog, velocity, and dependencies to suggest optimal sprint composition." },
  { icon: "💬", title: "MonkeysAI Chat", desc: '"What broke in the last deploy?" "Create a task for the auth bug." Natural language for everything.' },
];

const steps = [
  { num: "01", title: "Create Project", desc: "Select your stack or let us auto-detect from your repo. Connect GitHub or use our built-in Git.", icon: "📦" },
  { num: "02", title: "Write Code & Track Work", desc: "Create tasks on your board. Link branches and PRs automatically. AI reviews every change.", icon: "✍️" },
  { num: "03", title: "Push & Build", desc: "Every push triggers a build. Preview environments spin up for PRs. AI assesses deployment risk.", icon: "⚡" },
  { num: "04", title: "Deploy & Monitor", desc: "Rolling, blue/green, or canary deploys. Real-time monitoring. AI alerts if something goes wrong.", icon: "🚀" },
];

const comparison = [
  { before: "GitHub for code + Jira for tasks + Vercel for deploy + Datadog for monitoring", after: "One platform, one dashboard, one bill" },
  { before: "Context-switching between 4+ tabs", after: "Everything on one screen" },
  { before: "Manually linking PRs to tickets", after: "Auto-linked: task → branch → PR → deploy" },
  { before: "Separate billing for each tool ($50-200+/tool/mo)", after: "Starting at $0/mo, all included" },
  { before: "No AI unless you build it yourself", after: "AI in every workflow, out of the box" },
  { before: "Different permission models per tool", after: "One team, one role, everywhere" },
];

const plans = [
  { name: "Starter", price: "Free", period: "", features: ["1 project", "1 team member", "100 builds/month", "Built-in Git, tasks, auto-deploy", "Community support"], cta: "Get Started", accent: false },
  { name: "Developer", price: "$29", period: "/mo", features: ["5 projects", "5 team members", "500 builds/month", "Custom domains, SSL, CDN", "AI features included", "Preview environments"], cta: "Start Free Trial", accent: true },
  { name: "Team", price: "$79", period: "/mo", features: ["20 projects", "15 team members", "Unlimited builds", "All features", "Priority support", "SSO (add-on)"], cta: "Start Free Trial", accent: false },
  { name: "Enterprise", price: "Custom", period: "", features: ["Unlimited everything", "Dedicated support", "SSO / SAML", "SLA guarantee", "CMEK encryption"], cta: "Contact Sales", accent: false },
];

const testimonials = [
  { quote: "We replaced GitHub + Linear + Vercel with one platform. Our deploy time went from 5 minutes of context-switching to one click.", name: "Alex Rivera", role: "CTO at LaunchStack" },
  { quote: "The AI code review catches things we miss. It's like having a senior dev reviewing every PR automatically.", name: "Sarah Chen", role: "Lead Engineer at DevForge" },
  { quote: "Managing 12 client sites from one dashboard changed our agency workflow completely.", name: "Marcus Thompson", role: "Agency Owner at PixelCraft" },
];

/* ─── Page ─── */
export default function HomePage() {
  return (
    <>
      {/* ═══════════════════════════════════════════════════════════════════
          HERO
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-accent-50/30" />
        {/* Decorative blobs */}
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary-200/30 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-10 right-20 w-96 h-96 bg-accent-200/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />

        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-24 lg:py-32">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary-50 border border-primary-200 text-primary-600 text-sm font-medium mb-6">
              <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75" /><span className="relative inline-flex rounded-full h-2 w-2 bg-primary-500" /></span>
              Now with AI-powered code review &amp; deploy risk assessment
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-dark tracking-tight leading-[1.1] font-heading">
              Ship code, manage tasks,
              <br />
              deploy anywhere —{" "}
              <span className="bg-gradient-to-r from-primary-500 to-accent-500 bg-clip-text text-transparent">
                one platform
              </span>
            </h1>
            <p className="mt-6 text-lg sm:text-xl text-surface-500 max-w-2xl mx-auto leading-relaxed">
              MonkeysCloud unifies Git hosting, agile task management, and multi-stack hosting
              with AI-powered workflows. Push code, track work, and deploy to production —
              all from a single dashboard.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                href="/register"
                className="inline-flex items-center px-8 py-3.5 text-base font-semibold text-white bg-accent-500 hover:bg-accent-600 rounded-xl shadow-lg shadow-accent-500/25 hover:shadow-xl hover:shadow-accent-500/30 transition-all hover:-translate-y-0.5"
              >
                Get Started Free
                <svg className="ml-2 w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
              </Link>
              <button className="inline-flex items-center px-8 py-3.5 text-base font-semibold text-dark border-2 border-surface-200 hover:border-surface-300 rounded-xl transition-all hover:bg-surface-50 gap-2">
                <svg className="w-5 h-5 text-accent-500" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                Watch Demo (2 min)
              </button>
            </div>
          </div>

          {/* ── Hero Visual: Simulated Dashboard ── */}
          <div className="mt-16 mx-auto max-w-5xl">
            <div className="rounded-2xl border border-surface-200 bg-white shadow-2xl shadow-surface-200/50 overflow-hidden">
              {/* Title bar */}
              <div className="flex items-center gap-2 px-4 py-3 bg-surface-50 border-b border-surface-200">
                <div className="flex gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-400" />
                  <div className="w-3 h-3 rounded-full bg-yellow-400" />
                  <div className="w-3 h-3 rounded-full bg-green-400" />
                </div>
                <div className="flex-1 text-center text-xs text-surface-400 font-mono">monkeys.cloud/dashboard</div>
              </div>
              {/* Three panels */}
              <div className="grid grid-cols-3 divide-x divide-surface-200 min-h-[280px]">
                {/* Code panel */}
                <div className="p-4 bg-[#1e1e2e] text-xs font-mono space-y-1.5">
                  <div className="text-surface-500 text-[10px] uppercase tracking-wider mb-2 font-sans">Code Editor</div>
                  <div><span className="text-purple-400">class</span> <span className="text-yellow-300">UserController</span> <span className="text-surface-400">{"{"}</span></div>
                  <div className="pl-4"><span className="text-purple-400">public function</span> <span className="text-blue-300">store</span><span className="text-surface-400">(</span><span className="text-yellow-300">Request</span> <span className="text-orange-300">$req</span><span className="text-surface-400">)</span></div>
                  <div className="pl-4"><span className="text-surface-400">{"{"}</span></div>
                  <div className="pl-8"><span className="text-blue-300">$user</span> <span className="text-surface-400">=</span> <span className="text-yellow-300">User</span><span className="text-surface-400">::</span><span className="text-blue-300">create</span><span className="text-surface-400">(</span></div>
                  <div className="pl-12"><span className="text-orange-300">$req</span><span className="text-surface-400">-&gt;</span><span className="text-blue-300">validated</span><span className="text-surface-400">()</span></div>
                  <div className="pl-8"><span className="text-surface-400">);</span></div>
                  <div className="pl-8"><span className="text-purple-400">return</span> <span className="text-blue-300">$user</span><span className="text-surface-400">;</span></div>
                  <div className="pl-4"><span className="text-surface-400">{"}"}</span></div>
                  <div><span className="text-surface-400">{"}"}</span></div>
                  <div className="mt-3 px-2 py-1.5 rounded bg-green-500/10 border border-green-500/20 text-green-400 text-[10px]">
                    ✓ AI Review: LGTM — no issues found
                  </div>
                </div>
                {/* Task panel */}
                <div className="p-4 bg-white space-y-2">
                  <div className="text-surface-500 text-[10px] uppercase tracking-wider mb-2">Task Board</div>
                  {[
                    { label: "Auth API endpoints", tag: "In Progress", color: "bg-blue-100 text-blue-700" },
                    { label: "User profile page", tag: "In Review", color: "bg-purple-100 text-purple-700" },
                    { label: "Payment webhook", tag: "To Do", color: "bg-surface-100 text-surface-600" },
                    { label: "Email templates", tag: "Done", color: "bg-green-100 text-green-700" },
                  ].map((t) => (
                    <div key={t.label} className="flex items-center justify-between p-2.5 rounded-lg border border-surface-200 hover:border-primary-200 transition-colors">
                      <span className="text-xs text-dark font-medium">{t.label}</span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${t.color}`}>{t.tag}</span>
                    </div>
                  ))}
                  <div className="mt-2 text-[10px] text-surface-400 flex items-center gap-1">
                    <span className="text-primary-500">↗</span> 3 tasks linked to PR #42
                  </div>
                </div>
                {/* Deploy panel */}
                <div className="p-4 bg-[#0f172a] text-xs font-mono space-y-1.5">
                  <div className="text-surface-500 text-[10px] uppercase tracking-wider mb-2 font-sans">Deploy Terminal</div>
                  <div className="text-green-400">$ mc deploy production</div>
                  <div className="text-surface-400">→ Building image...</div>
                  <div className="text-surface-400">→ Running tests... <span className="text-green-400">✓ 48/48 passed</span></div>
                  <div className="text-surface-400">→ AI risk score: <span className="text-green-400">LOW (0.12)</span></div>
                  <div className="text-surface-400">→ Rolling deploy... <span className="text-yellow-400">3/3 pods</span></div>
                  <div className="text-surface-400">→ Health checks... <span className="text-green-400">✓ all passing</span></div>
                  <div className="mt-2 text-green-400 font-bold">✓ Deployed to production in 42s</div>
                  <div className="text-surface-500 mt-1">  https://myapp.monkeys.cloud</div>
                </div>
              </div>
              {/* Flow arrows */}
              <div className="flex items-center justify-center gap-4 py-3 bg-surface-50 border-t border-surface-200 text-xs text-surface-400">
                <span className="font-medium text-dark">Code</span>
                <svg className="w-4 h-4 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                <span className="font-medium text-dark">Tasks</span>
                <svg className="w-4 h-4 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                <span className="font-medium text-dark">Deploy</span>
                <span className="text-surface-300 mx-2">—</span>
                <span className="text-primary-500 font-medium">All connected. Zero context-switching.</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Social Proof Bar ── */}
      <section className="border-y border-surface-200 bg-surface-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-center text-sm text-surface-400 font-medium uppercase tracking-wider">
            Trusted by developers shipping to production
          </p>
          <div className="mt-4 flex items-center justify-center gap-8 opacity-40">
            {["LaunchStack", "DevForge", "PixelCraft", "CodeShip", "NightOwl"].map((name) => (
              <div key={name} className="text-sm font-bold text-surface-600 tracking-wider">{name}</div>
            ))}
          </div>
          <p className="mt-3 text-center text-xs text-surface-400">Join 500+ developers in early access</p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 1: THREE PILLARS
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-dark font-heading">
              Everything your team needs. Nothing it doesn&apos;t.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                icon: "🔀", title: "Built-in Git hosting",
                desc: "Host repos, create pull requests, run AI code reviews, enforce branch protection — all without leaving the platform. Or connect GitHub, GitLab, or Bitbucket.",
                link: "/features/git", linkText: "Explore Git features →",
              },
              {
                icon: "📋", title: "Agile task management",
                desc: "Kanban and Scrum boards linked to your code. Tasks auto-link to branches, PRs, and deployments. Full traceability from idea to production.",
                link: "/features/tasks", linkText: "Explore task management →",
              },
              {
                icon: "🚀", title: "Multi-stack auto-deploy",
                desc: "Push code, we build and deploy. PHP, Node.js, Python, Go, Rust — 15+ stacks with zero config. Preview environments for every PR.",
                link: "/features/hosting", linkText: "Explore hosting →",
              },
            ].map((pillar) => (
              <div key={pillar.title} className="group relative p-8 rounded-2xl border border-surface-200 hover:border-primary-200 hover:shadow-xl hover:shadow-primary-500/5 transition-all bg-white">
                <span className="text-4xl">{pillar.icon}</span>
                <h3 className="mt-5 text-xl font-bold text-dark font-heading">{pillar.title}</h3>
                <p className="mt-3 text-sm text-surface-500 leading-relaxed">{pillar.desc}</p>
                <Link href={pillar.link} className="inline-block mt-5 text-sm font-semibold text-primary-500 hover:text-primary-600 transition-colors group-hover:translate-x-1 transform">
                  {pillar.linkText}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 2: STACK SHOWCASE
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-24 bg-surface-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-dark font-heading">
              Deploy anything. We handle the infrastructure.
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {stacks.map((s) => (
              <div key={s.name} className="group relative overflow-hidden rounded-xl border border-surface-200 bg-white p-6 hover:shadow-lg transition-all hover:-translate-y-0.5">
                <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${s.color}`} />
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-bold text-dark">{s.name}</h3>
                  <span className="text-xs font-mono font-bold text-primary-500 bg-primary-50 px-2.5 py-1 rounded-full">{s.time}</span>
                </div>
                <p className="mt-2 text-sm text-surface-500">{s.runtime}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <span className="text-sm text-surface-400 mr-3">+ 9 more stacks supported</span>
            <Link href="/stacks" className="text-sm font-semibold text-primary-500 hover:text-primary-600 transition-colors">
              See all supported stacks →
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 3: AI-POWERED WORKFLOWS
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-dark font-heading">
              AI that actually helps you ship.
            </h2>
            <p className="mt-4 text-lg text-surface-500">
              MonkeysAI is embedded in every workflow — not bolted on.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {aiFeatures.map((f) => (
              <div key={f.title} className="group p-6 rounded-xl border border-surface-200 bg-white hover:border-primary-200 hover:shadow-lg hover:shadow-primary-500/5 transition-all">
                <span className="text-3xl">{f.icon}</span>
                <h3 className="mt-4 text-lg font-bold text-dark font-heading">{f.title}</h3>
                <p className="mt-2 text-sm text-surface-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link href="/features/ai" className="text-sm font-semibold text-primary-500 hover:text-primary-600 transition-colors">
              See all AI features →
            </Link>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 4: HOW IT WORKS
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-24 bg-surface-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-dark font-heading">
              From idea to production in minutes.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {steps.map((step, i) => (
              <div key={step.num} className="relative">
                {i < 3 && (
                  <div className="hidden md:block absolute top-12 -right-3 z-10">
                    <svg className="w-6 h-6 text-primary-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                  </div>
                )}
                <div className="text-center p-6 rounded-2xl border border-surface-200 bg-white hover:shadow-lg transition-all h-full">
                  <span className="text-4xl">{step.icon}</span>
                  <div className="mt-3 inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary-50 text-primary-600 text-xs font-bold">{step.num}</div>
                  <h3 className="mt-3 text-base font-bold text-dark font-heading">{step.title}</h3>
                  <p className="mt-2 text-sm text-surface-500 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 5: COMPARISON TABLE
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-dark font-heading">
              Stop duct-taping your workflow.
            </h2>
          </div>
          <div className="max-w-4xl mx-auto rounded-2xl border border-surface-200 overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-2 bg-surface-50 border-b border-surface-200">
              <div className="px-6 py-4 text-sm font-bold text-surface-500 uppercase tracking-wider">What you do today</div>
              <div className="px-6 py-4 text-sm font-bold text-primary-600 uppercase tracking-wider border-l border-surface-200">With MonkeysCloud</div>
            </div>
            {/* Rows */}
            {comparison.map((row, i) => (
              <div key={i} className={`grid grid-cols-2 ${i < comparison.length - 1 ? "border-b border-surface-200" : ""}`}>
                <div className="px-6 py-4 text-sm text-surface-500">{row.before}</div>
                <div className="px-6 py-4 text-sm text-dark font-medium border-l border-surface-200 bg-primary-50/30">
                  <span className="text-primary-500 mr-1.5">✓</span>{row.after}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 6: PRICING
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-24 bg-surface-50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-dark font-heading">
              Transparent pricing. No surprises.
            </h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-2xl p-6 transition-all hover:-translate-y-1 hover:shadow-xl ${
                  plan.accent
                    ? "bg-dark text-white border-2 border-primary-500 shadow-lg shadow-primary-500/20"
                    : "bg-white border border-surface-200"
                }`}
              >
                {plan.accent && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 text-xs font-bold text-white bg-primary-500 rounded-full">
                    Most Popular
                  </div>
                )}
                <h3 className={`text-lg font-bold font-heading ${plan.accent ? "text-white" : "text-dark"}`}>{plan.name}</h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className={`text-3xl font-extrabold ${plan.accent ? "text-white" : "text-dark"}`}>{plan.price}</span>
                  {plan.period && <span className={`text-sm ${plan.accent ? "text-surface-300" : "text-surface-500"}`}>{plan.period}</span>}
                </div>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className={`flex items-start gap-2 text-sm ${plan.accent ? "text-surface-300" : "text-surface-500"}`}>
                      <span className={`mt-0.5 ${plan.accent ? "text-primary-400" : "text-primary-500"}`}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href={plan.name === "Enterprise" ? "/contact" : "/register"}
                  className={`mt-8 block w-full text-center py-2.5 text-sm font-semibold rounded-lg transition-all ${
                    plan.accent
                      ? "bg-accent-500 hover:bg-accent-600 text-white shadow-lg shadow-accent-500/25"
                      : "border border-surface-300 text-dark hover:bg-surface-50"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
          <p className="mt-8 text-center text-sm text-surface-400">
            All plans include: Git hosting, task management, auto-deploy, SSL, monitoring.{" "}
            <Link href="/pricing" className="text-primary-500 font-medium hover:text-primary-600">See full comparison →</Link>
          </p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 7: TESTIMONIALS
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-dark font-heading">
              Developers love shipping with MonkeysCloud.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t) => (
              <div key={t.name} className="p-8 rounded-2xl border border-surface-200 bg-white hover:shadow-lg transition-all">
                <div className="flex gap-1 mb-4 text-yellow-400">
                  {[...Array(5)].map((_, i) => (
                    <svg key={i} className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                  ))}
                </div>
                <p className="text-sm text-surface-600 leading-relaxed italic">&ldquo;{t.quote}&rdquo;</p>
                <div className="mt-6 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-sm font-bold">
                    {t.name[0]}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-dark">{t.name}</div>
                    <div className="text-xs text-surface-500">{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SECTION 8: CTA FOOTER
      ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-dark" />
        {/* Code pattern overlay */}
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />
        <div className="relative mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white font-heading">
            Start shipping faster today.
          </h2>
          <p className="mt-4 text-lg text-surface-400 max-w-xl mx-auto">
            Free tier available. No credit card required. Deploy your first project in 60 seconds.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/register"
              className="inline-flex items-center px-8 py-3.5 text-base font-semibold text-white bg-accent-500 hover:bg-accent-600 rounded-xl shadow-lg shadow-accent-500/25 transition-all hover:-translate-y-0.5"
            >
              Get Started Free
              <svg className="ml-2 w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center px-8 py-3.5 text-base font-semibold text-white border-2 border-white/20 hover:border-white/40 rounded-xl transition-all hover:bg-white/5"
            >
              Schedule a Demo
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
