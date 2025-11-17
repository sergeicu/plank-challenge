/**
 * Custom hook for MediaPipe Pose detection
 * Handles initialization, detection loop, and plank validation
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { PoseLandmarker, FilesetResolver, DrawingUtils } from '@mediapipe/tasks-vision';
import { PlankDetectionResult, detectPlankPosition } from '@/lib/poseDetection';

export interface UsePoseDetectionOptions {
  onPlankDetected?: () => void;
  onPlankLost?: () => void;
  enableDetection?: boolean;
  stabilityFrames?: number; // Number of consecutive frames needed to confirm detection
  gracePeriodFrames?: number; // Number of frames to wait before confirming plank lost
}

export interface UsePoseDetectionReturn {
  isReady: boolean;
  isProcessing: boolean;
  error: string | null;
  detectionResult: PlankDetectionResult | null;
  detectPose: (video: HTMLVideoElement) => void;
  reset: () => void;
}

export function usePoseDetection({
  onPlankDetected,
  onPlankLost,
  enableDetection = true,
  stabilityFrames = 5,
  gracePeriodFrames = 10,
}: UsePoseDetectionOptions = {}): UsePoseDetectionReturn {
  const [isReady, setIsReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detectionResult, setDetectionResult] = useState<PlankDetectionResult | null>(null);

  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const plankDetectedCountRef = useRef(0);
  const plankLostCountRef = useRef(0);
  const isPlankActiveRef = useRef(false);
  const lastDetectionTimeRef = useRef(0);

  // Initialize MediaPipe Pose
  useEffect(() => {
    if (!enableDetection) return;

    let mounted = true;

    async function initializePoseLandmarker() {
      try {
        setIsProcessing(true);

        // Load MediaPipe Pose
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
        );

        if (!mounted) return;

        const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numPoses: 1,
          minPoseDetectionConfidence: 0.3,
          minPosePresenceConfidence: 0.3,
          minTrackingConfidence: 0.3,
        });

        if (!mounted) return;

        poseLandmarkerRef.current = poseLandmarker;
        setIsReady(true);
        setIsProcessing(false);
      } catch (err) {
        console.error('Failed to initialize pose detection:', err);
        if (mounted) {
          setError('Failed to load pose detection. Please refresh the page.');
          setIsProcessing(false);
        }
      }
    }

    initializePoseLandmarker();

    return () => {
      mounted = false;
      if (poseLandmarkerRef.current) {
        poseLandmarkerRef.current.close();
        poseLandmarkerRef.current = null;
      }
    };
  }, [enableDetection]);

  // Detect pose from video frame
  const detectPose = useCallback((video: HTMLVideoElement) => {
    if (!poseLandmarkerRef.current || !isReady || !video) return;

    try {
      const now = performance.now();

      // Throttle detection to ~15 FPS for performance
      if (now - lastDetectionTimeRef.current < 66) return;
      lastDetectionTimeRef.current = now;

      // Detect pose landmarks
      const result = poseLandmarkerRef.current.detectForVideo(video, now);

      if (result.landmarks && result.landmarks.length > 0) {
        // Get first person's landmarks
        const landmarks = result.landmarks[0];

        // Detect if it's a plank position
        const plankResult = detectPlankPosition(landmarks);
        setDetectionResult(plankResult);

        // Handle plank detection with stability filter
        if (plankResult.isPlank) {
          plankDetectedCountRef.current++;
          plankLostCountRef.current = 0;

          // Confirm plank detected after consecutive frames
          if (
            !isPlankActiveRef.current &&
            plankDetectedCountRef.current >= stabilityFrames
          ) {
            isPlankActiveRef.current = true;
            onPlankDetected?.();
          }
        } else {
          plankLostCountRef.current++;
          plankDetectedCountRef.current = 0;

          // Confirm plank lost after grace period
          if (
            isPlankActiveRef.current &&
            plankLostCountRef.current >= gracePeriodFrames
          ) {
            isPlankActiveRef.current = false;
            onPlankLost?.();
          }
        }
      } else {
        // No person detected
        setDetectionResult({
          isPlank: false,
          confidence: 0,
          feedback: ['No person detected. Position yourself in frame.'],
        });

        plankLostCountRef.current++;
        plankDetectedCountRef.current = 0;

        // Confirm plank lost if was previously active
        if (
          isPlankActiveRef.current &&
          plankLostCountRef.current >= gracePeriodFrames
        ) {
          isPlankActiveRef.current = false;
          onPlankLost?.();
        }
      }
    } catch (err) {
      console.error('Error during pose detection:', err);
      setError('Detection error occurred');
    }
  }, [isReady, onPlankDetected, onPlankLost, stabilityFrames, gracePeriodFrames]);

  // Reset detection state
  const reset = useCallback(() => {
    plankDetectedCountRef.current = 0;
    plankLostCountRef.current = 0;
    isPlankActiveRef.current = false;
    setDetectionResult(null);
    setError(null);
  }, []);

  return {
    isReady,
    isProcessing,
    error,
    detectionResult,
    detectPose,
    reset,
  };
}
