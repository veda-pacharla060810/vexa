import { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext'
import AuthPage from './pages/AuthPage'
import Dashboard from './pages/Dashboard'

function AppContent() {
  const { user, loading } = useAuth()
  const [showAuth, setShowAuth] = useState(false)

  useEffect(() => {
    if (!loading && !user) {
      setShowAuth(false)
    }
  }, [loading, user])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#754B4D] px-4 text-[#D8A694]">
        <div className="rounded-2xl border border-white/20 bg-white/10 px-6 py-4 font-sans text-sm backdrop-blur">
          Loading VEXA…
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#754B4D] px-4 py-8 text-[#D8A694] sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-3xl flex-col items-center justify-center rounded-[2rem] border border-white/20 bg-white/10 px-6 py-12 text-center shadow-2xl backdrop-blur-xl">
          <div className="font-hand text-4xl text-[#D8A694]">VEXA</div>
          <h1 className="mt-4 font-serif text-4xl leading-tight sm:text-5xl">A calmer way to stay accountable.</h1>
          <p className="mt-4 max-w-xl font-sans text-base text-white/80">
            Focus with intention, track your progress, and let AI guide your next step.
          </p>

          <button
            type="button"
            onClick={() => setShowAuth(true)}
            className="mt-8 rounded-2xl border border-white/30 bg-white/20 px-6 py-3 font-sans text-sm font-semibold text-white shadow-lg backdrop-blur transition hover:bg-white/30"
          >
            Enter VEXA
          </button>
        </div>

        {showAuth ? <AuthPage onAuthenticated={() => setShowAuth(false)} /> : null}
      </div>
    )
  }

  return <Dashboard />
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}

export default App
