import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("package-win script", () => {
  it("copies root tool markdown files into the packaged app", () => {
    const script = readFileSync(new URL("../scripts/package-win.mjs", import.meta.url), "utf8");

    expect(script).toContain("copyToolMarkdownFiles");
    expect(script).toContain(".endsWith(\".md\")");
  });
});
