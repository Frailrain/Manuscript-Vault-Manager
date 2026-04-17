interface PathPickerProps {
  value: string
  placeholder: string
  onPick: () => Promise<string | null>
  onChange: (value: string) => void
}

const INPUT_CLASSES =
  'flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100 dark:placeholder:text-neutral-500'

const BROWSE_CLASSES =
  'rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-100 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100 dark:hover:bg-neutral-700'

export function PathPicker({
  value,
  placeholder,
  onPick,
  onChange
}: PathPickerProps): JSX.Element {
  async function handlePick(): Promise<void> {
    const picked = await onPick()
    if (picked) onChange(picked)
  }

  return (
    <div className="flex gap-2">
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={INPUT_CLASSES}
        spellCheck={false}
      />
      <button type="button" onClick={handlePick} className={BROWSE_CLASSES}>
        Browse
      </button>
    </div>
  )
}
