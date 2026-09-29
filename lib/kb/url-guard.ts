/**
 * SSRF guard for KB URL ingestion. Pure (no DNS): it checks the URL's scheme
 * and literal host only. A public name that resolves to a private address
 * (DNS rebinding) is not caught here.
 */

const BLOCKED_NAME_SUFFIXES = [".localhost", ".local", ".internal"];

function reject(reason: string): never {
  throw new Error(`URL not allowed: ${reason}`);
}

/** Parse a dotted-quad IPv4 literal (already normalised by WHATWG URL). */
function parseIPv4(host: string): number[] | null {
  const parts = host.split(".");
  if (parts.length !== 4) return null;
  const octets = parts.map((p) => (/^\d{1,3}$/.test(p) ? Number(p) : Number.NaN));
  return octets.every((o) => Number.isInteger(o) && o >= 0 && o <= 255) ? octets : null;
}

function isBlockedIPv4([a, b]: number[]): boolean {
  return (
    a === 0 || // 0.0.0.0/8 "this network"
    a === 10 || // 10/8 private
    a === 127 || // 127/8 loopback
    (a === 169 && b === 254) || // 169.254/16 link-local (cloud metadata)
    (a === 172 && b >= 16 && b <= 31) || // 172.16/12 private
    (a === 192 && b === 168) || // 192.168/16 private
    (a === 100 && b >= 64 && b <= 127) || // 100.64/10 carrier-grade NAT
    a >= 224 // multicast + reserved
  );
}

/** Expand an IPv6 literal (no brackets) to eight 16-bit groups. */
function parseIPv6(host: string): number[] | null {
  let h = host;
  // Trailing embedded IPv4 (e.g. ::ffff:1.2.3.4) → two hex groups.
  const v4 = h.match(/^(.*:)(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (v4) {
    const o = parseIPv4(v4[2]);
    if (!o) return null;
    h = `${v4[1]}${((o[0] << 8) | o[1]).toString(16)}:${((o[2] << 8) | o[3]).toString(16)}`;
  }
  const halves = h.split("::");
  if (halves.length > 2) return null;
  const toGroups = (s: string) => (s === "" ? [] : s.split(":"));
  const head = toGroups(halves[0]);
  const tail = halves.length === 2 ? toGroups(halves[1]) : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const all = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill("0"), ...tail];
  const groups = all.map((g) => (/^[0-9a-f]{1,4}$/i.test(g) ? Number.parseInt(g, 16) : Number.NaN));
  return groups.every((g) => !Number.isNaN(g)) ? groups : null;
}

function isBlockedIPv6(g: number[]): boolean {
  const allZeroUpTo = (n: number) => g.slice(0, n).every((x) => x === 0);
  if (allZeroUpTo(8)) return true; // :: unspecified
  if (allZeroUpTo(7) && g[7] === 1) return true; // ::1 loopback
  if ((g[0] & 0xfe00) === 0xfc00) return true; // fc00::/7 unique local
  if ((g[0] & 0xffc0) === 0xfe80) return true; // fe80::/10 link-local
  if ((g[0] & 0xff00) === 0xff00) return true; // ff00::/8 multicast
  // IPv4-mapped (::ffff:a.b.c.d) and IPv4-compatible (::a.b.c.d): check the IPv4.
  if (allZeroUpTo(5) && (g[5] === 0xffff || g[5] === 0)) {
    return isBlockedIPv4([g[6] >> 8, g[6] & 0xff, g[7] >> 8, g[7] & 0xff]);
  }
  return false;
}

/**
 * Returns the parsed URL if it is http(s) and its host is not loopback,
 * private, link-local or an internal name. Throws `URL not allowed: …` otherwise.
 */
export function assertPublicHttpUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    reject("not a valid URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    reject(`only http and https are supported (got ${url.protocol})`);
  }

  // WHATWG URL lower-cases names and normalises IPv4 spellings
  // (2130706433, 0x7f000001, 0177.0.0.1 → 127.0.0.1).
  const host = url.hostname.replace(/\.$/, "");
  if (!host) reject("missing host");

  if (host.startsWith("[") && host.endsWith("]")) {
    const groups = parseIPv6(host.slice(1, -1));
    if (!groups || isBlockedIPv6(groups)) reject(`internal address ${host}`);
    return url;
  }

  const v4 = parseIPv4(host);
  if (v4) {
    if (isBlockedIPv4(v4)) reject(`internal address ${host}`);
    return url;
  }

  if (host === "localhost" || BLOCKED_NAME_SUFFIXES.some((s) => host.endsWith(s))) {
    reject(`internal host ${host}`);
  }
  return url;
}
