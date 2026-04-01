export type AssistantLlmCallLayer = 'understanding' | 'composer';

export type AssistantLlmCallSource = 'llm' | 'deterministic';

export type AssistantLlmCallDiagnostics = {
  layer: AssistantLlmCallLayer;
  apiKeyPresent: boolean;
  called: boolean;
  source: AssistantLlmCallSource;
  model: string;
  baseUrl: string;
  durationMs: number | null;
  success: boolean | null;
  statusCode: number | null;
  fallbackReason: string | null;
  deterministicFallbackUsed: boolean;
  error: string | null;
};

export function createAssistantLlmCallDiagnostics(input: {
  layer: AssistantLlmCallLayer;
  apiKeyPresent: boolean;
  model: string;
  baseUrl: string;
}): AssistantLlmCallDiagnostics {
  return {
    layer: input.layer,
    apiKeyPresent: input.apiKeyPresent,
    called: false,
    source: 'deterministic',
    model: input.model,
    baseUrl: input.baseUrl,
    durationMs: null,
    success: null,
    statusCode: null,
    fallbackReason: null,
    deterministicFallbackUsed: false,
    error: null,
  };
}
