import { SignIn } from '@clerk/react'

export function SignInPage() {
  return (
    <div className="flex h-screen items-center justify-center bg-[#13141a]">
      <SignIn
        routing="path"
        path="/sign-in"
        fallbackRedirectUrl="/"
        appearance={{
          variables: {
            colorPrimary: '#4f7dfa',
            colorBackground: '#1c1e26',
            colorText: '#e2e8f0',
            colorTextSecondary: '#94a3b8',
            colorInputBackground: '#13141a',
            colorInputText: '#e2e8f0',
            borderRadius: '0.5rem',
          },
          elements: {
            card: 'shadow-none border border-white/[0.06]',
            headerTitle: 'text-white',
            formButtonPrimary: 'bg-[#4f7dfa] hover:bg-[#3d6ef0]',
          },
        }}
      />
    </div>
  )
}
