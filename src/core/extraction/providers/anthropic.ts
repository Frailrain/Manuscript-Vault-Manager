import Anthropic from '@anthropic-ai/sdk'

import type { LLMProviderConfig } from '../../../shared/types'
import { ExtractionError } from '../errors'
import {
  LLMProviderError,
  type JSONSchema,
  type LLMProvider,
  type ProviderCallResult
} from './types'

// No prompt caching here by design — Brief #2 defers it to a later brief. The
// system prompts and tool schemas are static across a run so this will be a
// natural optimisation once we're ready to measure hit rates.
export class AnthropicProvider implements LLMProvider {
  readonly kind = 'anthropic' as const
  readonly model: string
  private readonly client: Anthropic
  private readonly defaultMaxTokens: number

  constructor(config: LLMProviderConfig) {
    if (!config.apiKey) {
      throw new ExtractionError('Anthropic provider requires apiKey', 'config')
    }
    if (!config.model) {
      throw new ExtractionError('Anthropic provider requires model', 'config')
    }
    this.model = config.model
    this.defaultMaxTokens = config.maxTokens ?? 4096
    this.client = new Anthropic({
      apiKey: config.apiKey,
      ...(config.baseURL ? { baseURL: config.baseURL } : {})
    })
  }

  async callWithSchema<T>(params: {
    systemPrompt: string
    userPrompt: string
    toolName: string
    toolDescription: string
    toolInputSchema: JSONSchema
    maxTokens?: number
  }): Promise<ProviderCallResult<T>> {
    let response: Anthropic.Messages.Message
    try {
      response = await this.client.messages.create({
        model: this.model,
        max_tokens: params.maxTokens ?? this.defaultMaxTokens,
        system: params.systemPrompt,
        messages: [{ role: 'user', content: params.userPrompt }],
        tools: [
          {
            name: params.toolName,
            description: params.toolDescription,
            input_schema: params.toolInputSchema as unknown as Anthropic.Messages.Tool.InputSchema
          }
        ],
        tool_choice: { type: 'tool', name: params.toolName }
      })
    } catch (err) {
      throw classifyAnthropicError(err)
    }

    const toolBlock = response.content.find(
      (block): block is Anthropic.Messages.ToolUseBlock =>
        block.type === 'tool_use' && block.name === params.toolName
    )
    if (!toolBlock) {
      throw new LLMProviderError(
        `Anthropic response contained no tool_use block for tool '${params.toolName}'`,
        'refusal'
      )
    }

    return {
      data: toolBlock.input as T,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens
      }
    }
  }
}

function classifyAnthropicError(err: unknown): LLMProviderError {
  if (err instanceof Anthropic.AuthenticationError) {
    return new LLMProviderError(
      `Anthropic authentication failed: ${err.message}`,
      'auth',
      err
    )
  }
  if (err instanceof Anthropic.PermissionDeniedError) {
    return new LLMProviderError(
      `Anthropic permission denied: ${err.message}`,
      'auth',
      err
    )
  }
  if (err instanceof Anthropic.RateLimitError) {
    return new LLMProviderError(
      `Anthropic rate limited: ${err.message}`,
      'rate_limit',
      err
    )
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new LLMProviderError(
      `Anthropic network error: ${err.message}`,
      'network',
      err
    )
  }
  if (err instanceof Anthropic.APIError) {
    return new LLMProviderError(
      `Anthropic API error (${err.status}): ${err.message}`,
      'other',
      err
    )
  }
  if (err instanceof Error) {
    return new LLMProviderError(err.message, 'other', err)
  }
  return new LLMProviderError('Unknown Anthropic error', 'other', err)
}
