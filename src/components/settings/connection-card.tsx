import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { api, type AppInfo } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TextInput } from "@/components/ui/text-input";
import { Label } from "@/components/ui/label";

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-4 py-2.5">
      <span className="text-sm text-muted-foreground w-36 shrink-0">{label}</span>
      <span className="text-sm font-mono break-all">{value || "—"}</span>
    </div>
  );
}

export function ConnectionCard({ info }: { info?: AppInfo }) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<string | null>(null);
  const [restartRequired, setRestartRequired] = useState(false);

  const socket = draft ?? info?.socket_path ?? "";

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: (s: string) => api.info.setPodmanSocket(s),
    onSuccess: (_, s) => {
      queryClient.setQueryData<AppInfo>(["info"], (prev) =>
        prev ? { ...prev, socket_path: s } : prev
      );
      setDraft(null);
      setRestartRequired(true);
      toast.success("Socket path saved — restart Harbr to apply");
    },
    onError: () => toast.error("Failed to save socket path"),
  });

  const isDirty = draft !== null && draft !== info?.socket_path;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Connection</CardTitle>
      </CardHeader>
      <CardContent className="pt-2 space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Podman socket</Label>
          <div className="flex gap-2">
            <TextInput
              value={socket}
              onChange={(e) => {
                setDraft(e.target.value);
                setRestartRequired(false);
              }}
              placeholder="/run/user/1000/podman/podman.sock"
              className="font-mono text-xs h-8 flex-1"
            />
            {isDirty && (
              <>
                <Button size="sm" className="h-8" onClick={() => save(socket)} disabled={saving || !socket.trim()}>
                  {saving ? "Saving…" : "Save"}
                </Button>
                <Button size="sm" variant="ghost" className="h-8" onClick={() => { setDraft(null); setRestartRequired(false); }} disabled={saving}>
                  Discard
                </Button>
              </>
            )}
          </div>
          {restartRequired && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              Restart Harbr to connect using the new socket path.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Path to the Podman socket. On Windows use the named pipe path, e.g.{" "}
            <span className="font-mono">\\.\pipe\podman-machine-default</span>.
          </p>
        </div>
        <div className="divide-y divide-border/40 pt-1">
          <InfoRow label="Daemon port" value={info ? String(info.daemon_port) : "…"} />
          <InfoRow label="Config file" value={info?.config_file ?? "…"} />
          <InfoRow label="Data directory" value={info?.data_dir ?? "…"} />
        </div>
        <p className="text-xs text-muted-foreground pt-1">
          The daemon port is configurable via <span className="font-mono">config.toml</span>.
          Changing it only takes effect in headless mode — the desktop app connects to port 9090 internally.
        </p>
      </CardContent>
    </Card>
  );
}
