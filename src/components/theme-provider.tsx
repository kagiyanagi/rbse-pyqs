"use client";

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { useEffect, type ReactNode } from "react";

const LIGHT_BG = "#ffffff";
const DARK_BG = "#1f1f1f";

function ThemeColorSync() {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    if (typeof document === "undefined") return;
    const color = resolvedTheme === "dark" ? DARK_BG : LIGHT_BG;
    let tag = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]:not([media])');
    if (!tag) {
      tag = document.createElement("meta");
      tag.name = "theme-color";
      document.head.appendChild(tag);
    }
    tag.content = color;
  }, [resolvedTheme]);
  return null;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem storageKey="theme">
      <ThemeColorSync />
      {children}
    </NextThemesProvider>
  );
}
