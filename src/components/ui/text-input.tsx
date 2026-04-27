import * as React from "react"
import { Input } from "@/components/ui/input"

/**
 * Input variant for text entry fields (names, paths, values etc).
 * Wires up Ctrl/Cmd+Z/Y for undo/redo which WebKitGTK doesn't handle
 * natively for <input> elements.
 */
function TextInput({ onKeyDown, ...props }: React.ComponentProps<"input">) {
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    const mod = e.ctrlKey || e.metaKey;
    if (mod && e.key === "z" && !e.shiftKey) {
      e.preventDefault();
      document.execCommand("undo");
    } else if (mod && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
      e.preventDefault();
      document.execCommand("redo");
    }
    onKeyDown?.(e);
  }

  return <Input onKeyDown={handleKeyDown} {...props} />;
}

export { TextInput }
