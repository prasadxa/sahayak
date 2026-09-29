import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Sahayak Kiosk",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#06120d",
};

const KIOSK_CSS = `
html:has(.kiosk-shell), body:has(.kiosk-shell) {
  overflow: hidden;
  overscroll-behavior: none;
  background: #06120d;
}
.kiosk-shell, .kiosk-shell * {
  -webkit-user-select: none;
  user-select: none;
  -webkit-touch-callout: none;
  -webkit-tap-highlight-color: transparent;
}
.kiosk-shell button:focus-visible { outline: 4px solid #fcd34d; outline-offset: 3px; }
@keyframes kiosk-wave { 0%, 100% { transform: scaleY(0.25); } 50% { transform: scaleY(1); } }
.kiosk-wave > span { animation: kiosk-wave 0.9s ease-in-out infinite; transform-origin: center; }
@keyframes kiosk-ping { 0% { transform: scale(1); opacity: 0.7; } 100% { transform: scale(2.2); opacity: 0; } }
.kiosk-ping { animation: kiosk-ping 1.1s cubic-bezier(0, 0, 0.2, 1) infinite; }
@keyframes kiosk-ring { 0% { transform: scale(1); opacity: 0.55; } 100% { transform: scale(1.35); opacity: 0; } }
.kiosk-ring { animation: kiosk-ring 1.2s ease-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .kiosk-wave > span, .kiosk-ping, .kiosk-ring { animation-duration: 2.4s; }
}
`;

/**
 * Full-screen kiosk shell: no sidebar, large type, high contrast, touch-first.
 * Convex, auth and i18n providers come from the root layout.
 */
export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="kiosk-shell fixed inset-0 flex flex-col overflow-hidden bg-[#06120d] text-[20px] leading-snug text-white antialiased [@media(min-height:700px)]:text-[24px]"
      style={{ touchAction: "manipulation", overscrollBehavior: "none" }}
    >
      <style>{KIOSK_CSS}</style>
      {children}
    </div>
  );
}
