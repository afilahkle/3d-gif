'use client';

import {
  Suspense,
  useRef,
  useState,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import {
  OrbitControls,
  Text,
  useProgress,
  Html,
  Environment,
} from '@react-three/drei';
import * as THREE from 'three';
import { ModelData, GifSettings } from '@/app/page';
import { LoadedModel } from '@/components/LoadedModel';
import { recordGif } from '@/lib/gifRecorder';
import { Loader2, Download, Camera, Play, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ModelViewerProps {
  modelData: ModelData | null;
  settings: GifSettings;
  onClearFile?: () => void;
  isRecording?: boolean;
  recordingProgress?: number;
  onRecordingStateChange?: (isRecording: boolean) => void;
  onRecordingProgressChange?: (progress: number) => void;
}

export interface ModelViewerRef {
  startRecording: () => void;
}

function LoadingFallback() {
  return (
    <div className='flex flex-col items-center justify-center h-full space-y-4'>
      <Loader2 className='h-8 w-8 animate-spin text-blue-500' />
      <p className='text-sm text-gray-600'>Loading 3D scene...</p>
    </div>
  );
}

function EmptyState() {
  return (
    <mesh>
      <Text
        position={[0, 0, 0]}
        fontSize={0.5}
        color='#9CA3AF'
        anchorX='center'
        anchorY='middle'
      >
        Upload a 3D model to preview
      </Text>
    </mesh>
  );
}

export const ModelViewer = forwardRef<ModelViewerRef, ModelViewerProps>(
  (
    {
      modelData,
      settings,
      onClearFile,
      isRecording: externalIsRecording,
      recordingProgress: externalRecordingProgress,
      onRecordingStateChange,
      onRecordingProgressChange,
    },
    ref
  ) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingProgress, setRecordingProgress] = useState(0);
    const [gifUrl, setGifUrl] = useState<string | null>(null);
    const [showPreview, setShowPreview] = useState(false);

    // Use external recording state if provided, otherwise use internal state
    const actualIsRecording =
      externalIsRecording !== undefined ? externalIsRecording : isRecording;
    const actualRecordingProgress =
      externalRecordingProgress !== undefined
        ? externalRecordingProgress
        : recordingProgress;

    const updateRecordingState = (recording: boolean) => {
      if (onRecordingStateChange) {
        onRecordingStateChange(recording);
      } else {
        setIsRecording(recording);
      }
    };

    const updateRecordingProgress = (progress: number) => {
      if (onRecordingProgressChange) {
        onRecordingProgressChange(progress);
      } else {
        setRecordingProgress(progress);
      }
    };

    // Check if model has lightmaps to adjust lighting accordingly
    const hasLightmaps =
      modelData?.textures &&
      (modelData.textures.lightmap || modelData.textures.light);

    // Check if this is a GLTF/GLB model (likely from Unreal Engine)
    const isGLTFModel = modelData?.type === 'gltf' || modelData?.type === 'glb';

    const startRecording = async () => {
      if (!canvasRef.current) return;

      updateRecordingState(true);
      updateRecordingProgress(0);
      setGifUrl(null);
      setShowPreview(false);

      // Wait a bit longer to ensure the scene is fully rendered
      await new Promise((resolve) => setTimeout(resolve, 1000));

      try {
        // Debug: Test if we can capture a single frame first
        console.log(
          'Canvas dimensions:',
          canvasRef.current.width,
          'x',
          canvasRef.current.height
        );
        const testCanvas = document.createElement('canvas');
        testCanvas.width = canvasRef.current.width;
        testCanvas.height = canvasRef.current.height;
        const testCtx = testCanvas.getContext('2d');

        if (testCtx) {
          testCtx.drawImage(canvasRef.current, 0, 0);
          const imageData = testCtx.getImageData(
            0,
            0,
            testCanvas.width,
            testCanvas.height
          );
          const hasContent = imageData.data.some(
            (value, index) => index % 4 !== 3 && value > 0
          );
          console.log('Test frame has content:', hasContent);
        }

        const gifBlob = await recordGif(
          canvasRef.current,
          settings,
          (progress) => updateRecordingProgress(progress)
        );

        const url = URL.createObjectURL(gifBlob);
        setGifUrl(url);
        setShowPreview(true);
      } catch (error) {
        console.error('Error recording GIF:', error);
      } finally {
        updateRecordingState(false);
        updateRecordingProgress(0);
      }
    };

    // Expose startRecording method via ref
    useImperativeHandle(ref, () => ({
      startRecording,
    }));

    const downloadGif = () => {
      if (gifUrl) {
        const link = document.createElement('a');
        link.href = gifUrl;
        link.download = `3d-model-animation-${Date.now()}.gif`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    };

    const closePreview = () => {
      setShowPreview(false);
      if (gifUrl) {
        URL.revokeObjectURL(gifUrl);
        setGifUrl(null);
      }
    };

    return (
      <div className='h-full w-full bg-white rounded-lg overflow-hidden relative'>
        {/* Model Name Display - Right Side */}
        {modelData && (
          <div className='absolute top-4 right-4 z-10'>
            <div className='bg-white/90 backdrop-blur-sm rounded-lg px-4 py-2 shadow-lg border'>
              <div className='flex items-center space-x-3'>
                <div className='flex items-center space-x-2'>
                  <div className='w-2 h-2 bg-green-400 rounded-full'></div>
                  <span className='text-sm font-medium text-gray-700'>
                    {modelData.name}
                  </span>
                </div>
                {onClearFile && (
                  <button
                    onClick={onClearFile}
                    className='text-gray-400 hover:text-gray-600 text-sm ml-2'
                  >
                    ×
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Generate GIF Button - Top Left */}
        {modelData && !actualIsRecording && (
          <div className='absolute top-4 left-4 z-10'>
            <Button
              onClick={startRecording}
              className='bg-blue-500 hover:bg-blue-600 text-white shadow-lg'
            >
              <Camera className='mr-2 h-4 w-4' />
              Generate GIF
            </Button>
          </div>
        )}

        {/* Recording Status - Same Position as Generate Button */}
        {actualIsRecording && (
          <div className='absolute top-4 left-4 z-10 bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center space-x-2 shadow-lg'>
            <div className='w-2 h-2 bg-white rounded-full animate-pulse'></div>
            <span>Recording {actualRecordingProgress.toFixed(0)}%</span>
          </div>
        )}

        {/* GIF Preview Modal */}
        {showPreview && gifUrl && (
          <div className='fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50'>
            <div className='bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-auto'>
              <div className='flex justify-between items-center mb-4'>
                <h3 className='text-lg font-semibold'>GIF Preview</h3>
                <Button
                  variant='ghost'
                  size='sm'
                  onClick={closePreview}
                  className='p-1'
                >
                  <X className='h-4 w-4' />
                </Button>
              </div>

              <div className='mb-4 flex justify-center'>
                <img
                  src={gifUrl}
                  alt='Generated GIF preview'
                  className='max-w-full max-h-96 rounded-lg shadow-md'
                />
              </div>

              <div className='flex gap-2 justify-end'>
                <Button variant='outline' onClick={closePreview}>
                  Close
                </Button>
                <Button
                  onClick={downloadGif}
                  className='bg-green-500 hover:bg-green-600 text-white'
                >
                  <Download className='mr-2 h-4 w-4' />
                  Download GIF
                </Button>
              </div>
            </div>
          </div>
        )}

        <Canvas
          ref={canvasRef}
          camera={{
            position: [
              settings.cameraDistance,
              settings.cameraDistance,
              settings.cameraDistance,
            ],
            fov: 50,
          }}
          shadows
          className='h-full w-full'
          gl={{
            preserveDrawingBuffer: true,
            antialias: true,
            alpha: false,
            // Unreal Engine optimized settings
            toneMapping: isGLTFModel
              ? THREE.ACESFilmicToneMapping
              : THREE.LinearToneMapping,
            toneMappingExposure: isGLTFModel ? 1.0 : 1.2, // Lower exposure for UE GLTF assets
            outputColorSpace: THREE.SRGBColorSpace,
          }}
          scene={{ background: new THREE.Color(0xf5f5f5) }}
        >
          <Suspense fallback={null}>
            {/* Unreal Engine optimized lighting setup */}

            {/* Ambient light - much more subtle */}
            <ambientLight
              intensity={isGLTFModel ? 0.1 : hasLightmaps ? 0.15 : 0.3}
              color={0xffffff}
            />

            {/* Main directional light - much reduced intensity */}
            <directionalLight
              position={[10, 10, 5]}
              intensity={isGLTFModel ? 0.8 : hasLightmaps ? 1.0 : 1.5}
              color={0xffffff}
              castShadow={!hasLightmaps && !isGLTFModel}
              shadow-mapSize-width={2048}
              shadow-mapSize-height={2048}
              shadow-camera-far={50}
              shadow-camera-left={-15}
              shadow-camera-right={15}
              shadow-camera-top={15}
              shadow-camera-bottom={-15}
              shadow-bias={-0.0001}
            />

            {/* Fill light - very subtle */}
            <directionalLight
              position={[-8, 4, -6]}
              intensity={isGLTFModel ? 0.2 : hasLightmaps ? 0.3 : 0.5}
              color={0xffeedd}
            />

            {/* Rim light - minimal */}
            <directionalLight
              position={[0, 5, -10]}
              intensity={isGLTFModel ? 0.15 : hasLightmaps ? 0.25 : 0.4}
              color={0xccddff}
            />

            {/* Environment lighting - much reduced */}
            <Environment
              files={'/textures/belfast_sunset_puresky_4k.hdr'}
              background={false}
              environmentIntensity={
                isGLTFModel ? 0.1 : hasLightmaps ? 0.2 : 0.4
              }
            />

            <OrbitControls
              enablePan={!actualIsRecording}
              enableZoom={!actualIsRecording}
              enableRotate={!actualIsRecording}
              dampingFactor={0.05}
            />

            {modelData ? (
              <LoadedModel
                modelData={modelData}
                autoRotate={settings.autoRotate && !actualIsRecording}
                rotationSpeed={settings.rotationSpeed}
                isRecording={actualIsRecording}
                recordingProgress={actualRecordingProgress}
              />
            ) : (
              <EmptyState />
            )}
          </Suspense>
        </Canvas>
      </div>
    );
  }
);

ModelViewer.displayName = 'ModelViewer';
