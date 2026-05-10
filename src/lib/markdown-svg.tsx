import { isValidElement, type ReactNode } from "react";

const MAX_SVG_BYTES = 60_000;

export function sanitizeSvg(input: string): string | null {
  const trimmed = input.trim();
  if (!/^<svg[\s>]/i.test(trimmed)) return null;
  if (trimmed.length > MAX_SVG_BYTES) return null;
  const out = trimmed
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<\/?script[^>]*>/gi, "")
    .replace(/<foreignObject\b[^>]*>[\s\S]*?<\/foreignObject>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, "")
    .replace(/\s(href|xlink:href)\s*=\s*("javascript:[^"]*"|'javascript:[^']*'|javascript:[^\s>]+)/gi, "");
  // Re-check size after substitutions.
  if (out.length > MAX_SVG_BYTES) return null;
  return out;
}

// Override <pre> so a fenced ```svg block renders as inline SVG instead of
// monospace source. Anything else falls back to the default <pre>.
type CodeChild = {
  props?: { className?: string; children?: ReactNode };
};

export function PreWithSvg({ children, ...rest }: { children?: ReactNode }) {
  const child = Array.isArray(children) ? children[0] : children;
  if (isValidElement(child)) {
    const c = child as unknown as CodeChild;
    const className = c.props?.className ?? "";
    if (/(?:^|\s)language-svg(?:\s|$)/.test(className)) {
      const raw =
        typeof c.props?.children === "string"
          ? c.props.children
          : Array.isArray(c.props?.children)
            ? c.props.children.filter((x) => typeof x === "string").join("")
            : "";
      const cleaned = sanitizeSvg(raw);
      if (cleaned) {
        return (
          <div
            className="solution-svg my-3 flex justify-center"
            dangerouslySetInnerHTML={{ __html: cleaned }}
          />
        );
      }
    }
  }
  return <pre {...rest}>{children}</pre>;
}
