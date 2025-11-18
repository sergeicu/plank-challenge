'use client';

import { useEffect, useRef, useState, useCallback, memo } from 'react';
import { VideoRecorder as Recorder, getCameraStream, downloadBlob } from '@/utils/videoRecorder';
import { formatDuration, generateFilename, getDayNumber } from '@/utils/timerLogic';
import { format } from 'date-fns';
import { usePoseDetection } from '@/hooks/usePoseDetection';
import { drawPoseSkeleton, drawDetectionFeedback } from '@/lib/poseDetection';
import { getOptimizedCanvasContext, CanvasPerformanceMonitor } from '@/lib/canvasOptimizations';

interface VideoRecorderProps {
  targetDuration: number;
  onComplete: (elapsedTime: number) => void;
  onError: (error: string) => void;
  detectionMode?: boolean;
  cameraMode?: 'user' | 'environment';
}

type RecordingPhase = 'preparing' | 'countdown' | 'recording' | 'preview' | 'completed' | 'detecting';

// Memoize the timer overlay drawing function (performance-critical)
const drawTimerOverlayMemoized = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  seconds: number,
  targetDuration: number
) => {
  const timeText = formatDuration(seconds);
  const fontSize = Math.min(width, height) * 0.15; // Responsive font size

  // Semi-transparent background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.fillRect(width * 0.25, height * 0.05, width * 0.5, fontSize * 1.5);

  // Timer text
  ctx.font = `bold ${fontSize}px monospace`;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(timeText, width / 2, height * 0.05 + fontSize * 0.75);

  // Target duration indicator (smaller text below)
  const targetText = `/ ${formatDuration(targetDuration)}`;
  const smallFontSize = fontSize * 0.4;
  ctx.font = `${smallFontSize}px monospace`;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
  ctx.fillText(targetText, width / 2, height * 0.05 + fontSize * 1.3);
};

function VideoRecorder({ targetDuration, onComplete, onError, detectionMode = false, cameraMode = 'environment' }: VideoRecorderProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<Recorder | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const canvasContextRef = useRef<CanvasRenderingContext2D | null>(null); // Reuse canvas context

  const [phase, setPhase] = useState<RecordingPhase>('preparing');
  const [countdown, setCountdown] = useState(10);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
  const [isRestarting, setIsRestarting] = useState(false);
  const [finalFrameData, setFinalFrameData] = useState<string | null>(null);
  const [gracePeriodCount, setGracePeriodCount] = useState(0);
  const detectionFrameRef = useRef<number | null>(null);

  // Performance monitoring (development only)
  const performanceMonitorRef = useRef<CanvasPerformanceMonitor | null>(null);

  // Declare stopRecording ref to avoid dependency issues
  const stopRecordingRef = useRef<(() => Promise<void>) | null>(null);

  // Memoize pose detection callbacks to prevent hook re-initialization
  const handlePlankDetected = useCallback(() => {
    // Auto-start recording when plank detected
    setPhase(prevPhase => {
      if (prevPhase === 'detecting') {
        return 'countdown';
      }
      return prevPhase;
    });
  }, []);

  const handlePlankLost = useCallback(() => {
    // Auto-stop recording when plank lost (after grace period)
    setPhase(prevPhase => {
      if (prevPhase === 'recording') {
        // Capture final frame before stopping
        if (canvasRef.current) {
          const finalFrame = canvasRef.current.toDataURL('image/png');
          setFinalFrameData(finalFrame);
        }
        // Call stopRecording via ref
        if (stopRecordingRef.current) {
          stopRecordingRef.current();
        }
      }
      return prevPhase;
    });
  }, []);

  // Pose detection hook
  const {
    isReady: poseReady,
    isProcessing: poseLoading,
    error: poseError,
    detectionResult,
    detectPose,
    reset: resetPoseDetection,
  } = usePoseDetection({
    enableDetection: detectionMode,
    onPlankDetected: handlePlankDetected,
    onPlankLost: handlePlankLost,
    stabilityFrames: 5,
    gracePeriodFrames: 30, // ~3 seconds at 10 FPS
  });

  // Initialize camera and setup canvas
  useEffect(() => {
    let mounted = true;

    async function setupCamera() {
      try {
        const stream = await getCameraStream(cameraMode);

        if (!mounted) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }

        // Wait for video to be ready
        await new Promise<void>((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => resolve();
          }
        });

        // Start detection mode or countdown
        if (mounted) {
          if (detectionMode) {
            setPhase('detecting');
          } else {
            setPhase('countdown');
          }
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to access camera';
        setError(errorMsg);
        onError(errorMsg);
      }
    }

    setupCamera();

    return () => {
      mounted = false;

      // Stop camera stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      // Cancel animation frames
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (detectionFrameRef.current) {
        cancelAnimationFrame(detectionFrameRef.current);
        detectionFrameRef.current = null;
      }

      // Clear canvas and release context
      if (canvasRef.current && canvasContextRef.current) {
        canvasContextRef.current.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        canvasContextRef.current = null;
      }

      // Stop recorder if active
      if (recorderRef.current && recorderRef.current.isRecording()) {
        recorderRef.current.stop().catch(err => console.warn('Error stopping recorder on cleanup:', err));
        recorderRef.current = null;
      }
    };
  }, [onError, detectionMode, cameraMode]);

  // Handle countdown
  useEffect(() => {
    if (phase !== 'countdown') return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setPhase('recording');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [phase]);

  // Pose detection loop (runs at ~10 FPS during detecting and recording phases)
  // This is separated from rendering to allow independent frame rates
  useEffect(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || !detectionMode) return;
    if (phase !== 'detecting' && phase !== 'recording') return;

    // Cancel any existing detection frame before starting new one
    if (detectionFrameRef.current) {
      cancelAnimationFrame(detectionFrameRef.current);
      detectionFrameRef.current = null;
    }

    const runDetection = () => {
      detectPose(video);
      detectionFrameRef.current = requestAnimationFrame(runDetection);
    };

    runDetection();

    return () => {
      if (detectionFrameRef.current) {
        cancelAnimationFrame(detectionFrameRef.current);
        detectionFrameRef.current = null;
      }
    };
  }, [phase, detectionMode, detectPose]);

  // Handle video rendering to canvas (for both preview and recording)
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;

    if (!canvas || !video || phase === 'preparing' || phase === 'completed' || phase === 'preview') return;
    if (phase === 'detecting' && !detectionMode) return;

    // Reuse existing canvas context to avoid memory leaks
    // Use optimized context settings for better performance
    let ctx = canvasContextRef.current;
    if (!ctx) {
      ctx = getOptimizedCanvasContext(canvas, {
        alpha: false,
        desynchronized: true, // Lower latency
        willReadFrequently: false,
      });
      if (!ctx) return;
      canvasContextRef.current = ctx;
    }

    // Initialize performance monitor in development
    if (process.env.NODE_ENV === 'development' && !performanceMonitorRef.current) {
      performanceMonitorRef.current = new CanvasPerformanceMonitor();
    }

    // Set canvas size to match video
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    // Start recording if in recording phase
    if (phase === 'recording') {
      const canvasStream = canvas.captureStream(30); // 30 FPS
      recorderRef.current = new Recorder();
      recorderRef.current.start(canvasStream);
      startTimeRef.current = Date.now();
    }

    // Cancel any existing animation frame before starting new one
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Animation loop to draw video (and overlays)
    const drawFrame = () => {
      if (!ctx || !video) return;
      if (phase !== 'countdown' && phase !== 'recording' && phase !== 'detecting') return;

      // Performance monitoring (development only)
      const frameStart = performanceMonitorRef.current?.startFrame();

      // Clear canvas before drawing (prevent accumulation)
      // Use fast clear for better performance
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw video frame
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Draw pose skeleton and feedback during detection and recording
      if ((phase === 'detecting' || phase === 'recording') && detectionMode && detectionResult) {
        // Draw skeleton overlay
        if (detectionResult.landmarks) {
          const color = detectionResult.isPlank ? '#00FF00' : '#FF0000';
          drawPoseSkeleton(ctx, detectionResult.landmarks, canvas.width, canvas.height, color);
        }

        // Draw detection feedback
        drawDetectionFeedback(ctx, detectionResult, canvas.width, canvas.height);
      }

      // During recording, also draw timer overlay
      if (phase === 'recording') {
        const elapsed = Math.floor((Date.now() - (startTimeRef.current || 0)) / 1000);
        setElapsedTime(elapsed);

        // Draw timer overlay (use memoized function)
        drawTimerOverlayMemoized(ctx, canvas.width, canvas.height, elapsed, targetDuration);

        // Check if target duration reached (capture final frame at exact target)
        if (elapsed >= targetDuration && !detectionMode) {
          // Only auto-stop for manual mode; detection mode stops when plank lost
          const finalFrame = canvas.toDataURL('image/png');
          setFinalFrameData(finalFrame);
          stopRecording();
          return;
        }
      }

      // Performance monitoring (development only)
      if (frameStart !== undefined && performanceMonitorRef.current) {
        performanceMonitorRef.current.endFrame(frameStart);

        // Log performance stats every 60 frames
        if (process.env.NODE_ENV === 'development' && Math.random() < 0.016) { // ~1/60 chance
          const stats = performanceMonitorRef.current.getStats();
          if (!stats.isGood) {
            console.warn('Canvas performance:', stats);
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(drawFrame);
    };

    drawFrame();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      // Clear canvas on cleanup
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
  }, [phase, targetDuration, detectionMode, detectionResult]);


  const stopRecording = useCallback(async () => {
    // Capture final elapsed time before stopping
    if (startTimeRef.current) {
      const finalElapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setElapsedTime(finalElapsed);
    }

    // Cancel all animation frames
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (detectionFrameRef.current) {
      cancelAnimationFrame(detectionFrameRef.current);
      detectionFrameRef.current = null;
    }

    if (recorderRef.current && recorderRef.current.isRecording()) {
      try {
        const blob = await recorderRef.current.stop();
        setVideoBlob(blob);
        setPhase('preview');
      } catch (err) {
        const errorMsg = 'Failed to save video';
        setError(errorMsg);
        onError(errorMsg);
      }
    }
  }, [onError]);

  // Update ref when stopRecording changes
  useEffect(() => {
    stopRecordingRef.current = stopRecording;
  }, [stopRecording]);

  const handleStop = useCallback(() => {
    // Debounce: prevent rapid clicking
    if (isRestarting) return;
    setIsRestarting(true);

    // If in detecting phase (not recording yet), just go back to idle without showing completion
    if (phase === 'detecting') {
      // Cancel detection frames
      if (detectionFrameRef.current) {
        cancelAnimationFrame(detectionFrameRef.current);
        detectionFrameRef.current = null;
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      // Stop camera and go back
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      // Reset pose detection
      resetPoseDetection();

      // Go back to idle by calling onError with empty message (will reset to idle without showing error)
      setIsRestarting(false);
      onError('');
      return;
    }

    // If in countdown phase, also go back to idle
    if (phase === 'countdown') {
      // Cancel animation frames
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      // Stop camera
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }

      // Reset pose detection if in detection mode
      if (detectionMode) {
        resetPoseDetection();
      }

      // Go back to idle
      setIsRestarting(false);
      onError('');
      return;
    }

    // Capture current frame as final frame
    if (canvasRef.current) {
      const finalFrame = canvasRef.current.toDataURL('image/png');
      setFinalFrameData(finalFrame);
    }

    // Stop recording and go to preview
    stopRecording();

    // Clear debounce after 500ms
    setTimeout(() => {
      setIsRestarting(false);
    }, 500);
  }, [isRestarting, phase, resetPoseDetection, onComplete, stopRecording]);

  const handleDownloadVideo = useCallback(() => {
    if (videoBlob) {
      const filename = generateFilename();
      downloadBlob(videoBlob, filename);
      setPhase('completed');

      // Stop camera stream after download
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }

      onComplete(elapsedTime);
    }
  }, [videoBlob, elapsedTime, onComplete]);

  const handleDownloadScreenshot = useCallback(() => {
    if (finalFrameData) {
      const dayNumber = getDayNumber();
      const filename = `plank-day${dayNumber}-${format(new Date(), 'yyyyMMdd')}-screenshot.png`;

      // Download the captured final frame
      const a = document.createElement('a');
      a.href = finalFrameData;
      a.download = filename;
      a.click();
    }
  }, [finalFrameData]);

  const handleRecordAnother = useCallback(() => {
    // Reset to appropriate phase
    if (detectionMode) {
      setPhase('detecting');
      resetPoseDetection();
    } else {
      setPhase('countdown');
    }
    setCountdown(10);
    setElapsedTime(0);
    setVideoBlob(null);
    setFinalFrameData(null);
    setGracePeriodCount(0);
  }, [detectionMode, resetPoseDetection]);

  if (error || poseError) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-red-50 rounded-lg">
        <p className="text-red-600 text-center font-semibold mb-4">Error: {error || poseError}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full max-w-2xl mx-auto">
      {/* Canvas for recording */}
      <canvas
        ref={canvasRef}
        className="w-full rounded-lg shadow-2xl"
        style={{ display: 'block', width: '100%', height: 'auto' }}
      />

      {/* Video element (completely hidden, used only as source) */}
      <video
        ref={videoRef}
        style={{
          position: 'absolute',
          top: '-9999px',
          left: '-9999px',
          width: '1px',
          height: '1px',
          opacity: 0,
          pointerEvents: 'none'
        }}
        playsInline
        muted
      />

      {/* Countdown overlay */}
      {phase === 'countdown' && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg">
          <div className="text-white text-9xl font-bold font-mono animate-pulse drop-shadow-2xl" style={{ textShadow: '0 0 20px rgba(0,0,0,0.8), 0 0 40px rgba(0,0,0,0.6)' }}>
            {countdown}
          </div>
        </div>
      )}

      {/* Preparing overlay */}
      {phase === 'preparing' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-lg">
          <div className="text-white text-2xl font-semibold">
            {detectionMode && poseLoading ? 'Loading pose detection...' : 'Preparing camera...'}
          </div>
        </div>
      )}

      {/* Detection mode overlay */}
      {phase === 'detecting' && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-blue-600 bg-opacity-90 px-6 py-3 rounded-lg">
          <div className="text-white text-center">
            <div className="text-lg font-semibold mb-1">Get into plank position</div>
            <div className="text-sm opacity-90">Timer will start automatically</div>
          </div>
        </div>
      )}

      {/* Stop button (visible during countdown, detecting, and recording) */}
      {(phase === 'countdown' || phase === 'detecting' || phase === 'recording') && (
        <button
          onClick={handleStop}
          disabled={isRestarting}
          className="absolute top-4 right-4 px-4 py-2 bg-red-600 bg-opacity-90 hover:bg-opacity-100 text-white font-semibold rounded-lg shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Stop
        </button>
      )}

      {/* Recording indicator */}
      {phase === 'recording' && (
        <div className="absolute bottom-4 left-4 flex items-center space-x-2 bg-red-600 px-4 py-2 rounded-full">
          <div className="w-3 h-3 bg-white rounded-full animate-pulse"></div>
          <span className="text-white font-semibold">Recording</span>
        </div>
      )}

      {/* Preview screen */}
      {phase === 'preview' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 rounded-lg">
          <div className="text-white text-center px-6 py-8">
            <div className="text-4xl mb-4">✓</div>
            <div className="text-2xl font-semibold mb-2">Great job!</div>
            <div className="text-lg mb-8">You held your plank for {formatDuration(elapsedTime)}!</div>

            <div className="flex flex-col space-y-3">
              <button
                onClick={handleDownloadVideo}
                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors shadow-lg"
              >
                Download Video
              </button>
              <button
                onClick={handleDownloadScreenshot}
                className="px-8 py-3 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-lg transition-colors shadow-lg"
              >
                Download Screenshot
              </button>
              <button
                onClick={handleRecordAnother}
                className="px-8 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors shadow-lg"
              >
                Record Another
              </button>
              <a
                href={process.env.NEXT_PUBLIC_DISCORD_URL || 'https://discord.com/channels/1210290974601773056/1438326766279196782'}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors shadow-lg"
              >
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
                Plank-Challenge Discord
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Completed message */}
      {phase === 'completed' && (
        <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-75 rounded-lg">
          <div className="text-white text-center">
            <div className="text-4xl mb-4">✓</div>
            <div className="text-2xl font-semibold">Complete!</div>
            <div className="text-lg mt-2">Video downloading...</div>
          </div>
        </div>
      )}
    </div>
  );
}

// Export memoized component to prevent unnecessary re-renders from parent
export default memo(VideoRecorder);
