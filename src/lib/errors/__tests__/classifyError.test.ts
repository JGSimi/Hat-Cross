import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { classifyError } from "../classifyError";

const originalOnLine = Object.getOwnPropertyDescriptor(
  window.navigator,
  "onLine",
);

function setOnline(online: boolean) {
  Object.defineProperty(window.navigator, "onLine", {
    configurable: true,
    value: online,
  });
}

describe("classifyError (EE1)", () => {
  beforeEach(() => setOnline(true));
  afterEach(() => {
    if (originalOnLine) {
      Object.defineProperty(window.navigator, "onLine", originalOnLine);
    }
  });

  it("returns unknown for null / undefined", () => {
    expect(classifyError(null)).toBe("unknown");
    expect(classifyError(undefined)).toBe("unknown");
  });

  it("detects network-offline when navigator.onLine is false", () => {
    setOnline(false);
    expect(classifyError(new Error("fetch failed"))).toBe("network-offline");
  });

  describe("firebase auth", () => {
    it("maps auth/popup-blocked", () => {
      expect(classifyError({ code: "auth/popup-blocked" })).toBe(
        "firebase-auth-popup-blocked",
      );
    });

    it("maps auth/network-request-failed", () => {
      expect(classifyError({ code: "auth/network-request-failed" })).toBe(
        "firebase-auth-network-request-failed",
      );
    });

    it("maps auth/account-exists-with-different-credential", () => {
      expect(
        classifyError({ code: "auth/account-exists-with-different-credential" }),
      ).toBe("firebase-auth-account-exists-with-different-credential");
    });

    it("maps auth/too-many-requests", () => {
      expect(classifyError({ code: "auth/too-many-requests" })).toBe(
        "firebase-auth-too-many-requests",
      );
    });

    it("falls back to invalid-credential for unknown auth/* codes", () => {
      expect(classifyError({ code: "auth/user-disabled" })).toBe(
        "firebase-auth-invalid-credential",
      );
    });
  });

  describe("provider HTTP status", () => {
    it("maps 401 to provider-401", () => {
      expect(classifyError({ status: 401 })).toBe("provider-401");
    });

    it("maps 403 to provider-401", () => {
      expect(classifyError({ status: 403 })).toBe("provider-401");
    });

    it("maps 429 to provider-429", () => {
      expect(classifyError({ status: 429 })).toBe("provider-429");
    });

    it("maps 503 to provider-5xx", () => {
      expect(classifyError({ status: 503 })).toBe("provider-5xx");
    });

    it("ignores 200 as unknown", () => {
      expect(classifyError({ status: 200 })).toBe("unknown");
    });
  });

  describe("Error instances", () => {
    it("detects AbortError name as timeout", () => {
      const e = new Error("fetch aborted");
      e.name = "AbortError";
      expect(classifyError(e)).toBe("provider-timeout");
    });

    it("detects timeout message", () => {
      expect(classifyError(new Error("Request timed out after 30s"))).toBe(
        "provider-timeout",
      );
    });

    it("detects context length exceeded", () => {
      expect(
        classifyError(new Error("Context length exceeded: 200000 tokens")),
      ).toBe("provider-context-exceeded");
    });

    it("detects content filter", () => {
      expect(classifyError(new Error("Blocked by content_policy"))).toBe(
        "provider-content-filter",
      );
    });

    it("detects tauri capability denied", () => {
      expect(classifyError(new Error("Capability clipboard:read denied"))).toBe(
        "tauri-capability-denied",
      );
    });

    it("detects tauri fs errors", () => {
      expect(classifyError(new Error("forbidden path: /etc/passwd"))).toBe(
        "tauri-fs-error",
      );
    });

    it("detects clipboard errors", () => {
      expect(classifyError(new Error("Clipboard read failed"))).toBe(
        "clipboard-read-failed",
      );
    });

    it("detects insufficient credits in en", () => {
      expect(classifyError(new Error("Insufficient credits"))).toBe(
        "credits-insufficient",
      );
    });

    it("detects insufficient credits in pt-BR", () => {
      expect(classifyError(new Error("Créditos zerados"))).toBe(
        "credits-insufficient",
      );
    });

    it("detects tauri command invoke failure", () => {
      expect(
        classifyError(new Error("invoke command flash_show rejected")),
      ).toBe("tauri-command-failed");
    });
  });

  describe("string errors", () => {
    it("detects tauri capability from string", () => {
      expect(classifyError("capability denied for fs:read")).toBe(
        "tauri-capability-denied",
      );
    });
  });

  it("returns unknown for unrecognized Error messages", () => {
    expect(classifyError(new Error("something weird happened"))).toBe("unknown");
  });

  it("returns unknown for non-error primitives", () => {
    expect(classifyError(42)).toBe("unknown");
    expect(classifyError(true)).toBe("unknown");
  });
});
