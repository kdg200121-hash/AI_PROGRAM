import { describe, expect, it } from "vitest";
import { resolveOpenAiSettingsStatus } from "./openAiSettings";

describe("resolveOpenAiSettingsStatus", () => {
  it("prefers a saved API key over environment variables", () => {
    expect(
      resolveOpenAiSettingsStatus({
        storedApiKey: "stored-key",
        environmentApiKey: "env-key",
        storedModel: "gpt-5.5",
        environmentModel: "gpt-env",
        defaultModel: "gpt-default",
        encryptionAvailable: true,
        updatedAt: "2026-07-08T00:00:00.000Z"
      })
    ).toEqual({
      configured: true,
      source: "stored",
      model: "gpt-5.5",
      encryptionAvailable: true,
      updatedAt: "2026-07-08T00:00:00.000Z"
    });
  });

  it("falls back to environment configuration before the default model", () => {
    expect(
      resolveOpenAiSettingsStatus({
        environmentApiKey: "env-key",
        environmentModel: "gpt-env",
        defaultModel: "gpt-default",
        encryptionAvailable: false
      })
    ).toEqual({
      configured: true,
      source: "environment",
      model: "gpt-env",
      encryptionAvailable: false
    });
  });

  it("reports missing credentials without exposing a key", () => {
    expect(
      resolveOpenAiSettingsStatus({
        defaultModel: "gpt-default",
        encryptionAvailable: true
      })
    ).toEqual({
      configured: false,
      source: null,
      model: "gpt-default",
      encryptionAvailable: true
    });
  });
});
