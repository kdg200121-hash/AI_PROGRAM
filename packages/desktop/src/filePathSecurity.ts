import { isAbsolute, relative, resolve } from "node:path";

export function normalizeAllowedPath(pathValue: string) {
  const trimmedPath = pathValue.trim();
  if (!trimmedPath) {
    throw new Error("경로가 비어 있습니다.");
  }

  return resolve(trimmedPath);
}

export function isPathInsideDirectory(candidatePath: string, directoryPath: string) {
  const normalizedCandidate = normalizeAllowedPath(candidatePath);
  const normalizedDirectory = normalizeAllowedPath(directoryPath);
  const relativePath = relative(normalizedDirectory, normalizedCandidate);

  return (
    relativePath === "" ||
    (!!relativePath && !relativePath.startsWith("..") && !isAbsolute(relativePath))
  );
}

export function assertPathInsideAllowedRoots(
  candidatePath: string,
  allowedRoots: string[],
  label = "경로"
) {
  if (
    allowedRoots.length === 0 ||
    !allowedRoots.some((rootPath) => isPathInsideDirectory(candidatePath, rootPath))
  ) {
    throw new Error(`${label}은 사용자가 선택한 툴 폴더 안에 있어야 합니다.`);
  }
}
