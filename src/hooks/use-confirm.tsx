import { useCallback, useRef, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export interface ConfirmOptions {
  title: string;
  description?: string;
  /** Label for the confirm button. Defaults to "Confirm". */
  confirmLabel?: string;
}

/**
 * Returns a `confirm(opts)` async function and a `dialog` element to render.
 *
 * Usage:
 *   const { confirm, dialog } = useConfirm();
 *   // ...
 *   const ok = await confirm({ title: "Remove volume?", confirmLabel: "Remove" });
 *   if (ok) mutation.mutate(id);
 *   // render {dialog} somewhere in the JSX tree
 */
export function useConfirm() {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState<ConfirmOptions>({ title: "" });
  const resolveRef = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions | string): Promise<boolean> => {
    const o = typeof options === "string" ? { title: options } : options;
    setOpts(o);
    setOpen(true);
    return new Promise((res) => {
      resolveRef.current = res;
    });
  }, []);

  function settle(value: boolean) {
    setOpen(false);
    resolveRef.current?.(value);
    resolveRef.current = null;
  }

  const dialog = (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o) settle(false); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{opts.title}</AlertDialogTitle>
          {opts.description && (
            <AlertDialogDescription>{opts.description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => settle(false)}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={() => settle(true)}
          >
            {opts.confirmLabel ?? "Confirm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return { confirm, dialog };
}
