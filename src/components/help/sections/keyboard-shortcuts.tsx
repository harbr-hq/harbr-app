import { Kbd } from "@/components/help/kbd";

const isMac = typeof navigator !== "undefined" && /Mac/.test(navigator.platform);
const Mod = () => <Kbd>{isMac ? "⌘" : "Ctrl"}</Kbd>;

function ShortcutRow({ keys, description }: { keys: React.ReactNode; description: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 gap-4">
      <span className="text-sm text-muted-foreground">{description}</span>
      <div className="flex items-center gap-1 shrink-0">{keys}</div>
    </div>
  );
}

export function KeyboardShortcutsSection() {
  return (
    <div className="space-y-10">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Keyboard Shortcuts</h2>
        <p className="mt-2 text-muted-foreground">
          Shortcuts available throughout Harbr.
        </p>
      </div>

      {/* Global */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Global</h3>
        <div className="rounded-lg border divide-y text-sm">
          <ShortcutRow
            description="Open Preferences"
            keys={<><Mod /><span className="text-muted-foreground mx-0.5">,</span></>}
          />
        </div>
      </section>

      {/* Log Viewer */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Log Viewer</h3>
        <div className="rounded-lg border divide-y text-sm">
          <ShortcutRow
            description="Pause / resume log stream"
            keys={<Kbd>Space</Kbd>}
          />
          <ShortcutRow
            description="Focus filter input"
            keys={<><Kbd>/</Kbd></>}
          />
        </div>
      </section>

      {/* Terminal */}
      <section className="space-y-3">
        <h3 className="text-lg font-semibold">Terminal</h3>
        <p className="text-sm text-muted-foreground">
          Standard terminal shortcuts apply — the xterm.js terminal passes all keystrokes directly
          to the shell inside the container.
        </p>
        <div className="rounded-lg border divide-y text-sm">
          <ShortcutRow description="Interrupt (SIGINT)" keys={<><Kbd>Ctrl</Kbd><span className="text-muted-foreground mx-0.5">+</span><Kbd>C</Kbd></>} />
          <ShortcutRow description="End of file" keys={<><Kbd>Ctrl</Kbd><span className="text-muted-foreground mx-0.5">+</span><Kbd>D</Kbd></>} />
          <ShortcutRow description="Clear screen" keys={<><Kbd>Ctrl</Kbd><span className="text-muted-foreground mx-0.5">+</span><Kbd>L</Kbd></>} />
          <ShortcutRow description="Previous command" keys={<Kbd>↑</Kbd>} />
          <ShortcutRow description="Copy selection" keys={<><Kbd>Ctrl</Kbd><span className="text-muted-foreground mx-0.5">+</span><Kbd>Shift</Kbd><span className="text-muted-foreground mx-0.5">+</span><Kbd>C</Kbd></>} />
          <ShortcutRow description="Paste" keys={<><Kbd>Ctrl</Kbd><span className="text-muted-foreground mx-0.5">+</span><Kbd>Shift</Kbd><span className="text-muted-foreground mx-0.5">+</span><Kbd>V</Kbd></>} />
        </div>
      </section>
    </div>
  );
}
