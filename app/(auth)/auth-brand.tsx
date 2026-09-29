import Link from "next/link";
import Image from "next/image";

import { ArrowRight, ClipboardList, Languages, Mic, MonitorSmartphone, Sprout } from "lucide-react";

import { cn } from "@/lib/utils";

const FEATURES = [
  {
    icon: Languages,
    title: "22 Indian languages",
    detail: "Ask in Hindi, Marathi, Tamil, Bengali, Odia and more",
  },
  {
    icon: Mic,
    title: "Voice in and out",
    detail: "Speak your question and hear the answer read aloud",
  },
  {
    icon: ClipboardList,
    title: "Grievance filing and tracking",
    detail: "Get a GRV reference ID and follow every status update",
  },
  {
    icon: MonitorSmartphone,
    title: "Built for PACS kiosks",
    detail: "Works on phones, laptops and the society's help-desk kiosk",
  },
] as const;

export const BrandMark = ({ className }: { className?: string }) => (
  <div className={cn("flex items-center gap-3", className)}>
    <Image
      src="/icons/icon.svg"
      alt=""
      width={44}
      height={44}
      priority
      className="rounded-[22%] ring-1 ring-white/30"
    />
    <div className="flex flex-col leading-tight">
      <span className="text-xl font-semibold tracking-tight">Sahayak</span>
      <span lang="hi" className="text-sm opacity-80">
        सहायक
      </span>
    </div>
  </div>
);

export const TrackGrievanceLink = ({ className }: { className?: string }) => (
  <Link
    href="/track"
    className={cn(
      "group inline-flex items-center gap-1.5 text-sm font-medium underline-offset-4 hover:underline",
      className
    )}
  >
    Track a grievance without signing in
    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
  </Link>
);

export const AuthSidePanel = () => (
  <aside className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-green-700 via-green-800 to-green-950 p-10 text-white lg:flex">
    <Sprout
      aria-hidden
      className="pointer-events-none absolute -bottom-16 -right-16 h-96 w-96 text-white/[0.06]"
      strokeWidth={1.25}
    />

    <BrandMark />

    <div className="relative max-w-md space-y-8">
      <div className="space-y-3">
        <h2 className="text-3xl font-semibold leading-tight tracking-tight">
          Multilingual help for cooperative members and farmers
        </h2>
        <p className="text-base text-green-50/85">
          Cooperative laws and by-laws, government schemes, PMFBY crop insurance, financial literacy
          and grievance redressal, in your own language.
        </p>
      </div>

      <ul className="space-y-4">
        {FEATURES.map(({ icon: Icon, title, detail }) => (
          <li key={title} className="flex gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-white/10 text-amber-400">
              <Icon className="h-4 w-4" />
            </span>
            <div className="flex flex-col">
              <span className="font-medium">{title}</span>
              <span className="text-sm text-green-50/75">{detail}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>

    <TrackGrievanceLink className="relative text-amber-300 hover:text-amber-200" />
  </aside>
);

export const AuthTerms = () => (
  <p className="text-center text-xs text-muted-foreground">
    By continuing, you agree to Sahayak&apos;s Terms of Use and Privacy Policy.
  </p>
);
