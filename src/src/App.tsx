import { useEffect, useState } from 'react'

const bootLines = [
  'Initializing VEXA...',
  'Loading accountability system...',
  'Preparing workspace...',
  'System ready.',
]

export default function App() {
  const [visibleLines, setVisibleLines] = useState(0)
  const [showTitle, setShowTitle] = useState(false)

  useEffect(() => {
    if (visibleLines < bootLines.length) {
      const timer = setTimeout(() => setVisibleLines(visibleLines + 1), 550)
      return () => clearTimeout(timer)
    } else {
      const timer = setTimeout(() => setShowTitle(true), 400)
      return () => clearTimeout(timer)
    }
  }, [visibleLines])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-plum text-rosewater px-6">
      {!showTitle && (
        <div className="font-mono text-sm sm:text-base space-y-2 text-left w-full max-w-md">
          {bootLines.slice(0, visibleLines).map((line, i) => (
            <p key={i}>
              <span className="text-dusty">{'>'}</span> {line}
            </p>
          ))}
          <span className="inline-block w-2 h-4 bg-rosewater animate-pulse" />
        </div>
      )}

      {showTitle && (
        <div className="text-center animate-fade-in">
          <h1 className="font-serif text-6xl sm:text-7xl tracking-tight mb-3">VEXA</h1>
          <p className="font-sans text-dusty text-lg mb-10">Own Your Time.</p>
          <button className="font-sans px-6 py-3 rounded-full backdrop-blur bg-white/10 border border-white/20 hover:bg-white/20 transition">
            Enter VEXA
          </button>
        </div>
      )}
    </div>
  )
}
