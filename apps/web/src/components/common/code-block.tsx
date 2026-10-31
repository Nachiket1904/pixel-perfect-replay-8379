import { Check, Copy } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";

/** Read-only code display. The Monaco editor replaces this where learners type (Day 15). */
export function CodeBlock({ code, label }: { code: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked (e.g. insecure context); copying is a nice-to-have.
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
      <div className="flex items-center justify-between border-b border-slate-800 px-3 py-1.5">
        <span className="font-mono text-xs text-slate-400">{label ?? "python"}</span>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => void copy()}
          className="h-7 text-slate-300 hover:bg-slate-800 hover:text-white"
        >
          {copied ? <Check className="mr-1 size-3.5" /> : <Copy className="mr-1 size-3.5" />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre className="overflow-x-auto p-4 font-mono text-sm leading-6 text-slate-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}
