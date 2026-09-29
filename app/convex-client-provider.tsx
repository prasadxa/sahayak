"use client";

import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";
import { ReactNode } from "react";

import { I18nProvider } from "@/lib/i18n";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export function ConvexClientProvider({
  children,
  initialLang,
}: {
  children: ReactNode;
  initialLang: string;
}) {
  return (
    <ConvexAuthNextjsProvider client={convex}>
      <I18nProvider initialLang={initialLang}>{children}</I18nProvider>
    </ConvexAuthNextjsProvider>
  );
}
