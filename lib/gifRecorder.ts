import { GifSettings } from '@/app/page';

export async function recordGif(
  canvas: HTMLCanvasElement,
  settings: GifSettings,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      // Import gif.js dynamically
      import('gif.js')
        .then((GIF) => {
          const gif = new GIF.default({
            workers: 2,
            quality: settings.quality,
            width: canvas.width,
            height: canvas.height,
            workerScript: '/gif.worker.js',
          });

          // For smooth continuous loop, ensure enough frames and avoid duplicate start/end
          const totalFrames = Math.max(
            24,
            Math.floor(settings.duration * settings.fps)
          );
          const frameInterval = 1000 / settings.fps;
          let frameCount = 0;

          const captureFrame = () => {
            if (frameCount >= totalFrames) {
              gif.render();
              return;
            }

            // Use requestAnimationFrame to ensure we capture after rendering
            requestAnimationFrame(() => {
              try {
                // Create a copy of the canvas to capture the current frame
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = canvas.width;
                tempCanvas.height = canvas.height;
                const tempCtx = tempCanvas.getContext('2d');

                if (tempCtx) {
                  // For WebGL canvases, we need to preserve the drawing buffer
                  tempCtx.drawImage(canvas, 0, 0);

                  // Check if the canvas has actual content (not just black)
                  const imageData = tempCtx.getImageData(
                    0,
                    0,
                    tempCanvas.width,
                    tempCanvas.height
                  );
                  const hasContent = imageData.data.some(
                    (value, index) => index % 4 !== 3 && value > 0 // Check RGB values (skip alpha)
                  );

                  if (hasContent) {
                    gif.addFrame(tempCanvas, { delay: frameInterval });
                  } else {
                    console.warn(
                      `Frame ${frameCount} appears to be empty/black`
                    );
                    gif.addFrame(tempCanvas, { delay: frameInterval }); // Add it anyway for timing
                  }
                }

                frameCount++;
                // Progress should only reflect capture phase for smooth rotation
                const captureProgress = (frameCount / totalFrames) * 100;
                onProgress?.(Math.round(captureProgress));

                setTimeout(captureFrame, frameInterval);
              } catch (error) {
                console.error('Error capturing frame:', error);
                setTimeout(captureFrame, frameInterval);
              }
            });
          };

          gif.on('finished', (blob: Blob) => {
            resolve(blob);
          });

          // Don't update progress during rendering phase to keep rotation smooth
          gif.on('progress', (progress: number) => {
            // Keep progress at 100% during rendering to maintain final rotation position
            onProgress?.(100);
          });

          // Start capturing frames after a longer delay to ensure scene is rendered
          setTimeout(captureFrame, 500);
        })
        .catch(reject);
    } catch (error) {
      reject(error);
    }
  });
}
