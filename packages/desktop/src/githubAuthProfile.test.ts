import { describe, expect, it } from "vitest";
import { nicknameForGitHubLogin } from "./githubAuthProfile";

describe("nicknameForGitHubLogin", () => {
  it("keeps the saved nickname when the same GitHub account logs in again", () => {
    expect(
      nicknameForGitHubLogin({
        enteredNickname: "",
        existingProfile: {
          githubId: "kdg200121-hash",
          nickname: "동건"
        },
        githubUser: {
          login: "kdg200121-hash",
          name: "GitHub Name"
        }
      })
    ).toBe("동건");
  });

  it("uses a newly entered nickname over a saved nickname", () => {
    expect(
      nicknameForGitHubLogin({
        enteredNickname: "새 닉네임",
        existingProfile: {
          githubId: "kdg200121-hash",
          nickname: "동건"
        },
        githubUser: {
          login: "kdg200121-hash",
          name: "GitHub Name"
        }
      })
    ).toBe("새 닉네임");
  });

  it("does not reuse a nickname saved for a different GitHub account", () => {
    expect(
      nicknameForGitHubLogin({
        enteredNickname: "",
        existingProfile: {
          githubId: "other-user",
          nickname: "다른 사람"
        },
        githubUser: {
          login: "kdg200121-hash",
          name: "GitHub Name"
        }
      })
    ).toBe("GitHub Name");
  });
});
