import { useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { UploadCloud, FileWarning } from 'lucide-react'
import { cn } from '@/lib/utils'

const ACCEPTED = {
  'application/pdf': ['.pdf'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
  'image/heic': ['.heic'],
}

const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

interface DropZoneProps {
  onFiles: (files: File[]) => void
  uploading: boolean
}

export function DropZone({ onFiles, uploading }: DropZoneProps) {
  const onDrop = useCallback(
    (accepted: File[]) => {
      if (accepted.length) onFiles(accepted)
    },
    [onFiles],
  )

  const { getRootProps, getInputProps, isDragActive, isDragReject, fileRejections } = useDropzone({
    onDrop,
    accept: ACCEPTED,
    maxSize: MAX_SIZE,
    multiple: true,
    disabled: uploading,
  })

  const hasRejections = fileRejections.length > 0

  return (
    <div
      {...getRootProps()}
      className={cn(
        'flex min-h-[180px] cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border border-dashed transition-colors',
        isDragActive && !isDragReject && 'border-violet-500/70 bg-violet-500/[0.06]',
        isDragReject && 'border-red-500/60 bg-red-500/[0.05]',
        !isDragActive && !isDragReject && 'border-white/[0.10] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.03]',
        uploading && 'cursor-not-allowed opacity-50',
      )}
    >
      <input {...getInputProps()} />

      {isDragReject || hasRejections ? (
        <>
          <FileWarning className="h-8 w-8 text-red-400" />
          <p className="text-sm font-medium text-red-400">
            {isDragReject ? 'Unsupported file type' : 'Some files were rejected'}
          </p>
          {hasRejections && (
            <ul className="max-h-24 overflow-auto text-xs text-red-400/80">
              {fileRejections.map(({ file, errors }) => (
                <li key={file.name}>
                  {file.name} — {errors.map((e) => e.message).join(', ')}
                </li>
              ))}
            </ul>
          )}
        </>
      ) : (
        <>
          <UploadCloud
            className={cn(
              'h-8 w-8 transition-colors',
              isDragActive ? 'text-violet-400' : 'text-slate-500',
            )}
          />
          <div className="text-center">
            <p className={cn('text-sm font-medium', isDragActive ? 'text-violet-300' : 'text-slate-300')}>
              {uploading ? 'Uploading…' : isDragActive ? 'Drop to upload' : 'Drop invoices here'}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">
              PDF, PNG, JPG, WEBP, HEIC · max 10 MB each
            </p>
          </div>
        </>
      )}
    </div>
  )
}
