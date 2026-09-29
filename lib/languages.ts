export interface Language {
  /** BCP-47-ish code also passed to STT when supported. */
  code: string;
  /** English name — sent to the model in the system prompt. */
  name: string;
  /** Native label shown in the selector. */
  native: string;
}

/** The 22 scheduled Indian languages + English (CallMissed voice coverage). */
export const LANGUAGES: Language[] = [
  { code: "en", name: "English", native: "English" },
  { code: "hi", name: "Hindi", native: "हिन्दी" },
  { code: "bn", name: "Bengali", native: "বাংলা" },
  { code: "te", name: "Telugu", native: "తెలుగు" },
  { code: "mr", name: "Marathi", native: "मराठी" },
  { code: "ta", name: "Tamil", native: "தமிழ்" },
  { code: "ur", name: "Urdu", native: "اردو" },
  { code: "gu", name: "Gujarati", native: "ગુજરાતી" },
  { code: "kn", name: "Kannada", native: "ಕನ್ನಡ" },
  { code: "or", name: "Odia", native: "ଓଡ଼ିଆ" },
  { code: "ml", name: "Malayalam", native: "മലയാളം" },
  { code: "pa", name: "Punjabi", native: "ਪੰਜਾਬੀ" },
  { code: "as", name: "Assamese", native: "অসমীয়া" },
  { code: "mai", name: "Maithili", native: "मैथिली" },
  { code: "sat", name: "Santali", native: "ᱥᱟᱱᱛᱟᱲᱤ" },
  { code: "ks", name: "Kashmiri", native: "کٲشُر" },
  { code: "ne", name: "Nepali", native: "नेपाली" },
  { code: "sd", name: "Sindhi", native: "سنڌي" },
  { code: "doi", name: "Dogri", native: "डोगरी" },
  { code: "kok", name: "Konkani", native: "कोंकणी" },
  { code: "mni", name: "Manipuri", native: "ꯃꯤꯇꯩꯂꯣꯟ" },
  { code: "brx", name: "Bodo", native: "बड़ो" },
  { code: "sa", name: "Sanskrit", native: "संस्कृतम्" },
];

export const DEFAULT_LANGUAGE = "en";

export function languageByCode(code: string): Language {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}

export const LANGUAGE_COOKIE = "sahayak-lang";

/** Languages CallMissed `bulbul:v3` can speak (11 Indian languages incl. English). */
export const TTS_LANGUAGES = [
  "en",
  "hi",
  "bn",
  "ta",
  "te",
  "kn",
  "ml",
  "mr",
  "gu",
  "pa",
  "or",
] as const;

export function isTtsLanguage(code: string): boolean {
  return (TTS_LANGUAGES as readonly string[]).includes(code);
}

/** Short code → BCP-47 tag used by STT/TTS (`hi` → `hi-IN`). */
export function toBcp47(code: string): string {
  return `${code}-IN`;
}
