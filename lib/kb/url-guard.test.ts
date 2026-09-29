import { describe, expect, it } from "vitest";
import { assertPublicHttpUrl } from "./url-guard";

describe("assertPublicHttpUrl", () => {
  it.each([
    "https://pmfby.gov.in/",
    "https://cooperation.gov.in/en/schemes",
    "http://example.com:8080/page?x=1",
    "https://172.15.0.1/",
    "https://172.32.0.1/",
    "https://8.8.8.8/",
    "https://[2001:4860:4860::8888]/",
  ])("allows public URL %s", (raw) => {
    expect(assertPublicHttpUrl(raw)).toBeInstanceOf(URL);
  });

  it("returns the parsed URL", () => {
    expect(assertPublicHttpUrl("https://pmfby.gov.in/").hostname).toBe("pmfby.gov.in");
  });

  it.each([
    "file:///etc/passwd",
    "ftp://example.com/file",
    "gopher://example.com/",
    "javascript:alert(1)",
    "data:text/plain,hello",
  ])("rejects non-http(s) scheme %s", (raw) => {
    expect(() => assertPublicHttpUrl(raw)).toThrow(/http/i);
  });

  it.each(["not a url", "", "https://"])("rejects unparseable %j", (raw) => {
    expect(() => assertPublicHttpUrl(raw)).toThrow();
  });

  it.each([
    // Review Focus #5
    "http://127.0.0.1",
    "http://127.0.0.1:3000/admin",
    "http://169.254.169.254/latest/meta-data/",
    // loopback / private / link-local / this-network IPv4
    "http://127.1.2.3/",
    "http://10.0.0.5/",
    "http://172.16.0.1/",
    "http://172.31.255.255/",
    "http://192.168.1.1/",
    "http://0.0.0.0/",
    "http://0.1.2.3/",
    // alternate IPv4 spellings that WHATWG URL normalises to 127.0.0.1
    "http://2130706433/",
    "http://0x7f000001/",
    "http://0177.0.0.1/",
    // names
    "http://localhost/",
    "http://LOCALHOST:8080/",
    "http://api.localhost/",
    "http://printer.local/",
    "http://metadata.google.internal/",
    "http://localhost./",
    // IPv6
    "http://[::1]/",
    "http://[0:0:0:0:0:0:0:1]/",
    "http://[::]/",
    "http://[fc00::1]/",
    "http://[fd12:3456:789a::1]/",
    "http://[fe80::1]/",
    "http://[febf::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://[::ffff:10.0.0.1]/",
  ])("rejects internal host %s", (raw) => {
    expect(() => assertPublicHttpUrl(raw)).toThrow(/not allowed/i);
  });
});
