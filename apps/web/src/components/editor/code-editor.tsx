import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import type { OnMount } from "@monaco-editor/react";
import { Moon, Play, RotateCcw, Square, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

// Monaco is big, so it's split into its own chunk and the editor files themselves load from
// jsDelivr (the @monaco-editor/react default). Nothing is downloaded until the editor is shown.
const MonacoEditor = lazy(() => import("@monaco-editor/react"));

export type EditorLanguage = "python" | "javascript";
type EditorTheme = "vs" | "vs-dark";

const THEME_KEY = "padhlo:editor-theme";

function readTheme(): EditorTheme {
  try {
    return window.localStorage.getItem(THEME_KEY) === "vs-dark" ? "vs-dark" : "vs";
  } catch {
    return "vs"; // storage blocked (private mode, strict settings)
  }
}

export interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: EditorLanguage;
  /** The original code, for the Reset button. Reset is hidden when omitted. */
  initialValue?: string;
  /** Shows a Run button and binds Ctrl/Cmd+Enter. Hidden when omitted. */
  onRun?: () => void;
  /** Shows Stop instead of Run while code is executing. */
  running?: boolean;
  onStop?: () => void;
  readOnly?: boolean;
  /** Editor height in px. */
  height?: number;
  label: string;
  className?: string;
}

export function CodeEditor({
  value,
  onChange,
  language = "python",
  initialValue,
  onRun,
  running = false,
  onStop,
  readOnly = false,
  height = 320,
  label,
  className,
}: CodeEditorProps) {
  const [theme, setTheme] = useState<EditorTheme>("vs");
  // Monaco only works in the browser; render a placeholder during SSR and the first paint.
  const [mounted, setMounted] = useState(false);
  // Keep the latest onRun in a ref so the keybinding registered once at mount never goes stale.
  const runRef = useRef(onRun);
  runRef.current = onRun;

  useEffect(() => {
    setTheme(readTheme());
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    const next: EditorTheme = theme === "vs" ? "vs-dark" : "vs";
    setTheme(next);
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      // not persisted; fine
    }
  };

  const handleMount = useCallback<OnMount>((editor, monaco) => {
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => runRef.current?.());
  }, []);

  const placeholder = <Skeleton className="w-full rounded-none" style={{ height }} />;

  return (
    <div
      className={cn("overflow-hidden rounded-lg border border-border bg-card shadow-sm", className)}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border px-3 py-2">
        <span className="text-sm font-medium text-foreground">
          {language === "python" ? "Python" : "JavaScript"}
        </span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-8"
            onClick={toggleTheme}
            aria-label={theme === "vs" ? "Use dark editor theme" : "Use light editor theme"}
          >
            {theme === "vs" ? (
              <Moon className="size-4" aria-hidden="true" />
            ) : (
              <Sun className="size-4" aria-hidden="true" />
            )}
          </Button>
          {initialValue !== undefined && !readOnly && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange(initialValue)}
              disabled={value === initialValue || running}
            >
              <RotateCcw className="mr-1.5 size-3.5" aria-hidden="true" /> Reset
            </Button>
          )}
          {onRun &&
            (running ? (
              <Button type="button" size="sm" variant="destructive" onClick={onStop}>
                <Square className="mr-1.5 size-3.5" aria-hidden="true" /> Stop
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={onRun}
                className="bg-warning text-foreground hover:bg-warning/90"
                title="Run (Ctrl/Cmd + Enter)"
              >
                <Play className="mr-1.5 size-3.5" aria-hidden="true" /> Run
              </Button>
            ))}
        </div>
      </div>

      <div role="group" aria-label={label}>
        {mounted ? (
          <Suspense fallback={placeholder}>
            <MonacoEditor
              height={height}
              language={language}
              theme={theme}
              value={value}
              onChange={(v) => onChange(v ?? "")}
              onMount={handleMount}
              loading={placeholder}
              options={{
                readOnly,
                fontSize: 14,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                automaticLayout: true, // reflows when the sheet/window resizes
                tabSize: 4,
                wordWrap: "on", // no sideways scrolling on phones
                lineNumbersMinChars: 3,
                padding: { top: 12, bottom: 12 },
                ariaLabel: label,
                // Beginners type fast: suggestions are accepted with Tab only, never by
                // typing "(" or pressing Enter, which silently changed what they wrote.
                acceptSuggestionOnCommitCharacter: false,
                acceptSuggestionOnEnter: "off",
              }}
            />
          </Suspense>
        ) : (
          placeholder
        )}
      </div>
    </div>
  );
}
