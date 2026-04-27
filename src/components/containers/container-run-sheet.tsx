import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, type PortMapping } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/text-input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Plus, Trash2 } from "lucide-react";
import { CommandEditor } from "@/components/containers/command-editor";

interface PortRow { host: string; container: string }
interface EnvRow { value: string }

/** Shell-aware tokeniser — respects single quotes, double quotes, and backslash escapes. */
function shellSplit(input: string): string[] {
  const args: string[] = [];
  let current = "";
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (ch === "'") {
      i++;
      while (i < input.length && input[i] !== "'") current += input[i++];
      i++;
    } else if (ch === '"') {
      i++;
      while (i < input.length && input[i] !== '"') {
        if (input[i] === "\\" && i + 1 < input.length) { i++; current += input[i++]; }
        else current += input[i++];
      }
      i++;
    } else if (ch === "\\") {
      i++;
      if (i < input.length) current += input[i++];
    } else if (/\s/.test(ch)) {
      if (current.length > 0) { args.push(current); current = ""; }
      i++;
    } else {
      current += input[i++];
    }
  }
  if (current.length > 0) args.push(current);
  return args;
}

const EMPTY_RUN_FORM = {
  image: "",
  name: "",
  ports: [] as PortRow[],
  env: [] as EnvRow[],
  cmd: "",
};

interface RunContainerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RunContainerSheet({ open, onOpenChange }: RunContainerSheetProps) {
  const queryClient = useQueryClient();
  const [runForm, setRunForm] = useState(EMPTY_RUN_FORM);

  const runContainer = useMutation({
    mutationFn: () => {
      const ports: PortMapping[] = runForm.ports
        .filter((p) => p.host && p.container)
        .map((p) => ({
          host_port: parseInt(p.host, 10),
          container_port: parseInt(p.container, 10),
        }));
      const env = runForm.env.map((e) => e.value).filter(Boolean);
      const cmd = runForm.cmd.trim()
        ? shellSplit(runForm.cmd.trim())
        : undefined;
      return api.containers.run({
        image: runForm.image.trim(),
        name: runForm.name.trim() || undefined,
        ports: ports.length ? ports : undefined,
        env: env.length ? env : undefined,
        cmd,
      });
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["containers"] });
      onOpenChange(false);
      setRunForm(EMPTY_RUN_FORM);
      toast.success("Container started");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : String(e)),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>Run container</SheetTitle>
          <SheetDescription>Start a new container from an image.</SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-5">
          {/* Image */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="run-image">Image <span className="text-destructive">*</span></Label>
            <TextInput
              id="run-image"
              placeholder="docker.io/library/nginx:latest"
              value={runForm.image}
              onChange={(e) => setRunForm((f) => ({ ...f, image: e.target.value }))}
            />
          </div>

          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="run-name">Name <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <TextInput
              id="run-name"
              placeholder="my-container"
              value={runForm.name}
              onChange={(e) => setRunForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>

          {/* Port mappings */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>Port mappings</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() =>
                  setRunForm((f) => ({ ...f, ports: [...f.ports, { host: "", container: "" }] }))
                }
              >
                <Plus className="h-3 w-3 mr-1" /> Add
              </Button>
            </div>
            {runForm.ports.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {runForm.ports.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <TextInput
                      className="h-8 text-sm"
                      placeholder="8080"
                      value={p.host}
                      onChange={(e) =>
                        setRunForm((f) => {
                          const ports = [...f.ports];
                          ports[i] = { ...ports[i], host: e.target.value };
                          return { ...f, ports };
                        })
                      }
                    />
                    <span className="text-muted-foreground shrink-0">:</span>
                    <TextInput
                      className="h-8 text-sm"
                      placeholder="80"
                      value={p.container}
                      onChange={(e) =>
                        setRunForm((f) => {
                          const ports = [...f.ports];
                          ports[i] = { ...ports[i], container: e.target.value };
                          return { ...f, ports };
                        })
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() =>
                        setRunForm((f) => ({
                          ...f,
                          ports: f.ports.filter((_, j) => j !== i),
                        }))
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Env vars */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <Label>Environment variables</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() =>
                  setRunForm((f) => ({ ...f, env: [...f.env, { value: "" }] }))
                }
              >
                <Plus className="h-3 w-3 mr-1" /> Add
              </Button>
            </div>
            {runForm.env.length > 0 && (
              <div className="flex flex-col gap-1.5">
                {runForm.env.map((e, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <TextInput
                      className="h-8 text-sm font-mono"
                      placeholder="KEY=value"
                      value={e.value}
                      onChange={(ev) =>
                        setRunForm((f) => {
                          const env = [...f.env];
                          env[i] = { value: ev.target.value };
                          return { ...f, env };
                        })
                      }
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() =>
                        setRunForm((f) => ({
                          ...f,
                          env: f.env.filter((_, j) => j !== i),
                        }))
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Command override */}
          <div className="flex flex-col gap-1.5">
            <Label>Command override <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <CommandEditor
              placeholder={"nginx -g 'daemon off;'"}
              value={runForm.cmd}
              onChange={(v) => setRunForm((f) => ({ ...f, cmd: v }))}
            />
          </div>

          <Button
            className="mt-2"
            disabled={!runForm.image.trim() || runContainer.isPending}
            onClick={() => runContainer.mutate()}
          >
            {runContainer.isPending ? "Starting…" : "Run container"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
