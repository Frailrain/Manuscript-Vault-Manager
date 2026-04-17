import { describe, expect, it } from 'vitest'

import type { ExtractedLocation } from '../../../shared/types'
import {
  allocateLocationFilenames,
  resolveLocationChains
} from '../locations'

function buildLoc(
  name: string,
  parent: string | null = null
): ExtractedLocation {
  return {
    name,
    description: '',
    significance: '',
    firstAppearanceChapter: 1,
    appearances: [1],
    parentLocation: parent,
    customFields: {}
  }
}

describe('resolveLocationChains', () => {
  it('returns empty path prefix for top-level locations', () => {
    const warnings: string[] = []
    const chains = resolveLocationChains(
      [buildLoc('The Forest'), buildLoc("Ganston's Crossing")],
      warnings
    )
    expect(chains.get('The Forest')).toBe('')
    expect(chains.get("Ganston's Crossing")).toBe('')
    expect(warnings).toHaveLength(0)
  })

  it('resolves a three-level chain A → B → C to path prefix A/B', () => {
    const warnings: string[] = []
    const chains = resolveLocationChains(
      [
        buildLoc("Ganston's Crossing"),
        buildLoc('Defensive Line', "Ganston's Crossing"),
        buildLoc('East Gate', 'Defensive Line')
      ],
      warnings
    )
    expect(chains.get("Ganston's Crossing")).toBe('')
    expect(chains.get('Defensive Line')).toBe("Ganston's Crossing")
    expect(chains.get('East Gate')).toBe("Ganston's Crossing/Defensive Line")
    expect(warnings).toHaveLength(0)
  })

  it('truncates cycles and warns', () => {
    const warnings: string[] = []
    const chains = resolveLocationChains(
      [buildLoc('A', 'B'), buildLoc('B', 'A')],
      warnings
    )
    expect(chains.get('A')).toBe('')
    expect(chains.get('B')).toBe('')
    expect(warnings.some((w) => w.toLowerCase().includes('cycle'))).toBe(true)
  })

  it('treats orphan-parent references as top-level and warns', () => {
    const warnings: string[] = []
    const chains = resolveLocationChains(
      [buildLoc('Hidden Grove', 'Unextracted Forest')],
      warnings
    )
    expect(chains.get('Hidden Grove')).toBe('Unextracted Forest')
    expect(warnings.some((w) => w.toLowerCase().includes('orphan'))).toBe(true)
  })
})

describe('allocateLocationFilenames', () => {
  it('writes top-level locations at the Locations root', () => {
    const result = allocateLocationFilenames([
      buildLoc('The Forest'),
      buildLoc("Ganston's Crossing")
    ])
    expect(result.filenames.get('The Forest')).toBe('The Forest')
    expect(result.filenames.get("Ganston's Crossing")).toBe(
      "Ganston's Crossing"
    )
  })

  it('writes a sub-location into a folder named after its parent', () => {
    const result = allocateLocationFilenames([
      buildLoc("Ganston's Crossing"),
      buildLoc('Defensive Line', "Ganston's Crossing"),
      buildLoc('East Gate', 'Defensive Line')
    ])
    expect(result.filenames.get('Defensive Line')).toBe(
      "Ganston's Crossing/Defensive Line"
    )
    expect(result.filenames.get('East Gate')).toBe(
      "Ganston's Crossing/Defensive Line/East Gate"
    )
  })

  it('suffixes (2) when two children sanitize to the same name within the same parent', () => {
    const result = allocateLocationFilenames([
      buildLoc("Ganston's Crossing"),
      buildLoc('Gate', "Ganston's Crossing"),
      buildLoc('Gate?', "Ganston's Crossing")
    ])
    expect(result.filenames.get('Gate')).toBe("Ganston's Crossing/Gate")
    expect(result.filenames.get('Gate?')).toBe("Ganston's Crossing/Gate (2)")
  })

  it('does not collide similarly-named locations in different parent folders', () => {
    const result = allocateLocationFilenames([
      buildLoc("Ganston's Crossing"),
      buildLoc('The Forest'),
      buildLoc('Gate', "Ganston's Crossing"),
      buildLoc('Gate?', 'The Forest')
    ])
    expect(result.filenames.get('Gate')).toBe("Ganston's Crossing/Gate")
    expect(result.filenames.get('Gate?')).toBe('The Forest/Gate')
  })

  it('records children by parent in original order', () => {
    const result = allocateLocationFilenames([
      buildLoc("Ganston's Crossing"),
      buildLoc('Defensive Line', "Ganston's Crossing"),
      buildLoc('Council Office', "Ganston's Crossing"),
      buildLoc('Market Square', "Ganston's Crossing")
    ])
    expect(result.children.get("Ganston's Crossing")).toEqual([
      'Defensive Line',
      'Council Office',
      'Market Square'
    ])
  })

  it('returns empty children map entry for a leaf location', () => {
    const result = allocateLocationFilenames([buildLoc('The Forest')])
    expect(result.children.has('The Forest')).toBe(false)
  })
})
