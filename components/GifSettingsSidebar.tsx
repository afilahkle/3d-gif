'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Settings, X, RotateCcw, Timer, Palette } from 'lucide-react';

interface GifSettings {
  fps: number;
  duration: number;
  quality: number;
  autoRotate: boolean;
  rotationSpeed: number;
  cameraDistance: number;
}

interface GifSettingsSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  settings: GifSettings;
  onSettingsChange: (settings: GifSettings) => void;
  onGenerateGif: () => void;
  isRecording: boolean;
  recordingProgress: number;
}

export function GifSettingsSidebar({
  isOpen,
  onClose,
  settings,
  onSettingsChange,
  onGenerateGif,
  isRecording,
  recordingProgress,
}: GifSettingsSidebarProps) {
  const updateSetting = <K extends keyof GifSettings>(key: K, value: GifSettings[K]) => {
    onSettingsChange({ ...settings, [key]: value });
  };

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden"
          onClick={onClose}
        />
      )}
      
      {/* Sidebar */}
      <div className={`
        fixed top-0 right-0 h-full w-80 bg-white border-l border-gray-200 shadow-xl z-50
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}
        lg:relative lg:translate-x-0 lg:w-80 lg:border-l lg:shadow-none lg:z-auto
      `}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div className="flex items-center space-x-2">
              <Settings className="h-5 w-5 text-gray-600" />
              <h2 className="text-lg font-semibold text-gray-900">GIF Settings</h2>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="lg:hidden"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">

            {/* Animation Settings */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center">
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Animation
                </CardTitle>
                <CardDescription className="text-xs">
                  Control model rotation and movement
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="autoRotate" className="text-sm font-medium">
                    Auto Rotate
                  </Label>
                  <Switch
                    id="autoRotate"
                    checked={settings.autoRotate}
                    onCheckedChange={(checked) => updateSetting('autoRotate', checked)}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Rotation Speed: {settings.rotationSpeed.toFixed(1)}
                  </Label>
                  <Slider
                    value={[settings.rotationSpeed]}
                    onValueChange={([value]) => updateSetting('rotationSpeed', value)}
                    min={0.1}
                    max={3.0}
                    step={0.1}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Camera Distance: {settings.cameraDistance.toFixed(1)}
                  </Label>
                  <Slider
                    value={[settings.cameraDistance]}
                    onValueChange={([value]) => updateSetting('cameraDistance', value)}
                    min={2}
                    max={20}
                    step={0.5}
                    className="w-full"
                  />
                </div>
              </CardContent>
            </Card>

            {/* GIF Quality Settings */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center">
                  <Timer className="mr-2 h-4 w-4" />
                  Recording
                </CardTitle>
                <CardDescription className="text-xs">
                  Configure GIF quality and timing
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Frame Rate: {settings.fps} FPS
                  </Label>
                  <Slider
                    value={[settings.fps]}
                    onValueChange={([value]) => updateSetting('fps', value)}
                    min={10}
                    max={60}
                    step={5}
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Duration: {settings.duration}s
                  </Label>
                  <Slider
                    value={[settings.duration]}
                    onValueChange={([value]) => updateSetting('duration', value)}
                    min={1}
                    max={10}
                    step={0.5}
                    className="w-full"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Export Settings */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center">
                  <Palette className="mr-2 h-4 w-4" />
                  Export
                </CardTitle>
                <CardDescription className="text-xs">
                  Output dimensions and quality
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">
                    Quality: {settings.quality}
                  </Label>
                  <Slider
                    value={[settings.quality]}
                    onValueChange={([value]) => updateSetting('quality', value)}
                    min={1}
                    max={20}
                    step={1}
                    className="w-full"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}
