"use client";

import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { useRouter, useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { ImageUpload } from "@/components/ui/ImageUpload";
import {
  FolderPlus,
  ArrowRight,
  Loader2,
  Package,
  AlertCircle,
  Globe,
  CheckCircle2,
  XCircle,
  ChevronDown,
  Github,
  GitBranch,
  Terminal,
  Zap,
  Banana,
  Triangle,
  PenLine,
  Droplets,
  Hexagon,
  Leaf,
  Atom,
  Component,
  Compass,
  Bolt,
  FlaskConical,
  Gem,
  Circle,
  Cog,
  FileCode,
  Container,
  Flame,
  Sparkles,
  BarChart3,
  Coffee,
  Layers,
  Search,
} from "lucide-react";
import clsx from "clsx";

/* ─── Stack Definitions (32 stacks, 10 categories) ─── */

const CATEGORIES = [
  { id: "all", label: "All" },
  { id: "PHP", label: "PHP" },
  { id: "JS/TS", label: "JS / TS" },
  { id: "Python", label: "Python" },
  { id: "Ruby", label: "Ruby" },
  { id: "Go", label: "Go" },
  { id: "Rust", label: "Rust" },
  { id: "Java", label: "Java" },
  { id: ".NET", label: ".NET" },
  { id: "Elixir", label: "Elixir" },
  { id: "Other", label: "Static / Docker" },
] as const;

const STACKS: { id: string; label: string; icon: ReactNode; category: string }[] = [
  // PHP
  { id: "monkeyslegion", label: "MonkeysLegion", icon: <Banana className="h-5 w-5" />, category: "PHP" },
  { id: "laravel", label: "Laravel", icon: <Triangle className="h-5 w-5" />, category: "PHP" },
  { id: "symfony", label: "Symfony", icon: <Hexagon className="h-5 w-5" />, category: "PHP" },
  { id: "wordpress", label: "WordPress", icon: <PenLine className="h-5 w-5" />, category: "PHP" },
  { id: "drupal", label: "Drupal", icon: <Droplets className="h-5 w-5" />, category: "PHP" },
  { id: "php-generic", label: "PHP Generic", icon: <FileCode className="h-5 w-5" />, category: "PHP" },
  // JS / TS
  { id: "nextjs", label: "Next.js", icon: <Hexagon className="h-5 w-5" />, category: "JS/TS" },
  { id: "nuxtjs", label: "Nuxt.js", icon: <Leaf className="h-5 w-5" />, category: "JS/TS" },
  { id: "remix", label: "Remix", icon: <Zap className="h-5 w-5" />, category: "JS/TS" },
  { id: "sveltekit", label: "SvelteKit", icon: <Flame className="h-5 w-5" />, category: "JS/TS" },
  { id: "astro", label: "Astro", icon: <Sparkles className="h-5 w-5" />, category: "JS/TS" },
  { id: "express", label: "Express", icon: <Terminal className="h-5 w-5" />, category: "JS/TS" },
  { id: "nestjs", label: "NestJS", icon: <Component className="h-5 w-5" />, category: "JS/TS" },
  { id: "react", label: "React SPA", icon: <Atom className="h-5 w-5" />, category: "JS/TS" },
  { id: "vue", label: "Vue.js SPA", icon: <Component className="h-5 w-5" />, category: "JS/TS" },
  { id: "angular", label: "Angular", icon: <Triangle className="h-5 w-5" />, category: "JS/TS" },
  // Python
  { id: "django", label: "Django", icon: <Compass className="h-5 w-5" />, category: "Python" },
  { id: "fastapi", label: "FastAPI", icon: <Bolt className="h-5 w-5" />, category: "Python" },
  { id: "flask", label: "Flask", icon: <FlaskConical className="h-5 w-5" />, category: "Python" },
  { id: "streamlit", label: "Streamlit", icon: <BarChart3 className="h-5 w-5" />, category: "Python" },
  { id: "python-generic", label: "Python Generic", icon: <FileCode className="h-5 w-5" />, category: "Python" },
  // Ruby
  { id: "rails", label: "Rails", icon: <Gem className="h-5 w-5" />, category: "Ruby" },
  { id: "ruby-generic", label: "Ruby Generic", icon: <Gem className="h-5 w-5" />, category: "Ruby" },
  // Go
  { id: "go", label: "Go", icon: <Circle className="h-5 w-5" />, category: "Go" },
  // Rust
  { id: "rust", label: "Rust", icon: <Cog className="h-5 w-5" />, category: "Rust" },
  // Java
  { id: "spring-boot", label: "Spring Boot", icon: <Leaf className="h-5 w-5" />, category: "Java" },
  { id: "java-generic", label: "Java Generic", icon: <Coffee className="h-5 w-5" />, category: "Java" },
  // .NET
  { id: "dotnet", label: ".NET", icon: <Layers className="h-5 w-5" />, category: ".NET" },
  // Elixir
  { id: "phoenix", label: "Phoenix", icon: <Flame className="h-5 w-5" />, category: "Elixir" },
  // Static & Docker
  { id: "static", label: "Static Site", icon: <FileCode className="h-5 w-5" />, category: "Other" },
  { id: "docker", label: "Docker", icon: <Container className="h-5 w-5" />, category: "Other" },
  { id: "docker-compose", label: "Docker Compose", icon: <Container className="h-5 w-5" />, category: "Other" },
];

const REPO_SOURCES = [
  { id: "internal", label: "Internal Git", icon: <GitBranch className="h-4 w-4" />, desc: "Hosted on MonkeysCloud" },
  { id: "github", label: "GitHub", icon: <Github className="h-4 w-4" />, desc: "Connect your GitHub repo" },
  { id: "gitlab", label: "GitLab", icon: <GitBranch className="h-4 w-4" />, desc: "Connect your GitLab repo" },
  { id: "bitbucket", label: "Bitbucket", icon: <GitBranch className="h-4 w-4" />, desc: "Connect your Bitbucket repo" },
] as const;

/* ─── Stack → default config ─── */

function getStackDefaults(stack: string) {
  const php = (v = "8.4") => ({ install: "composer install", build: "", start: "", version: "php", phpVersion: v });
  const node = (v = "22", out = "dist") => ({ install: "npm install", build: "npm run build", start: "npm start", version: "node", nodeVersion: v, output: out });
  const python = (v = "3.13") => ({ install: "pip install -r requirements.txt", build: "", start: "", version: "python", pythonVersion: v });

  switch (stack) {
    case "monkeyslegion": return { ...php(), start: "php franken-worker.php" };
    case "laravel": return { ...php(), start: "php artisan serve" };
    case "symfony": return { ...php(), start: "symfony server:start" };
    case "wordpress": case "drupal": return php();
    case "php-generic": return { ...php(), start: "php -S 0.0.0.0:8080" };
    case "nextjs": return { ...node("22", ".next") };
    case "nuxtjs": return { ...node("22", ".output") };
    case "remix": return { ...node("22", "build") };
    case "sveltekit": return { ...node("22", "build") };
    case "astro": return { ...node("22", "dist"), start: "" };
    case "express": return { ...node("22"), build: "", start: "node index.js", output: "" };
    case "nestjs": return { ...node("22", "dist"), start: "node dist/main.js" };
    case "react": case "vue": case "angular": return { ...node("22"), start: "", output: "dist" };
    case "django": return { ...python(), start: "gunicorn config.wsgi" };
    case "fastapi": return { ...python(), start: "uvicorn main:app" };
    case "flask": return { ...python(), start: "gunicorn app:app" };
    case "streamlit": return { ...python(), start: "streamlit run app.py" };
    case "python-generic": return { ...python(), start: "python main.py" };
    case "rails": return { install: "bundle install", build: "", start: "rails server", version: "ruby", rubyVersion: "3.3" };
    case "ruby-generic": return { install: "bundle install", build: "", start: "ruby app.rb", version: "ruby", rubyVersion: "3.3" };
    case "go": return { install: "", build: "go build -o app", start: "./app", version: "go", goVersion: "1.23" };
    case "rust": return { install: "", build: "cargo build --release", start: "./target/release/app", version: "" };
    case "spring-boot": return { install: "", build: "mvn package -DskipTests", start: "java -jar target/*.jar", version: "" };
    case "java-generic": return { install: "", build: "mvn package", start: "java -jar target/*.jar", version: "" };
    case "dotnet": return { install: "dotnet restore", build: "dotnet publish -c Release", start: "dotnet run", version: "" };
    case "phoenix": return { install: "mix deps.get", build: "MIX_ENV=prod mix release", start: "_build/prod/rel/app/bin/app start", version: "" };
    case "static": return { ...node("22"), start: "", output: "dist" };
    case "docker": return { install: "", build: "docker build -t app .", start: "docker run app", version: "" };
    case "docker-compose": return { install: "", build: "docker compose build", start: "docker compose up", version: "" };
    default: return { install: "", build: "", start: "", version: "" };
  }
}

function needsPhp(s: string) { return ["monkeyslegion","laravel","symfony","wordpress","drupal","php-generic"].includes(s); }
function needsNode(s: string) { return ["nextjs","nuxtjs","remix","sveltekit","astro","express","nestjs","react","vue","angular","static"].includes(s); }
function needsPython(s: string) { return ["django","fastapi","flask","streamlit","python-generic"].includes(s); }
function needsRuby(s: string) { return ["rails","ruby-generic"].includes(s); }
function needsGo(s: string) { return s === "go"; }

/* ─── Page Component ─── */

export default function CreateProjectPage() {
  const router = useRouter();
  const params = useParams();
  const orgSlug = params.orgSlug as string;
  const { currentOrg } = useAuthStore();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [description, setDescription] = useState("");
  const [taskPrefix, setTaskPrefix] = useState("");
  const [taskPrefixEdited, setTaskPrefixEdited] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");
  const [stack, setStack] = useState("");
  const [repoSource, setRepoSource] = useState("internal");
  const [repoUrl, setRepoUrl] = useState("");
  const [defaultBranch, setDefaultBranch] = useState("main");
  const [rootDirectory, setRootDirectory] = useState("/");
  const [autoDeploy, setAutoDeploy] = useState(true);
  const [buildCommand, setBuildCommand] = useState("");
  const [startCommand, setStartCommand] = useState("");
  const [installCommand, setInstallCommand] = useState("");
  const [outputDirectory, setOutputDirectory] = useState("");
  const [phpVersion, setPhpVersion] = useState("");
  const [nodeVersion, setNodeVersion] = useState("");
  const [pythonVersion, setPythonVersion] = useState("");
  const [rubyVersion, setRubyVersion] = useState("");
  const [goVersion, setGoVersion] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [scaffoldStatus, setScaffoldStatus] = useState("");
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null);
  const [slugChecking, setSlugChecking] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const [showBuildConfig, setShowBuildConfig] = useState(false);
  const [stackSearch, setStackSearch] = useState("");
  const [stackCategory, setStackCategory] = useState("all");

  // Filtered stacks
  const filteredStacks = STACKS.filter((s) => {
    const matchesCategory = stackCategory === "all" || s.category === stackCategory;
    const matchesSearch = !stackSearch || s.label.toLowerCase().includes(stackSearch.toLowerCase()) || s.id.includes(stackSearch.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Debounced slug check
  const checkSlugAvailability = useCallback((slugValue: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!slugValue || slugValue.length < 3) {
      setSlugAvailable(null);
      setSlugChecking(false);
      return;
    }
    setSlugChecking(true);
    setSlugAvailable(null);
    debounceRef.current = setTimeout(async () => {
      try {
        const orgId = currentOrg?.id;
        if (!orgId) return;
        const res = await api.get<{ available: boolean }>(
          `/api/v1/organizations/${orgId}/projects/check-slug?slug=${encodeURIComponent(slugValue)}`
        );
        setSlugAvailable(res.available);
      } catch {
        setSlugAvailable(null);
      } finally {
        setSlugChecking(false);
      }
    }, 500);
  }, [currentOrg?.id]);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  // Auto-slug from name
  useEffect(() => {
    if (!slugEdited) {
      const generated = name.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").slice(0, 60);
      setSlug(generated);
      checkSlugAvailability(generated);
    }
    if (!taskPrefixEdited) {
      const prefix = name.replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase();
      setTaskPrefix(prefix);
    }
  }, [name, slugEdited, taskPrefixEdited, checkSlugAvailability]);

  // Auto-fill build config when stack changes
  useEffect(() => {
    if (!stack) return;
    const defaults = getStackDefaults(stack);
    setInstallCommand(defaults.install || "");
    setBuildCommand(defaults.build || "");
    setStartCommand(defaults.start || "");
    setOutputDirectory((defaults as any).output || "");
    if ((defaults as any).phpVersion) setPhpVersion((defaults as any).phpVersion);
    if ((defaults as any).nodeVersion) setNodeVersion((defaults as any).nodeVersion);
    if ((defaults as any).pythonVersion) setPythonVersion((defaults as any).pythonVersion);
    if ((defaults as any).rubyVersion) setRubyVersion((defaults as any).rubyVersion);
    if ((defaults as any).goVersion) setGoVersion((defaults as any).goVersion);
  }, [stack]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!name.trim()) { setError("Project name is required."); return; }
    if (!slug.trim() || slug.length < 3) { setError("Slug must be at least 3 characters."); return; }
    if (!stack) { setError("Please select a stack."); return; }
    if (slugAvailable === false) { setError("This slug is already taken."); return; }

    setLoading(true);
    setScaffoldStatus("Creating project...");
    try {
      const orgId = currentOrg?.id;
      if (!orgId) throw new Error("No organization selected");

      // Show scaffold progress — the API call takes 15-60s for real scaffolding
      const progressTimer = setTimeout(() => setScaffoldStatus("Scaffolding repository..."), 2000);
      const progressTimer2 = setTimeout(() => setScaffoldStatus("Running scaffold command..."), 6000);
      const progressTimer3 = setTimeout(() => setScaffoldStatus("Installing dependencies..."), 15000);
      const progressTimer4 = setTimeout(() => setScaffoldStatus("Initializing git repository..."), 30000);

      try {
        await api.post(`/api/v1/organizations/${orgId}/projects`, {
          name: name.trim(),
          slug: slug.trim(),
          description: description.trim() || null,
          stack,
          repo_source: repoSource,
          repo_url: repoUrl.trim() || null,
          default_branch: defaultBranch.trim() || "main",
          root_directory: rootDirectory.trim() || "/",
          auto_deploy: autoDeploy,
          build_command: buildCommand.trim() || null,
          start_command: startCommand.trim() || null,
          logo_url: logoUrl || null,
          install_command: installCommand.trim() || null,
          output_directory: outputDirectory.trim() || null,
          php_version: phpVersion || null,
          node_version: nodeVersion || null,
          python_version: pythonVersion || null,
          ruby_version: rubyVersion || null,
          go_version: goVersion || null,
          task_prefix: taskPrefix.trim() || null,
        });

        setScaffoldStatus("Project created! Redirecting...");
        setTimeout(() => {
          window.location.href = `/org/${orgSlug}/projects/${slug.trim()}`;
        }, 500);
      } finally {
        clearTimeout(progressTimer);
        clearTimeout(progressTimer2);
        clearTimeout(progressTimer3);
        clearTimeout(progressTimer4);
      }
    } catch (err: any) {
      setError(err?.data?.error || err?.message || "Failed to create project.");
      setScaffoldStatus("");
    } finally {
      setLoading(false);
    }
  }

  const isSubmitDisabled = loading || !name.trim() || !stack || slugAvailable === false || slugChecking;

  return (
    <div className="max-w-3xl mx-auto pb-16">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center shadow-lg shadow-primary-500/20">
            <FolderPlus className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Create a new project</h1>
            <p className="text-sm text-surface-400">in <span className="text-primary-400 font-medium">{currentOrg?.name || orgSlug}</span></p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Error */}
        {error && (
          <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* ───── Basics Card ───── */}
        <div className="rounded-2xl border border-surface-800 bg-[#111827] p-6">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <span className="h-5 w-5 rounded-full bg-primary-500/20 text-primary-400 flex items-center justify-center text-xs font-bold">1</span>
            Project details
          </h2>

          {/* Logo */}
          <div className="mb-5">
            <ImageUpload
              value={logoUrl}
              onChange={setLogoUrl}
              entityType="project"
              entityId="new"
              label="Project logo"
              sublabel="Optional • JPG, PNG, WebP, SVG"
              size={72}
              shape="rounded"
            />
          </div>

          {/* Name */}
          <div className="mb-4">
            <label className="block text-[13px] font-medium text-surface-300 mb-1.5">Project name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Awesome App"
              className="w-full rounded-lg border border-surface-700 bg-surface-900 px-4 py-2.5 text-sm text-white placeholder:text-surface-500 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 transition-colors"
              autoFocus
              maxLength={100}
            />
          </div>

          {/* Slug */}
          <div className="mb-4">
            <label className="block text-[13px] font-medium text-surface-300 mb-1.5">
              <div className="flex items-center gap-1.5">
                <Globe className="h-3.5 w-3.5 text-surface-500" />
                Project slug
              </div>
            </label>
            <div className={clsx(
              "flex items-center rounded-lg border bg-surface-900 overflow-hidden transition-colors",
              slugAvailable === false ? "border-red-500/60" : slugAvailable === true ? "border-emerald-500/60" : "border-surface-700 focus-within:border-primary-500"
            )}>
              <span className="px-3 text-sm text-surface-500 shrink-0 border-r border-surface-700 py-2.5 bg-surface-800/50 whitespace-nowrap">
                /org/{orgSlug}/projects/
              </span>
              <input
                type="text"
                value={slug}
                onChange={(e) => { const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""); setSlug(val); setSlugEdited(true); checkSlugAvailability(val); }}
                placeholder="my-awesome-app"
                className="flex-1 bg-transparent px-3 py-2.5 text-sm text-white placeholder:text-surface-500 outline-none"
                maxLength={60}
              />
              {slug.length >= 3 && (
                <span className="pr-3 flex items-center">
                  {slugChecking ? <Loader2 className="h-4 w-4 text-surface-500 animate-spin" /> :
                   slugAvailable === true ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> :
                   slugAvailable === false ? <XCircle className="h-4 w-4 text-red-400" /> : null}
                </span>
              )}
            </div>
            {slug.length >= 3 && !slugChecking && slugAvailable === false && (
              <p className="mt-1.5 text-[13px] text-red-400 flex items-center gap-1"><XCircle className="h-3 w-3" /> This slug is already taken.</p>
            )}
            {slug && slugAvailable !== false && (
              <p className="mt-1.5 text-[13px] text-surface-500">
                Your project URL will be{" "}
                <span className="text-primary-400 font-mono">monkeyscloud.com/org/{orgSlug}/projects/{slug}</span>
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-[13px] font-medium text-surface-300 mb-1.5">Description <span className="text-surface-600">(optional)</span></label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="A brief description of your project…"
              rows={2}
              className="w-full rounded-lg border border-surface-700 bg-surface-900 px-4 py-2.5 text-sm text-white placeholder:text-surface-500 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 transition-colors resize-none"
              maxLength={500}
            />
          </div>

          {/* Task Prefix */}
          <div>
            <label className="block text-[13px] font-medium text-surface-300 mb-1.5">
              Task prefix <span className="text-surface-600">(for task IDs like TSK-1)</span>
            </label>
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={taskPrefix}
                onChange={(e) => { setTaskPrefix(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10)); setTaskPrefixEdited(true); }}
                placeholder="TSK"
                className="w-32 rounded-lg border border-surface-700 bg-surface-900 px-4 py-2.5 text-sm text-white font-mono uppercase placeholder:text-surface-500 outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30 transition-colors tracking-wider"
                maxLength={10}
              />
              {taskPrefix && (
                <span className="text-sm text-surface-500">
                  Tasks will be numbered as <span className="text-primary-400 font-mono">{taskPrefix}-1</span>, <span className="text-primary-400 font-mono">{taskPrefix}-2</span>, etc.
                </span>
              )}
            </div>
          </div>
        </div>

        {/* ───── Stack Card ───── */}
        <div className="rounded-2xl border border-surface-800 bg-[#111827] p-6">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <span className="h-5 w-5 rounded-full bg-primary-500/20 text-primary-400 flex items-center justify-center text-xs font-bold">2</span>
            Technology stack
            <span className="text-xs text-surface-500 font-normal ml-auto">{STACKS.length} stacks available</span>
          </h2>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500" />
            <input
              type="text"
              value={stackSearch}
              onChange={(e) => setStackSearch(e.target.value)}
              placeholder="Search stacks…"
              className="w-full rounded-lg border border-surface-700 bg-surface-900 pl-9 pr-4 py-2 text-sm text-white placeholder:text-surface-500 outline-none focus:border-primary-500 transition-colors"
            />
          </div>

          {/* Category tabs */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => { setStackCategory(cat.id); setStackSearch(""); }}
                className={clsx(
                  "px-2.5 py-1 rounded-md text-[13px] font-medium transition-all",
                  stackCategory === cat.id
                    ? "bg-primary-500/20 text-primary-400 ring-1 ring-primary-500/30"
                    : "bg-surface-800/50 text-surface-400 hover:bg-surface-800 hover:text-surface-300"
                )}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Stack grid */}
          <div className="grid grid-cols-4 gap-2">
            {filteredStacks.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setStack(s.id)}
                className={clsx(
                  "flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-all text-center",
                  stack === s.id
                    ? "border-primary-500 bg-primary-500/10 ring-1 ring-primary-500/30 shadow-lg shadow-primary-500/10"
                    : "border-surface-700 bg-surface-800/30 hover:border-surface-600 hover:bg-surface-800/60"
                )}
              >
                <span className={clsx("transition-colors", stack === s.id ? "text-primary-400" : "text-surface-400")}>{s.icon}</span>
                <span className={clsx("text-[13px] font-medium", stack === s.id ? "text-primary-300" : "text-surface-300")}>{s.label}</span>
              </button>
            ))}
            {filteredStacks.length === 0 && (
              <p className="col-span-4 text-center py-6 text-sm text-surface-500">No stacks match your search</p>
            )}
          </div>

          {/* Version selectors (conditional) */}
          {stack && (
            <div className="mt-4 flex gap-3 flex-wrap">
              {needsPhp(stack) && (
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-[13px] font-medium text-surface-400 mb-1">PHP Version</label>
                  <select value={phpVersion} onChange={(e) => setPhpVersion(e.target.value)} className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-white outline-none focus:border-primary-500">
                    <option value="8.4">8.4</option>
                    <option value="8.3">8.3</option>
                    <option value="8.2">8.2</option>
                    <option value="8.1">8.1</option>
                  </select>
                </div>
              )}
              {needsNode(stack) && (
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-[13px] font-medium text-surface-400 mb-1">Node Version</label>
                  <select value={nodeVersion} onChange={(e) => setNodeVersion(e.target.value)} className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-white outline-none focus:border-primary-500">
                    <option value="22">22 LTS</option>
                    <option value="20">20 LTS</option>
                    <option value="18">18</option>
                  </select>
                </div>
              )}
              {needsPython(stack) && (
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-[13px] font-medium text-surface-400 mb-1">Python Version</label>
                  <select value={pythonVersion} onChange={(e) => setPythonVersion(e.target.value)} className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-white outline-none focus:border-primary-500">
                    <option value="3.13">3.13</option>
                    <option value="3.12">3.12</option>
                    <option value="3.11">3.11</option>
                  </select>
                </div>
              )}
              {needsRuby(stack) && (
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-[13px] font-medium text-surface-400 mb-1">Ruby Version</label>
                  <select value={rubyVersion} onChange={(e) => setRubyVersion(e.target.value)} className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-white outline-none focus:border-primary-500">
                    <option value="3.3">3.3</option>
                    <option value="3.2">3.2</option>
                    <option value="3.1">3.1</option>
                  </select>
                </div>
              )}
              {needsGo(stack) && (
                <div className="flex-1 min-w-[140px]">
                  <label className="block text-[13px] font-medium text-surface-400 mb-1">Go Version</label>
                  <select value={goVersion} onChange={(e) => setGoVersion(e.target.value)} className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-white outline-none focus:border-primary-500">
                    <option value="1.23">1.23</option>
                    <option value="1.22">1.22</option>
                    <option value="1.21">1.21</option>
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ───── Repository Card ───── */}
        <div className="rounded-2xl border border-surface-800 bg-[#111827] p-6">
          <h2 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <span className="h-5 w-5 rounded-full bg-primary-500/20 text-primary-400 flex items-center justify-center text-xs font-bold">3</span>
            Repository
          </h2>

          <div className="grid grid-cols-2 gap-2 mb-4">
            {REPO_SOURCES.map((rs) => (
              <button
                key={rs.id}
                type="button"
                onClick={() => setRepoSource(rs.id)}
                className={clsx(
                  "flex items-center gap-3 rounded-xl border p-3 transition-all text-left",
                  repoSource === rs.id
                    ? "border-primary-500 bg-primary-500/10"
                    : "border-surface-700 bg-surface-800/30 hover:border-surface-600"
                )}
              >
                <span className={clsx(repoSource === rs.id ? "text-primary-400" : "text-surface-400")}>{rs.icon}</span>
                <div>
                  <span className={clsx("text-sm font-medium block", repoSource === rs.id ? "text-primary-300" : "text-surface-300")}>{rs.label}</span>
                  <span className="text-xs text-surface-500">{rs.desc}</span>
                </div>
              </button>
            ))}
          </div>

          {repoSource !== "internal" && (
            <div className="mb-3">
              <label className="block text-[13px] font-medium text-surface-400 mb-1">Repository URL</label>
              <input
                type="text"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder={`https://${repoSource}.com/your-org/your-repo`}
                className="w-full rounded-lg border border-surface-700 bg-surface-900 px-4 py-2.5 text-sm text-white placeholder:text-surface-500 outline-none focus:border-primary-500 transition-colors"
              />
            </div>
          )}

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-[13px] font-medium text-surface-400 mb-1">Default branch</label>
              <input
                type="text"
                value={defaultBranch}
                onChange={(e) => setDefaultBranch(e.target.value)}
                className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-white outline-none focus:border-primary-500 transition-colors"
              />
            </div>
            <div className="flex-1">
              <label className="block text-[13px] font-medium text-surface-400 mb-1">Root directory</label>
              <input
                type="text"
                value={rootDirectory}
                onChange={(e) => setRootDirectory(e.target.value)}
                className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-white outline-none focus:border-primary-500 transition-colors"
              />
            </div>
          </div>

          <label className="flex items-center gap-2.5 mt-3 cursor-pointer">
            <div className={clsx(
              "h-5 w-9 rounded-full transition-colors relative",
              autoDeploy ? "bg-primary-500" : "bg-surface-700"
            )}>
              <div className={clsx(
                "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
                autoDeploy ? "translate-x-4" : "translate-x-0.5"
              )} />
            </div>
            <div>
              <span className="text-sm font-medium text-surface-300">Auto-deploy</span>
              <span className="text-xs text-surface-500 ml-1.5">Deploy on every push to default branch</span>
            </div>
          </label>
        </div>

        {/* ───── Build Config Card (collapsible) ───── */}
        <div className="rounded-2xl border border-surface-800 bg-[#111827] overflow-hidden">
          <button
            type="button"
            onClick={() => setShowBuildConfig(!showBuildConfig)}
            className="flex w-full items-center justify-between p-6 text-left hover:bg-surface-800/30 transition-colors"
          >
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <span className="h-5 w-5 rounded-full bg-primary-500/20 text-primary-400 flex items-center justify-center text-xs font-bold">4</span>
              <Terminal className="h-4 w-4 text-surface-400" />
              Build & deploy settings
              <span className="text-xs text-surface-500 font-normal ml-1">(auto-configured)</span>
            </h2>
            <ChevronDown className={clsx("h-4 w-4 text-surface-500 transition-transform", showBuildConfig && "rotate-180")} />
          </button>

          {showBuildConfig && (
            <div className="px-6 pb-6 space-y-3 border-t border-surface-800 pt-4">
              <div>
                <label className="block text-[13px] font-medium text-surface-400 mb-1">Install command</label>
                <input type="text" value={installCommand} onChange={(e) => setInstallCommand(e.target.value)} placeholder="npm install" className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-white font-mono placeholder:text-surface-600 outline-none focus:border-primary-500 transition-colors" />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-surface-400 mb-1">Build command</label>
                <input type="text" value={buildCommand} onChange={(e) => setBuildCommand(e.target.value)} placeholder="npm run build" className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-white font-mono placeholder:text-surface-600 outline-none focus:border-primary-500 transition-colors" />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-surface-400 mb-1">Start command</label>
                <input type="text" value={startCommand} onChange={(e) => setStartCommand(e.target.value)} placeholder="npm start" className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-white font-mono placeholder:text-surface-600 outline-none focus:border-primary-500 transition-colors" />
              </div>
              <div>
                <label className="block text-[13px] font-medium text-surface-400 mb-1">Output directory</label>
                <input type="text" value={outputDirectory} onChange={(e) => setOutputDirectory(e.target.value)} placeholder="dist" className="w-full rounded-lg border border-surface-700 bg-surface-900 px-3 py-2 text-sm text-white font-mono placeholder:text-surface-600 outline-none focus:border-primary-500 transition-colors" />
              </div>
            </div>
          )}
        </div>

        {/* ───── Scaffold Progress ───── */}
        {loading && scaffoldStatus && (
          <div className="rounded-2xl border border-primary-500/30 bg-primary-500/5 p-6">
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="h-12 w-12 rounded-full bg-primary-500/20 flex items-center justify-center">
                  <Package className="h-6 w-6 text-primary-400 animate-pulse" />
                </div>
                <div className="absolute -top-1 -right-1 h-4 w-4">
                  <Loader2 className="h-4 w-4 text-primary-400 animate-spin" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-white">{scaffoldStatus}</p>
                <p className="text-xs text-surface-500 mt-1">
                  This may take up to a minute depending on the stack
                </p>
              </div>
              <div className="w-full max-w-xs">
                <div className="h-1.5 rounded-full bg-surface-800 overflow-hidden">
                  <div className="h-full rounded-full bg-gradient-to-r from-primary-500 to-violet-500 animate-[shimmer_2s_ease-in-out_infinite]" style={{ width: '60%' }} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ───── Submit ───── */}
        <button
          type="submit"
          disabled={isSubmitDisabled}
          className={clsx(
            "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-sm font-semibold transition-all",
            isSubmitDisabled
              ? "bg-surface-800 text-surface-500 cursor-not-allowed"
              : "bg-gradient-to-r from-primary-500 to-violet-600 text-white hover:from-primary-600 hover:to-violet-700 shadow-lg shadow-primary-500/20 hover:shadow-xl hover:shadow-primary-500/30"
          )}
        >
          {loading ? (
            <><Loader2 className="h-4 w-4 animate-spin" /> {scaffoldStatus || 'Creating project…'}</>
          ) : (
            <><Zap className="h-4 w-4" /> Create Project <ArrowRight className="h-4 w-4" /></>
          )}
        </button>

        {/* Back */}
        <p className="text-center text-[13px] text-surface-500">
          <button type="button" onClick={() => window.location.href = `/org/${orgSlug}`} className="text-primary-400 hover:text-primary-300 transition-colors">
            ← Back to {currentOrg?.name || "organization"}
          </button>
        </p>
      </form>
    </div>
  );
}
