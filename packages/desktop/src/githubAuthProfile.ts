export interface StoredGitHubAuthProfile {
  githubId: string;
  nickname?: string;
}

export interface GitHubLoginUser {
  login: string;
  name?: string | null;
}

export function nicknameForGitHubLogin({
  enteredNickname,
  existingProfile,
  githubUser
}: {
  enteredNickname?: string;
  existingProfile?: StoredGitHubAuthProfile | null;
  githubUser: GitHubLoginUser;
}) {
  const trimmedEnteredNickname = enteredNickname?.trim();
  if (trimmedEnteredNickname) {
    return trimmedEnteredNickname;
  }

  const savedNickname = existingProfile?.nickname?.trim();
  if (existingProfile?.githubId === githubUser.login && savedNickname) {
    return savedNickname;
  }

  return githubUser.name?.trim() || githubUser.login;
}
