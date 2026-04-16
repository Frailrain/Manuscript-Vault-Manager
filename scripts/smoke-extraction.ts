// Manual smoke test. Run with a real Anthropic API key against the Scrivener
// fixture that ships with Brief #1. Example:
//
//   ANTHROPIC_API_KEY=sk-ant-... npx tsx scripts/smoke-extraction.ts
//
// This file is intentionally simple — it is not part of the test suite and
// should not be imported by production code. Cost under $0.05 on Haiku 4.5.

import { runExtraction } from '../src/core/extraction'
import { parseScrivenerProject } from '../src/core/scrivener'

async function main(): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    // eslint-disable-next-line no-console
    console.error('ANTHROPIC_API_KEY is not set')
    process.exit(1)
  }

  const project = await parseScrivenerProject(
    'src/core/scrivener/__tests__/fixtures/minimal.scriv'
  )

  const result = await runExtraction(
    project,
    {
      kind: 'anthropic',
      apiKey,
      model: 'claude-haiku-4-5-20251001'
    },
    {
      onProgress: (p) => {
        // eslint-disable-next-line no-console
        console.log(
          `[${p.phase}] ch ${p.currentChapter}/${p.totalChapters} pass=${p.currentPass ?? '-'} $${p.estimatedCostSoFar.toFixed(4)}`
        )
      }
    }
  )

  // eslint-disable-next-line no-console
  console.log(JSON.stringify(result, null, 2))
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err)
  process.exit(1)
})
