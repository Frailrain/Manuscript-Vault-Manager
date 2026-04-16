import type { LLMProviderConfig } from '../../../shared/types'
import { ExtractionError } from '../errors'
import {
  LLMProviderError,
  type JSONSchema,
  type LLMProvider,
  type ProviderCallResult
} from './types'

interface ChatCompletionResponse {
  choices?: Array<{
    message?: {
      tool_calls?: Array<{
        id?: string
        type?: string
        function?: { name?: string; arguments?: string }
      }>
    }
  }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
  }
  error?: { message?: string; type?: string }
}

export class OpenAICompatibleProvider implements LLMProvider {
  readonly kind = 'openai-compatible' as const
  readonly model: string
  private readonly apiKey: string
  private readonly baseURL: string
  private readonly defaultMaxTokens: number

  constructor(config: LLMProviderConfig) {
    if (!config.apiKey) {
      throw new ExtractionError(
        'openai-compatible provider requires apiKey',
        'config'
      )
    }
    if (!config.model) {
      throw new ExtractionError(
        'openai-compatible provider requires model',
        'config'
      )
    }
    if (!config.baseURL) {
      throw new ExtractionError(
        'openai-compatible provider requires baseURL',
        'config'
      )
    }
    try {
      new URL(config.baseURL)
    } catch (err) {
      throw new ExtractionError(
        `openai-compatible provider received invalid baseURL: ${config.baseURL}`,
        'config',
        err
      )
    }
    this.model = config.model
    this.apiKey = config.apiKey
    this.baseURL = config.baseURL.replace(/\/$/, '')
    this.defaultMaxTokens = config.maxTokens ?? 4096
  }

  async callWithSchema<T>(params: {
    systemPrompt: string
    userPrompt: string
    toolName: string
    toolDescription: string
    toolInputSchema: JSONSchema
    maxTokens?: number
  }): Promise<ProviderCallResult<T>> {
    const body = {
      model: this.model,
      max_tokens: params.maxTokens ?? this.defaultMaxTokens,
      messages: [
        { role: 'system', content: params.systemPrompt },
        { role: 'user', content: params.userPrompt }
      ],
      tools: [
        {
          type: 'function',
          function: {
            name: params.toolName,
            description: params.toolDescription,
            parameters: params.toolInputSchema
          }
        }
      ],
      tool_choice: {
        type: 'function',
        function: { name: params.toolName }
      }
    }

    const url = `${this.baseURL}/chat/completions`
    let response = await this.postJson(url, body)
    if (response.status === 429) {
      await sleep(2000)
      response = await this.postJson(url, body)
      if (response.status === 429) {
        await sleep(4000)
        response = await this.postJson(url, body)
      }
    }

    if (!response.ok) {
      throw classifyHttpStatus(response.status, response.bodyText)
    }

    let parsed: ChatCompletionResponse
    try {
      parsed = JSON.parse(response.bodyText) as ChatCompletionResponse
    } catch (err) {
      throw new LLMProviderError(
        'openai-compatible response was not valid JSON',
        'parse',
        err
      )
    }

    const toolCall = parsed.choices?.[0]?.message?.tool_calls?.[0]
    if (!toolCall || !toolCall.function?.arguments) {
      throw new LLMProviderError(
        `openai-compatible response contained no tool_calls for '${params.toolName}'`,
        'refusal'
      )
    }

    let data: T
    try {
      data = JSON.parse(toolCall.function.arguments) as T
    } catch (err) {
      throw new LLMProviderError(
        `openai-compatible tool_call arguments did not parse as JSON: ${(err as Error).message}`,
        'parse',
        err
      )
    }

    return {
      data,
      usage: {
        inputTokens: parsed.usage?.prompt_tokens ?? 0,
        outputTokens: parsed.usage?.completion_tokens ?? 0
      }
    }
  }

  private async postJson(
    url: string,
    body: unknown
  ): Promise<{ ok: boolean; status: number; bodyText: string }> {
    let resp: Response
    try {
      resp = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      })
    } catch (err) {
      throw new LLMProviderError(
        `Network error calling ${url}: ${(err as Error).message}`,
        'network',
        err
      )
    }
    const bodyText = await resp.text()
    return { ok: resp.ok, status: resp.status, bodyText }
  }
}

function classifyHttpStatus(status: number, bodyText: string): LLMProviderError {
  const snippet = bodyText.length > 500 ? bodyText.slice(0, 500) + '…' : bodyText
  if (status === 401 || status === 403) {
    return new LLMProviderError(
      `Authentication failed (${status}): ${snippet}`,
      'auth'
    )
  }
  if (status === 429) {
    return new LLMProviderError(
      `Rate limited after retries (${status}): ${snippet}`,
      'rate_limit'
    )
  }
  return new LLMProviderError(
    `HTTP ${status}: ${snippet}`,
    'other'
  )
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
