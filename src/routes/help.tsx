import { createFileRoute } from "@tanstack/react-router";
import { LightboxProvider } from "@/components/help/help-lightbox";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { SearchInput } from "@/components/ui/search-input";
import { cn } from "@/lib/utils";
import { helpIndex } from "@/components/help/search-index";
import { GettingStarted } from "@/components/help/sections/getting-started";
import { ContainersSection } from "@/components/help/sections/containers";
import { ContainerDetailSection } from "@/components/help/sections/container-detail";
import { ComposeSection } from "@/components/help/sections/compose";
import { LogSearchSection } from "@/components/help/sections/log-search";
import { ImagesSection } from "@/components/help/sections/images";
import { VolumesSection } from "@/components/help/sections/volumes";
import { NetworksSection } from "@/components/help/sections/networks";
import { PreferencesSection } from "@/components/help/sections/preferences";
import { TroubleshootingSection } from "@/components/help/sections/troubleshooting";

// ─── Route ───────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/help")({
  validateSearch: (search: Record<string, unknown>) => ({
    section: (search.section as string) ?? "getting-started",
  }),
  component: HelpPage,
});

// ─── Nav structure ───────────────────────────────────────────────────────────

const sections = [
  { id: "getting-started",    label: "Getting Started" },
  { id: "containers",         label: "Containers" },
  { id: "container-detail",   label: "Container Detail" },
  { id: "compose",            label: "Compose" },
  { id: "log-search",         label: "Log Search" },
  { id: "images",             label: "Images" },
  { id: "volumes",            label: "Volumes" },
  { id: "networks",           label: "Networks" },
  { id: "preferences",        label: "Preferences" },
  { id: "troubleshooting",    label: "Troubleshooting" },
] as const;

type SectionId = (typeof sections)[number]["id"];

const sectionContent: Record<SectionId, React.ReactNode> = {
  "getting-started":    <GettingStarted />,
  "containers":         <ContainersSection />,
  "container-detail":   <ContainerDetailSection />,
  "compose":            <ComposeSection />,
  "log-search":         <LogSearchSection />,
  "images":             <ImagesSection />,
  "volumes":            <VolumesSection />,
  "networks":           <NetworksSection />,
  "preferences":        <PreferencesSection />,
  "troubleshooting":    <TroubleshootingSection />,
};

// ─── Page ────────────────────────────────────────────────────────────────────

function HelpPage() {
  const navigate = Route.useNavigate();
  const { section } = Route.useSearch();
  const searchRef = useRef<HTMLInputElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingHeading = useRef<string | null>(null);

  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [targetHeading, setTargetHeading] = useState<string | null>(null);

  const activeSection: SectionId = sections.some((s) => s.id === section)
    ? (section as SectionId)
    : "getting-started";

  // Scroll to top on section change — skip if a heading scroll is pending.
  useEffect(() => {
    if (pendingHeading.current) return;
    scrollRef.current?.scrollTo({ top: 0 });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection]);

  // Scroll to the target h3 after the section content renders.
  useEffect(() => {
    if (!targetHeading || !contentRef.current) return;
    const timer = setTimeout(() => {
      if (!contentRef.current) return;
      const h3s = contentRef.current.querySelectorAll("h3");
      for (const h3 of h3s) {
        if (h3.textContent?.trim() === targetHeading && scrollRef.current) {
          const containerTop = scrollRef.current.getBoundingClientRect().top;
          const headingTop = h3.getBoundingClientRect().top;
          scrollRef.current.scrollBy({ top: headingTop - containerTop - 16, behavior: "smooth" });
          break;
        }
      }
      pendingHeading.current = null;
      setTargetHeading(null);
    }, 50);
    return () => clearTimeout(timer);
  }, [activeSection, targetHeading]);

  const setSection = (id: SectionId, heading?: string) => {
    setQuery("");
    pendingHeading.current = heading ?? null;
    if (heading) setTargetHeading(heading);
    navigate({ search: { section: id }, replace: true });
  };

  const results = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    if (!q) return [];
    return helpIndex.filter(
      (e) =>
        e.heading.toLowerCase().includes(q) ||
        e.excerpt.toLowerCase().includes(q) ||
        e.keywords.toLowerCase().includes(q) ||
        e.sectionLabel.toLowerCase().includes(q),
    );
  }, [deferredQuery]);

  const isSearching = query.trim().length > 0;

  return (
    <div className="flex h-full min-h-0 gap-6">
      {/* Secondary nav */}
      <nav className="w-52 shrink-0 flex flex-col gap-3">
        {/* Search input */}
        <SearchInput
          ref={searchRef}
          placeholder="Search docs…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onClear={() => { setQuery(""); searchRef.current?.focus(); }}
          className="h-8 text-sm"
        />

        {/* Section nav — hidden while searching */}
        {!isSearching && (
          <>
            <p className="px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Documentation
            </p>
            <ul className="space-y-0.5">
              {sections.map((s) => (
                <li key={s.id}>
                  <button
                    onClick={() => setSection(s.id)}
                    className={cn(
                      "w-full rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                      activeSection === s.id
                        ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {s.label}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </nav>

      {/* Content */}
      <div ref={scrollRef} className="flex-1 min-w-0 overflow-auto">
        <div ref={contentRef} className="max-w-3xl pb-16">
          {isSearching ? (
            <SearchResults
              query={deferredQuery}
              results={results}
              onSelect={(id, heading) => setSection(id as SectionId, heading)}
            />
          ) : (
            <LightboxProvider key={activeSection}>
              {sectionContent[activeSection]}
            </LightboxProvider>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Search results ──────────────────────────────────────────────────────────

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function Highlight({ text, query }: { text: string; query: string }) {
  const q = query.trim();
  if (!q) return <>{text}</>;
  const parts = text.split(new RegExp(`(${escapeRegex(q)})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === q.toLowerCase() ? (
          <mark
            key={i}
            className="bg-yellow-200 dark:bg-yellow-700/50 text-foreground rounded-sm px-0.5 not-italic"
          >
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

function SearchResults({
  query,
  results,
  onSelect,
}: {
  query: string;
  results: ReturnType<typeof helpIndex.filter>;
  onSelect: (sectionId: string, heading: string) => void;
}) {
  if (results.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          No results for <span className="font-medium text-foreground">"{query.trim()}"</span>
        </p>
        <p className="text-xs text-muted-foreground">
          Try a different term or browse the sections in the sidebar.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <p className="text-xs text-muted-foreground mb-3">
        {results.length} result{results.length !== 1 ? "s" : ""} for{" "}
        <span className="font-medium text-foreground">"{query.trim()}"</span>
      </p>
      {results.map((entry, i) => (
        <button
          key={i}
          onClick={() => onSelect(entry.sectionId, entry.heading)}
          className="w-full text-left rounded-lg border px-4 py-3 hover:bg-muted transition-colors group"
        >
          <div className="flex items-baseline gap-2 mb-0.5">
            <span className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">
              <Highlight text={entry.sectionLabel} query={query} />
            </span>
            <span className="text-muted-foreground text-xs">/</span>
            <span className="text-sm font-medium">
              <Highlight text={entry.heading} query={query} />
            </span>
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2">
            <Highlight text={entry.excerpt} query={query} />
          </p>
        </button>
      ))}
    </div>
  );
}
