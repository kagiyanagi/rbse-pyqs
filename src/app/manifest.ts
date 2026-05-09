import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "RBSE Class 12 Question Bank",
    short_name: "RBSE Q-Bank",
    description:
      "Browse RBSE Class 12 past-paper questions with filters, bookmarks, and AI solutions.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#1f1f1f",
    theme_color: "#1f1f1f",
    icons: [
      { src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/favicon.ico", sizes: "32x32", type: "image/x-icon" },
    ],
  };
}
