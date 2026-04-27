import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { useState } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TextInput } from "@/components/ui/text-input";
import { useConfirm } from "@/hooks/use-confirm";
import { FolderOpen, Plus, X } from "lucide-react";

export function ComposeDirsEditor() {
  const queryClient = useQueryClient();
  const { confirm, dialog: confirmDialog } = useConfirm();

  const { data, isLoading } = useQuery({
    queryKey: ["settings", "compose-dirs"],
    queryFn: api.info.getComposeDirs,
    staleTime: 30_000,
  });

  const [draft, setDraft] = useState<string[] | null>(null);
  const [newPath, setNewPath] = useState("");
  const dirs = draft ?? data?.dirs ?? [];

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: (d: string[]) => api.info.setComposeDirs(d),
    onSuccess: (_, d) => {
      queryClient.setQueryData(["settings", "compose-dirs"], { dirs: d });
      queryClient.invalidateQueries({ queryKey: ["info"] });
      setDraft(null);
      toast.success("Compose directories saved");
    },
    onError: () => toast.error("Failed to save compose directories"),
  });

  async function pickFolder() {
    try {
      const selected = await openDialog({ directory: true, multiple: false });
      if (typeof selected === "string" && selected) {
        setDraft([...dirs, selected]);
      }
    } catch {
      // Dialog cancelled or not available — fall back to manual input.
    }
  }

  function addManual() {
    const trimmed = newPath.trim();
    if (!trimmed || dirs.includes(trimmed)) return;
    setDraft([...dirs, trimmed]);
    setNewPath("");
  }

  function remove(path: string) {
    setDraft(dirs.filter((d) => d !== path));
  }

  const isDirty = draft !== null;

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Compose Directories</CardTitle>
        </CardHeader>
        <CardContent className="pt-2 space-y-3">
          <p className="text-xs text-muted-foreground">
            Harbr scans these directories for compose files on startup and when
            listing projects.
          </p>

          <div className="space-y-1.5">
            {isLoading ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : dirs.length === 0 ? (
              <p className="text-xs text-muted-foreground">No directories configured.</p>
            ) : (
              dirs.map((d) => (
                <div
                  key={d}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/40 border border-border/40"
                >
                  <span className="text-xs font-mono flex-1 truncate">{d}</span>
                  <button
                    onClick={async () => {
                      const ok = await confirm({
                        title: "Remove directory?",
                        description: `"${d}" will be removed from the compose directories list.`,
                        confirmLabel: "Remove",
                      });
                      if (ok) remove(d);
                    }}
                    className="text-muted-foreground hover:text-destructive transition-colors shrink-0"
                    title="Remove"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="flex gap-2">
            <TextInput
              value={newPath}
              onChange={(e) => setNewPath(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addManual()}
              placeholder="/home/user/compose-projects"
              className="font-mono text-xs h-8"
            />
            <Button variant="outline" size="sm" onClick={addManual} disabled={!newPath.trim()}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
            <Button variant="outline" size="sm" onClick={pickFolder} title="Browse…">
              <FolderOpen className="h-3.5 w-3.5" />
            </Button>
          </div>

          {isDirty && (
            <div className="flex gap-2 pt-1">
              <Button size="sm" onClick={() => save(dirs)} disabled={saving}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDraft(null)} disabled={saving}>
                Discard
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      {confirmDialog}
    </>
  );
}
