import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/** Markdown renderer for policies and blog posts (GFM tables, blockquotes). */
export function Markdown({ content, className }: { content: string; className?: string }) {
  return (
    <div
      className={cn(
        "prose-brand max-w-none [overflow-wrap:anywhere] text-ink-900 [&_a]:text-gold-700 [&_a]:underline [&_a]:underline-offset-4 [&_blockquote]:my-6 [&_blockquote]:border-s-2 [&_blockquote]:border-gold-500 [&_blockquote]:bg-sand-100 [&_blockquote]:px-5 [&_blockquote]:py-3 [&_blockquote]:text-ink-500 [&_code]:rounded [&_code]:bg-sand-100 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-sm [&_h2]:mt-10 [&_h2]:mb-4 [&_h2]:text-2xl [&_h3]:mt-8 [&_h3]:mb-3 [&_h3]:text-xl [&_li]:my-1.5 [&_ol]:my-4 [&_ol]:list-decimal [&_ol]:ps-6 [&_p]:my-4 [&_p]:leading-relaxed [&_strong]:font-semibold [&_table]:my-6 [&_table]:w-full [&_table]:text-sm [&_td]:border-b [&_td]:border-sand-200 [&_td]:px-3 [&_td]:py-2 [&_th]:border-b [&_th]:border-gold-500/50 [&_th]:px-3 [&_th]:py-2 [&_th]:text-start [&_th]:font-semibold [&_ul]:my-4 [&_ul]:list-disc [&_ul]:ps-6",
        className,
      )}
    >
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}
