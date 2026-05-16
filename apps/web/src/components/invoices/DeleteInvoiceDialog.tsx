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

interface DeleteInvoiceDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  count: number
  fileName?: string | null
  onConfirm: () => void | Promise<void>
}

export function DeleteInvoiceDialog({
  open,
  onOpenChange,
  count,
  fileName,
  onConfirm,
}: DeleteInvoiceDialogProps) {
  const plural = count > 1
  const title = plural ? `Delete ${count} invoices?` : 'Delete invoice?'
  const description = plural
    ? `This will permanently delete ${count} invoices and their uploaded files. This cannot be undone.`
    : fileName
      ? `This will permanently delete "${fileName}" and remove its file and logo from storage. This cannot be undone.`
      : 'This will permanently delete this invoice and remove its file and logo from storage. This cannot be undone.'

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="border-white/8 bg-surface">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-slate-900 dark:text-slate-100">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-slate-500 dark:text-slate-400">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="border-border bg-transparent text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            className="bg-red-600 text-white hover:bg-red-700"
            onClick={(e) => {
              e.preventDefault()
              void Promise.resolve(onConfirm()).then(() => onOpenChange(false))
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
