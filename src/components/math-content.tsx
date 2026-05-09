"use client";

import { MathJax, MathJaxContext } from "better-react-mathjax";
import type { ReactNode } from "react";

const config = {
  loader: { load: ["[tex]/ams", "[tex]/noerrors", "[tex]/noundefined"] },
  tex: {
    inlineMath: [
      ["$", "$"],
      ["\\(", "\\)"],
    ],
    displayMath: [
      ["$$", "$$"],
      ["\\[", "\\]"],
    ],
    packages: { "[+]": ["ams", "noerrors", "noundefined"] },
  },
  options: {
    skipHtmlTags: ["script", "noscript", "style", "textarea", "pre", "code"],
  },
};

export function MathProvider({ children }: { children: ReactNode }) {
  return (
    <MathJaxContext version={3} config={config} src="https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-chtml.js">
      {children}
    </MathJaxContext>
  );
}

export function MathContent({ children }: { children: ReactNode }) {
  return (
    <MathJax dynamic={false} hideUntilTypeset="first" inline={false}>
      {children}
    </MathJax>
  );
}
