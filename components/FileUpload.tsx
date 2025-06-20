'use client';

import { useCallback, useState } from 'react';
import { Upload, FileArchive, Box, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { handleFileUpload } from '@/lib/fileHandler';
import { ModelData } from '@/app/page';

interface FileUploadProps {
  onModelLoad: (data: ModelData) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
}

export function FileUpload({
  onModelLoad,
  isLoading,
  setIsLoading,
}: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
        processFile(e.target.files[0]);
      }
    },
    []
  );

  const processFile = async (file: File) => {
    setError(null);
    setIsLoading(true);
    setProgress(0);

    try {
      const progressCallback = (progress: number) => {
        setProgress(progress);
      };

      const modelData = await handleFileUpload(file, progressCallback);
      onModelLoad(modelData);
      setProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load model');
    } finally {
      setIsLoading(false);
    }
  };

  const supportedFormats = ['.obj', '.fbx', '.gltf', '.glb', '.zip'];

  return (
    <div className='space-y-4'>
      <div className='text-center'>
        <h2 className='text-xl font-semibold text-gray-900 mb-2'>
          Upload 3D Model
        </h2>
        <p className='text-sm text-gray-600'>
          Support for OBJ, FBX, GLTF, GLB files and ZIP archives
        </p>
      </div>

      <div
        className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 ${
          dragActive
            ? 'border-blue-400 bg-blue-50'
            : isLoading
            ? 'border-gray-300 bg-gray-50'
            : 'border-gray-300 hover:border-gray-400 hover:bg-gray-50'
        } ${isLoading ? 'pointer-events-none' : 'cursor-pointer'}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() =>
          !isLoading && document.getElementById('file-input')?.click()
        }
      >
        <input
          id='file-input'
          type='file'
          className='hidden'
          accept={supportedFormats.join(',')}
          onChange={handleFileInput}
          disabled={isLoading}
        />

        {isLoading ? (
          <div className='space-y-4'>
            <div className='animate-spin mx-auto'>
              <Box className='h-12 w-12 text-blue-500' />
            </div>
            <div className='space-y-2'>
              <p className='text-sm font-medium text-gray-700'>
                Processing file...
              </p>
              <Progress value={progress} className='w-full' />
              <p className='text-xs text-gray-500'>{progress}%</p>
            </div>
          </div>
        ) : (
          <div className='space-y-4'>
            <div className='flex justify-center space-x-2'>
              <Upload className='h-8 w-8 text-gray-400' />
              <FileArchive className='h-8 w-8 text-gray-400' />
            </div>
            <div>
              <p className='text-lg font-medium text-gray-700'>
                Drag & drop your 3D model here
              </p>
              <p className='text-sm text-gray-500 mt-1'>
                or click to browse files
              </p>
            </div>
            <Button variant='outline' className='mt-4'>
              Choose File
            </Button>
          </div>
        )}
      </div>

      {error && (
        <Alert variant='destructive'>
          <AlertCircle className='h-4 w-4' />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className='grid grid-cols-2 gap-2'>
        {supportedFormats.map((format) => (
          <div
            key={format}
            className='flex items-center space-x-2 text-xs text-gray-600 bg-gray-50 rounded px-2 py-1'
          >
            <div className='w-1.5 h-1.5 bg-green-400 rounded-full'></div>
            <span>{format.toUpperCase()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
