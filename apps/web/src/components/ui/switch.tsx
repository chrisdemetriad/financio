import { cn } from '@/lib/utils'

interface SwitchProps {
  checked: boolean
  onCheckedChange: () => void
  className?: string
}

export function Switch({ checked, onCheckedChange, className }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onCheckedChange}
      className={cn(
        'relative h-5 w-9 shrink-0 rounded-full transition-colors duration-200',
        checked ? 'bg-accent' : 'bg-white/15',
        className,
      )}
    >
      <span
        className={cn(
          'absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200',
          checked ? 'translate-x-4' : 'translate-x-0',
        )}
      />
    </button>
  )
}
