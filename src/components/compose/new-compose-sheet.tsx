import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { invoke } from "@tauri-apps/api/core";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TextInput } from "@/components/ui/text-input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ComposeEditor, formatYaml, isValidYaml } from "@/components/compose/compose-editor";
import { api } from "@/lib/api";
import { FolderOpen, Loader2, Plus, X } from "lucide-react";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { Checkbox } from "@/components/ui/checkbox";

const TEMPLATE = `services:
  web:
    image: nginx:alpine
    ports:
      - "8080:80"
`;

export function NewProjectSheet({ onCreated }: { onCreated: (name: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [content, setContent] = useState(TEMPLATE);
  const [workingDir, setWorkingDir] = useState("");
  const [workingDirError, setWorkingDirError] = useState("");
  const [formatOnSave, setFormatOnSave] = useLocalStorage("harbr:compose:format-on-save", false);
  const [validating, setValidating] = useState(false);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [sheetWidth, setSheetWidth] = useState(520);
  const dragging = useRef(false);

  function onDragStart(e: React.MouseEvent) {
    e.preventDefault();
    dragging.current = true;

    function onMove(ev: MouseEvent) {
      if (!dragging.current) return;
      const width = window.innerWidth - ev.clientX;
      setSheetWidth(Math.min(Math.max(width, 380), window.innerWidth * 0.9));
    }

    function onUp() {
      dragging.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  async function handlePickFolder() {
    const selected = await openDialog({ directory: true, multiple: false });
    if (typeof selected === "string") {
      setWorkingDir(selected);
      setWorkingDirError("");
    }
  }

  async function handleWorkingDirBlur() {
    if (!workingDir.trim()) {
      setWorkingDirError("");
      return;
    }
    const valid = await invoke<boolean>("check_dir_exists", { path: workingDir.trim() });
    setWorkingDirError(valid ? "" : "Folder does not exist");
  }

  const createMutation = useMutation({
    mutationFn: () => {
      const finalContent = formatOnSave ? (() => { try { return formatYaml(content); } catch { return content; } })() : content;
      return api.compose.create(name.trim(), finalContent, workingDir || undefined);
    },
    onSuccess: () => {
      const createdName = name.trim();
      setOpen(false);
      setName("");
      setContent(TEMPLATE);
      setWorkingDir("");
      setValidationErrors([]);
      onCreated(createdName);
      toast.success("Project created");
    },
    onError: (e) => {
      const msg = e instanceof Error ? e.message : String(e);
      toast.error(`Create failed: ${msg}`);
    },
  });

  async function handleValidate() {
    setValidating(true);
    try {
      const result = await api.compose.validate(content);
      setValidationErrors(result.errors);
      if (result.valid) toast.success("YAML is valid");
      else toast.error(`Validation failed: ${result.errors.join(", ")}`);
    } finally {
      setValidating(false);
    }
  }

  const canCreate = name.trim().length > 0 && isValidYaml(content) && !workingDirError;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" className="gap-1.5 shrink-0">
          <Plus className="h-3.5 w-3.5" />
          New project
        </Button>
      </SheetTrigger>
      <SheetContent
        className="!max-w-none !p-0"
        style={{ width: sheetWidth }}
      >
        {/* Drag handle */}
        <div
          onMouseDown={onDragStart}
          className="absolute left-0 inset-y-0 w-1.5 cursor-col-resize hover:bg-border/60 transition-colors z-10"
        />

        {/* Inner layout */}
        <div className="flex flex-col h-full p-6 gap-4 overflow-hidden">
          <SheetHeader className="shrink-0">
            <SheetTitle>New Compose Project</SheetTitle>
          </SheetHeader>

          <div className="shrink-0 flex flex-col gap-2">
            <label htmlFor="project-name" className="text-sm font-medium">
              Project name
            </label>
            <TextInput
              id="project-name"
              placeholder="my-project"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="shrink-0 flex flex-col gap-2">
            <label className="text-sm font-medium">
              Working directory <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <div className="flex gap-2 items-center">
              <div className="flex-1 min-w-0 flex flex-col gap-1">
                <TextInput
                  placeholder="/home/user/myproject"
                  value={workingDir}
                  onChange={(e) => { setWorkingDir(e.target.value); setWorkingDirError(""); }}
                  onBlur={() => void handleWorkingDirBlur()}
                  className={workingDirError ? "border-destructive focus-visible:ring-destructive" : ""}
                />
                {workingDirError && (
                  <p className="text-xs text-destructive">{workingDirError}</p>
                )}
              </div>
              {workingDir && (
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 self-start" onClick={() => { setWorkingDir(""); setWorkingDirError(""); }}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={handlePickFolder}>
                <FolderOpen className="h-3.5 w-3.5" />
                Browse
              </Button>
            </div>
            {workingDir && (
              <p className="text-xs text-muted-foreground">
                Config files in this folder are available to your compose file via relative paths.
              </p>
            )}
          </div>

          <div className="flex-1 min-h-0 flex flex-col gap-2">
            <div className="flex items-center justify-between shrink-0">
              <span className="text-sm font-medium">compose.yml</span>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
                <Checkbox
                  checked={formatOnSave}
                  onCheckedChange={(v) => setFormatOnSave(v === true)}
                  className="h-3.5 w-3.5"
                />
                Format on create
              </label>
            </div>
            <ComposeEditor
              value={content}
              onChange={setContent}
              className="flex-1 min-h-0"
            />
          </div>

          {validationErrors.length > 0 && (
            <div className="shrink-0 rounded-md border border-destructive/50 bg-destructive/10 p-3">
              {validationErrors.map((e, i) => (
                <p key={i} className="text-xs text-destructive">
                  {e}
                </p>
              ))}
            </div>
          )}

          <div className="shrink-0 flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                try { setContent(formatYaml(content)); }
                catch { toast.error("Could not format — invalid YAML"); }
              }}
            >
              Format
            </Button>
            <Button variant="outline" onClick={handleValidate} disabled={validating}>
              {validating && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
              Validate
            </Button>
            <Button
              className="flex-1"
              onClick={() => createMutation.mutate()}
              disabled={!canCreate || createMutation.isPending}
            >
              {createMutation.isPending ? "Creating…" : "Create"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
