import {
  LLMProviderError,
  type JSONSchema,
  type LLMProvider,
  type ProviderCallResult
} from '../providers'

export type MockOutcome = ProviderCallResult<unknown> | Error

export const OK_CHARACTERS = {
  characters: [
    {
      name: 'Elara',
      aliases: [],
      description: 'A young mage.',
      chapterActivity: 'Enters the tower. Confronts the scholar.',
      role: 'protagonist',
      relationships: [],
      isNew: true,
      tier: 'main'
    }
  ]
}

export const OK_LOCATIONS = {
  locations: [
    {
      name: 'Silver Tower',
      description: 'A tall spire.',
      significance: 'Home of the scholars.',
      isNew: true,
      parentLocation: null
    }
  ]
}

export const OK_TIMELINE = {
  summary: 'Elara explores the Silver Tower and meets the scholar.',
  events: [
    { summary: 'Elara enters the tower', sequence: 1 },
    { summary: 'Elara meets the scholar', sequence: 2 }
  ],
  charactersAppearing: ['Elara'],
  locationsAppearing: ['Silver Tower']
}

export const OK_CONTINUITY = { issues: [] }

export const DEFAULT_USAGE = { inputTokens: 100, outputTokens: 50 }

export function defaultRespond(toolName: string): MockOutcome {
  switch (toolName) {
    case 'record_characters':
      return { data: OK_CHARACTERS, usage: DEFAULT_USAGE }
    case 'record_locations':
      return { data: OK_LOCATIONS, usage: DEFAULT_USAGE }
    case 'record_timeline':
      return { data: OK_TIMELINE, usage: DEFAULT_USAGE }
    case 'record_continuity_issues':
      return { data: OK_CONTINUITY, usage: DEFAULT_USAGE }
    default:
      return new LLMProviderError(`No mock for ${toolName}`, 'other')
  }
}

export class MockProvider implements LLMProvider {
  readonly kind = 'anthropic' as const
  readonly model = 'claude-haiku-4-5'
  readonly calls: Array<{
    toolName: string
    systemPrompt: string
    userPrompt: string
    toolInputSchema: JSONSchema
  }> = []

  respond: (toolName: string, callIndex: number) => MockOutcome = defaultRespond

  async callWithSchema<T>(params: {
    systemPrompt: string
    userPrompt: string
    toolName: string
    toolDescription: string
    toolInputSchema: JSONSchema
  }): Promise<ProviderCallResult<T>> {
    const callIndex = this.calls.filter(
      (c) => c.toolName === params.toolName
    ).length
    this.calls.push({
      toolName: params.toolName,
      systemPrompt: params.systemPrompt,
      userPrompt: params.userPrompt,
      toolInputSchema: params.toolInputSchema
    })
    const outcome = this.respond(params.toolName, callIndex)
    if (outcome instanceof Error) throw outcome
    return outcome as ProviderCallResult<T>
  }
}
