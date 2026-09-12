import { escapeHtml } from "./email";

/**
 * Tiny Markdown → HTML for emails: headings, paragraphs, bold/italic, links,
 * images and simple lists. Everything is HTML-escaped first, so the output is
 * safe to embed in the email layout.
 */
export function markdownToEmailHtml(md: string, align: "left" | "right" = "left"): string {
  const inline = (text: string) =>
    escapeHtml(text)
      .replace(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%;border-radius:8px;display:block;margin:8px 0">')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" style="color:#DDB97A">$1</a>')
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|\s)\*([^*]+)\*/g, "$1<em>$2</em>")
      .replace(/(^|\s)(https?:\/\/[^\s<]+)/g, '$1<a href="$2" style="color:#DDB97A">$2</a>');

  const blocks = md.replace(/\r\n/g, "\n").trim().split(/\n{2,}/);
  const html = blocks.map((block) => {
    const lines = block.split("\n");
    if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
      return `<ul style="margin:0 0 14px;padding-inline-start:20px;text-align:${align}">${lines.map((l) => `<li style="margin:4px 0">${inline(l.replace(/^\s*[-*]\s+/, ""))}</li>`).join("")}</ul>`;
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(lines[0]);
    if (h && lines.length === 1) {
      const size = h[1].length === 1 ? 22 : h[1].length === 2 ? 19 : 17;
      return `<h${h[1].length + 1} style="margin:18px 0 8px;font-size:${size}px;font-weight:600;line-height:1.35;text-align:${align}">${inline(h[2])}</h${h[1].length + 1}>`;
    }
    return `<p style="margin:0 0 14px;text-align:${align}">${lines.map(inline).join("<br>")}</p>`;
  });
  return html.join("");
}
