import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { ComposeEditor, formatYaml } from "@/components/compose/compose-editor";
import { Copy, FolderOpen, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { useLocalStorage } from "@/hooks/use-local-storage";

export function FileTab({ name }: { name: string }) {
  const queryClient = useQueryClient();

  const { data: project } = useQuery({
    queryKey: ["compose", name],
    queryFn: () => api.compose.inspect(name),
  });

  const { data: fileData, isLoading } = useQuery({
    queryKey: ["compose-file", name],
    queryFn: () => api.compose.getFile(name),
    enabled: !!project?.file_path,
    retry: 1,
  });

  const [localContent, setLocalContent] = useState("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [validating, setValidating] = useState(false);
  const [formatOnSave, setFormatOnSave] = useLocalStorage("harbr:compose:format-on-save", false);
  const seededRef = useRef(false);

  useEffect(() => {
    if (fileData && !seededRef.current) {
      seededRef.current = true;
      setLocalContent(fileData.content);
    }
  }, [fileData]);

  const isDirty = localContent !== (fileData?.content ?? "");
  const isManaged = project?.file_managed ?? false;

  const saveMutation = useMutation({
    mutationFn: (content: string) => api.compose.saveFile(name, content),
    onSuccess: () => {
      seededRef.current = false;
      void queryClient.invalidateQueries({ queryKey: ["compose-file", name] });
      toast.success("File saved");
    },
    onError: (e) =>
      toast.error(`Save failed: ${e instanceof Error ? e.message : String(e)}`),
  });

  function handleSave() {
    let content = localContent;
    if (formatOnSave) {
      try {
        content = formatYaml(localContent);
        setLocalContent(content);
      } catch {
        // Invalid YAML — save as-is, linter will highlight the problem.
      }
    }
    saveMutation.mutate(content);
  }

  async function handleValidate() {
    setValidating(true);
    try {
      const result = await api.compose.validate(localContent);
      setValidationErrors(result.errors);
      if (result.valid) toast.success("YAML is valid");
      else toast.error(`Validation errors: ${result.errors.join(", ")}`);
    } finally {
      setValidating(false);
    }
  }

  if (!project?.file_path) {
    return (
      <div className="mt-3 rounded-lg border border-dashed p-8 text-center text-muted-foreground">
        <p className="text-sm">No compose file associated with this project.</p>
        <p className="text-xs mt-1">
          This project was detected from container labels — Harbr doesn&apos;t manage its file.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return <Skeleton className="h-64 w-full rounded-lg mt-3" />;
  }

  return (
    <div className="flex flex-col gap-3 mt-3 pb-4 h-[calc(100vh-12rem)] overflow-hidden">
      {!isManaged && (
        <p className="text-xs text-muted-foreground rounded-md border border-dashed px-3 py-2 shrink-0">
          This file is not managed by Harbr — read-only.
          <span className="ml-1 font-mono">{project.file_path}</span>
        </p>
      )}

      {project.working_dir && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground shrink-0">
          <FolderOpen className="h-3.5 w-3.5 shrink-0" />
          <span className="font-medium text-foreground">Working dir</span>
          <span className="font-mono truncate" title={project.working_dir}>{project.working_dir}</span>
        </div>
      )}

      <div className="relative flex-1 min-h-0">
        <button
          className="absolute top-2 right-2 z-10 p-1.5 rounded text-muted-foreground/60 hover:text-muted-foreground hover:bg-white/10 transition-colors"
          onClick={() =>
            void navigator.clipboard
              .writeText(localContent)
              .then(() => toast.success("Copied to clipboard"))
          }
          title="Copy file contents"
        >
          <Copy className="h-3.5 w-3.5" />
        </button>
        <ComposeEditor
          value={localContent}
          onChange={isManaged ? setLocalContent : undefined}
          readOnly={!isManaged}
          className="h-full"
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

      {isManaged && (
        <div className="shrink-0 flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              try { setLocalContent(formatYaml(localContent)); }
              catch { toast.error("Could not format — invalid YAML"); }
            }}
          >
            Format
          </Button>
          <Button variant="outline" onClick={handleValidate} disabled={validating}>
            {validating && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
            Validate
          </Button>
          <div className="flex-1" />
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer select-none">
            <Checkbox
              checked={formatOnSave}
              onCheckedChange={(v) => setFormatOnSave(v === true)}
            />
            Format on save
          </label>
          <Button
            onClick={handleSave}
            disabled={!isDirty || saveMutation.isPending}
            className="gap-1.5"
          >
            <Save className="h-3.5 w-3.5" />
            {saveMutation.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      )}
    </div>
  );
}
