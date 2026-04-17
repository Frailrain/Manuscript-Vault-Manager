import { describe, expect, it } from 'vitest'

import { renderCallout } from '../callouts'

describe('renderCallout', () => {
  it('renders a simple callout with type and body', () => {
    const out = renderCallout({ type: 'note', body: 'Hello.' })
    expect(out).toBe('> [!note]\n> Hello.')
  })

  it('renders a callout with a title on the header line', () => {
    const out = renderCallout({
      type: 'abstract',
      title: 'At a Glance',
      body: 'Some body text.'
    })
    expect(out).toBe('> [!abstract] At a Glance\n> Some body text.')
  })

  it('appends "-" after the closing bracket when foldable is true', () => {
    const out = renderCallout({
      type: 'note',
      title: 'Per-chapter detail',
      body: 'Chapter 1: stuff.',
      foldable: true
    })
    expect(out).toBe('> [!note]- Per-chapter detail\n> Chapter 1: stuff.')
  })

  it('appends "-" after the closing bracket when foldable and no title', () => {
    const out = renderCallout({
      type: 'note',
      body: 'Body only.',
      foldable: true
    })
    expect(out).toBe('> [!note]-\n> Body only.')
  })

  it('prefixes every non-empty body line with "> "', () => {
    const out = renderCallout({
      type: 'info',
      body: 'Line one.\nLine two.\nLine three.'
    })
    expect(out).toBe(
      '> [!info]\n> Line one.\n> Line two.\n> Line three.'
    )
  })

  it('renders blank lines in the body as bare ">"', () => {
    const out = renderCallout({
      type: 'danger',
      body: 'First paragraph.\n\nSecond paragraph.'
    })
    expect(out).toBe(
      '> [!danger]\n> First paragraph.\n>\n> Second paragraph.'
    )
  })

  it('throws if the body contains a nested callout header', () => {
    expect(() =>
      renderCallout({
        type: 'info',
        body: 'Outer.\n> [!note] inner\n> stuff'
      })
    ).toThrow(/Nested callouts not supported/)
  })
})
