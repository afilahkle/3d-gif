'use client';

import { useState } from 'react';
import { FileUpload } from '@/components/FileUpload';
import { ModelViewer } from '@/components/ModelViewer';
import { ControlPanel } from '@/components/ControlPanel';
import { Header } from '@/components/Header';
import { Card } from '@/components/ui/card';
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
  const [gifSettings, setGifSettings] = useState<GifSettings>({
    duration: 3,
    fps: 15,
    quality: 10,
    rotationSpeed: 1,
    autoRotate: true,
    cameraDistance: 8,
  });

  const handleModelLoad = (data: ModelData) => {
    setModelData(data);
  };

  return (
    <div className='min-h-screen bg-gradient-to-br from-slate-50 to-slate-100'>
      <Header />

      <main className='container mx-auto px-4 py-8'>
        <div className='grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-12rem)]'>
          {/* File Upload Section */}
          <div className='lg:col-span-1 space-y-6'>
            <Card className='p-6'>
              <FileUpload
                onModelLoad={handleModelLoad}
                isLoading={isLoading}
                setIsLoading={setIsLoading}
              />
            </Card>

            <Card className='p-6'>
              <ControlPanel
                settings={gifSettings}
                onSettingsChange={setGifSettings}
                modelLoaded={!!modelData}
              />
            </Card>
          </div>

          {/* 3D Viewer Section */}
          <div className='lg:col-span-2'>
            <Card className='h-full p-6'>
              <ModelViewer modelData={modelData} settings={gifSettings} />
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
