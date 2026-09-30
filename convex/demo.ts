/**
 * Demo data for the SIH judging demo. INTERNAL functions only: operators run
 *   npx convex run [--prod] demo:seed '{}'
 *   npx convex run [--prod] demo:clear '{}'
 * (or `npm run seed:demo [-- --prod] [-- --clear]`).
 *
 * Every demo row is identifiable, so `clear` never touches real data:
 * - user: email `demo.citizen@sahayak.test` (reserved `.test` TLD).
 * - grievances: refIds `GRV-DE000001` … `GRV-DE000018` (the `GRV-DE00` prefix
 *   plus 4 hex digits). "GRV-DEMO…" would fail the `^GRV-[0-9A-F]{8}$` format
 *   that grievances.track accepts; D and E are hex, so these refs track like
 *   real ones. `clear` deletes only these refs AND only when owned by the
 *   demo user, so a real grievance whose random ref collides survives.
 * - kb_queries: the schema has no marker field, so each demo row's createdAt
 *   ends in 123 ms (`Math.floor(t / 1000) * 1000 + 123`) and its text is one
 *   of DEMO_QUERIES. `clear` needs both, so a real query that lands on the
 *   same millisecond survives.
 *
 * `seed` is idempotent: it creates what is missing and a second run adds
 * nothing. Timestamps are relative to the seed time; to refresh dates, run
 * `clear` then `seed`.
 */
import type { MutationCtx } from "./_generated/server";
import { internalMutation } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { GrievanceCategory, GrievanceStatus, KbCategory } from "@/lib/constants";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

export const DEMO_EMAIL = "demo.citizen@sahayak.test";
export const DEMO_REF_PREFIX = "GRV-DE00";
/** Marker for demo kb_queries rows: createdAt % 1000. */
export const DEMO_QUERY_MS = 123;

export function demoRefId(n: number): string {
  return DEMO_REF_PREFIX + n.toString(16).toUpperCase().padStart(4, "0");
}

export function markDemoTime(t: number): number {
  return Math.floor(t / 1000) * 1000 + DEMO_QUERY_MS;
}

// ── Grievances ──────────────────────────────────────────────────────────────

type District = "Pune" | "Nashik" | "Satara" | "Kolhapur" | "Solapur" | "Nagpur";

const OFFICERS: Record<District, string> = {
  Pune: "A. Deshmukh, ARCS Pune",
  Nashik: "S. Patil, DDR Nashik",
  Satara: "R. Jadhav, ARCS Satara",
  Kolhapur: "M. Kulkarni, DDR Kolhapur",
  Solapur: "V. Shinde, ARCS Solapur",
  Nagpur: "P. Wankhede, DDR Nagpur",
};

type Step = { status: GrievanceStatus; note: string; afterDays: number };

type DemoGrievance = {
  category: GrievanceCategory;
  district: District;
  societyName: string;
  channel: "web" | "kiosk";
  language: "hi" | "mr" | "en";
  daysAgo: number;
  subject: string;
  description: string;
  /** Officer actions after the "submitted" entry; the last one sets status. */
  steps: Step[];
};

const GRIEVANCES: DemoGrievance[] = [
  // membership
  {
    category: "membership",
    district: "Pune",
    societyName: "Shri Ganesh PACS, Baramati",
    channel: "web",
    language: "mr",
    daysAgo: 42,
    subject: "सभासदत्वासाठी पैसे भरूनही शेअर प्रमाणपत्र मिळाले नाही",
    description:
      "मी जानेवारीत ₹500 भरून सोसायटीच्या सभासदत्वासाठी अर्ज केला. पावती मिळाली, पण अजून शेअर प्रमाणपत्र आणि सभासद क्रमांक दिलेला नाही. सचिव प्रत्येक वेळी पुढच्या आठवड्यात या असे सांगतात.",
    steps: [
      { status: "in_review", note: "Forwarded to the society secretary to check the membership register", afterDays: 2 },
      { status: "resolved", note: "Share certificate No. 1142 issued; member added to the register", afterDays: 9 },
    ],
  },
  {
    category: "membership",
    district: "Nashik",
    societyName: "Pimpalgaon Baswant Vividh Karyakari Seva Society, Niphad",
    channel: "kiosk",
    language: "hi",
    daysAgo: 20,
    subject: "पिता की मृत्यु के बाद सदस्यता मेरे नाम नहीं हो रही",
    description:
      "मेरे पिता का देहांत पिछले साल हुआ। वे सोसायटी के सदस्य थे और नामांकन में मेरा नाम है। फिर भी सचिव सदस्यता मेरे नाम पर ट्रांसफर नहीं कर रहे और मृत्यु प्रमाणपत्र के अलावा कई और कागज़ माँग रहे हैं।",
    steps: [
      { status: "in_review", note: "Society asked to state in writing why the nominee transfer is pending, within 7 days", afterDays: 3 },
    ],
  },
  {
    category: "membership",
    district: "Nagpur",
    societyName: "Kalmeshwar Adivasi PACS, Kalmeshwar",
    channel: "web",
    language: "en",
    daysAgo: 6,
    subject: "Membership application rejected without a reason",
    description:
      "I applied for PACS membership in June with my 7/12 extract and Aadhaar. The managing committee rejected it at the last meeting but gave no written reason. I own 2 acres inside the society's area of operation.",
    steps: [],
  },
  // loan_credit
  {
    category: "loan_credit",
    district: "Pune",
    societyName: "Shri Ganesh PACS, Baramati",
    channel: "kiosk",
    language: "hi",
    daysAgo: 30,
    subject: "फसल ऋण तीन महीने से मंजूर नहीं हुआ",
    description:
      "मैंने खरीफ के लिए ₹80,000 के फसल ऋण का आवेदन अप्रैल में दिया था। सभी कागज़ जमा हैं, फिर भी ऋण मंजूर नहीं हुआ। बुवाई का समय निकल गया और अब साहूकार से कर्ज लेना पड़ा।",
    steps: [
      { status: "in_review", note: "Loan file called for from the PACS and the DCCB Baramati branch", afterDays: 4 },
    ],
  },
  {
    category: "loan_credit",
    district: "Solapur",
    societyName: "Mohol Taluka Vividh Karyakari Society, Mohol",
    channel: "web",
    language: "mr",
    daysAgo: 38,
    subject: "कर्जमाफीनंतरही खात्यावर थकबाकी दाखवली जाते",
    description:
      "कर्जमाफी योजनेच्या यादीत माझे ₹1.2 लाखांचे पीक कर्ज माफ झाल्याचे नाव आहे. तरीही सोसायटीच्या उताऱ्यावर थकबाकी दाखवतात आणि नवीन कर्ज देत नाहीत.",
    steps: [
      { status: "in_review", note: "Name verified in the waiver list; DCCB asked to reconcile the loan account", afterDays: 2 },
      { status: "resolved", note: "Account reconciled, outstanding cleared and no-dues certificate issued", afterDays: 12 },
    ],
  },
  {
    category: "loan_credit",
    district: "Kolhapur",
    societyName: "Warana Krishi Seva Sahakari Society, Panhala",
    channel: "kiosk",
    language: "mr",
    daysAgo: 3,
    subject: "किसान क्रेडिट कार्डची मर्यादा वाढवण्याचा अर्ज प्रलंबित",
    description:
      "ऊस लागवड वाढवल्यामुळे मी किसान क्रेडिट कार्डची मर्यादा ₹1.5 लाखांवरून ₹2.5 लाख करण्यासाठी अर्ज केला आहे. दोन महिने झाले, पण काहीच उत्तर मिळाले नाही.",
    steps: [],
  },
  // election
  {
    category: "election",
    district: "Satara",
    societyName: "Koregaon Vikas Seva Sahakari Society, Koregaon",
    channel: "web",
    language: "mr",
    daysAgo: 25,
    subject: "संचालक मंडळ निवडणुकीच्या मतदार यादीतून नाव वगळले",
    description:
      "मी १२ वर्षांपासून सोसायटीचा सभासद आहे आणि दरवर्षी शेअरची रक्कम भरतो. तरीही यंदाच्या संचालक मंडळ निवडणुकीच्या अंतिम मतदार यादीत माझे नाव नाही.",
    steps: [
      { status: "in_review", note: "Voter list and objections register sought from the returning officer", afterDays: 1 },
    ],
  },
  {
    category: "election",
    district: "Nagpur",
    societyName: "Umred Seva Sahakari Society, Umred",
    channel: "web",
    language: "en",
    daysAgo: 33,
    subject: "Society board election overdue by two years",
    description:
      "The board's five-year term ended in 2024 but no election has been announced. The same committee continues to take decisions on loans and godown rent.",
    steps: [
      { status: "in_review", note: "Status checked with the State Cooperative Election Authority", afterDays: 3 },
      { status: "rejected", note: "Election programme already notified by the State Cooperative Election Authority for next month; no further action needed. Complainant informed.", afterDays: 10 },
    ],
  },
  {
    category: "election",
    district: "Solapur",
    societyName: "Pandharpur Shetkari Sahakari Society, Pandharpur",
    channel: "kiosk",
    language: "hi",
    daysAgo: 9,
    subject: "संचालक पद का नामांकन गलत तरीके से खारिज",
    description:
      "मैंने संचालक पद के लिए नामांकन भरा था, लेकिन मुझे बकायेदार बताकर खारिज कर दिया गया। मेरा कोई बकाया नहीं है और मेरे पास बेबाकी प्रमाणपत्र भी है।",
    steps: [],
  },
  // bylaw_violation
  {
    category: "bylaw_violation",
    district: "Kolhapur",
    societyName: "Shri Mahalaxmi PACS, Karveer",
    channel: "web",
    language: "mr",
    daysAgo: 44,
    subject: "दोन वर्षांपासून वार्षिक सर्वसाधारण सभा घेतली नाही",
    description:
      "उपविधीनुसार दरवर्षी ३० सप्टेंबरपूर्वी वार्षिक सर्वसाधारण सभा घ्यावी लागते. आमच्या सोसायटीने २०२४ आणि २०२५ मध्ये सभा घेतली नाही आणि लेखापरीक्षण अहवालही सभासदांना दिला नाही.",
    steps: [
      { status: "in_review", note: "Notice issued to the society under the MCS Act for not holding the AGM", afterDays: 2 },
      { status: "resolved", note: "AGM held on the directed date; audit report circulated to members", afterDays: 15 },
    ],
  },
  {
    category: "bylaw_violation",
    district: "Pune",
    societyName: "Indapur Vividh Karyakari Seva Society, Indapur",
    channel: "kiosk",
    language: "hi",
    daysAgo: 18,
    subject: "सचिव ने बोर्ड की मंज़ूरी के बिना खाद का ठेका दिया",
    description:
      "सोसायटी के सचिव ने बोर्ड बैठक के बिना अपने रिश्तेदार की दुकान को खाद आपूर्ति का ठेका दे दिया। अब सदस्यों को महँगे दाम पर खाद मिल रही है।",
    steps: [],
  },
  {
    category: "bylaw_violation",
    district: "Nashik",
    societyName: "Dindori Adivasi Vividh Karyakari Society, Dindori",
    channel: "web",
    language: "en",
    daysAgo: 12,
    subject: "Board meeting minutes not shared with members",
    description:
      "Members asked for copies of the board minutes that approved the new godown construction. The secretary refuses, although the by-laws let members inspect society records.",
    steps: [
      { status: "in_review", note: "Society directed to allow members to inspect the minutes book", afterDays: 2 },
    ],
  },
  // financial_fraud
  {
    category: "financial_fraud",
    district: "Satara",
    societyName: "Karad Krishi Seva Sahakari Society, Karad",
    channel: "web",
    language: "mr",
    daysAgo: 40,
    subject: "मी न घेतलेले कर्ज माझ्या नावावर दाखवले आहे",
    description:
      "बँकेच्या नोटीसवरून समजले की माझ्या नावावर ₹60,000 चे कर्ज आहे. मी असे कोणतेही कर्ज घेतलेले नाही आणि कोणत्याही कागदावर सही केलेली नाही. खोटी सही केल्याचा संशय आहे.",
    steps: [
      { status: "in_review", note: "Special audit ordered for FY 2024-25 loan disbursements", afterDays: 1 },
      { status: "in_review", note: "Signature samples sent for verification; auditor's report awaited", afterDays: 14 },
    ],
  },
  {
    category: "financial_fraud",
    district: "Solapur",
    societyName: "Barshi Vividh Karyakari Society, Barshi",
    channel: "kiosk",
    language: "hi",
    daysAgo: 22,
    subject: "जमा की रसीद मिली, लेकिन पैसा खाते में नहीं आया",
    description:
      "मैंने सोसायटी के कैशियर को ₹25,000 नकद जमा किए और हाथ से लिखी रसीद मिली। पासबुक अपडेट कराने पर पता चला कि रकम खाते में जमा ही नहीं हुई।",
    steps: [],
  },
  {
    category: "financial_fraud",
    district: "Nagpur",
    societyName: "Katol Sahakari Seva Society, Katol",
    channel: "web",
    language: "en",
    daysAgo: 28,
    subject: "Fake SMS asking for OTP in the society's name",
    description:
      "I got an SMS saying my PACS loan would be waived if I shared an OTP, and then a call from someone claiming to be from the society. I did not share it, but many members in the village got the same message.",
    steps: [
      { status: "in_review", note: "Reported to the Nagpur cyber cell; society asked to warn members", afterDays: 1 },
      { status: "resolved", note: "Warning notice put up at the society office and read out at the gram sabha. Members told never to share OTPs.", afterDays: 6 },
    ],
  },
  // service_denial
  {
    category: "service_denial",
    district: "Kolhapur",
    societyName: "Warana Krishi Seva Sahakari Society, Panhala",
    channel: "web",
    language: "mr",
    daysAgo: 35,
    subject: "सोसायटीच्या गोदामात माल ठेवण्यास नकार",
    description:
      "मी सोयाबीन साठवण्यासाठी सोसायटीच्या गोदामात जागा मागितली. सचिवांनी जागा नाही असे सांगितले, पण इतरांचा माल ठेवला जात आहे.",
    steps: [
      { status: "in_review", note: "Godown booking register inspected", afterDays: 2 },
      { status: "rejected", note: "Godown was at full capacity on the requested dates and allotment followed the booking register. Complainant offered the next free slot.", afterDays: 8 },
    ],
  },
  {
    category: "service_denial",
    district: "Pune",
    societyName: "Junnar Taluka Seva Sahakari Society, Junnar",
    channel: "kiosk",
    language: "hi",
    daysAgo: 16,
    subject: "सोसायटी की दुकान से यूरिया नहीं मिल रहा",
    description:
      "मैं सदस्य हूँ और मेरे पास पर्ची भी है, फिर भी दो हफ्ते से सोसायटी की दुकान पर यूरिया खत्म बताया जाता है। बाहर की दुकानों पर वही यूरिया ज़्यादा दाम पर मिल रहा है।",
    steps: [
      { status: "in_review", note: "Stock register called for; taluka agriculture officer informed", afterDays: 2 },
    ],
  },
  {
    category: "service_denial",
    district: "Satara",
    societyName: "Wai Vividh Karyakari Society, Wai",
    channel: "web",
    language: "en",
    daysAgo: 2,
    subject: "No-dues certificate not issued",
    description:
      "I repaid my crop loan in full in August. I need a no-dues certificate for a bank loan, but the society says the secretary is on leave and nobody else can sign it.",
    steps: [],
  },
  // scheme_benefit
  {
    category: "scheme_benefit",
    district: "Nashik",
    societyName: "Pimpalgaon Baswant Vividh Karyakari Seva Society, Niphad",
    channel: "web",
    language: "mr",
    daysAgo: 27,
    subject: "पीक विमा योजनेची भरपाई मिळाली नाही",
    description:
      "गेल्या खरीप हंगामात अवकाळी पावसामुळे माझ्या कांदा पिकाचे नुकसान झाले. सोसायटीमार्फत PMFBY चा हप्ता भरला होता, पण भरपाई अजून खात्यावर जमा झाली नाही.",
    steps: [
      { status: "in_review", note: "Forwarded to the insurance company and the district agriculture office", afterDays: 3 },
      { status: "resolved", note: "Claim of ₹18,400 credited to the farmer's account; UTR shared with the farmer", afterDays: 11 },
    ],
  },
  {
    category: "scheme_benefit",
    district: "Kolhapur",
    societyName: "Shri Mahalaxmi PACS, Karveer",
    channel: "kiosk",
    language: "hi",
    daysAgo: 19,
    subject: "समय पर कर्ज चुकाने पर भी ब्याज में छूट नहीं मिली",
    description:
      "मैंने फसल ऋण समय पर चुकाया, इसलिए ब्याज में 3% की छूट मिलनी चाहिए थी। सोसायटी ने पूरा 7% ब्याज काट लिया और कहती है कि योजना की राशि अभी नहीं आई।",
    steps: [],
  },
  {
    category: "scheme_benefit",
    district: "Solapur",
    societyName: "Akkalkot Seva Sahakari Society, Akkalkot",
    channel: "web",
    language: "en",
    daysAgo: 7,
    subject: "Solar pump subsidy application stuck at the society",
    description:
      "I applied through the society for a solar pump under PM-KUSUM in May. The society has not forwarded my application, and the portal still shows it as pending at the PACS.",
    steps: [
      { status: "in_review", note: "Society asked to forward the application with documents within 5 days", afterDays: 1 },
    ],
  },
  // other
  {
    category: "other",
    district: "Nagpur",
    societyName: "Kalmeshwar Adivasi PACS, Kalmeshwar",
    channel: "kiosk",
    language: "mr",
    daysAgo: 24,
    subject: "गावातील शेतरस्त्याचे काम अर्धवट सोडले",
    description:
      "आमच्या गावातील शेतरस्त्याचे काम अर्धवट सोडले आहे. पावसात शेतात जाता येत नाही. कृपया लक्ष द्यावे.",
    steps: [
      { status: "rejected", note: "Not a cooperative-society matter. Complainant advised to approach the Gram Panchayat or the Block Development Officer.", afterDays: 4 },
    ],
  },
  {
    category: "other",
    district: "Satara",
    societyName: "Koregaon Vikas Seva Sahakari Society, Koregaon",
    channel: "web",
    language: "hi",
    daysAgo: 14,
    subject: "सोसायटी का कार्यालय अक्सर बंद रहता है",
    description:
      "सोसायटी का कार्यालय सुबह 10 से शाम 5 बजे तक खुलना चाहिए, लेकिन ज़्यादातर दिन दोपहर 12 बजे के बाद बंद मिलता है। दूर के गाँवों से आने वाले सदस्यों को बार-बार चक्कर लगाने पड़ते हैं।",
    steps: [
      { status: "in_review", note: "Society asked to display office hours and a contact number at the entrance", afterDays: 3 },
    ],
  },
  {
    category: "other",
    district: "Nashik",
    societyName: "Sinnar Vividh Karyakari Society, Sinnar",
    channel: "web",
    language: "en",
    daysAgo: 1,
    subject: "Annual report available only in English",
    description:
      "The annual report and audit summary are printed only in English, and most members cannot read them. Please ask the society to publish a Marathi version as well.",
    steps: [],
  },
];

function buildGrievance(
  g: DemoGrievance,
  n: number,
  userId: Id<"users">,
  now: number
): Omit<Doc<"grievances">, "_id" | "_creationTime"> {
  // Spread filing times over the day so rows don't share a timestamp.
  const createdAt = now - g.daysAgo * DAY_MS - ((n * 37) % 600) * 60 * 1000;
  const officer = OFFICERS[g.district];
  const updates = [
    { status: "submitted", note: "Grievance received", at: createdAt, byName: "Sahayak" },
    ...g.steps.map((s, i) => ({
      status: s.status,
      note: s.note,
      at: createdAt + s.afterDays * DAY_MS + (3 + i) * HOUR_MS,
      byName: officer,
    })),
  ];
  return {
    userId,
    refId: demoRefId(n),
    category: g.category,
    subject: g.subject,
    description: g.description,
    // Obviously fake: "+91 00000 …" is not a routable Indian mobile number.
    contact: `+91 00000 0${String(n).padStart(4, "0")}`,
    status: updates[updates.length - 1].status,
    channel: g.channel,
    district: g.district,
    societyName: g.societyName,
    language: g.language,
    updates,
    createdAt,
  };
}

// ── Knowledge-base queries ──────────────────────────────────────────────────

type DemoQuery = {
  language: "hi" | "mr" | "en" | "ta" | "te" | "bn";
  category: KbCategory;
  query: string;
  /** A knowledge gap: logged with hits 0 and mode "none". */
  gap?: true;
};

const QUERIES: DemoQuery[] = [
  { language: "hi", category: "pmfby", query: "PMFBY में रबी फसल का प्रीमियम कितना लगता है?" },
  { language: "hi", category: "laws", query: "PACS का सदस्य कैसे बनें?" },
  { language: "hi", category: "finance", query: "किसान क्रेडिट कार्ड पर ब्याज दर कितनी है?" },
  { language: "hi", category: "pmfby", query: "फसल नुकसान की सूचना कितने दिन में देनी होती है?" },
  { language: "hi", category: "laws", query: "सहकारी समिति के चुनाव में वोट देने का अधिकार किसे है?" },
  { language: "hi", category: "schemes", query: "सहकारिता मंत्रालय की कौन सी योजनाएँ किसानों के लिए हैं?" },
  { language: "hi", category: "grievance", query: "सोसायटी के खिलाफ शिकायत कहाँ करें?" },
  { language: "hi", category: "finance", query: "समय पर कर्ज चुकाने पर ब्याज में कितनी छूट मिलती है?" },
  { language: "hi", category: "schemes", query: "PACS से खाद और बीज कैसे खरीदें?" },
  { language: "hi", category: "finance", query: "OTP माँगने वाले फ़र्ज़ी कॉल से कैसे बचें?" },
  { language: "hi", category: "schemes", query: "मेरे गाँव में PACS गोदाम बनाने के लिए कितनी सब्सिडी मिलेगी?", gap: true },
  { language: "hi", category: "general", query: "डेयरी सहकारी समिति में दूध का भाव कौन तय करता है?", gap: true },
  { language: "mr", category: "laws", query: "सोसायटीचा सभासद होण्यासाठी कोणती कागदपत्रे लागतात?" },
  { language: "mr", category: "pmfby", query: "पीक विम्याची भरपाई कधी मिळते?" },
  { language: "mr", category: "laws", query: "वार्षिक सर्वसाधारण सभा किती वेळा घ्यावी लागते?" },
  { language: "mr", category: "finance", query: "पीक कर्जासाठी अर्ज कसा करायचा?" },
  { language: "mr", category: "grievance", query: "सहकारी संस्थेविरुद्ध तक्रार कशी नोंदवायची?" },
  { language: "mr", category: "pmfby", query: "खरीप हंगामात विमा हप्ता किती आहे?" },
  { language: "mr", category: "schemes", query: "PACS मध्ये जनऔषधी केंद्र सुरू करता येते का?" },
  { language: "mr", category: "laws", query: "नॉमिनीच्या नावावर सभासदत्व कसे हस्तांतरित करायचे?" },
  { language: "mr", category: "laws", query: "सोसायटीचे लेखापरीक्षण अहवाल सभासदांना पाहता येतो का?" },
  { language: "mr", category: "schemes", query: "ऊसतोड कामगारांसाठी सहकारी विमा योजना आहे का?", gap: true },
  { language: "en", category: "pmfby", query: "How is the PMFBY premium calculated for kharif crops?" },
  { language: "en", category: "laws", query: "What are my rights as a PACS member?" },
  { language: "en", category: "grievance", query: "How do I check my grievance status?" },
  { language: "en", category: "finance", query: "What is the interest subvention on crop loans?" },
  { language: "en", category: "schemes", query: "Which schemes help a PACS become a multi-purpose society?" },
  { language: "en", category: "laws", query: "Can a loan defaulter contest the society board election?" },
  { language: "en", category: "finance", query: "How do I stop someone taking a loan in my name?" },
  { language: "en", category: "schemes", query: "PACS godown subsidy for my village?", gap: true },
  { language: "ta", category: "pmfby", query: "பயிர் காப்பீட்டு பிரீமியம் எவ்வளவு?" },
  { language: "ta", category: "laws", query: "கூட்டுறவு சங்கத்தில் உறுப்பினராவது எப்படி?" },
  { language: "ta", category: "finance", query: "கிசான் கடன் அட்டைக்கு எப்படி விண்ணப்பிப்பது?" },
  { language: "ta", category: "schemes", query: "தென்னை விவசாயிகளுக்கு கூட்டுறவு மானியம் உள்ளதா?", gap: true },
  { language: "te", category: "pmfby", query: "పంట బీమా క్లెయిమ్ ఎలా చేయాలి?" },
  { language: "te", category: "laws", query: "సహకార సంఘం ఎన్నికలు ఎప్పుడు జరుగుతాయి?" },
  { language: "te", category: "finance", query: "పంట రుణంపై వడ్డీ రేటు ఎంత?" },
  { language: "bn", category: "laws", query: "সমবায় সমিতির সদস্য হতে কী লাগে?" },
  { language: "bn", category: "pmfby", query: "ফসল বীমার প্রিমিয়াম কত?" },
  { language: "bn", category: "finance", query: "মাছ চাষের জন্য সমবায় ঋণ কীভাবে পাব?", gap: true },
];

/** Each question is logged this many times (popular questions repeat). */
const QUERY_REPEATS = 3;
const DEMO_QUERY_TEXTS = new Set(QUERIES.map((q) => q.query));

function isDemoQuery(row: Doc<"kb_queries">): boolean {
  return row.createdAt % 1000 === DEMO_QUERY_MS && DEMO_QUERY_TEXTS.has(row.query);
}

/** Deterministic 0..1 spread, so every seed produces the same shape. */
function spread(i: number): number {
  return ((i * 2654435761) % 1000) / 1000;
}

function buildQueries(now: number): Omit<Doc<"kb_queries">, "_id" | "_creationTime">[] {
  const total = QUERIES.length * QUERY_REPEATS;
  const slot = (29 * DAY_MS) / total;
  const rows = [];
  for (let i = 0; i < total; i++) {
    // 7 is coprime with 40, so each question appears exactly QUERY_REPEATS times, interleaved.
    const q = QUERIES[(i * 7) % QUERIES.length];
    const t = now - (i + 0.5) * slot - Math.round(spread(i) * 3 * HOUR_MS) - 60_000;
    const createdAt = markDemoTime(t);
    if (q.gap) {
      rows.push({ query: q.query, category: q.category, language: q.language, hits: 0, mode: "none" as const, createdAt });
    } else if (i % 6 === 0) {
      // Full-text fallback (e.g. while embeddings were down): no score.
      rows.push({ query: q.query, category: q.category, language: q.language, hits: 1 + (i % 3), mode: "text" as const, createdAt });
    } else {
      const topScore = Math.round((0.55 + ((i * 13) % 35) / 100) * 100) / 100;
      rows.push({ query: q.query, category: q.category, language: q.language, hits: 1 + (i % 4), topScore, mode: "vector" as const, createdAt });
    }
  }
  return rows;
}

// ── Mutations ───────────────────────────────────────────────────────────────

async function demoUserRow(ctx: MutationCtx): Promise<Doc<"users"> | null> {
  return await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", DEMO_EMAIL))
    .first();
}

async function hasAuthAccount(ctx: MutationCtx, userId: Id<"users">): Promise<boolean> {
  const account = await ctx.db
    .query("authAccounts")
    .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
    .first();
  return account !== null;
}

/**
 * The seeded demo user, or null. Throws if any user with the demo email has
 * an `authAccounts` row: someone registered it as a real account, and demo
 * grievances must never be attached to a person who can sign in.
 */
async function findDemoUser(ctx: MutationCtx): Promise<Doc<"users"> | null> {
  const rows = await ctx.db
    .query("users")
    .withIndex("email", (q) => q.eq("email", DEMO_EMAIL))
    .collect();
  for (const row of rows) {
    if (await hasAuthAccount(ctx, row._id)) {
      throw new Error(`${DEMO_EMAIL} is a real account; refusing to seed`);
    }
  }
  return rows[0] ?? null;
}

async function grievanceByRef(ctx: MutationCtx, refId: string) {
  return await ctx.db
    .query("grievances")
    .withIndex("by_refId", (q) => q.eq("refId", refId))
    .first();
}

/**
 * Scans kb_queries for demo rows. Fine at prototype scale; a very large
 * table would hit Convex's per-transaction read limit.
 */
async function hasDemoQueries(ctx: MutationCtx): Promise<boolean> {
  for await (const row of ctx.db.query("kb_queries").withIndex("by_createdAt")) {
    if (isDemoQuery(row)) return true;
  }
  return false;
}

export const seed = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    let user = await findDemoUser(ctx);
    const userCreated = user === null;
    if (!user) {
      const id = await ctx.db.insert("users", {
        name: "Demo Citizen",
        email: DEMO_EMAIL,
        image: "",
        role: "member",
      });
      user = (await ctx.db.get(id))!;
    }

    let grievances = 0;
    for (const [i, g] of GRIEVANCES.entries()) {
      const n = i + 1;
      // Skip refs already present (a previous seed, or a real collision).
      if (await grievanceByRef(ctx, demoRefId(n))) continue;
      await ctx.db.insert("grievances", buildGrievance(g, n, user._id, now));
      grievances++;
    }

    let queries = 0;
    if (!(await hasDemoQueries(ctx))) {
      for (const row of buildQueries(now)) {
        await ctx.db.insert("kb_queries", row);
        queries++;
      }
    }

    return { userCreated, grievances, queries };
  },
});

export const clear = internalMutation({
  args: {},
  handler: async (ctx) => {
    let users = 0;
    let grievances = 0;
    let queries = 0;

    const user = await demoUserRow(ctx);
    if (user) {
      for (let n = 1; n <= GRIEVANCES.length; n++) {
        const g = await grievanceByRef(ctx, demoRefId(n));
        if (g && g.userId === user._id) {
          await ctx.db.delete(g._id);
          grievances++;
        }
      }
      // Never delete an account someone can sign in with.
      if (!(await hasAuthAccount(ctx, user._id))) {
        await ctx.db.delete(user._id);
        users++;
      }
    }

    const demoQueryIds: Id<"kb_queries">[] = [];
    for await (const row of ctx.db.query("kb_queries").withIndex("by_createdAt")) {
      if (isDemoQuery(row)) demoQueryIds.push(row._id);
    }
    for (const id of demoQueryIds) {
      await ctx.db.delete(id);
      queries++;
    }

    return { users, grievances, queries };
  },
});
