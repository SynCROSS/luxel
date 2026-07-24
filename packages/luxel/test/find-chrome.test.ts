import { describe, expect, test } from "bun:test";
import { isHeadlessShellChrome } from "../src/util/find-chrome.ts";

describe("isHeadlessShellChrome", () => {
  test("detects playwright headless shell binaries", () => {
    expect(
      isHeadlessShellChrome(
        "C:\\ms-playwright\\chromium_headless_shell-1223\\chrome-headless-shell-win64\\chrome-headless-shell.exe",
      ),
    ).toBe(true);
    expect(isHeadlessShellChrome("/ms-playwright/chromium_headless_shell-1/chrome-headless-shell")).toBe(
      true,
    );
  });

  test("allows full chrome binaries", () => {
    expect(isHeadlessShellChrome("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe")).toBe(
      false,
    );
    expect(
      isHeadlessShellChrome(
        "C:\\ms-playwright\\chromium-1223\\chrome-win64\\chrome.exe",
      ),
    ).toBe(false);
  });
});
