export type JSONSchemaProperty =
  | { type: 'string'; description?: string; enum?: readonly string[] | string[] }
  | { type: 'integer'; description?: string; minimum?: number }
  | { type: 'number'; description?: string }
  | { type: 'boolean'; description?: string }
  | { type: 'array'; items: JSONSchemaProperty; description?: string }
  | { type: ['string', 'null']; description?: string }
  | {
      type: 'object'
      properties: Record<string, JSONSchemaProperty>
      required?: string[]
      description?: string
    }

export type JSONSchema = {
  type: 'object'
  properties: Record<string, JSONSchemaProperty>
  required?: string[]
  additionalProperties?: boolean
}

export interface ProviderCallResult<T> {
  data: T
  usage: { inputTokens: number; outputTokens: number }
}

export interface LLMProvider {
  readonly kind: 'anthropic' | 'openai-compatible'
  readonly model: string
  callWithSchema<T>(params: {
    systemPrompt: string
    userPrompt: string
    toolName: string
    toolDescription: string
    toolInputSchema: JSONSchema
    maxTokens?: number
  }): Promise<ProviderCallResult<T>>
}

export type LLMProviderErrorKind =
  | 'network'
  | 'auth'
  | 'rate_limit'
  | 'refusal'
  | 'parse'
  | 'other'

export class LLMProviderError extends Error {
  constructor(
    message: string,
    public readonly kind: LLMProviderErrorKind,
    public readonly cause?: unknown
  ) {
    super(message)
    this.name = 'LLMProviderError'
  }
}
