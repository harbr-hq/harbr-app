import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Trash2 } from "lucide-react";
import { useConfirm } from "@/hooks/use-confirm";
import { ComposeDirsEditor } from "@/components/settings/compose-dirs-editor";
import { ConnectionCard } from "@/components/settings/connection-card";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});

function SettingsPage() {
  const queryClient = useQueryClient();
  const { confirm, dialog } = useConfirm();

  const { data: info } = useQuery({
    queryKey: ["info"],
    queryFn: api.info.get,
    staleTime: Infinity,
  });

  const { data: closeToPref } = useQuery({
    queryKey: ["prefs", "close_to_tray"],
    queryFn: () => invoke<boolean>("get_close_to_tray"),
    staleTime: Infinity,
  });

  const { mutate: setCloseToPref } = useMutation({
    mutationFn: (value: boolean) => invoke("set_close_to_tray", { value }),
    onSuccess: (_, value) => {
      queryClient.setQueryData(["prefs", "close_to_tray"], value);
    },
  });

  const { data: notificationsPref } = useQuery({
    queryKey: ["prefs", "notifications_enabled"],
    queryFn: () => invoke<boolean>("get_notifications_enabled"),
    staleTime: Infinity,
  });

  const { mutate: setNotificationsPref } = useMutation({
    mutationFn: (value: boolean) => invoke("set_notifications_enabled", { value }),
    onSuccess: (_, value) => {
      queryClient.setQueryData(["prefs", "notifications_enabled"], value);
    },
  });

  const { mutate: clearLogs, isPending: clearingLogs } = useMutation({
    mutationFn: api.logs.clearAll,
    onSuccess: () => toast.success("Log data cleared"),
    onError: () => toast.error("Failed to clear log data"),
  });

  return (
    <div className="max-w-2xl mx-auto py-2 space-y-5">
      <div>
        <h1 className="text-xl font-semibold">Preferences</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          System information and application settings.
        </p>
      </div>

      {/* About */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">About</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 divide-y divide-border/40">
          {[
            ["Harbr version", info?.app_version ?? "…"],
            ["Podman version", info?.podman_version ?? "…"],
            ["Compose binary", info?.compose_bin ?? "Not available"],
          ].map(([label, value]) => (
            <div key={label} className="flex items-start gap-4 py-2.5">
              <span className="text-sm text-muted-foreground w-36 shrink-0">{label}</span>
              <span className="text-sm font-mono break-all">{value || "—"}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <ConnectionCard info={info} />
      <ComposeDirsEditor />

      {/* Interface */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Interface</CardTitle>
        </CardHeader>
        <CardContent className="pt-2 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label>Close to tray</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Hide to system tray when the window is closed instead of quitting.
              </p>
            </div>
            <Switch
              checked={closeToPref ?? true}
              onCheckedChange={(v) => setCloseToPref(v)}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label>System notifications</Label>
              <p className="text-xs text-muted-foreground mt-0.5">
                Show OS notifications for container and compose actions triggered from the tray.
              </p>
            </div>
            <Switch
              checked={notificationsPref ?? true}
              onCheckedChange={(v) => setNotificationsPref(v)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/40">
        <CardHeader className="pb-2">
          <CardTitle className="text-base text-destructive">Danger Zone</CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Clear log data</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Permanently deletes all stored container logs from the local database.
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              disabled={clearingLogs}
              onClick={async () => {
                const ok = await confirm({
                  title: "Clear all log data?",
                  description: "This permanently deletes all stored container logs from the local database. This cannot be undone.",
                  confirmLabel: "Clear logs",
                });
                if (ok) clearLogs();
              }}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1.5" />
              Clear logs
            </Button>
          </div>
        </CardContent>
      </Card>
      {dialog}
    </div>
  );
}
