import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("renderer build config", () => {
  it("uses relative asset paths for file:// Electron loading", () => {
    const config = readFileSync(new URL("../vite.config.ts", import.meta.url), "utf8");

    expect(config).toContain('base: "./"');
  });
});
