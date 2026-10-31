import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

/**
 * Safe Markdown renderer for lesson, summary and AI text.
 * - Raw HTML in the source is dropped (skipHtml), so injected <script>/<img onerror> can't run.
 * - react-markdown's default urlTransform strips javascript: and other unsafe URLs.
 * - External links open in a new tab without leaking window.opener or passing SEO weight.
 */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div
      className={cn(
        "prose prose-slate max-w-none prose-headings:font-semibold prose-headings:text-foreground prose-a:text-primary prose-code:rounded prose-code:bg-secondary prose-code:px-1 prose-code:py-0.5 prose-code:font-mono prose-code:text-[0.85em] prose-code:before:content-none prose-code:after:content-none prose-pre:bg-slate-900",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        skipHtml
        components={{
          a: ({ href, children: linkChildren }) => (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow">
              {linkChildren}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
