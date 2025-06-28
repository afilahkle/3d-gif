'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, File, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileUploadAreaProps {
  onFileUpload: (file: File) => void;
  isLoading?: boolean;
  currentFileName?: string;
  onClearFile?: () => void;
}

export function FileUploadArea({ 
  onFileUpload, 
  isLoading = false, 
  currentFileName,
  onClearFile 
}: FileUploadAreaProps) {
  const [isDragActive, setIsDragActive] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      onFileUpload(acceptedFiles[0]);
    }
  }, [onFileUpload]);

  const { getRootProps, getInputProps, isDragReject } = useDropzone({
    onDrop,
    onDragEnter: () => setIsDragActive(true),
    onDragLeave: () => setIsDragActive(false),
    accept: {
      'model/*': ['.obj', '.fbx', '.gltf', '.glb'],
      'application/octet-stream': ['.obj', '.fbx', '.gltf', '.glb'],
      'application/zip': ['.zip'],
      'application/x-zip-compressed': ['.zip'],
    },
    maxFiles: 1,
    disabled: isLoading,
  });

  if (currentFileName) {
    return (
      <Card className="border-2 border-dashed border-green-300 bg-green-50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-green-100 rounded-lg">
                <File className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-green-900">{currentFileName}</p>
                <p className="text-sm text-green-600">Model loaded successfully</p>
              </div>
            </div>
            {onClearFile && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearFile}
                className="text-green-600 hover:text-green-700 hover:bg-green-100"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={cn(
      "border-2 border-dashed transition-all duration-200 cursor-pointer h-full",
      isDragActive && !isDragReject && "border-blue-400 bg-blue-50",
      isDragReject && "border-red-400 bg-red-50",
      !isDragActive && !isDragReject && "border-gray-300 hover:border-gray-400 hover:bg-gray-50",
      isLoading && "opacity-50 cursor-not-allowed"
    )}>
      <CardContent {...getRootProps()} className="p-8 h-full flex items-center justify-center">
        <input {...getInputProps()} />
        <div className="flex flex-col items-center justify-center space-y-4">
          {isLoading ? (
            <div className="p-4 bg-blue-100 rounded-full">
              <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
            </div>
          ) : (
            <div className={cn(
              "p-4 rounded-full transition-colors",
              isDragActive && !isDragReject && "bg-blue-100",
              isDragReject && "bg-red-100",
              !isDragActive && !isDragReject && "bg-gray-100"
            )}>
              <Upload className={cn(
                "h-8 w-8 transition-colors",
                isDragActive && !isDragReject && "text-blue-600",
                isDragReject && "text-red-600",
                !isDragActive && !isDragReject && "text-gray-600"
              )} />
            </div>
          )}
          
          <div className="text-center space-y-2">
            {isLoading ? (
              <>
                <p className="text-lg font-medium text-gray-900">Loading model...</p>
                <p className="text-sm text-gray-500">Please wait while we process your file</p>
              </>
            ) : isDragReject ? (
              <>
                <p className="text-lg font-medium text-red-900">Invalid file type</p>
                <p className="text-sm text-red-600">Please upload a 3D model file (.obj, .fbx, .gltf, .glb, .zip)</p>
              </>
            ) : isDragActive ? (
              <>
                <p className="text-lg font-medium text-blue-900">Drop your 3D model here</p>
                <p className="text-sm text-blue-600">Release to upload</p>
              </>
            ) : (
              <>
                <p className="text-lg font-medium text-gray-900">Upload your 3D model</p>
                <p className="text-sm text-gray-500">
                  Drag and drop a file here, or click to browse
                </p>
                <p className="text-xs text-gray-400">
                  Supports .obj, .fbx, .gltf, .glb, .zip files
                </p>
              </>
            )}
          </div>

          {!isLoading && !isDragActive && (
            <Button 
              variant="outline" 
              className="mt-4"
              disabled={isLoading}
            >
              Choose File
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
