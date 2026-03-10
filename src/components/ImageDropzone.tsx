import { useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { ImagePlus } from 'lucide-react';

interface ImageDropzoneProps {
  onFileAccepted: (file: File) => void;
}

export function ImageDropzone({ onFileAccepted }: ImageDropzoneProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onFileAccepted(acceptedFiles[0]);
      }
    },
    [onFileAccepted]
  );

  const { getRootProps, getInputProps, isDragActive, isDragReject } = useDropzone({
    onDrop,
    accept: {
      'image/jpeg': ['.jpg', '.jpeg'],
      'image/png': ['.png'],
      'image/tiff': ['.tiff', '.tif'],
      'image/heic': ['.heic'],
      'image/heif': ['.heif'],
    },
    maxFiles: 1,
  });

  return (
    <div
      {...getRootProps()}
      className={`
        flex flex-col items-center justify-center p-12 text-center 
        border-2 border-dashed rounded-2xl cursor-pointer transition-colors duration-200 ease-in-out
        w-full max-w-2xl mx-auto h-80
        ${
          isDragReject
            ? 'border-red-500 bg-red-500/10 text-red-400'
            : isDragActive
            ? 'border-blue-500 bg-blue-500/10 text-blue-400'
            : 'border-neutral-600 bg-neutral-800/50 hover:bg-neutral-800 hover:border-neutral-500 text-neutral-400'
        }
      `}
    >
      <input {...getInputProps()} />
      <div className="mb-4 p-4 bg-neutral-800 rounded-full shadow-inner">
        <ImagePlus
          size={48}
          className={`${
            isDragReject ? 'text-red-500' : isDragActive ? 'text-blue-500' : 'text-neutral-500'
          }`}
        />
      </div>
      {isDragReject ? (
        <p className="text-xl font-medium">Unsupported file type</p>
      ) : isDragActive ? (
        <p className="text-xl font-medium">Drop the scan here...</p>
      ) : (
        <>
          <p className="text-xl font-medium mb-2 text-neutral-200">
            Drag & drop a scan here
          </p>
          <p className="text-sm">or click to select a file</p>
          <div className="flex gap-2 mt-6 text-xs font-mono text-neutral-500 bg-neutral-900/50 px-4 py-2 rounded-lg">
            <span>JPG</span>
            <span>PNG</span>
            <span>TIFF</span>
            <span>HEIC</span>
          </div>
        </>
      )}
    </div>
  );
}
