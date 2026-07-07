import { describe, expect, it } from "vitest";
import {
  assertPathInsideAllowedRoots,
  isPathInsideDirectory,
  normalizeAllowedPath
} from "./filePathSecurity";

describe("filePathSecurity", () => {
  it("allows a selected folder and files inside it", () => {
    const root = normalizeAllowedPath("C:/Users/Donggeon/Documents/AI Program/tools");

    expect(isPathInsideDirectory(`${root}/sample.md`, root)).toBe(true);
    expect(isPathInsideDirectory(`${root}/nested/sample.md`, root)).toBe(true);
    expect(() => assertPathInsideAllowedRoots(`${root}/sample.md`, [root], "툴 파일")).not.toThrow();
  });

  it("blocks sibling paths that only share the same prefix", () => {
    const root = normalizeAllowedPath("C:/Users/Donggeon/Documents/AI Program/tools");
    const sibling = normalizeAllowedPath("C:/Users/Donggeon/Documents/AI Program/tools-private/secret.md");

    expect(isPathInsideDirectory(sibling, root)).toBe(false);
    expect(() => assertPathInsideAllowedRoots(sibling, [root], "툴 파일")).toThrow(
      "툴 파일은 사용자가 선택한 툴 폴더 안에 있어야 합니다."
    );
  });
});
