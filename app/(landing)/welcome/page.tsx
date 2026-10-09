import Link from "next/link";

import { HeroVideo } from "@/components/landing/hero-video";
import { CALLMISSED_MODELS } from "@/lib/callmissed";
import { LANGUAGES } from "@/lib/languages";

const topics = [
  {
    title: "Cooperative laws and by-laws",
    body: "Plain answers on how a society is run: members, meetings, committees and audits.",
  },
  {
    title: "Ministry of Cooperation schemes",
    body: "What a scheme offers, who can apply, and what to carry to the office.",
  },
  {
    title: "PMFBY crop insurance",
    body: "Rules from the knowledge base, plus a premium calculator the assistant runs for you.",
  },
  {
    title: "Financial literacy",
    body: "Loans, interest, savings and records, explained without jargon.",
  },
  {
    title: "Grievances",
    body: "Describe the problem. Sahayak files it and gives you a GRV reference ID.",
  },
];

const steps = [
  { title: "Pick a language", body: "Choose from 22 Indian languages or English. Sahayak replies in that language and script." },
  { title: "Type or speak", body: "Write the question, or hold the mic and say it. Speech is converted to text for you." },
  { title: "Get a sourced answer", body: "Sahayak searches its cooperative knowledge base first, then answers. It can also search the web." },
  { title: "File and follow up", body: "If something is wrong, it files a grievance. An officer picks it up from the console." },
];

const models = [
  { role: "Everyday chat", id: CALLMISSED_MODELS.chatSmall },
  { role: "Longer, harder questions", id: CALLMISSED_MODELS.chatLarge },
  { role: "Step-by-step reasoning", id: CALLMISSED_MODELS.reasoning },
  { role: "Speech to text", id: CALLMISSED_MODELS.stt },
  { role: "Text to speech", id: CALLMISSED_MODELS.tts },
  { role: "Knowledge search", id: CALLMISSED_MODELS.embedding },
];

const REPO_URL = "https://github.com/prasadxa/sahayak";
const LIVE_URL = "https://sahayak.rough-cell-383c.workers.dev";
const FILM_SRC = "/media/sahayak-film.mp4";
const FILM_POSTER = "/media/sahayak-film-poster.jpg";

const features = [
  { title: "22 Indian languages plus English", body: "Pick a language once. Replies come back in its native script. The app interface itself is translated into 11 languages." },
  { title: "Voice in and out", body: "Speech-to-text for questions and text-to-speech to read answers aloud. Spoken replies are available in 11 languages." },
  { title: "Knowledge-base-first answers", body: "The assistant searches a curated cooperative knowledge base before it answers, and shows which source it used." },
  { title: "PMFBY premium calculator", body: "A fixed formula, not a guess: farmer premium from the season and the sum insured, shown as a card." },
  { title: "Web search", body: "When the knowledge base has no answer, the assistant can search the web." },
  { title: "Grievance filing", body: "Describe the problem in chat or at the kiosk. Sahayak files it and returns a GRV reference ID." },
  { title: "Public tracking", body: "Anyone with the reference ID can open /track, with no login, and see the status timeline." },
  { title: "Officer console", body: "Staff filter grievances, set a status, add a public note, and export rows to CSV." },
  { title: "Governance dashboard", body: "Questions by language and category, grievance counts, overdue cases, and unanswered questions that show where content is missing." },
  { title: "Knowledge manager", body: "Staff paste text, fetch a URL or upload a PDF or text file. It is split into chunks and embedded for search." },
  { title: "Admin model switching", body: "An admin changes the model for chat, speech-to-text and text-to-speech from /admin/models, without a redeploy." },
  { title: "Installable PWA", body: "Add it to a phone home screen. Role-based routes protect staff pages." },
];

const problem = [
  "Many members of cooperative societies and farmers do not know their rights, the schemes they qualify for, or how to complain.",
  "The information sits in English legal text and is spread across portals.",
  "Sahayak is our prototype for Smart India Hackathon 2026, problem statement 26088 (Hardware category), under the Ministry of Cooperation and NCCT context: one help desk that speaks the member's language, on a phone or at a kiosk in the society office.",
];

const flow = [
  { title: "File", body: "By chat or at the kiosk. The assistant collects the details and files it." },
  { title: "Reference", body: "A GRV-XXXXXXXX ID is returned. The kiosk can print it as a receipt with a QR code." },
  { title: "Review", body: "An officer opens it in the console, sets In review, and adds a note." },
  { title: "Track", body: "The citizen sees the update on /track. Statuses: submitted, in review, resolved, rejected." },
];

const officer = [
  "Grievance console with filters by status, category and district",
  "Overdue flag: open for more than 15 days, a citizen-charter target and not a legal deadline",
  "CSV export of filtered grievances",
  "Questions asked, by language and by category",
  "Unanswered questions, grouped, so staff know what to add to the knowledge base",
  "Role management for staff (admin only)",
];

const stack = [
  { layer: "Frontend", what: "Next.js 15 (App Router), React 19, Tailwind, shadcn/Radix" },
  { layer: "Backend", what: "Convex: database, file storage, vector and full-text search, actions, scheduled jobs" },
  { layer: "Auth", what: "Convex Auth: email and password, plus Google sign-in" },
  { layer: "AI", what: "Vercel AI SDK with the CallMissed OpenAI-compatible gateway (chat, embeddings, speech, web search)" },
  { layer: "Hosting", what: "Cloudflare Workers via OpenNext; Convex cloud for the backend" },
  { layer: "Quality", what: "CI runs lint, typecheck, tests and the Cloudflare build; deploys run from main" },
];

const security = [
  "Four roles: member, officer, admin and kiosk. Staff-only actions check the role on the server.",
  "Chats, messages, documents and files are checked for ownership. Users see only their own.",
  "A kiosk account never sees chat history, grievances or personal memory. Kiosk chats are purged after one hour.",
  "Only staff can write to the knowledge base. URL fetching has an SSRF guard.",
  "Per-user rate limits on chat, voice, knowledge search, grievance filing and more. Kiosk accounts get wider limits.",
  "The public tracking page returns status and timeline only, with no personal details.",
];

const roadmap = [
  "Missed-call and IVR access for feature phones (planned)",
  "WhatsApp channel (planned)",
  "Offline FAQs on the kiosk (planned)",
  "Kiosk testing on real Raspberry Pi hardware (not yet done)",
  "State-registrar integration (a direction named in our demo plan)",
];

const btn =
  "inline-flex items-center justify-center rounded-full px-6 py-3 text-base font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1B2A5B]";
const btnPrimary = `${btn} bg-[#F28C1B] text-[#1B2A5B] hover:bg-[#e07d10]`;
const btnQuiet = `${btn} border-2 border-[#1B2A5B] text-[#1B2A5B] hover:bg-[#FFF4D6]`;

function Wrap({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-6xl px-5 md:px-8 ${className}`}>{children}</div>;
}

export default function WelcomePage() {
  return (
    <main>
      {/* tricolour rule */}
      <div aria-hidden className="flex h-1.5">
        <span className="flex-1 bg-[#F28C1B]" />
        <span className="flex-1 bg-white" />
        <span className="flex-1 bg-[#1E7B3A]" />
      </div>

      <header>
        <Wrap className="flex items-center justify-between py-5">
          <span className="font-display text-2xl">
            Sahayak <span lang="hi" className="text-[#F28C1B]">सहायक</span>
          </span>
          <nav className="flex items-center gap-1 text-sm font-semibold sm:gap-2">
            <a href="#film" className="hidden rounded-full px-4 py-2 hover:bg-[#FFF4D6] md:inline-block">Film</a>
            <a href="#features" className="hidden rounded-full px-4 py-2 hover:bg-[#FFF4D6] md:inline-block">Features</a>
            <a href="#architecture" className="hidden rounded-full px-4 py-2 hover:bg-[#FFF4D6] md:inline-block">Architecture</a>
            <Link href="/track" className="rounded-full px-4 py-2 hover:bg-[#FFF4D6]">
              Track a grievance
            </Link>
            <Link href="/login" className="rounded-full bg-[#1B2A5B] px-4 py-2 text-white hover:bg-[#13204a]">
              Sign in
            </Link>
          </nav>
        </Wrap>
      </header>

      {/* Hero */}
      <section>
        <Wrap className="grid items-center gap-12 pb-20 pt-8 md:grid-cols-[1.2fr_1fr] md:pt-14">
          <div>
            <h1 className="font-display text-5xl leading-[1.08] md:text-7xl">
              Ask in your own language. Get an answer you can act on.
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-[#1B2A5B]/80">
              Sahayak is a help desk for cooperative society members, farmers and rural
              communities. It explains cooperative law, government schemes and crop
              insurance, and files your grievance, by text or by voice.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login" className={btnPrimary}>Start asking</Link>
              <a href="#film" className={btnQuiet}>Watch the film</a>
            </div>
            <p className="mt-5 text-sm font-semibold text-[#1B2A5B]/70">
              Smart India Hackathon 2026 · PS 26088 · Ministry of Cooperation / NCCT
            </p>
          </div>
          <HeroVideo />
        </Wrap>
      </section>

      {/* Problem */}
      <section className="bg-[#FFF4D6]" aria-labelledby="problem">
        <Wrap className="grid gap-10 py-20 md:grid-cols-[1fr_1.4fr]">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-[#1E7B3A]">The problem</p>
            <h2 id="problem" className="font-display mt-2 text-4xl md:text-5xl">
              Help exists. It is hard to reach.
            </h2>
          </div>
          <div className="space-y-4 text-lg leading-relaxed text-[#1B2A5B]/85">
            {problem.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </div>
        </Wrap>
      </section>

      {/* Film */}
      <section className="bg-[#1B2A5B] text-white" id="film" aria-labelledby="film-title">
        <Wrap className="py-20">
          <p className="text-sm font-bold uppercase tracking-widest text-[#F6B04D]">The film</p>
          <h2 id="film-title" className="font-display mt-2 text-4xl md:text-5xl">Watch the film</h2>
          <p className="mt-4 max-w-xl text-lg text-white/80">
            A short film on what Sahayak does and who it is for.
          </p>
          <video
            className="mt-8 aspect-video max-h-[75vh] w-full rounded-2xl border-4 border-[#F28C1B] bg-black object-contain"
            controls
            playsInline
            preload="none"
            poster={FILM_POSTER}
            src={FILM_SRC}
          >
            Your browser cannot play this video.
          </video>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href={FILM_SRC}
              download="sahayak-film.mp4"
              className={`${btn} bg-[#F28C1B] text-[#1B2A5B] hover:bg-[#e07d10]`}
            >
              Download the film (MP4)
            </a>
            <a
              href={FILM_SRC}
              target="_blank"
              rel="noopener noreferrer"
              className={`${btn} border-2 border-white text-white hover:bg-white/10`}
            >
              Open in a new tab
            </a>
          </div>
        </Wrap>
      </section>

      {/* Languages: the memorable moment */}
      <section className="bg-[#1E7B3A] text-white" aria-labelledby="languages">
        <Wrap className="py-20">
          <h2 id="languages" className="font-display text-4xl md:text-5xl">
            22 languages, written and spoken
          </h2>
          <p className="mt-4 max-w-xl text-lg text-white/80">
            Choose a language once. Chat replies arrive in its script, and the microphone
            and speaker work in it too. English is included.
          </p>
          <ul className="mt-10 flex flex-wrap gap-x-7 gap-y-3 text-2xl md:text-3xl">
            {LANGUAGES.map((l, i) => (
              <li
                key={l.code}
                lang={l.code}
                title={l.name}
                className={i % 3 === 0 ? "text-[#F6B04D]" : i % 3 === 1 ? "text-white" : "text-[#8ED1A0]"}
              >
                {l.native}
              </li>
            ))}
          </ul>
        </Wrap>
      </section>

      {/* What it does */}
      <section aria-labelledby="what">
        <Wrap className="py-20">
          <h2 id="what" className="font-display max-w-2xl text-4xl md:text-5xl">
            What you can ask Sahayak
          </h2>
          <dl className="mt-10 grid gap-x-12 gap-y-8 md:grid-cols-2">
            {topics.map((t) => (
              <div key={t.title} className="border-l-4 border-[#F28C1B] pl-5">
                <dt className="text-xl font-bold">{t.title}</dt>
                <dd className="mt-1 max-w-md leading-relaxed text-[#1B2A5B]/80">{t.body}</dd>
              </div>
            ))}
          </dl>
        </Wrap>
      </section>

      {/* Features */}
      <section id="features" className="bg-[#FFF4D6]" aria-labelledby="features-title">
        <Wrap className="py-20">
          <h2 id="features-title" className="font-display text-4xl md:text-5xl">Everything in the prototype</h2>
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <li key={f.title} className="rounded-2xl border-2 border-[#1B2A5B] bg-white p-5 shadow-[4px_4px_0_0_#F28C1B]">
                <h3 className="text-lg font-bold">{f.title}</h3>
                <p className="mt-1 leading-relaxed text-[#1B2A5B]/80">{f.body}</p>
              </li>
            ))}
          </ul>
        </Wrap>
      </section>

      {/* KB first */}
      <section aria-labelledby="kb">
        <Wrap className="grid gap-10 py-20 md:grid-cols-2">
          <div>
            <h2 id="kb" className="font-display text-4xl md:text-5xl">Answers from sources, not guesses</h2>
            <p className="mt-4 max-w-md text-lg leading-relaxed text-[#1B2A5B]/80">
              Sahayak looks in its knowledge base first. Search is by meaning (vector
              embeddings) and falls back to full-text search if the embedding service is
              down. Every search is logged, and a search with no hits counts as an
              unanswered question for staff.
            </p>
          </div>
          <div>
            <p className="font-semibold">Curated sources today (8)</p>
            <ul className="mt-3 grid gap-1 text-[#1B2A5B]/80">
              {[
                "PACS member services",
                "PACS model by-laws",
                "MSCS Act and amendments",
                "Ministry of Cooperation schemes",
                "PMFBY crop insurance",
                "KCC and interest subvention",
                "Financial literacy and fraud safety",
                "Grievance redressal",
              ].map((k) => (
                <li key={k} className="flex gap-3">
                  <span aria-hidden className="mt-2.5 h-2 w-2 shrink-0 rounded-full bg-[#F28C1B]" />
                  {k}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-sm text-[#1B2A5B]/70">
              Some sources are still waiting for embeddings, so search currently uses the full-text fallback.
            </p>
          </div>
        </Wrap>
      </section>

      {/* How it works */}
      <section className="bg-[#FFF4D6]" aria-labelledby="how">
        <Wrap className="py-20">
          <h2 id="how" className="font-display text-4xl md:text-5xl">How it works</h2>
          <ol className="mt-10 grid gap-8 md:grid-cols-4">
            {steps.map((s, i) => (
              <li key={s.title}>
                <span className="font-display flex h-12 w-12 items-center justify-center rounded-full bg-[#1B2A5B] text-xl text-white">
                  {i + 1}
                </span>
                <h3 className="mt-4 text-lg font-bold">{s.title}</h3>
                <p className="mt-1 leading-relaxed text-[#1B2A5B]/80">{s.body}</p>
              </li>
            ))}
          </ol>
        </Wrap>
      </section>

      {/* Models */}
      <section aria-labelledby="models">
        <Wrap className="grid gap-10 py-20 md:grid-cols-[1fr_1.2fr]">
          <div>
            <h2 id="models" className="font-display text-4xl md:text-5xl">The models behind it</h2>
            <p className="mt-4 max-w-md text-lg leading-relaxed text-[#1B2A5B]/80">
              Sahayak runs on Indian-language models served through the CallMissed gateway.
              An administrator can switch the model for chat, speech-to-text and
              text-to-speech from a settings page, with no redeploy.
            </p>
          </div>
          <table className="w-full text-left">
            <caption className="sr-only">Models used by Sahayak</caption>
            <tbody>
              {models.map((m) => (
                <tr key={m.role} className="border-b border-[#1B2A5B]/15">
                  <th scope="row" className="py-3 pr-4 font-semibold">{m.role}</th>
                  <td className="py-3 font-mono text-sm text-[#1B2A5B]/80">{m.id}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Wrap>
      </section>

      {/* Kiosk */}
      <section className="border-y-4 border-[#1E7B3A] bg-[#EAF5EC]" aria-labelledby="kiosk">
        <Wrap className="grid gap-10 py-20 md:grid-cols-2">
          <div>
            <h2 id="kiosk" className="font-display text-4xl md:text-5xl">A kiosk for the society office</h2>
            <p className="mt-4 max-w-md text-lg leading-relaxed text-[#1B2A5B]/80">
              For people who do not carry a smartphone, we designed a voice kiosk. Tap a
              language, hold one big button, ask aloud and hear the answer.
            </p>
            <p className="mt-4 max-w-md rounded-lg bg-white px-4 py-3 text-sm font-semibold">
              Prototype and concept. The kiosk software runs in a browser today, but it
              has not yet been tested on real Raspberry Pi hardware.
            </p>
            <div className="mt-6">
              <Link href="/kiosk" className={btnQuiet}>Open the kiosk screen</Link>
            </div>
          </div>
          <ul className="grid content-start gap-3 text-lg">
            {[
              "Raspberry Pi 4 running the kiosk page full-screen",
              "7-inch touchscreen",
              "USB microphone and powered speaker",
              "Arcade push-to-talk button with a light",
              "Optional thermal printer for a paper receipt with a QR code",
              "Planned core build: about ₹16,000 in parts",
            ].map((item) => (
              <li key={item} className="flex gap-3">
                <span aria-hidden className="mt-2.5 h-2 w-2 shrink-0 rounded-full bg-[#1E7B3A]" />
                {item}
              </li>
            ))}
          </ul>
        </Wrap>
      </section>

      {/* Tracker */}
      <section aria-labelledby="track">
        <Wrap className="grid items-center gap-10 py-20 md:grid-cols-2">
          <div>
            <h2 id="track" className="font-display text-4xl md:text-5xl">Follow your grievance</h2>
            <p className="mt-4 max-w-md text-lg leading-relaxed text-[#1B2A5B]/80">
              Every grievance gets a reference ID that starts with GRV. Enter it on the
              tracking page from any phone. No account is needed, and the timeline updates
              when an officer acts.
            </p>
            <div className="mt-6">
              <Link href="/track" className={btnPrimary}>Track a grievance</Link>
            </div>
          </div>
          <div className="rounded-2xl border-2 border-dashed border-[#1B2A5B]/40 p-6">
            <p className="text-sm text-[#1B2A5B]/70">Your reference</p>
            <p className="font-mono text-3xl font-bold tracking-wider">GRV-XXXXXXXX</p>
          </div>
        </Wrap>
      </section>

      {/* Grievance flow */}
      <section className="bg-[#FFF4D6]" aria-labelledby="flow">
        <Wrap className="py-20">
          <h2 id="flow" className="font-display text-4xl md:text-5xl">A grievance, start to finish</h2>
          <ol className="mt-10 grid gap-8 md:grid-cols-4">
            {flow.map((s, i) => (
              <li key={s.title} className="border-t-4 border-[#1E7B3A] pt-4">
                <span className="font-display text-3xl text-[#F28C1B]">{i + 1}</span>
                <h3 className="mt-1 text-lg font-bold">{s.title}</h3>
                <p className="mt-1 leading-relaxed text-[#1B2A5B]/80">{s.body}</p>
              </li>
            ))}
          </ol>
        </Wrap>
      </section>

      {/* Officer + admin */}
      <section aria-labelledby="staff">
        <Wrap className="grid gap-12 py-20 md:grid-cols-2">
          <div>
            <h2 id="staff" className="font-display text-4xl md:text-5xl">For officers</h2>
            <ul className="mt-6 grid gap-3 text-lg">
              {officer.map((o) => (
                <li key={o} className="flex gap-3">
                  <span aria-hidden className="mt-2.5 h-2 w-2 shrink-0 rounded-full bg-[#F28C1B]" />
                  {o}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl bg-[#1B2A5B] p-7 text-white">
            <h3 className="font-display text-3xl">For admins: switch models live</h3>
            <p className="mt-3 leading-relaxed text-white/85">
              The Models and voice page lets an admin pick the provider and model for each
              chat tier, speech-to-text, text-to-speech and the voice. The choice is stored
              in the database and read at call time, so nothing is redeployed. A reset
              returns to the default. The embedding model is fixed because the vector
              indexes are 1536-dimensional.
            </p>
          </div>
        </Wrap>
      </section>

      {/* Architecture */}
      <section id="architecture" className="bg-[#1B2A5B] text-white" aria-labelledby="arch">
        <Wrap className="py-20">
          <h2 id="arch" className="font-display text-4xl md:text-5xl">Architecture and stack</h2>
          <p className="mt-4 max-w-2xl text-lg text-white/80">
            Phone, laptop and kiosk all use the same web app and the same backend. The
            kiosk is the normal app with a large-touch voice page, signed in with a kiosk account.
          </p>
          <dl className="mt-10 grid gap-x-10 gap-y-5 md:grid-cols-2">
            {stack.map((t) => (
              <div key={t.layer} className="border-l-4 border-[#F28C1B] pl-5">
                <dt className="font-bold text-[#F6B04D]">{t.layer}</dt>
                <dd className="mt-1 leading-relaxed text-white/85">{t.what}</dd>
              </div>
            ))}
          </dl>
        </Wrap>
      </section>

      {/* Security */}
      <section aria-labelledby="security">
        <Wrap className="grid gap-10 py-20 md:grid-cols-[1fr_1.4fr]">
          <h2 id="security" className="font-display text-4xl md:text-5xl">Access control and limits</h2>
          <ul className="grid gap-3 text-lg">
            {security.map((x) => (
              <li key={x} className="flex gap-3">
                <span aria-hidden className="mt-2.5 h-2 w-2 shrink-0 rounded-full bg-[#1E7B3A]" />
                {x}
              </li>
            ))}
          </ul>
        </Wrap>
      </section>

      {/* Roadmap */}
      <section className="bg-[#EAF5EC]" aria-labelledby="roadmap">
        <Wrap className="py-20">
          <h2 id="roadmap" className="font-display text-4xl md:text-5xl">What comes next</h2>
          <p className="mt-4 max-w-xl text-lg text-[#1B2A5B]/80">
            None of these are built yet.
          </p>
          <ul className="mt-8 grid gap-3 text-lg md:grid-cols-2">
            {roadmap.map((x) => (
              <li key={x} className="rounded-xl border-2 border-dashed border-[#1E7B3A] bg-white px-4 py-3">
                {x}
              </li>
            ))}
          </ul>
        </Wrap>
      </section>

      {/* Final CTA */}
      <section className="bg-[#F28C1B]">
        <Wrap className="flex flex-col items-start gap-6 py-16 md:flex-row md:items-center md:justify-between">
          <h2 className="font-display max-w-xl text-4xl">Ask your first question today.</h2>
          <div className="flex flex-wrap gap-3">
            <Link href="/login" className={`${btn} bg-[#1B2A5B] text-white hover:bg-[#13204a]`}>
              Sign in to chat
            </Link>
            <Link href="/register" className={`${btn} border-2 border-[#1B2A5B] text-[#1B2A5B] hover:bg-white/40`}>
              Create an account
            </Link>
            <a href={LIVE_URL} className={`${btn} border-2 border-[#1B2A5B] text-[#1B2A5B] hover:bg-white/40`}>
              Live app
            </a>
            <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className={`${btn} border-2 border-[#1B2A5B] text-[#1B2A5B] hover:bg-white/40`}>
              GitHub
            </a>
          </div>
        </Wrap>
      </section>

      <footer>
        <Wrap className="py-8 text-sm text-[#1B2A5B]/70">
          Sahayak is a Smart India Hackathon 2026 prototype (PS 26088) for cooperative governance support. Source: <a className="underline" href={REPO_URL}>github.com/prasadxa/sahayak</a>. Answers come from a curated knowledge base; check important decisions with your society officer.
        </Wrap>
      </footer>
    </main>
  );
}
