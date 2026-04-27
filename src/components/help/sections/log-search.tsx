import { HelpImage } from "@/components/help/help-image";
import { HelpCallout } from "@/components/help/help-callout";

export function LogSearchSection() {
  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Log Search</h2>
        <p className="mt-2 text-muted-foreground">
          Search stored logs across all containers — filter by text, container, stream, and time.
        </p>
      </div>

      {/* Overview */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Overview</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The Log Search page queries the local SurrealDB database for stored log lines matching
          your search. Unlike the live log stream in Container Detail, this searches historical
          data — useful for finding a specific error across many containers without knowing exactly
          when it occurred.
        </p>
        <HelpImage src="/help/log-search-results.png" alt="Log search page with results" caption="Log search with container filter chips and results" />
        <HelpCallout type="warning">
          Log Search only returns results for containers that have stored logs. Go to a container's
          Insights tab and toggle <strong>Persist logs</strong> on to start collecting. Logs
          collected before persistence was enabled are not retroactively stored.
        </HelpCallout>
      </section>

      {/* Search */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Searching</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Type in the search bar and press <strong>Search</strong> (or Enter) to find log lines
          containing that exact string. Matching is case-insensitive — only lines that contain your
          search term are returned, with the matched text highlighted in each result.
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Leave the search bar empty and press Search to return all stored log lines matching your
          other filters, with no text constraint.
        </p>
      </section>

      {/* Sort Order */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Sort Order</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Results are sorted by timestamp. Use the toggle on the right side of the results header
          to switch between <strong>Newest first</strong> and <strong>Oldest first</strong>. Changing
          the order immediately re-runs the search from the beginning.
        </p>
        <HelpImage src="/help/log-search-sort.png" alt="Log search results sorted oldest first" caption="Sort order toggle — top right of the results list" />
        <HelpCallout type="tip">
          Use <strong>Oldest first</strong> to trace a sequence of events forward in time — useful
          when debugging a startup failure or a crash cascade.
        </HelpCallout>
      </section>

      {/* Container Filter */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Container Filter</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The container picker only lists containers that have at least one stored log line —
          containers that have never had persistence enabled won't appear here. Click a container
          to add it as a filter chip. Remove a chip by clicking the × on it.
        </p>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Each chip uses a deterministic colour per container — the same container always gets the
          same colour across sessions and matches the colour shown in search results. With no
          containers selected, results come from all containers with stored logs.
        </p>
        <HelpImage src="/help/log-search-chips.png" alt="Container filter chips in the search toolbar" caption="Coloured container chips for filtering" />
      </section>

      {/* Stream Filter */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Stream Filter</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The <strong>stdout / stderr / all</strong> selector restricts results to one stream.
          Useful when you only care about errors (stderr) and want to exclude normal output.
        </p>
      </section>

      {/* Time Presets */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Time Presets</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          The time selector limits results to logs within a recent window:
        </p>
        <div className="rounded-lg border divide-y text-sm">
          {[
            { preset: "1h", desc: "Last hour" },
            { preset: "6h", desc: "Last 6 hours" },
            { preset: "24h", desc: "Last 24 hours" },
            { preset: "7d", desc: "Last 7 days" },
            { preset: "All", desc: "No time restriction — all stored logs" },
          ].map(({ preset, desc }) => (
            <div key={preset} className="grid grid-cols-[60px_1fr] gap-2 px-4 py-2">
              <span className="font-mono text-xs font-medium">{preset}</span>
              <span className="text-muted-foreground">{desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Pagination */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Load More</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Results are paginated — the initial query returns the first batch, and a{" "}
          <strong>Load more</strong> button at the bottom fetches the next page. There is no
          artificial cap on total results.
        </p>
      </section>

      {/* URL State */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">URL State</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Your search query, selected containers, stream filter, time preset, and sort order are all
          stored in the URL as search parameters. Navigate away and back and your search is exactly as you
          left it. You can also bookmark or share a specific search configuration.
        </p>
      </section>
    </div>
  );
}
