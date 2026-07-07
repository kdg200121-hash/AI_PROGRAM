export type OpenAiSettingsSource = "stored" | "environment" | null;

export interface OpenAiSettingsStatus {
  configured: boolean;
  source: OpenAiSettingsSource;
  model: string;
  encryptionAvailable: boolean;
  updatedAt?: string;
}

export interface OpenAiSettingsStatusInput {
  storedApiKey?: string;
  environmentApiKey?: string;
  storedModel?: string;
  environmentModel?: string;
  defaultModel: string;
  encryptionAvailable: boolean;
  updatedAt?: string;
}

export function resolveOpenAiSettingsStatus(input: OpenAiSettingsStatusInput): OpenAiSettingsStatus {
  const hasStoredKey = Boolean(input.storedApiKey?.trim());
  const hasEnvironmentKey = Boolean(input.environmentApiKey?.trim());
  return {
    configured: hasStoredKey || hasEnvironmentKey,
    source: hasStoredKey ? "stored" : hasEnvironmentKey ? "environment" : null,
    model: input.storedModel?.trim() || input.environmentModel?.trim() || input.defaultModel,
    encryptionAvailable: input.encryptionAvailable,
    ...(input.updatedAt ? { updatedAt: input.updatedAt } : {})
  };
}
