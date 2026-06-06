import { describe, expect, it } from "vitest";
import { isAppleMobileSafari } from "../apple-mobile-safari";

describe("isAppleMobileSafari", () => {
  it("detects iPhone Safari", () => {
    expect(
      isAppleMobileSafari(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
      ),
    ).toBe(true);
  });

  it("detects iPad Safari", () => {
    expect(
      isAppleMobileSafari(
        "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
      ),
    ).toBe(true);
  });

  it("does not match Safari on macOS", () => {
    expect(
      isAppleMobileSafari(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
      ),
    ).toBe(false);
  });

  it("does not match Chrome on iPhone", () => {
    expect(
      isAppleMobileSafari(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/125.0.6422.73 Mobile/15E148 Safari/604.1",
      ),
    ).toBe(false);
  });

  it("does not match Android browsers", () => {
    expect(
      isAppleMobileSafari(
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36",
      ),
    ).toBe(false);
  });
});
