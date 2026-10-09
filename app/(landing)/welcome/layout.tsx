import type { Metadata } from "next";
import { Mukta, Rozha_One } from "next/font/google";

const mukta = Mukta({
  variable: "--font-body",
  subsets: ["latin", "devanagari"],
  weight: ["400", "500", "600", "700"],
});

const rozha = Rozha_One({
  variable: "--font-display",
  subsets: ["latin", "devanagari"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Sahayak: a voice help desk for cooperatives and farmers",
  description:
    "Ask about cooperative law, Ministry of Cooperation schemes and PMFBY crop insurance in 22 Indian languages, by text or voice. File a grievance and track it with a reference ID.",
};

// Public marketing page. Sits outside the (chat) layout, so no sidebar.
export default function WelcomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${mukta.variable} ${rozha.variable} min-h-dvh bg-white font-[family-name:var(--font-body)] text-[#1B2A5B] [&_.font-display]:font-[family-name:var(--font-display)]`}
    >
      {children}
    </div>
  );
}
