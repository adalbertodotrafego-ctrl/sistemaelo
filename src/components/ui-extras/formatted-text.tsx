function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const URL_RE = /(https?:\/\/[^\s<]+)/g;
const BOLD_RE = /\*\*(.+?)\*\*/g;
const ITALIC_RE = /_(.+?)_/g;

// Renders a lightweight, safe subset of markdown: **bold**, _italic_, and
// auto-linked URLs. Input is HTML-escaped first, so the eventual innerHTML
// only ever contains tags we generated ourselves — never anything from the
// original text — which is what makes dangerouslySetInnerHTML fine here.
export function formatMiniMarkdown(raw: string): string {
  let html = escapeHtml(raw);
  html = html.replace(URL_RE, (url) => `<a href="${url}" target="_blank" rel="noreferrer" class="underline hover:no-underline">${url}</a>`);
  html = html.replace(BOLD_RE, "<strong>$1</strong>");
  html = html.replace(ITALIC_RE, "<em>$1</em>");
  html = html.replace(/\n/g, "<br/>");
  return html;
}

export function FormattedText({ text, className }: { text: string; className?: string }) {
  if (!text) return null;
  return <span className={className} dangerouslySetInnerHTML={{ __html: formatMiniMarkdown(text) }} />;
}
