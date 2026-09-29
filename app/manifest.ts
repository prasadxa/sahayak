import type { MetadataRoute } from "next";

/** Brand green used by public/icons/icon.svg. */
const THEME_COLOR = "#15803d";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Sahayak — Cooperative Help Desk",
    short_name: "Sahayak",
    description:
      "Multilingual help for cooperative members and farmers: cooperative laws, Ministry of Cooperation schemes, PMFBY crop insurance, financial literacy and grievance redressal in 22 Indian languages, by text or voice.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#ffffff",
    theme_color: THEME_COLOR,
    lang: "en-IN",
    dir: "ltr",
    categories: ["education", "government", "productivity"],
    icons: [
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "New chat",
        short_name: "Chat",
        url: "/",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Track grievance",
        short_name: "Track",
        description: "Check a grievance's status by its reference ID",
        url: "/track",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "My grievances",
        short_name: "Grievances",
        url: "/grievances",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
