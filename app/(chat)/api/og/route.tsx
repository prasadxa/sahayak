import { ImageResponse } from "next/og";

const GREEN = "#15803d";
const GREEN_DARK = "#14532d";
const SAFFRON = "#f59e0b";
const HINDI_NAME = "सहायक";

type OgFont = { name: string; data: ArrayBuffer; weight: 600; style: "normal" };

let devanagariFont: Promise<OgFont | null> | undefined;

/**
 * The default OG font has no Devanagari glyphs, so fetch a subset of Noto Sans
 * Devanagari containing just the Hindi name. Without network access the image
 * still renders, only without the Hindi name.
 */
async function fetchDevanagariFont(): Promise<OgFont | null> {
  try {
    const css = await fetch(
      `https://fonts.googleapis.com/css2?family=Noto+Sans+Devanagari:wght@600&text=${encodeURIComponent(HINDI_NAME)}`,
      { signal: AbortSignal.timeout(3000) }
    ).then((res) => (res.ok ? res.text() : ""));
    const url = css.match(/src: url\((.+?)\) format\('(?:opentype|truetype)'\)/)?.[1];
    if (!url) return null;
    const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) return null;
    return {
      name: "Noto Sans Devanagari",
      data: await res.arrayBuffer(),
      weight: 600,
      style: "normal",
    };
  } catch {
    return null;
  }
}

function loadDevanagariFont(): Promise<OgFont | null> {
  const pending =
    devanagariFont ??
    fetchDevanagariFont().then((font) => {
      if (!font) devanagariFont = undefined; // retry on the next request
      return font;
    });
  devanagariFont = pending;
  return pending;
}

// Simplified public/icons/icon.svg: speech bubble with a sprout.
const Logo = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 512 512">
    <rect
      x="8"
      y="8"
      width="496"
      height="496"
      rx="108"
      fill={GREEN}
      stroke="rgba(255,255,255,0.45)"
      strokeWidth="16"
    />
    <path
      d="M140 96h232a60 60 0 0 1 60 60v150a60 60 0 0 1-60 60H250l-86 66v-66h-24a60 60 0 0 1-60-60V156a60 60 0 0 1 60-60z"
      fill="#ffffff"
    />
    <path d="M256 322V214" stroke={GREEN} strokeWidth="24" strokeLinecap="round" fill="none" />
    <path d="M250 262c-58 4-96-26-104-86 60-6 100 24 104 86z" fill={GREEN} />
    <path d="M262 222c6-62 46-94 110-88-4 64-44 96-110 88z" fill={SAFFRON} />
    <path d="M196 330h120" stroke={SAFFRON} strokeWidth="20" strokeLinecap="round" fill="none" />
  </svg>
);

export async function GET() {
  const hindiFont = await loadDevanagariFont();

  return new ImageResponse(
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        height: "100%",
        width: "100%",
        padding: "64px 72px",
        color: "white",
        backgroundColor: GREEN_DARK,
        backgroundImage: `linear-gradient(135deg, ${GREEN} 0%, ${GREEN_DARK} 100%)`,
      }}
    >
      <div style={{ display: "flex", alignItems: "center" }}>
        <Logo size={120} />
        <div style={{ display: "flex", flexDirection: "column", marginLeft: 32 }}>
          <span
            style={{
              fontSize: 80,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              lineHeight: 1,
            }}
          >
            Sahayak
          </span>
          {hindiFont && (
            <span
              style={{
                fontFamily: "Noto Sans Devanagari",
                fontSize: 44,
                color: SAFFRON,
                marginTop: 8,
              }}
            >
              {HINDI_NAME}
            </span>
          )}
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column" }}>
        <span
          style={{
            fontSize: 52,
            fontWeight: 700,
            lineHeight: 1.2,
            maxWidth: 920,
          }}
        >
          Multilingual help for cooperative members and farmers
        </span>
        <span
          style={{
            fontSize: 27,
            marginTop: 20,
            opacity: 0.85,
            maxWidth: 1056,
            lineHeight: 1.4,
          }}
        >
          Laws, schemes, PMFBY crop insurance, financial literacy and grievance redressal
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", fontSize: 24 }}>
        {["22 Indian languages", "Voice in and out", "Grievance tracking", "PACS kiosks"].map(
          (label) => (
            <span
              key={label}
              style={{
                display: "flex",
                marginRight: 16,
                padding: "10px 20px",
                borderRadius: 999,
                backgroundColor: "rgba(255,255,255,0.12)",
                border: `2px solid ${SAFFRON}`,
              }}
            >
              {label}
            </span>
          )
        )}
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      fonts: hindiFont ? [hindiFont] : undefined,
    }
  );
}
