import * as React from 'react'
import { DayPicker } from 'react-day-picker'
import { ChevronLeft, ChevronRight } from 'lucide-react'

import { cn } from '@/lib/utils'
import { buttonVariants } from '@/components/ui/button'

import 'react-day-picker/style.css'

export type CalendarProps = React.ComponentProps<typeof DayPicker>

/** Calendar for popovers; styled with Tailwind + default DayPicker CSS for grid layout. */
function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn('p-2', className)}
      classNames={{
        months: 'relative flex flex-col gap-4 sm:flex-row',
        month: 'flex w-full flex-col gap-4',
        month_caption: 'flex h-8 items-center justify-center px-10',
        caption_label: 'text-sm font-medium text-slate-800 dark:text-slate-200',
        nav: 'absolute inset-x-0 top-2 flex w-full items-center justify-between px-2',
        button_previous: cn(
          buttonVariants({ variant: 'outline', size: 'icon-sm' }),
          'size-7 p-0 text-slate-600 dark:text-slate-300',
        ),
        button_next: cn(
          buttonVariants({ variant: 'outline', size: 'icon-sm' }),
          'size-7 p-0 text-slate-600 dark:text-slate-300',
        ),
        month_grid: 'w-full border-collapse',
        weekdays: 'flex w-full',
        weekday: 'w-8 flex-1 text-center text-[0.75rem] font-normal text-slate-500 dark:text-slate-400',
        week: 'mt-1 flex w-full',
        day: 'relative flex size-8 flex-1 items-center justify-center p-0 text-center',
        day_button: cn(
          buttonVariants({ variant: 'ghost', size: 'icon-sm' }),
          'size-8 p-0 font-normal text-slate-800 dark:text-slate-200',
          'data-[selected-single=true]:bg-accent data-[selected-single=true]:text-accent-foreground',
        ),
        selected: 'rounded-md',
        today: 'rounded-md bg-slate-100 text-slate-900 dark:bg-white/10 dark:text-white',
        outside: 'text-slate-400 opacity-60 dark:text-slate-500',
        disabled: 'pointer-events-none opacity-40',
        hidden: 'invisible',
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation, className: chClassName, ...chevronProps }) =>
          orientation === 'left' ? (
            <ChevronLeft className={cn('size-4', chClassName)} {...chevronProps} />
          ) : (
            <ChevronRight className={cn('size-4', chClassName)} {...chevronProps} />
          ),
      }}
      {...props}
    />
  )
}

export { Calendar }
