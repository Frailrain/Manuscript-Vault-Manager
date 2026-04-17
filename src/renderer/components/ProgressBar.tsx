interface ProgressBarProps {
  current: number | null
  total: number | null
}

export function ProgressBar({ current, total }: ProgressBarProps): JSX.Element {
  const determinate = current !== null && total !== null && total > 0
  const pct = determinate
    ? Math.min(100, Math.max(0, Math.round((current! / total!) * 100)))
    : 0

  return (
    <div className="w-full">
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        {determinate ? (
          <div
            className="h-full bg-sky-600 transition-all duration-200"
            style={{ width: `${pct}%` }}
          />
        ) : (
          <div className="progress-indeterminate absolute inset-y-0 w-1/3 bg-sky-600" />
        )}
      </div>
      {determinate ? (
        <div className="mt-1 text-right text-xs text-neutral-600 dark:text-neutral-400">
          {current} / {total}
        </div>
      ) : null}
    </div>
  )
}
