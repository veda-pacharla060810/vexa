import { useState } from 'react'
import { supabase } from '../lib/supabase'

type AuthMode = 'login' | 'signup'

type AuthPageProps = {
  onAuthenticated?: () => void
}

function AuthPage({ onAuthenticated }: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState('')
  const [infoMessage, setInfoMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setErrorMessage('')
    setInfoMessage('')

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password })
      setLoading(false)

      if (error) {
        setErrorMessage(formatError(error.message))
        return
      }

      setInfoMessage('Check your email for the confirmation link, then sign in when it arrives.')
      setPassword('')
      setMode('login')
      return
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)

    if (error) {
      setErrorMessage(formatError(error.message))
      return
    }

    onAuthenticated?.()
  }

  return (
    <div className="min-h-screen bg-[#754B4D] px-4 py-10 text-[#D8A694] sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-5xl flex-col overflow-hidden rounded-[2rem] border border-white/20 bg-white/10 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col items-center justify-center px-6 py-12 text-center sm:px-10 lg:w-2/5 lg:items-start lg:text-left">
          <p className="font-hand text-3xl text-[#D8A694]">VEXA</p>
          <h1 className="mt-4 font-serif text-4xl leading-tight sm:text-5xl">
            {mode === 'login' ? 'Return to your rhythm.' : 'Create your account.'}
          </h1>
          <p className="mt-4 max-w-md font-sans text-sm text-white/80 sm:text-base">
            {mode === 'login'
              ? 'Sign in to keep your tasks, focus sessions, and plans in one place.'
              : 'Start with a simple account and bring your plans into focus.'}
          </p>
        </div>

        <div className="border-t border-white/20 bg-[#754B4D]/70 px-6 py-8 sm:px-10 lg:w-3/5 lg:border-l lg:border-t-0">
          <form className="space-y-4" onSubmit={handleSubmit}>
            <div>
              <label className="mb-2 block font-sans text-sm font-medium text-[#D8A694]" htmlFor="email">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="w-full rounded-2xl border border-white/20 bg-white/20 px-4 py-3 font-sans text-sm text-white outline-none placeholder:text-white/50 focus:border-[#D8A694] focus:ring-2 focus:ring-[#D8A694]/40"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="mb-2 block font-sans text-sm font-medium text-[#D8A694]" htmlFor="password">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={6}
                className="w-full rounded-2xl border border-white/20 bg-white/20 px-4 py-3 font-sans text-sm text-white outline-none placeholder:text-white/50 focus:border-[#D8A694] focus:ring-2 focus:ring-[#D8A694]/40"
                placeholder="At least 6 characters"
              />
            </div>

            {errorMessage ? (
              <p className="rounded-2xl border border-[#D8A694]/30 bg-[#A86A65]/40 px-4 py-3 font-sans text-sm text-white">
                {errorMessage}
              </p>
            ) : null}

            {infoMessage ? (
              <p className="rounded-2xl border border-[#D8A694]/30 bg-white/15 px-4 py-3 font-sans text-sm text-white">
                {infoMessage}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl border border-white/30 bg-white/20 px-4 py-3 font-sans text-sm font-semibold text-white shadow-lg backdrop-blur transition hover:bg-white/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? 'Working…' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <div className="mt-6 flex items-center justify-between text-sm text-white/80">
            <p>
              {mode === 'login' ? 'New here?' : 'Already have an account?'}
            </p>
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'signup' : 'login')
                setErrorMessage('')
                setInfoMessage('')
              }}
              className="font-semibold text-[#D8A694] underline-offset-4 hover:underline"
            >
              {mode === 'login' ? 'Create account' : 'Sign in'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function formatError(message: string) {
  if (message.includes('Invalid login credentials')) {
    return 'The email or password is not correct.'
  }

  if (message.includes('User already registered')) {
    return 'An account with this email already exists.'
  }

  if (message.includes('Password')) {
    return 'Please use a password with at least 6 characters.'
  }

  return message
}

export default AuthPage
