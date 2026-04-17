import { useState } from 'react'

import {
  deriveFieldKey,
  type GenreFieldDef,
  type GenreFieldType
} from '../../shared/presets'

const INPUT_CLASSES =
  'rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-500'

const SELECT_CLASSES = INPUT_CLASSES

const TEXTAREA_CLASSES =
  'w-full rounded-md border border-neutral-300 bg-white px-2 py-1 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-500'

export interface FieldEditorProps {
  fields: GenreFieldDef[]
  onChange: (next: GenreFieldDef[]) => void
  /** Display helper used in the "Add field" button. */
  entityLabel: string
}

export function FieldEditor({
  fields,
  onChange,
  entityLabel
}: FieldEditorProps): JSX.Element {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)

  function updateField(idx: number, patch: Partial<GenreFieldDef>): void {
    const next = fields.map((f, i) => (i === idx ? { ...f, ...patch } : f))
    onChange(next)
  }

  function updateLabel(idx: number, label: string): void {
    const current = fields[idx]!
    const next = fields.map((f, i) =>
      i === idx ? { ...f, label, key: deriveFieldKey(label) } : f
    )
    onChange(next)
    // Reference `current` so the compiler is happy; no behavioural effect.
    void current
  }

  function removeField(idx: number): void {
    const next = fields.filter((_, i) => i !== idx)
    onChange(next)
    if (expandedIdx === idx) setExpandedIdx(null)
  }

  function addField(): void {
    const label = `New Field ${fields.length + 1}`
    const def: GenreFieldDef = {
      label,
      key: deriveFieldKey(label),
      type: 'text',
      description: ''
    }
    onChange([...fields, def])
    setExpandedIdx(fields.length)
  }

  return (
    <div className="space-y-2">
      {fields.length === 0 ? (
        <p className="text-xs italic text-neutral-600 dark:text-neutral-400">
          No fields configured. Pick a preset or click &quot;Add field&quot; below.
        </p>
      ) : (
        fields.map((field, idx) => (
          <div
            key={idx}
            data-testid={`field-row-${idx}`}
            className="rounded-md border border-neutral-300 bg-neutral-50 p-2 dark:border-neutral-700 dark:bg-neutral-900/40"
          >
            <div className="flex items-center gap-2">
              <input
                type="text"
                aria-label={`Field ${idx + 1} label`}
                value={field.label}
                onChange={(e) => updateLabel(idx, e.target.value)}
                className={`${INPUT_CLASSES} flex-1`}
                placeholder="Field label"
              />
              <select
                aria-label={`Field ${idx + 1} type`}
                value={field.type}
                onChange={(e) =>
                  updateField(idx, { type: e.target.value as GenreFieldType })
                }
                className={`${SELECT_CLASSES} w-32`}
              >
                <option value="text">text</option>
                <option value="number">number</option>
                <option value="list">list</option>
              </select>
              <button
                type="button"
                aria-label={`Remove field ${field.label || idx + 1}`}
                onClick={() => removeField(idx)}
                className="rounded-md px-2 py-1 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950"
              >
                ×
              </button>
            </div>
            <div className="mt-1 flex items-center gap-3">
              <span
                data-testid={`field-key-${idx}`}
                className="font-mono text-xs text-neutral-500 dark:text-neutral-400"
                title={field.key}
              >
                key: {field.key || '—'}
              </span>
              <button
                type="button"
                onClick={() =>
                  setExpandedIdx(expandedIdx === idx ? null : idx)
                }
                className="text-xs text-sky-600 hover:underline dark:text-sky-400"
              >
                {expandedIdx === idx ? 'Hide description' : 'Edit description'}
              </button>
            </div>
            {expandedIdx === idx ? (
              <div className="mt-2">
                <textarea
                  aria-label={`Field ${idx + 1} description`}
                  value={field.description}
                  onChange={(e) =>
                    updateField(idx, { description: e.target.value })
                  }
                  rows={3}
                  placeholder="Tell Claude what this field means..."
                  className={TEXTAREA_CLASSES}
                />
              </div>
            ) : null}
          </div>
        ))
      )}
      <button
        type="button"
        onClick={addField}
        className="rounded-md border border-dashed border-neutral-400 px-3 py-1.5 text-xs font-medium text-neutral-700 hover:bg-neutral-100 dark:border-neutral-600 dark:text-neutral-300 dark:hover:bg-neutral-800"
      >
        + Add {entityLabel} field
      </button>
    </div>
  )
}
