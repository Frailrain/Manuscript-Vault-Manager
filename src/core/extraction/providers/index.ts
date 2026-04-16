import type { LLMProviderConfig } from '../../../shared/types'
import { ExtractionError } from '../errors'
import { AnthropicProvider } from './anthropic'
import { OpenAICompatibleProvider } from './openaiCompatible'
import type { LLMProvider } from './types'

export function createProvider(config: LLMProviderConfig): LLMProvider {
  switch (config.kind) {
    case 'anthropic':
      return new AnthropicProvider(config)
    case 'openai-compatible':
      return new OpenAICompatibleProvider(config)
    default: {
      const exhaustive: never = config.kind
      throw new ExtractionError(
        `Unknown provider kind: ${String(exhaustive)}`,
        'config'
      )
    }
  }
}

export type { LLMProvider } from './types'
export {
  LLMProviderError,
  type JSONSchema,
  type JSONSchemaProperty,
  type ProviderCallResult
} from './types'
