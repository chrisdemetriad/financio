import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@clerk/react'

export function ProtectedRoute() {
  const { isSignedIn, isLoaded } = useAuth()

  if (!isLoaded) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#13141a]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#4f7dfa] border-t-transparent" />
      </div>
    )
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />
  }

  return <Outlet />
}
