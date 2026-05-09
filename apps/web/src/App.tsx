import { useState } from 'react'
import { RouterProvider } from 'react-router-dom'
import { Toaster } from 'sonner'
import { TooltipProvider } from '@/components/ui/tooltip'
import { createRouter } from './router'

export default function App() {
  const [darkMode, setDarkMode] = useState(true)

  const router = createRouter(darkMode, () => setDarkMode((d) => !d))

  return (
      <TooltipProvider>
      <RouterProvider router={router} />
      <Toaster
        position="bottom-right"
        theme="dark"
        toastOptions={{
          style: {
            background: '#1c1e26',
            border: '1px solid rgba(255,255,255,0.08)',
            color: '#e2e8f0',
          },
        }}
      />
    </TooltipProvider>
  )
}
