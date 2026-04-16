// Manual smoke test for the vault generator. No API key needed — this uses the
// built-in fixture and writes to /tmp.
//
//   npx tsx scripts/smoke-vault.ts
//
// Then open `/tmp/mvm-smoke-vault` in Obsidian (File → Open folder as vault).

import {
  buildMiniExtraction,
  buildMiniScrivenerProject
} from '../src/core/vault/__tests__/fixtures/mini-extraction'
import { generateVault } from '../src/core/vault'

async function main(): Promise<void> {
  const project = buildMiniScrivenerProject()
  const extraction = buildMiniExtraction()
  const result = await generateVault(
    extraction,
    project,
    '/tmp/mvm-smoke-vault',
    {
      novelTitle: 'Smoke Test Novel',
      clean: true,
      onProgress: (p) => {
        // eslint-disable-next-line no-console
        console.log(
          `[${p.phase}] ${p.current}/${p.total} ${p.currentFile}`
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
