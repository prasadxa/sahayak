"use client";

import { QRCodeSVG } from "qrcode.react";
import { Printer, X } from "lucide-react";

import { toBcp47 } from "@/lib/languages";
import { kioskT } from "@/lib/kiosk/strings";

/**
 * Only the receipt prints, at 58 mm thermal-roll width, black on white.
 * Chromium on the Pi runs with --kiosk-printing, so window.print() goes
 * straight to the CUPS default printer with no dialog.
 */
const PRINT_CSS = `
@media print {
  @page { size: 58mm auto; margin: 0; }
  html, body { background: #fff !important; }
  body * { visibility: hidden !important; }
  .kiosk-shell { position: static !important; overflow: visible !important; height: auto !important; }
  .kiosk-receipt, .kiosk-receipt * {
    visibility: visible !important;
    color: #000 !important;
    background: #fff !important;
    box-shadow: none !important;
    border-color: #000 !important;
  }
  .kiosk-receipt {
    position: fixed !important;
    left: 0; top: 0;
    width: 58mm !important;
    max-width: 58mm !important;
    margin: 0 !important;
    padding: 3mm !important;
    border: 0 !important;
    border-radius: 0 !important;
    font-size: 9pt !important;
  }
  .kiosk-receipt .kiosk-receipt-ref { font-size: 14pt !important; }
  .kiosk-receipt svg { width: 38mm !important; height: 38mm !important; }
  .kiosk-receipt .kiosk-receipt-actions { display: none !important; }
}
`;

export const KioskReceipt = ({
  refId,
  filedAt,
  lang,
  trackUrl,
  onClose,
}: {
  refId: string;
  filedAt: number;
  lang: string | null;
  trackUrl: string;
  onClose: () => void;
}) => {
  const code = lang ?? "en";
  let when: string;
  try {
    when = new Intl.DateTimeFormat(toBcp47(code), {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(filedAt);
  } catch {
    when = new Date(filedAt).toLocaleString();
  }
  const appName = kioskT(code, "appName");

  return (
    <div
      className="kiosk-receipt w-full max-w-sm rounded-2xl border-4 border-black bg-white p-6 text-black shadow-2xl"
      role="dialog"
      aria-label={kioskT(code, "receiptTitle")}
    >
      <style>{PRINT_CSS}</style>

      <div className="text-center">
        <div className="text-2xl font-extrabold tracking-tight">
          Sahayak{appName !== "Sahayak" ? ` · ${appName}` : ""}
        </div>
        <div className="text-sm">Cooperative help desk</div>
      </div>

      <div className="my-3 border-t-2 border-dashed border-black" />

      <div className="text-center text-xl font-bold">{kioskT(code, "receiptTitle")}</div>
      <div className="mt-3 text-center text-sm">{kioskT(code, "referenceNo")}</div>
      <div className="kiosk-receipt-ref text-center font-mono text-3xl font-bold tracking-wider break-all">
        {refId}
      </div>
      <div className="mt-1 text-center text-sm">{when}</div>

      <div className="mt-4 flex justify-center">
        <QRCodeSVG
          value={trackUrl}
          size={176}
          level="M"
          marginSize={2}
          bgColor="#ffffff"
          fgColor="#000000"
        />
      </div>
      <div className="mt-2 text-center text-base font-semibold">
        {kioskT(code, "scanToTrack")}
      </div>
      <div className="mt-1 text-center font-mono text-[11px] break-all">{trackUrl}</div>

      <div className="kiosk-receipt-actions mt-5 grid grid-cols-[1fr_auto] gap-3">
        <button
          type="button"
          onClick={() => window.print()}
          className="flex min-h-16 items-center justify-center gap-3 rounded-xl bg-black px-4 text-xl font-bold text-white active:scale-[0.98]"
        >
          <Printer className="size-7" aria-hidden />
          {kioskT(code, "printReceipt")}
        </button>
        <button
          type="button"
          onClick={onClose}
          aria-label={kioskT(code, "close")}
          className="flex min-h-16 min-w-16 items-center justify-center rounded-xl border-4 border-black active:scale-[0.98]"
        >
          <X className="size-8" aria-hidden />
        </button>
      </div>
    </div>
  );
};
