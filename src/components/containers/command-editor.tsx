import { useEffect, useRef } from "react";
import { EditorView, minimalSetup } from "codemirror";
import { placeholder as cmPlaceholder } from "@codemirror/view";
import { oneDarkTheme } from "@codemirror/theme-one-dark";
import { EditorState } from "@codemirror/state";

interface CommandEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

export function CommandEditor({ value, onChange, placeholder, className }: CommandEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current) return;

    const extensions = [
      minimalSetup,
      oneDarkTheme,
      EditorView.lineWrapping,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) onChangeRef.current(update.state.doc.toString());
      }),
      EditorView.theme({
        // Grows with content up to ~10 lines then scrolls.
        "&": { maxHeight: "240px" },
        ".cm-scroller": { overflow: "auto" },
        ".cm-content": { padding: "8px 12px" },
        ".cm-line": { padding: "0" },
        // Subtle caret colour to match the theme.
        ".cm-cursor": { borderLeftColor: "#abb2bf" },
      }),
    ];

    if (placeholder) extensions.push(cmPlaceholder(placeholder));

    const view = new EditorView({
      state: EditorState.create({ doc: value, extensions }),
      parent: containerRef.current,
    });

    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external value changes (e.g. form reset).
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: value } });
    }
  }, [value]);

  return (
    <div
      ref={containerRef}
      className={`rounded-md overflow-hidden border border-border text-sm font-mono ${className ?? ""}`}
    />
  );
}
