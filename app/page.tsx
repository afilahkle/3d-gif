'use client';

import { useState, useRef } from 'react';
import { FileUploadArea } from '@/components/FileUploadArea';
import { ModelViewer, ModelViewerRef } from '@/components/ModelViewer';
import { GifSettingsSidebar } from '@/components/GifSettingsSidebar';
import { Header } from '@/components/Header';
import { handleFileUpload } from '@/lib/fileHandler';
import { FileLoader } from '@/lib/fileLoader';

export interface ModelData {
  url: string;
  name: string;
  type: string;
  textures?: Record<string, string>;
  auxiliaryFiles?: Record<string, string>;
  hasEmbeddedMaterials?: boolean;
  fileLoader: FileLoader | null;
  internalPath: string;
  mtlPath?: string;
  width?: number;
  height?: number;
}

export interface GifSettings {
  duration: number;
  fps: number;
  quality: number;
  rotationSpeed: number;
  autoRotate: boolean;
  cameraDistance: number;
}

export default function Home() {
  const [modelData, setModelData] = useState<ModelData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingProgress, setRecordingProgress] = useState(0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [gifSettings, setGifSettings] = useState<GifSettings>({
    duration: 3,
    fps: 15,
    quality: 10,
    rotationSpeed: 1,
    autoRotate: true,
    cameraDistance: 8,
  });

  // State for GIF generation
  const modelViewerRef = useRef<ModelViewerRef>(null);

  const handleFileUploadProcess = async (file: File) => {
    setIsLoading(true);
    try {
      const progressCallback = (progress: number) => {
        console.log('Upload progress:', progress);
      };
      const modelData = await handleFileUpload(file, progressCallback);
      setModelData(modelData);
    } catch (error) {
      console.error('Error loading file:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearFile = () => {
    setModelData(null);
  };

  const handleGenerateGif = () => {
    if (modelViewerRef.current?.startRecording) {
      modelViewerRef.current.startRecording();
    } else {
      console.log('ModelViewer not ready for recording');
    }
  };

  return (
    <div className='min-h-screen bg-gray-50 flex flex-col'>
      <Header onOpenSettings={() => setIsSidebarOpen(true)} />

      <div className='flex-1 flex'>
        {/* Main Content Area */}
        <div className='flex-1 flex flex-col min-h-0'>
          {/* File Upload Area - only show when no model is loaded */}
          {!modelData && (
            <div className='flex-1 p-6 flex flex-col'>
              <div className='flex-1 min-h-0'>
                <FileUploadArea
                  onFileUpload={handleFileUploadProcess}
                  isLoading={isLoading}
                  onClearFile={handleClearFile}
                />
              </div>
            </div>
          )}

          {/* 3D Viewer - full width when model is loaded */}
          {modelData && (
            <div className='flex-1 relative min-h-0'>
              {/* Settings Toggle Button - Mobile */}
              <div className='absolute top-4 left-4 z-10 lg:hidden'>
                <button
                  onClick={() => setIsSidebarOpen(true)}
                  className='bg-white/90 backdrop-blur-sm rounded-lg p-2 shadow-lg border hover:bg-white transition-colors'
                >
                  <svg
                    className='w-5 h-5 text-gray-700'
                    fill='none'
                    stroke='currentColor'
                    viewBox='0 0 24 24'
                  >
                    <path
                      strokeLinecap='round'
                      strokeLinejoin='round'
                      strokeWidth={2}
                      d='M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4'
                    />
                  </svg>
                </button>
              </div>

              {/* 3D Viewer Component */}
              <ModelViewer
                ref={modelViewerRef}
                modelData={modelData}
                settings={gifSettings}
                onClearFile={handleClearFile}
                isRecording={isRecording}
                recordingProgress={recordingProgress}
                onRecordingStateChange={setIsRecording}
                onRecordingProgressChange={setRecordingProgress}
              />
            </div>
          )}
        </div>

        {/* Settings Sidebar - always visible on desktop when model is loaded, toggle on mobile */}
        {modelData && (
          <GifSettingsSidebar
            isOpen={isSidebarOpen}
            onClose={() => setIsSidebarOpen(false)}
            settings={gifSettings}
            onSettingsChange={setGifSettings}
            onGenerateGif={handleGenerateGif}
            isRecording={isRecording}
            recordingProgress={recordingProgress}
          />
        )}
      </div>
    </div>
  );
}
