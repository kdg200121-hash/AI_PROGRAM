type ApprovalStatus = "approved" | "pending" | "rejected";
type ReviewState = "open" | "closed" | "merged";

export interface CustomToolSyncVersion {
  id: string;
  version: string;
  author: string;
  description: string;
  sourcePath?: string;
  installedPath?: string;
  reviewUrl?: string;
  reviewNumber?: number;
  reviewState?: ReviewState;
  isToolLike: boolean;
  riskWarnings: string[];
  toolSchema?: unknown;
  learningLog?: unknown;
}

export interface CustomToolSyncItem<SectionId extends string = string> {
  id: string;
  sectionId: SectionId;
  name: string;
  description: string;
  version: string;
  author: string;
  createdAt?: string;
  usageCount: number;
  pinned: boolean;
  registered: boolean;
  approvalStatus: ApprovalStatus;
  isToolLike: boolean;
  riskWarnings: string[];
  toolSchema?: unknown;
  learningLog?: unknown;
  sourcePath?: string;
  installedPath?: string;
  reviewUrl?: string;
  reviewNumber?: number;
  reviewState?: ReviewState;
  versions?: CustomToolSyncVersion[];
}

export interface GithubToolSyncGroup<SectionId extends string = string> {
  sectionId: SectionId;
  name: string;
  versions: CustomToolSyncVersion[];
}

interface MergeGithubCustomToolsOptions<SectionId extends string = string> {
  items: CustomToolSyncItem<SectionId>[];
  groups: GithubToolSyncGroup<SectionId>[];
  githubToolPathPrefix: string;
  nowIso: string;
  makeId: (group: GithubToolSyncGroup<SectionId>) => string;
}

function pathStartsWithGithubPrefix(path: string | undefined, githubToolPathPrefix: string) {
  return Boolean(path?.startsWith(githubToolPathPrefix));
}

export function isGithubCustomToolItem(
  item: CustomToolSyncItem,
  githubToolPathPrefix: string
) {
  if (
    pathStartsWithGithubPrefix(item.sourcePath, githubToolPathPrefix) ||
    pathStartsWithGithubPrefix(item.installedPath, githubToolPathPrefix)
  ) {
    return true;
  }

  return Boolean(
    item.versions?.some(
      (version) =>
        pathStartsWithGithubPrefix(version.sourcePath, githubToolPathPrefix) ||
        pathStartsWithGithubPrefix(version.installedPath, githubToolPathPrefix)
    )
  );
}

function pathsForItem(item: CustomToolSyncItem) {
  return [
    item.sourcePath,
    item.installedPath,
    ...(item.versions ?? []).flatMap((version) => [version.sourcePath, version.installedPath])
  ].filter((path): path is string => Boolean(path));
}

function pathsForGroup(group: GithubToolSyncGroup) {
  return group.versions
    .flatMap((version) => [version.sourcePath, version.installedPath])
    .filter((path): path is string => Boolean(path));
}

function itemSharesAnyPath(item: CustomToolSyncItem, group: GithubToolSyncGroup) {
  const groupPaths = new Set(pathsForGroup(group));
  return pathsForItem(item).some((path) => groupPaths.has(path));
}

function findExistingGithubItem<SectionId extends string>(
  githubItems: CustomToolSyncItem<SectionId>[],
  group: GithubToolSyncGroup<SectionId>,
  groups: GithubToolSyncGroup<SectionId>[]
) {
  return (
    githubItems.find(
      (item) => item.sectionId === group.sectionId && item.name === group.name
    ) ??
    githubItems.find((item) => itemSharesAnyPath(item, group)) ??
    (groups.filter((candidate) => candidate.name === group.name).length === 1
      ? githubItems.find((item) => item.name === group.name)
      : undefined)
  );
}

export function mergeGithubCustomTools<SectionId extends string>({
  items,
  groups,
  githubToolPathPrefix,
  nowIso,
  makeId
}: MergeGithubCustomToolsOptions<SectionId>): CustomToolSyncItem<SectionId>[] {
  const nonGithubItems = items.filter(
    (item) => !isGithubCustomToolItem(item, githubToolPathPrefix)
  );
  const githubItems = items.filter((item) =>
    isGithubCustomToolItem(item, githubToolPathPrefix)
  );

  const syncedGithubItems = groups.map((group) => {
    const activeVersion = group.versions[0];
    const existing = findExistingGithubItem(githubItems, group, groups);

    return {
      id: existing?.id ?? makeId(group),
      sectionId: group.sectionId,
      name: group.name,
      description: activeVersion.description,
      version: activeVersion.version,
      author: activeVersion.author,
      createdAt: existing?.createdAt ?? nowIso,
      usageCount: existing?.usageCount ?? 0,
      pinned: existing?.pinned ?? false,
      registered: existing?.registered ?? false,
      approvalStatus: existing?.approvalStatus ?? "approved",
      isToolLike: activeVersion.isToolLike,
      riskWarnings: activeVersion.riskWarnings,
      toolSchema: activeVersion.toolSchema,
      learningLog: activeVersion.learningLog,
      sourcePath: activeVersion.sourcePath,
      installedPath: activeVersion.installedPath,
      reviewUrl: existing?.reviewUrl,
      reviewNumber: existing?.reviewNumber,
      reviewState: existing?.reviewState,
      versions: [activeVersion]
    };
  });

  return [...nonGithubItems, ...syncedGithubItems];
}
