// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { GenreFieldDef } from '../../../shared/presets'
import { FieldEditor } from '../FieldEditor'

function StatefulEditor({
  initial,
  onSpy
}: {
  initial: GenreFieldDef[]
  onSpy?: (next: GenreFieldDef[]) => void
}): JSX.Element {
  const [fields, setFields] = useState<GenreFieldDef[]>(initial)
  return (
    <FieldEditor
      fields={fields}
      entityLabel="character"
      onChange={(next) => {
        setFields(next)
        onSpy?.(next)
      }}
    />
  )
}

afterEach(() => {
  cleanup()
})

const BASE_FIELDS: GenreFieldDef[] = [
  { key: 'level', label: 'Level', type: 'number', description: 'Current level.' },
  { key: 'class', label: 'Class', type: 'text', description: 'Class or path.' }
]

function inputValue(el: HTMLElement): string {
  return (el as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value
}

describe('<FieldEditor />', () => {
  it('renders one row per field with label and type controls', () => {
    render(
      <FieldEditor fields={BASE_FIELDS} entityLabel="character" onChange={() => {}} />
    )
    expect(inputValue(screen.getByLabelText('Field 1 label'))).toBe('Level')
    expect(inputValue(screen.getByLabelText('Field 2 label'))).toBe('Class')
    expect(inputValue(screen.getByLabelText('Field 1 type'))).toBe('number')
    expect(inputValue(screen.getByLabelText('Field 2 type'))).toBe('text')
  })

  it('shows the derived key next to each row', () => {
    render(
      <FieldEditor fields={BASE_FIELDS} entityLabel="character" onChange={() => {}} />
    )
    expect(screen.getByTestId('field-key-0').textContent).toBe('level')
    expect(screen.getByTestId('field-key-1').textContent).toBe('class')
  })

  it('typing in a label re-derives the key', async () => {
    const user = userEvent.setup()
    const spy = vi.fn()
    render(<StatefulEditor initial={BASE_FIELDS} onSpy={spy} />)
    const input = screen.getByLabelText('Field 1 label')
    await user.clear(input)
    await user.type(input, 'Danger Level')
    const last = spy.mock.calls.at(-1)![0] as GenreFieldDef[]
    expect(last[0]!.label).toBe('Danger Level')
    expect(last[0]!.key).toBe('danger-level')
  })

  it('clicking remove omits the field from the next state', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <FieldEditor fields={BASE_FIELDS} entityLabel="character" onChange={onChange} />
    )
    await user.click(screen.getByRole('button', { name: /Remove field Level/i }))
    expect(onChange).toHaveBeenCalledWith([BASE_FIELDS[1]])
  })

  it('Add field appends a new default field', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <FieldEditor fields={BASE_FIELDS} entityLabel="character" onChange={onChange} />
    )
    await user.click(screen.getByRole('button', { name: /Add character field/i }))
    expect(onChange).toHaveBeenCalledTimes(1)
    const next = onChange.mock.calls[0]![0] as GenreFieldDef[]
    expect(next).toHaveLength(3)
    expect(next[2]!.type).toBe('text')
    expect(next[2]!.label).toContain('New Field')
    expect(next[2]!.key).toBe(next[2]!.key.toLowerCase())
  })

  it('changing the type preserves label and key', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <FieldEditor fields={BASE_FIELDS} entityLabel="character" onChange={onChange} />
    )
    await user.selectOptions(screen.getByLabelText('Field 2 type'), 'list')
    const last = onChange.mock.calls.at(-1)![0] as GenreFieldDef[]
    expect(last[1]).toEqual({
      ...BASE_FIELDS[1]!,
      type: 'list'
    })
  })

  it('expanding a row reveals the description textarea', async () => {
    const user = userEvent.setup()
    render(
      <FieldEditor fields={BASE_FIELDS} entityLabel="character" onChange={() => {}} />
    )
    expect(screen.queryByLabelText('Field 1 description')).toBeNull()
    const toggles = screen.getAllByRole('button', { name: /Edit description/i })
    await user.click(toggles[0]!)
    expect(inputValue(screen.getByLabelText('Field 1 description'))).toBe(
      'Current level.'
    )
  })

  it('shows an empty-state message when no fields are configured', () => {
    render(
      <FieldEditor fields={[]} entityLabel="character" onChange={() => {}} />
    )
    expect(screen.getByText(/No fields configured/i)).not.toBeNull()
  })
})
