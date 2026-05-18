import { useState, useEffect } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { StoredBacsOrigin } from '@/lib/bacs'

interface BacsOriginDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initial?: StoredBacsOrigin | null
  paymentCount: number
  onSave: (origin: StoredBacsOrigin) => void
}

export function BacsOriginDialog({ open, onOpenChange, initial, paymentCount, onSave }: BacsOriginDialogProps) {
  const [sun, setSun] = useState('')
  const [sort, setSort] = useState('')
  const [account, setAccount] = useState('')
  const [name, setName] = useState('')

  useEffect(() => {
    if (!open) return
    setSun(initial?.sun ?? '')
    setSort(initial?.originatorSortCode ?? '')
    setAccount(initial?.originatorAccountNumber ?? '')
    setName(initial?.originatorName ?? '')
  }, [open, initial])

  function submit(): void {
    const o: StoredBacsOrigin = {
      sun: sun.trim(),
      originatorSortCode: sort.trim(),
      originatorAccountNumber: account.trim(),
      originatorName: name.trim(),
    }
    if (!o.sun || !o.originatorSortCode || !o.originatorAccountNumber || !o.originatorName) return
    onSave(o)
    onOpenChange(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md border-white/8 bg-surface">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-slate-900 dark:text-slate-100">Your BACS debiting details</AlertDialogTitle>
          <AlertDialogDescription className="text-left text-slate-500 dark:text-slate-400">
            Enter the UK account that will be debited for these {paymentCount} payment{paymentCount > 1 ? 's' : ''} (BACS service user number, sort code, account number, and name as held by the bank). This is stored only in your browser.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="grid gap-3 py-2">
          <label className="grid gap-1 text-sm">
            <span className="text-slate-600 dark:text-slate-400">Service user number (SUN)</span>
            <input
              value={sun}
              onChange={(e) => setSun(e.target.value)}
              className="rounded-md border border-border bg-transparent px-3 py-2 text-slate-900 dark:text-slate-100"
              placeholder="6 digits"
              autoComplete="off"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-slate-600 dark:text-slate-400">Sort code</span>
            <input
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="rounded-md border border-border bg-transparent px-3 py-2 text-slate-900 dark:text-slate-100"
              placeholder="e.g. 12-34-56"
              autoComplete="off"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-slate-600 dark:text-slate-400">Account number</span>
            <input
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              className="rounded-md border border-border bg-transparent px-3 py-2 text-slate-900 dark:text-slate-100"
              placeholder="8 digits"
              autoComplete="off"
            />
          </label>
          <label className="grid gap-1 text-sm">
            <span className="text-slate-600 dark:text-slate-400">Account name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-md border border-border bg-transparent px-3 py-2 text-slate-900 dark:text-slate-100"
              placeholder="Legal name on the account"
              autoComplete="off"
            />
          </label>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-border bg-transparent">Cancel</AlertDialogCancel>
          <AlertDialogAction
            className="bg-accent text-white hover:bg-accent/90 disabled:opacity-40"
            disabled={!sun.trim() || !sort.trim() || !account.trim() || !name.trim()}
            onClick={(e) => {
              e.preventDefault()
              submit()
            }}
          >
            Save & download
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
