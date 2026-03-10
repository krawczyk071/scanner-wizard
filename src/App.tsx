import { useState, useEffect } from 'react'

function App() {
  const [cvReady, setCvReady] = useState(false)

  useEffect(() => {
    // Poll to check if OpenCV is fully initialized.
    // window.cv might exist, but we need to wait until the WASM module is ready (e.g. cv.Mat is available)
    const checkCv = () => {
      // @ts-expect-error window.cv is injected by OpenCV.js
      if (window.cv && window.cv.Mat) {
        setCvReady(true)
      } else {
        setTimeout(checkCv, 100)
      }
    }
    checkCv()
  }, [])

  if (!cvReady) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-neutral-900 text-white w-full h-full">
        <h1 className="text-2xl font-semibold animate-pulse">Loading OpenCV.js (~8MB)...</h1>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-900 text-white w-full h-full">
      <h1 className="text-4xl font-bold text-blue-400 mb-4">Scanned Photo Splitter</h1>
      <div className="bg-neutral-800 p-6 rounded-xl border border-neutral-700 shadow-lg text-center">
        <p className="text-lg text-green-400 mb-2 font-medium">✓ OpenCV.js is loaded and ready!</p>
        <p className="text-neutral-400 text-sm">Phase 1 complete. Scaffold is ready for Phase 2.</p>
      </div>
    </div>
  )
}

export default App
