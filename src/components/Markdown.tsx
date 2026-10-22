// Renders editorial Markdown safely. Member posts are shown as plain text (see PlainText) and never as HTML.
import DOMPurify from "dompurify";
import { marked } from "marked";
import { useMemo } from "react";
import { asset } from "../lib/backend";

marked.setOptions({ gfm: true, breaks: false });

DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A") {
    const href = node.getAttribute("href") ?? "";
    if (/^https?:\/\//i.test(href)) { node.setAttribute("target", "_blank"); node.setAttribute("rel", "noopener noreferrer"); }
    else if (/^\/(?!\/)/.test(href)) node.setAttribute("href", asset(href));  // site links work from a subfolder too
  }
});

export function Markdown({ text, className = "prose-calm" }: { text: string; className?: string }) {
  const html = useMemo(() => DOMPurify.sanitize(marked.parse(text ?? "", { async: false }) as string, { USE_PROFILES: { html: true } }), [text]);
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Member-written text: no HTML or Markdown, line breaks kept. */
export function PlainText({ text, className = "" }: { text: string; className?: string }) {
  return <div className={`whitespace-pre-wrap break-words ${className}`}>{text}</div>;
}
