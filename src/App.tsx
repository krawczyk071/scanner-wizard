import { useState, useEffect } from 'react'
import { ImageDropzone } from './components/ImageDropzone'
import { Workspace } from './components/Workspace'
import { type LoadedImage, loadImageFile } from './utils/imageLoader'
import { Loader2 } from 'lucide-react'

function App() {
  const [cvReady, setCvReady] = useState(false)
  const [image, setImage] = useState<LoadedImage | null>(null)
  const [queue, setQueue] = useState<File[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Poll to check if OpenCV is fully initialized.
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

  const triggerLoad = async (file: File) => {
    setIsLoading(true);
    setError(null);
    try {
      const loadedParams = await loadImageFile(file);
      setImage(loadedParams);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError(String(err));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilesAccepted = (files: File[]) => {
    if (!image && !isLoading) {
      const [first, ...rest] = files;
      setQueue(prev => [...prev, ...rest]);
      triggerLoad(first);
    } else {
      setQueue(prev => [...prev, ...files]);
    }
  };

  const handleNext = () => {
    if (queue.length > 0) {
      const [next, ...rest] = queue;
      setQueue(rest);
      triggerLoad(next);
    } else {
      setImage(null);
      setQueue([]);
    }
  };

  if (!cvReady) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-950 text-white w-full h-full">
        <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
        <h1 className="text-xl font-medium animate-pulse text-neutral-300">Loading computer vision models...</h1>
      </div>
    )
  }

  return (
    <div className="flex flex-col w-full h-full bg-neutral-950 text-white overflow-hidden">
      {!image && (
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <h1 className="text-4xl font-bold text-white mb-2">Scanner Wizard</h1>
          <p className="text-neutral-400 mb-12">Split flatbed scans into individual photos with auto-detection.</p>
          
          {isLoading ? (
            <div className="flex flex-col items-center justify-center p-12 text-center h-80 w-full max-w-2xl text-neutral-400">
               <Loader2 className="w-12 h-12 text-blue-500 animate-spin mb-4" />
               <p className="text-xl font-medium">Processing scan...</p>
            </div>
          ) : (
            <ImageDropzone onFilesAccepted={handleFilesAccepted} />
          )}

          {error && (
            <div className="mt-8 p-4 bg-red-950/50 text-red-400 rounded-lg border border-red-900/50 max-w-2xl text-center">
              {error}
            </div>
          )}
        </div>
      )}
      
      {image && <Workspace image={image} queue={queue} onNext={handleNext} />}
    </div>
  )
}

export default App
