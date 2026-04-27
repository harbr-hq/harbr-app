import { useEffect, useRef } from "react";
import { EditorView, basicSetup } from "codemirror";
import { ViewPlugin, Decoration, type DecorationSet, keymap } from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { yaml } from "@codemirror/lang-yaml";
import { oneDarkTheme } from "@codemirror/theme-one-dark";
import { HighlightStyle, syntaxHighlighting, syntaxTree } from "@codemirror/language";
import { tags } from "@lezer/highlight";
import { EditorState } from "@codemirror/state";
import { indentWithTab } from "@codemirror/commands";
import { linter, lintGutter, type Diagnostic } from "@codemirror/lint";
import jsYaml from "js-yaml";

// ── YAML syntax highlight style ───────────────────────────────────────────────
// All keys are handled by the depth plugin below — propertyName is intentionally
// omitted here so the plugin has full control over key colouring.
const yamlHighlight = HighlightStyle.define([
  // Quoted string values
  { tag: tags.string,                        color: "#86efac" },
  // Block literal headers (|, >, |-, >-)
  { tag: tags.special(tags.string),          color: "#86efac", fontStyle: "italic" },
  // Unquoted values — numbers, booleans, null, plain strings all land here
  { tag: tags.content,                       color: "#e2e8f0" },
  // Comments
  { tag: tags.lineComment,                   color: "#6b7280", fontStyle: "italic" },
  // Document boundaries (--- and ...)
  { tag: tags.meta,                          color: "#94a3b8" },
  // : , - separators
  { tag: tags.separator,                     color: "#94a3b8" },
  // ? punctuation (explicit key marker)
  { tag: tags.punctuation,                   color: "#94a3b8" },
  // Anchors (&name) and aliases (*name)
  { tag: tags.labelName,                     color: "#c084fc" },
  // YAML tags (!!str, !!int, !!map …)
  { tag: tags.typeName,                      color: "#fbbf24" },
  // Flow sequence brackets [] and mapping braces {}
  { tag: tags.squareBracket,                 color: "#94a3b8" },
  { tag: tags.brace,                         color: "#94a3b8" },
  // Directive names (%YAML, %TAG)
  { tag: tags.keyword,                       color: "#f472b6" },
  // Directive values
  { tag: tags.attributeValue,                color: "#fbbf24" },
  // Invalid tokens
  { tag: tags.invalid,                       color: "#ffffff", backgroundColor: "#e06c75" },
]);

// ── Depth-aware key colouring ─────────────────────────────────────────────────
// Walk the syntax tree and count BlockMapping ancestors to determine nesting depth.
// Each depth level gets a distinct colour so the visual hierarchy is immediately clear.
//   depth 1 → top-level keys  (services, volumes, networks, version…)  coral
//   depth 2 → named items     (web, api, db…)                          purple
//   depth 3+→ property keys   (image, ports, command…)                 sky blue

const KEY_COLOURS = ["#e06c75", "#c084fc", "#7dd3fc"] as const;

function getKeyColour(depth: number): string {
  if (depth <= 1) return KEY_COLOURS[0];
  if (depth === 2) return KEY_COLOURS[1];
  return KEY_COLOURS[2];
}

function buildKeyDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const tree = syntaxTree(view.state);

  for (const { from, to } of view.visibleRanges) {
    tree.iterate({
      from,
      to,
      enter(node) {
        // Target the Literal / QuotedLiteral nodes that are direct children of a Key node.
        if (
          (node.name !== "Literal" && node.name !== "QuotedLiteral") ||
          node.node.parent?.name !== "Key"
        ) return;

        // Count BlockMapping ancestors to determine nesting depth.
        let depth = 0;
        let p = node.node.parent as { name: string; parent: typeof p | null } | null;
        while (p) {
          if (p.name === "BlockMapping" || p.name === "FlowMapping") depth++;
          p = p.parent;
        }

        const colour = getKeyColour(depth);
        builder.add(
          node.from,
          node.to,
          Decoration.mark({ attributes: { style: `color: ${colour}; font-weight: bold` } }),
        );
      },
    });
  }

  return builder.finish();
}

const yamlKeyDepthPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = buildKeyDecorations(view);
    }
    update(update: { docChanged: boolean; viewportChanged: boolean; view: EditorView }) {
      if (update.docChanged || update.viewportChanged) {
        this.decorations = buildKeyDecorations(update.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

interface ComposeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  className?: string;
}

export function isValidYaml(content: string): boolean {
  if (!content.trim()) return false;
  try { jsYaml.load(content); return true; } catch { return false; }
}

/** Parse → re-dump the YAML to normalise indentation and style. */
export function formatYaml(content: string): string {
  const parsed = jsYaml.load(content);
  return jsYaml.dump(parsed, { indent: 2, lineWidth: -1, noRefs: true });
}

/** CodeMirror linter — uses js-yaml to surface parse errors as diagnostics. */
function yamlLinter(view: EditorView): Diagnostic[] {
  const content = view.state.doc.toString();
  if (!content.trim()) return [];
  try {
    jsYaml.load(content);
    return [];
  } catch (e) {
    if (!(e instanceof jsYaml.YAMLException)) return [];
    const mark = e.mark;
    const line = view.state.doc.line(Math.min(mark.line + 1, view.state.doc.lines));
    const from = line.from + Math.min(mark.column, line.length);
    return [{
      from,
      to: Math.min(from + 1, line.to),
      severity: "error",
      message: e.reason,
    }];
  }
}

export function ComposeEditor({
  value,
  onChange,
  readOnly = false,
  className,
}: ComposeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!containerRef.current) return;

    const view = new EditorView({
      state: EditorState.create({
        doc: value,
        extensions: [
          basicSetup,
          yaml(),
          oneDarkTheme,
          syntaxHighlighting(yamlHighlight),
          yamlKeyDepthPlugin,
          keymap.of([indentWithTab]),
          linter(yamlLinter, { delay: 300 }),
          lintGutter(),
          EditorState.readOnly.of(readOnly),
          EditorView.updateListener.of((update) => {
            if (update.docChanged && onChangeRef.current) {
              onChangeRef.current(update.state.doc.toString());
            }

            // Auto-format on paste — runs after CM has inserted the raw text.
            if (readOnly) return;
            if (!update.transactions.some((tr) => tr.isUserEvent("input.paste"))) return;
            const content = update.state.doc.toString();
            try {
              const formatted = formatYaml(content);
              if (formatted === content) return;
              requestAnimationFrame(() => {
                update.view.dispatch({
                  changes: { from: 0, to: update.view.state.doc.length, insert: formatted },
                  selection: { anchor: 0 },
                  scrollIntoView: true,
                });
              });
            } catch {
              // Invalid YAML — leave as-is, linter will squiggle it.
            }
          }),
          EditorView.theme({
            "&": { height: "100%" },
            ".cm-scroller": { overflow: "auto" },
          }),
        ],
      }),
      parent: containerRef.current,
    });

    viewRef.current = view;

    const observer = new ResizeObserver(() => view.requestMeasure());
    observer.observe(containerRef.current);

    return () => {
      observer.disconnect();
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  }, [value]);

  return (
    <div
      ref={containerRef}
      className={`rounded-md overflow-hidden border border-border text-sm font-mono ${className ?? ""}`}
    />
  );
}
