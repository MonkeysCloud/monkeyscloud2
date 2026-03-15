"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import {
  Home,
  LayoutGrid,
  ListChecks,
  GitPullRequest,
  Rocket,
  Clock,
  BarChart3,
  Code2,
  FolderTree,
  GitBranch,
  GitCommitHorizontal,
  Tag,
  Kanban,
  List,
  Timer,
  Tags,
  History,
  Hammer,
  Globe2,
  Database,
  HardDrive,
  Archive,
  Link2,
  ShieldCheck,
  Activity,
  FileText,
  HeartPulse,
  Bell,
  Settings,
  Settings2,
  ChevronRight,
  ChevronDown,
  Plus,
  Star,
  Search,
  ChevronsLeft,
  ChevronsRight,
  X,
  Key,
} from "lucide-react";
import { useState, useRef, useEffect, type ReactNode } from "react";
import { useNavStore } from "@/stores/nav-store";
import { useAuthStore } from "@/stores/auth-store";
import { api } from "@/lib/api";
import { saveLastOrg, saveLastProject } from "@/lib/navigation-context";

/* ─── Navigation Data ─── */

const ORG_NAV = [
  { id: "home", href: "", icon: Home, label: "Home" },
  { id: "overview", href: "/overview", icon: LayoutGrid, label: "Overview" },
  { id: "all-tasks", href: "/tasks", icon: ListChecks, label: "All Tasks", badge: "47" },
  { id: "all-prs", href: "/pull-requests", icon: GitPullRequest, label: "All Pull Requests", badge: "12" },
  { id: "all-deploys", href: "/deployments", icon: Rocket, label: "All Deployments" },
  { id: "time-tracking", href: "/time-tracking", icon: Clock, label: "Time Tracking" },
  { id: "analytics", href: "/analytics", icon: BarChart3, label: "Analytics" },
];

interface NavChild {
  id: string;
  href: string;
  icon: typeof Home;
  label: string;
  badge?: string;
}

interface NavSection {
  id: string;
  icon: typeof Home;
  label: string;
  children: NavChild[];
}

const PROJECT_NAV: NavSection[] = [
  {
    id: "code", icon: Code2, label: "Code",
    children: [
      { id: "files", href: "code", icon: FolderTree, label: "Files" },
      { id: "pull-requests", href: "pull-requests", icon: GitPullRequest, label: "Pull Requests" },
      { id: "branches", href: "branches", icon: GitBranch, label: "Branches" },
      { id: "commits", href: "commits", icon: GitCommitHorizontal, label: "Commits" },
      { id: "tags", href: "tags", icon: Tag, label: "Tags" },
    ],
  },
  {
    id: "tasks", icon: ListChecks, label: "Tasks",
    children: [
      { id: "board", href: "board", icon: Kanban, label: "Board" },
      { id: "task-list", href: "tasks", icon: List, label: "List" },
      { id: "sprints", href: "sprints", icon: Timer, label: "Sprints" },
      { id: "labels", href: "labels", icon: Tags, label: "Labels" },
      { id: "fields", href: "settings/fields", icon: Settings2, label: "Fields" },
    ],
  },
  {
    id: "deployments", icon: Rocket, label: "Deployments",
    children: [
      { id: "deploy-history", href: "deployments", icon: History, label: "History" },
      { id: "builds", href: "builds", icon: Hammer, label: "Builds", badge: "1" },
      { id: "environments", href: "environments", icon: Globe2, label: "Environments" },
    ],
  },
  {
    id: "database", icon: Database, label: "Database",
    children: [
      { id: "instances", href: "databases", icon: HardDrive, label: "Instances" },
      { id: "backups", href: "databases/backups", icon: Archive, label: "Backups" },
    ],
  },
  {
    id: "domains", icon: Link2, label: "Domains",
    children: [
      { id: "custom-domains", href: "domains", icon: Globe2, label: "Custom Domains" },
      { id: "ssl", href: "domains/ssl", icon: ShieldCheck, label: "SSL Certificates" },
    ],
  },
  {
    id: "monitoring", icon: Activity, label: "Monitoring",
    children: [
      { id: "metrics", href: "monitoring", icon: BarChart3, label: "Metrics" },
      { id: "logs", href: "monitoring/logs", icon: FileText, label: "Logs" },
      { id: "uptime", href: "monitoring/uptime", icon: HeartPulse, label: "Uptime" },
      { id: "alerts", href: "monitoring/alerts", icon: Bell, label: "Alerts" },
    ],
  },
];

/* ─── Project type ─── */
interface ProjectItem {
  id: number;
  slug: string;
  name: string;
  stack: string;
  status?: string;
}

/* ─── Sidebar Component ─── */

export function Sidebar() {
  const pathname = usePathname();
  const {
    sidebarCollapsed,
    mobileSidebarOpen,
    setMobileSidebarOpen,
    expandedSections,
    toggleSection,
    toggleSidebar,
  } = useNavStore();
  const { user, organizations, currentOrg, setCurrentOrg, setOrganizations } = useAuthStore();
  const router = useRouter();

  // Extract org slug from the URL (e.g. /org/monkeys2/... → monkeys2)
  const slugFromUrl = pathname.startsWith("/org/")
    ? pathname.split("/")[2] || null
    : null;

  // Fetch organizations on mount
  useEffect(() => {
    async function loadOrgs() {
      try {
        const res = await api.get<any>("/api/v1/organizations");
        const orgList = res?.data ?? res;
        if (Array.isArray(orgList)) {
          setOrganizations(orgList);
          // Sync currentOrg with the URL slug
          if (slugFromUrl) {
            const match = orgList.find((o: any) => o.slug === slugFromUrl);
            if (match) setCurrentOrg(match);
          }
        }
      } catch (e) {
        // silently fail — user may not be authenticated yet
      }
    }
    if (organizations.length === 0) {
      loadOrgs();
    }
  }, []);

  // Keep currentOrg in sync with URL when navigating
  useEffect(() => {
    if (slugFromUrl && organizations.length > 0) {
      const match = organizations.find((o) => o.slug === slugFromUrl);
      if (match && match.id !== currentOrg?.id) {
        setCurrentOrg(match);
      }
      // Persist last org to localStorage
      if (slugFromUrl) saveLastOrg(slugFromUrl);
    }
  }, [slugFromUrl, organizations]);

  // Org-scoped base path
  const orgBase = `/org/${currentOrg?.slug || "default"}`;

  // On mobile the sidebar is always expanded (never icon mode)
  const collapsed = sidebarCollapsed;

  const [showOrgDropdown, setShowOrgDropdown] = useState(false);
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [activeProject, setActiveProject] = useState<ProjectItem | null>(null);
  const [projectSearch, setProjectSearch] = useState("");
  const [projectsLoading, setProjectsLoading] = useState(true);

  // Derive the target Org instance from the URL slug so we don't fetch the 
  // localStorage cached org first and then double-fetch when Sidebar syncs it.
  const targetOrg = organizations.find((o) => o.slug === slugFromUrl) || currentOrg;

  // Fetch projects only when org changes (not on every pathname change)
  useEffect(() => {
    async function loadProjects() {
      if (!targetOrg?.id) return;
      setProjectsLoading(true);
      try {
        const res = await api.get<any>(`/api/v1/organizations/${targetOrg.id}/projects`);
        const list = res?.data ?? res;
        if (Array.isArray(list)) {
          setProjects(list);
          const projectSlugFromUrl = pathname.match(/\/projects\/([^/]+)/)?.[1];
          if (projectSlugFromUrl) {
            // URL has a project slug — only activate the matching project (no fallback)
            const match = list.find((p: any) => p.slug === projectSlugFromUrl);
            if (match) {
              setActiveProject(match);
              saveLastProject(projectSlugFromUrl);
            }
            // If slug not in list, leave activeProject null (don't flash wrong project)
          } else {
            // No project in URL — fall back to first project
            setActiveProject(list[0] || null);
          }
        }
      } catch {
        setProjects([]);
        setActiveProject(null);
      } finally {
        setProjectsLoading(false);
      }
    }
    loadProjects();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetOrg?.id]);

  // Sync active project with URL on navigation (no API call)
  useEffect(() => {
    if (projects.length === 0) return;
    const projectSlugFromUrl = pathname.match(/\/projects\/([^/]+)/)?.[1];
    if (projectSlugFromUrl) {
      const match = projects.find((p) => p.slug === projectSlugFromUrl);
      if (match && match.slug !== activeProject?.slug) {
        setActiveProject(match);
        saveLastProject(projectSlugFromUrl);
      }
    }
  }, [pathname, projects]);


  const orgRef = useRef<HTMLDivElement>(null);
  const projRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (orgRef.current && !orgRef.current.contains(e.target as Node)) setShowOrgDropdown(false);
      if (projRef.current && !projRef.current.contains(e.target as Node)) setShowProjectDropdown(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Auto-close mobile sidebar on navigation
  useEffect(() => {
    setMobileSidebarOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Auto-expand the section whose child matches the current path
  useEffect(() => {
    if (!activeProject) return;
    const projectPrefix = `${orgBase}/projects/${activeProject.slug}/`;
    if (!pathname.startsWith(projectPrefix)) return;
    const rest = pathname.slice(projectPrefix.length);
    for (const section of PROJECT_NAV) {
      if (section.children.some((c) => rest.startsWith(c.href))) {
        if (!expandedSections.includes(section.id)) {
          toggleSection(section.id);
        }
        break;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, activeProject]);

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(projectSearch.toLowerCase())
  );

  const hasProjects = projects.length > 0;

  const isAccountPage = pathname.startsWith("/account");
  const isCreateProjectPage = pathname.endsWith("/projects/create");

  /* ─── Sidebar content (shared between desktop and mobile) ─── */
  const sidebarContent = (
    <>
      <div className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-surface-700 scrollbar-track-transparent">
        <div className={clsx("p-2", collapsed && !mobileSidebarOpen ? "px-1.5" : "px-2.5")}>

          {/* ─── Org Switcher ─── */}
          <div ref={orgRef} className="relative mb-2">
            <button
              onClick={() => setShowOrgDropdown(!showOrgDropdown)}
              className={clsx(
                "flex w-full items-center gap-2.5 rounded-lg transition-colors",
                collapsed && !mobileSidebarOpen ? "justify-center p-2" : "px-2.5 py-2",
                "hover:bg-surface-800/60"
              )}
            >
              <div className="h-8 w-8 shrink-0 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-sm font-bold text-white">
                {currentOrg?.name?.charAt(0) ?? "M"}
              </div>
              {(mobileSidebarOpen || !collapsed) && (
                <>
                  <span className="flex-1 text-left text-[13px] font-semibold text-surface-200 truncate">
                    {currentOrg?.name ?? "Select Org"}
                  </span>
                  <ChevronDown className={clsx("h-3.5 w-3.5 text-surface-500 transition-transform", showOrgDropdown && "rotate-180")} />
                </>
              )}
            </button>

            {showOrgDropdown && (mobileSidebarOpen || !collapsed) && (
              <Dropdown>
                {organizations.map((org) => (
                  <DropdownItem
                    key={org.id}
                    active={org.id === currentOrg?.id}
                    onMouseDown={(e: React.MouseEvent) => { e.stopPropagation(); setCurrentOrg(org); setShowOrgDropdown(false); window.location.href = `/org/${org.slug}`; }}
                  >
                    <div className="h-6 w-6 rounded bg-surface-700 flex items-center justify-center text-xs font-bold shrink-0">
                      {org.name.charAt(0)}
                    </div>
                    <span className="truncate">{org.name}</span>
                    {org.id === currentOrg?.id && <span className="ml-auto text-primary-400">✓</span>}
                  </DropdownItem>
                ))}
                <div className="border-t border-surface-800">
                  <button
                    onMouseDown={(e) => {
                      e.stopPropagation();
                      window.location.href = "/org/create";
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm text-surface-300 hover:bg-surface-800/60 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5 text-primary-400" />
                    <span className="text-primary-400">Create Organization</span>
                  </button>
                </div>
              </Dropdown>
            )}
          </div>

          {/* ─── Account Page Navigation ─── */}
          {isAccountPage && (
            <>
              <NavLink
                href={orgBase}
                icon={<Home className="h-[18px] w-[18px]" />}
                label="Back to Dashboard"
                active={false}
                collapsed={collapsed && !mobileSidebarOpen}
              />
              <div className="border-t border-surface-800 my-2.5 mx-1" />
              {(mobileSidebarOpen || !collapsed) && (
                <div className="px-2.5 mb-1.5">
                  <span className="text-xs font-bold uppercase tracking-[1.5px] text-surface-500">
                    Account
                  </span>
                </div>
              )}
              <NavLink
                href="/account"
                icon={<Settings className="h-[18px] w-[18px]" />}
                label="Account Settings"
                active={pathname === "/account"}
                collapsed={collapsed && !mobileSidebarOpen}
              />
              <NavLink
                href="/account/api-keys"
                icon={<Key className="h-[18px] w-[18px]" />}
                label="API Keys"
                active={pathname === "/account/api-keys"}
                collapsed={collapsed && !mobileSidebarOpen}
              />
            </>
          )}

          {/* ─── Create Project → Show back link + project list only ─── */}
          {isCreateProjectPage && (
            <>
              <NavLink
                href={orgBase}
                icon={<Home className="h-[18px] w-[18px]" />}
                label="Back to Dashboard"
                active={false}
                collapsed={collapsed && !mobileSidebarOpen}
              />
              <div className="border-t border-surface-800 my-2.5 mx-1" />
              {(mobileSidebarOpen || !collapsed) && (
                <div className="px-2.5 mb-1.5">
                  <span className="text-xs font-bold uppercase tracking-[1.5px] text-surface-500">
                    New Project
                  </span>
                </div>
              )}
            </>
          )}

          {/* ─── Org Navigation ─── */}
          {!isAccountPage && !isCreateProjectPage && ORG_NAV.map((item) => {
            const href = `${orgBase}${item.href}`;
            return (
              <NavLink
                key={item.id}
                href={href}
                icon={<item.icon className="h-[18px] w-[18px]" />}
                label={item.label}
                badge={item.badge}
                active={item.href === "" ? pathname === orgBase : pathname.startsWith(href)}
                collapsed={collapsed && !mobileSidebarOpen}
              />
            );
          })}

          {/* ─── Divider ─── */}
          {!isAccountPage && !isCreateProjectPage && <div className="border-t border-surface-800 my-2.5 mx-1" />}

          {/* ─── Project Label ─── */}
          {!isAccountPage && !isCreateProjectPage && (mobileSidebarOpen || !collapsed) && (
            <div className="px-2.5 mb-1.5">
              <span className="text-xs font-bold uppercase tracking-[1.5px] text-surface-500">
                Project
              </span>
            </div>
          )}

          {/* ─── Loading Skeleton ─── */}
          {!isAccountPage && !isCreateProjectPage && projectsLoading && (mobileSidebarOpen || !collapsed) && (
            <div className="animate-pulse space-y-2 mb-1.5">
              <div className="h-9 rounded-lg bg-surface-800/60 border border-surface-800" />
              <div className="space-y-1">
                <div className="h-6 w-3/4 rounded-md bg-surface-800/40" />
                <div className="h-6 w-2/3 rounded-md bg-surface-800/40" />
                <div className="h-6 w-4/5 rounded-md bg-surface-800/40" />
              </div>
            </div>
          )}
          {!isAccountPage && !isCreateProjectPage && projectsLoading && collapsed && !mobileSidebarOpen && (
            <div className="animate-pulse flex justify-center">
              <div className="h-8 w-8 rounded-lg bg-surface-800/60" />
            </div>
          )}

          {/* ─── No Projects: Create CTA ─── */}
          {!isAccountPage && !isCreateProjectPage && !projectsLoading && !hasProjects && (mobileSidebarOpen || !collapsed) && (
            <button
              onMouseDown={(e) => { e.stopPropagation(); window.location.href = `${orgBase}/projects/create`; }}
              className="flex w-full items-center gap-2.5 rounded-lg border border-dashed border-surface-700 px-3 py-3 mb-1.5 bg-surface-800/20 hover:bg-surface-800/50 hover:border-primary-500/40 transition-all group"
            >
              <div className="h-8 w-8 rounded-lg bg-primary-500/10 flex items-center justify-center group-hover:bg-primary-500/20 transition-colors">
                <Plus className="h-4 w-4 text-primary-400" />
              </div>
              <div className="text-left">
                <span className="text-sm font-medium text-surface-200 block">Create your first project</span>
                <span className="text-xs text-surface-500">Get started by deploying an app</span>
              </div>
            </button>
          )}
          {!isAccountPage && !isCreateProjectPage && !projectsLoading && !hasProjects && collapsed && !mobileSidebarOpen && (
            <button
              onMouseDown={(e) => { e.stopPropagation(); window.location.href = `${orgBase}/projects/create`; }}
              className="flex w-full items-center justify-center p-2 rounded-md text-primary-400 hover:bg-surface-800/50 transition-colors"
              title="Create Project"
            >
              <Plus className="h-4 w-4" />
            </button>
          )}

          {/* ─── Project Switcher (only when projects exist) ─── */}
          {!isAccountPage && hasProjects && activeProject && (
          <div ref={projRef} className="relative mb-1.5">
            <button
              onClick={() => setShowProjectDropdown(!showProjectDropdown)}
              className={clsx(
                "flex w-full items-center gap-2 rounded-lg border border-surface-800 transition-colors",
                collapsed && !mobileSidebarOpen ? "justify-center p-2" : "px-2.5 py-1.5",
                "bg-[#0f1a2e] hover:bg-surface-800/60"
              )}
            >
              {collapsed && !mobileSidebarOpen ? (
                <FolderTree className="h-4 w-4 text-surface-400" />
              ) : (
                <>
                  <div className="h-5 w-5 rounded bg-surface-700 flex items-center justify-center text-xs font-bold text-surface-300 shrink-0">
                    {activeProject.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="flex-1 text-left text-sm font-medium text-violet-300 truncate">
                    {activeProject.name}
                  </span>
                  <ChevronDown className={clsx("h-3 w-3 text-surface-500 transition-transform", showProjectDropdown && "rotate-180")} />
                </>
              )}
            </button>

            {showProjectDropdown && (mobileSidebarOpen || !collapsed) && (
              <Dropdown>
                <div className="p-1.5 border-b border-surface-800">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-surface-500" />
                    <input
                      value={projectSearch}
                      onChange={(e) => setProjectSearch(e.target.value)}
                      placeholder="Search projects..."
                      className="w-full bg-surface-900 border border-surface-800 rounded-md pl-7 pr-2 py-1.5 text-[13px] text-surface-200 placeholder:text-surface-500 outline-none focus:border-primary-500/50"
                      autoFocus
                    />
                  </div>
                </div>
                {filteredProjects.slice(0, 8).map((p) => (
                  <DropdownItem
                    key={p.id}
                    active={p.slug === activeProject.slug}
                    onMouseDown={(e: React.MouseEvent) => { e.stopPropagation(); setActiveProject(p); setShowProjectDropdown(false); setProjectSearch(""); window.location.href = `${orgBase}/projects/${p.slug}`; }}
                  >
                    <div className="h-5 w-5 rounded bg-surface-700 flex items-center justify-center text-xs font-bold shrink-0">
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="flex-1 truncate">{p.name}</span>
                    <span className="text-xs text-surface-500">{p.stack}</span>
                    {p.slug === activeProject.slug && <span className="text-primary-400 ml-1">✓</span>}
                  </DropdownItem>
                ))}
                {filteredProjects.length === 0 && (
                  <div className="px-3 py-2 text-[13px] text-surface-500 text-center">No projects found</div>
                )}
                <div className="border-t border-surface-800">
                  <DropdownItem onMouseDown={(e: React.MouseEvent) => { e.stopPropagation(); window.location.href = `${orgBase}/projects`; }}>
                    <FolderTree className="h-3.5 w-3.5 text-surface-400" />
                    <span className="text-surface-300">View all projects</span>
                  </DropdownItem>
                </div>
                <div className="border-t border-surface-800">
                  <DropdownItem onMouseDown={(e: React.MouseEvent) => { e.stopPropagation(); window.location.href = `${orgBase}/projects/create`; }}>
                    <Plus className="h-3.5 w-3.5 text-primary-400" />
                    <span className="text-primary-400">Create Project</span>
                  </DropdownItem>
                </div>
              </Dropdown>
            )}
          </div>
          )}

          {/* ─── Project Navigation (only when a project is selected) ─── */}
          {!isAccountPage && !isCreateProjectPage && hasProjects && activeProject && (
            <>
              {PROJECT_NAV.map((section) => {
                const isExpanded = expandedSections.includes(section.id);
                const showExpanded = mobileSidebarOpen || !collapsed;
                const isCollapsedMode = collapsed && !mobileSidebarOpen;
                const firstChildHref = `${orgBase}/projects/${activeProject.slug}/${section.children[0]?.href}`;

                const handleSectionClick = () => {
                  if (isCollapsedMode) {
                    router.push(firstChildHref);
                  } else {
                    toggleSection(section.id);
                  }
                };

                return (
                  <div key={section.id}>
                    <button
                      onClick={handleSectionClick}
                      title={isCollapsedMode ? section.label : undefined}
                      className={clsx(
                        "flex w-full items-center gap-2 rounded-md text-surface-400 transition-colors",
                        isCollapsedMode ? "justify-center p-2" : "px-2.5 py-[5px]",
                        "hover:bg-surface-800/50 hover:text-surface-300"
                      )}
                    >
                      <section.icon className="h-4 w-4 shrink-0" />
                      {showExpanded && (
                        <>
                          <span className="flex-1 text-left text-sm font-medium">{section.label}</span>
                          <ChevronRight
                            className={clsx(
                              "h-3 w-3 text-surface-600 transition-transform duration-150",
                              isExpanded && "rotate-90"
                            )}
                          />
                        </>
                      )}
                    </button>

                    {isExpanded && showExpanded && section.children?.map((child) => {
                      const childHref = `${orgBase}/projects/${activeProject.slug}/${child.href}`;
                      return (
                        <div key={child.id} className="ml-2 border-l border-surface-800/50 pl-1">
                          <NavLink
                            href={childHref}
                            icon={<child.icon className="h-3.5 w-3.5" />}
                            label={child.label}
                            badge={child.badge}
                            active={pathname.startsWith(childHref)}
                            collapsed={false}
                            indent
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {/* ─── Bottom Divider ─── */}
              <div className="border-t border-surface-800 my-2.5 mx-1" />

              {/* ─── Project Settings ─── */}
              <NavLink
                href={`${orgBase}/projects/${activeProject.slug}/settings`}
                icon={<Settings className="h-[18px] w-[18px]" />}
                label="Project Settings"
                active={pathname.includes("/settings") && pathname.includes("/projects/")}
                collapsed={collapsed && !mobileSidebarOpen}
              />
            </>
          )}

          {/* ─── Bottom Divider ─── */}
          {!isAccountPage && <div className="border-t border-surface-800 my-2.5 mx-1" />}

          {/* ─── Platform Admin (admin only) ─── */}
          {!isAccountPage && user?.is_admin && (
          <NavLink
            href="/admin"
            icon={<ShieldCheck className="h-[18px] w-[18px]" />}
            label="Platform Admin"
            active={pathname.startsWith("/admin")}
            collapsed={collapsed && !mobileSidebarOpen}
          />
          )}

          {/* ─── Org Settings (always visible) ─── */}
          {!isAccountPage && (
          <NavLink
            href={`${orgBase}/settings`}
            icon={<Settings className="h-[18px] w-[18px]" />}
            label="Org Settings"
            active={pathname.startsWith(`${orgBase}/settings`) && !pathname.includes("/projects/")}
            collapsed={collapsed && !mobileSidebarOpen}
          />
          )}
        </div>
      </div>

      {/* ─── Collapse Toggle (desktop only) ─── */}
      <div className="border-t border-surface-800 p-2 hidden lg:block">
        <button
          onClick={toggleSidebar}
          className="flex w-full items-center justify-center rounded-md py-1.5 text-surface-500 hover:text-surface-300 hover:bg-surface-800/50 transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden animate-fade-in"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Desktop sidebar (inline) */}
      <aside
        className={clsx(
          "hidden lg:flex flex-col h-screen border-r border-surface-800 bg-[#0d1220] transition-all duration-200 select-none",
          collapsed ? "w-16" : "w-[260px]"
        )}
      >
        {sidebarContent}
      </aside>

      {/* Mobile/Tablet sidebar (overlay) */}
      <aside
        className={clsx(
          "lg:hidden fixed inset-y-0 left-0 z-50 flex flex-col w-[280px] bg-[#0d1220] border-r border-surface-800 shadow-2xl shadow-black/50 transition-transform duration-200 select-none",
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Mobile header with close button */}
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-surface-800 shrink-0">
          <img src="/monkeyscloud-white-words.svg" alt="MonkeysCloud" className="h-8 w-24" />
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="flex items-center justify-center w-8 h-8 rounded-md text-surface-400 hover:text-white hover:bg-surface-800/60 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {sidebarContent}
      </aside>
    </>
  );
}

/* ─── NavLink ─── */

function NavLink({
  href,
  icon,
  label,
  badge,
  active,
  collapsed,
  indent,
}: {
  href: string;
  icon: ReactNode;
  label: string;
  badge?: string;
  active: boolean;
  collapsed: boolean;
  indent?: boolean;
}) {
  return (
    <Link
      href={href}
      title={collapsed ? label : undefined}
      className={clsx(
        "group flex items-center gap-2 rounded-md text-sm font-medium transition-all duration-100",
        collapsed ? "justify-center p-2" : indent ? "px-2.5 py-[4px]" : "px-2.5 py-[5px]",
        active
          ? "bg-primary-500/10 text-primary-400"
          : "text-surface-400 hover:text-surface-200 hover:bg-surface-800/40"
      )}
    >
      <span className={clsx("shrink-0", active && "text-primary-400")}>{icon}</span>
      {!collapsed && (
        <>
          <span className={clsx("flex-1 truncate", active && "font-semibold")}>{label}</span>
          {badge && (
            <span
              className={clsx(
                "text-xs font-semibold px-1.5 py-0.5 rounded-full",
                active
                  ? "bg-primary-500/20 text-primary-400"
                  : "bg-surface-800 text-surface-500"
              )}
            >
              {badge}
            </span>
          )}
        </>
      )}
    </Link>
  );
}

/* ─── Dropdown Helpers ─── */

function Dropdown({ children }: { children: ReactNode }) {
  return (
    <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl border border-surface-800 bg-[#111827] shadow-2xl shadow-black/40 overflow-hidden animate-slide-down">
      {children}
    </div>
  );
}

function DropdownItem({
  children,
  onClick,
  onMouseDown,
  active,
}: {
  children: ReactNode;
  onClick?: () => void;
  onMouseDown?: (e: React.MouseEvent) => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      onMouseDown={onMouseDown}
      className={clsx(
        "flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors",
        active ? "text-primary-400 bg-primary-500/10" : "text-surface-300 hover:bg-surface-800/60"
      )}
    >
      {children}
    </button>
  );
}
