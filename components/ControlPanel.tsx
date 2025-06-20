'use client';

import { Settings, RotateCcw, Info } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { GifSettings } from '@/app/page';

interface ControlPanelProps {
  settings: GifSettings;
  onSettingsChange: (settings: GifSettings) => void;
  modelLoaded: boolean;
}

export function ControlPanel({
  settings,
  onSettingsChange,
  modelLoaded,
}: ControlPanelProps) {
  const updateSetting = (key: keyof GifSettings, value: number | boolean) => {
    onSettingsChange({
      ...settings,
      [key]: value,
    });
  };

  return (
    <div className='space-y-6'>
      <div className='text-center'>
        <h2 className='text-xl font-semibold text-gray-900 mb-2 flex items-center justify-center space-x-2'>
          <Settings className='h-5 w-5' />
          <span>GIF Settings</span>
        </h2>
        <p className='text-sm text-gray-600'>Configure your animation export</p>
      </div>

      {modelLoaded && (
        <Alert>
          <Info className='h-4 w-4' />
          <AlertDescription>
            GIF recording will start automatically when you upload a model.
            Adjust settings and upload again to re-record.
          </AlertDescription>
        </Alert>
      )}

      <div className='space-y-4'>
        <div className='space-y-2'>
          <Label className='text-sm font-medium'>Duration (seconds)</Label>
          <Slider
            value={[settings.duration]}
            onValueChange={(value) => updateSetting('duration', value[0])}
            max={10}
            min={1}
            step={0.5}
            className='w-full'
          />
          <div className='flex justify-between text-xs text-gray-500'>
            <span>1s</span>
            <span className='font-medium'>{settings.duration}s</span>
            <span>10s</span>
          </div>
        </div>

        <div className='space-y-2'>
          <Label className='text-sm font-medium'>Frame Rate (fps)</Label>
          <Slider
            value={[settings.fps]}
            onValueChange={(value) => updateSetting('fps', value[0])}
            max={30}
            min={5}
            step={5}
            className='w-full'
          />
          <div className='flex justify-between text-xs text-gray-500'>
            <span>5 fps</span>
            <span className='font-medium'>{settings.fps} fps</span>
            <span>30 fps</span>
          </div>
        </div>

        <div className='space-y-2'>
          <Label className='text-sm font-medium'>Quality</Label>
          <Slider
            value={[settings.quality]}
            onValueChange={(value) => updateSetting('quality', value[0])}
            max={20}
            min={1}
            step={1}
            className='w-full'
          />
          <div className='flex justify-between text-xs text-gray-500'>
            <span>Low (1)</span>
            <span className='font-medium'>{settings.quality}</span>
            <span>High (20)</span>
          </div>
        </div>

        <Separator />

        <div className='space-y-4'>
          <div className='flex items-center justify-between'>
            <div className='space-y-1'>
              <Label className='text-sm font-medium'>Auto Rotate</Label>
              <p className='text-xs text-gray-500'>
                Automatically rotate the model
              </p>
            </div>
            <Switch
              checked={settings.autoRotate}
              onCheckedChange={(checked) =>
                updateSetting('autoRotate', checked)
              }
            />
          </div>

          {settings.autoRotate && (
            <div className='space-y-2'>
              <Label className='text-sm font-medium flex items-center space-x-1'>
                <RotateCcw className='h-3 w-3' />
                <span>Rotation Speed</span>
              </Label>
              <Slider
                value={[settings.rotationSpeed]}
                onValueChange={(value) =>
                  updateSetting('rotationSpeed', value[0])
                }
                max={3}
                min={0.1}
                step={0.1}
                className='w-full'
              />
              <div className='flex justify-between text-xs text-gray-500'>
                <span>0.1x</span>
                <span className='font-medium'>{settings.rotationSpeed}x</span>
                <span>3x</span>
              </div>
            </div>
          )}
        </div>

        <div className='space-y-2'>
          <Label className='text-sm font-medium'>Camera Distance</Label>
          <Slider
            value={[settings.cameraDistance]}
            onValueChange={(value) => updateSetting('cameraDistance', value[0])}
            max={15}
            min={2}
            step={0.5}
            className='w-full'
          />
          <div className='flex justify-between text-xs text-gray-500'>
            <span>Close (2)</span>
            <span className='font-medium'>{settings.cameraDistance}</span>
            <span>Far (15)</span>
          </div>
        </div>
      </div>

      <Separator />

      <div className='grid grid-cols-2 gap-2 text-xs text-gray-600'>
        <div className='bg-gray-50 rounded p-2'>
          <div className='font-medium'>File Size Est.</div>
          <div>{Math.round(settings.duration * settings.fps * 0.05)}MB</div>
        </div>
        <div className='bg-gray-50 rounded p-2'>
          <div className='font-medium'>Total Frames</div>
          <div>{Math.round(settings.duration * settings.fps)}</div>
        </div>
      </div>
    </div>
  );
}
