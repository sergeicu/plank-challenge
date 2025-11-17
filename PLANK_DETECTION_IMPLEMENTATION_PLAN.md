# Plank Detection Implementation Plan
**Feature:** Automatic Plank Position Detection with MediaPipe Pose
**Date:** 2025-11-17
**Status:** Ready for Implementation

---

## Executive Summary

This document provides a comprehensive implementation plan for adding automatic plank detection to the Plank Timer app using MediaPipe Pose. The feature will:

- **Automatically start the timer** when a proper plank position is detected
- **Stop the timer** when the plank position is lost (user drops out of plank)
- **Transition to download mode** when timer stops
- Use **MediaPipe Pose landmarks** to detect body position and angles
- Provide **real-time visual feedback** during detection

---

## 1. Current Codebase Analysis

### 1.1 Project Structure

```
Plank-timer/
├── app/
│   ├── page.tsx                 # Main entry point, renders PlankTimer
│   ├── layout.tsx               # Root layout with metadata
│   └── globals.css              # Global styles
├── components/
│   ├── PlankTimer.tsx           # Main state manager (idle/recording/completed)
│   ├── VideoRecorder.tsx        # Handles camera, recording, timer overlay
│   └── RestDay.tsx              # Sunday rest day component
├── utils/
│   ├── timerLogic.ts            # Day calculation, duration calculation
│   └── videoRecorder.ts         # MediaRecorder wrapper, camera access
└── package.json                 # Dependencies: Next.js 16, React 19, date-fns
```

### 1.2 Tech Stack

- **Framework:** Next.js 16 (App Router)
- **UI Library:** React 19
- **Styling:** Tailwind CSS 4
- **Language:** TypeScript 5.9
- **Utilities:** date-fns for date calculations

### 1.3 Current Implementation

#### Camera & Recording Flow
1. User clicks "Start Recording" → VideoRecorder component mounts
2. Camera access requested (front-facing, 1280x720)
3. 3-second countdown displayed
4. Recording starts:
   - Video rendered to hidden `<video>` element
   - Canvas draws video frame + timer overlay at 30 FPS
   - Canvas stream captured with MediaRecorder
5. Timer counts up from 0 to target duration
6. At target duration: recording auto-stops, preview shown
7. User downloads video → completed state

#### State Management
- **AppState:** `'idle' | 'recording' | 'completed'` in PlankTimer.tsx
- **RecordingPhase:** `'preparing' | 'countdown' | 'recording' | 'preview' | 'completed'` in VideoRecorder.tsx
- Camera stream managed in useRef, cleaned up on unmount

#### Timer Logic
- Countdown: 3 seconds before recording starts
- Main timer: counts up from 0, auto-stops at target duration
- Target duration calculated daily (30s base + 6s per day since Nov 17, 2025)

### 1.4 Key Integration Points

To add plank detection, we need to modify:

1. **VideoRecorder.tsx:** Add pose detection loop alongside canvas rendering
2. **Timer control logic:** Change from countdown-based start to detection-based start/stop
3. **Visual feedback:** Add pose landmarks overlay to show detection status
4. **State machine:** Add new states for "waiting for plank" and "plank lost"

---

## 2. MediaPipe Pose Research Findings

### 2.1 Available Libraries

**Option 1: @mediapipe/tasks-vision (RECOMMENDED)**
- **Package:** `@mediapipe/tasks-vision`
- **Status:** Current official library (2025)
- **Advantages:**
  - Modern API with TypeScript support
  - Uses TensorFlow Lite (Wasm + WebGL/GPU)
  - Optimized for browser performance
  - 33 3D pose landmarks
  - Built-in drawing utilities
- **Browser Support:** Chrome 90+, Safari 14+, Firefox 88+
- **Bundle Size:** ~8-10 MB for Wasm model files (loaded on demand)

**Option 2: @mediapipe/pose (LEGACY)**
- Older API, still functional but less optimized
- Not recommended for new projects

### 2.2 MediaPipe Pose Landmarks

MediaPipe Pose detects **33 body landmarks** in 3D space (x, y, z coordinates + visibility score):

```
Key landmarks for plank detection:
0:  NOSE
11: LEFT_SHOULDER    12: RIGHT_SHOULDER
13: LEFT_ELBOW       14: RIGHT_ELBOW
15: LEFT_WRIST       16: RIGHT_WRIST
23: LEFT_HIP         24: RIGHT_HIP
25: LEFT_KNEE        26: RIGHT_KNEE
27: LEFT_ANKLE       28: RIGHT_ANKLE
31: LEFT_FOOT_INDEX  32: RIGHT_FOOT_INDEX
```

Each landmark provides:
- `x`: Horizontal position (0-1, normalized to image width)
- `y`: Vertical position (0-1, normalized to image height)
- `z`: Depth (relative to hips)
- `visibility`: Confidence score (0-1)

### 2.3 Plank Detection Algorithm

#### What defines a proper plank position?

A plank consists of:
1. **Body alignment:** Shoulders, hips, and ankles form a straight line
2. **Elbow position:** Elbows directly below shoulders (~90° shoulder-elbow-wrist angle)
3. **Hip height:** Hips not sagging (not too low) or piking (not too high)
4. **Body angle:** Torso roughly parallel to ground (slight incline acceptable)

#### Detection Criteria (Research-Based)

Based on research from pose detection systems:

**Primary Checks:**
1. **Shoulder-Hip-Ankle Angle:** 160-180° (straight body line)
2. **Shoulder-Elbow-Wrist Angle:** 70-110° (forearm plank position)
3. **Hip-Knee-Ankle Angle:** 160-180° (straight legs)
4. **Body Horizontal Angle:** 0-30° from horizontal plane

**Secondary Checks:**
1. **Visibility:** All key landmarks visible (confidence > 0.5)
2. **Stability:** Angle variations < 5° over 3 consecutive frames (reduces false positives)
3. **Height:** Wrists/Elbows below shoulders (ensures proper support position)

**Algorithm Pseudocode:**
```typescript
function isValidPlank(landmarks: PoseLandmark[]): boolean {
  // Extract key points
  const leftShoulder = landmarks[11];
  const rightShoulder = landmarks[12];
  const leftElbow = landmarks[13];
  const leftWrist = landmarks[15];
  const leftHip = landmarks[23];
  const rightHip = landmarks[24];
  const leftKnee = landmarks[25];
  const leftAnkle = landmarks[27];

  // Check visibility
  if (any landmark visibility < 0.5) return false;

  // Calculate angles
  const bodyAngle = calculateAngle(leftShoulder, leftHip, leftAnkle);
  const elbowAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);
  const legAngle = calculateAngle(leftHip, leftKnee, leftAnkle);

  // Check plank criteria
  const bodyAligned = bodyAngle >= 160 && bodyAngle <= 180;
  const elbowsCorrect = elbowAngle >= 70 && elbowAngle <= 110;
  const legsStrait = legAngle >= 160 && legAngle <= 180;

  return bodyAligned && elbowsCorrect && legsStrait;
}
```

**Stability Filter:**
To prevent false positives from brief movements:
```typescript
// Only trigger "plank detected" after 5 consecutive frames (~167ms at 30fps)
// Only trigger "plank lost" after 10 consecutive frames (~333ms)
```

### 2.4 Performance Characteristics

**Model Loading:**
- First load: ~2-3 seconds (downloads ~8MB Wasm + model files)
- Subsequent loads: Cached in browser

**Inference Speed:**
- Desktop: 30-60 FPS (16-33ms per frame)
- Mobile: 15-30 FPS (33-66ms per frame)
- Memory: ~50-100MB additional overhead

**Optimization Strategies:**
- Run pose detection at 15 FPS (every other frame) while canvas renders at 30 FPS
- Use lower resolution for detection (640x480) than recording (1280x720)
- Lazy-load model only when detection mode enabled

---

## 3. Implementation Design

### 3.1 Architectural Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        PlankTimer.tsx                            │
│  State: idle | detecting | recording | completed                │
│  Controls: Start Detection → Auto-start Timer → Auto-stop       │
└────────────────────┬────────────────────────────────────────────┘
                     │
        ┌────────────▼─────────────┐
        │  VideoRecorder.tsx       │
        │  + PoseDetector.tsx      │
        │  (new hook/component)    │
        └────────────┬─────────────┘
                     │
        ┌────────────▼─────────────────────────────────┐
        │  Parallel Processing:                        │
        │  1. Video → Canvas (30 FPS)                  │
        │  2. Canvas → Pose Detection (15 FPS)         │
        │  3. Pose Results → Timer Control             │
        │  4. Canvas → MediaRecorder                   │
        └──────────────────────────────────────────────┘
```

### 3.2 State Machine Enhancement

**Current States:**
```
idle → recording → completed
```

**New States with Plank Detection:**
```
idle
  → detecting (waiting for plank)
    → recording (plank held, timer running)
      → paused (plank lost temporarily) [optional]
        → recording (plank resumed) [optional]
      → completed (timer reached target OR plank lost for >5s)
```

**State Definitions:**

1. **idle:** Welcome screen, no camera active
2. **detecting:** Camera on, pose detection active, waiting for valid plank
   - Display: "Position yourself in plank to start"
   - Show: Live skeleton overlay with color-coded joints (red=bad, green=good)
3. **recording:** Valid plank detected, timer running
   - Timer counts up from 0
   - Display: Timer overlay + "Hold your plank!"
   - Continuously monitor pose, stop if lost
4. **paused (optional):** Plank lost briefly, give 3-second grace period
   - Display: "Hold your position!" warning
   - If plank resumed within 3s → continue recording
   - If not resumed → go to completed
5. **completed:** Recording stopped, video ready to download

### 3.3 User Flow Changes

#### Current Flow:
```
1. Click "Start Recording"
2. 3-second countdown
3. Timer runs for target duration
4. Auto-stop at target
5. Download video
```

#### New Flow with Detection:
```
1. Click "Start Detection Mode"
2. Camera activates with pose detection
3. User gets into plank position
4. System detects valid plank → Timer auto-starts
5. Timer runs while plank held
6. User completes target duration OR drops plank
   → Timer auto-stops
7. Download video
```

**Key UX Improvements:**
- No manual start needed - hands-free operation
- Real-time feedback on body position
- Automatic stop prevents recording after plank ends

### 3.4 Component Architecture

#### New File: hooks/usePoseDetection.ts

```typescript
import { PoseLandmarker, FilesetResolver, PoseLandmarkerResult } from '@mediapipe/tasks-vision';

interface PoseDetectionConfig {
  onPlankDetected: () => void;
  onPlankLost: () => void;
  minDetectionConfidence?: number; // default: 0.5
  minTrackingConfidence?: number;  // default: 0.5
  runningMode?: 'IMAGE' | 'VIDEO'; // default: 'VIDEO'
}

interface PoseDetectionResult {
  isPlankPosition: boolean;
  landmarks: PoseLandmark[] | null;
  angles: {
    bodyAngle: number;
    elbowAngle: number;
    legAngle: number;
  } | null;
}

export function usePoseDetection(config: PoseDetectionConfig) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isPlankDetected, setIsPlankDetected] = useState(false);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const consecutiveFramesRef = useRef({ plank: 0, noPlank: 0 });

  // Initialize MediaPipe
  async function initialize() { ... }

  // Detect pose from video frame
  async function detectPose(video: HTMLVideoElement): Promise<PoseDetectionResult> { ... }

  // Calculate angle between 3 points
  function calculateAngle(p1, p2, p3): number { ... }

  // Check if landmarks form a plank position
  function isValidPlank(landmarks): boolean { ... }

  // Cleanup
  function cleanup() { ... }

  return {
    initialize,
    detectPose,
    isInitialized,
    isPlankDetected,
    cleanup,
  };
}
```

#### Modified: components/VideoRecorder.tsx

**Key Changes:**

1. **Import pose detection:**
   ```typescript
   import { usePoseDetection } from '@/hooks/usePoseDetection';
   ```

2. **Add new state:**
   ```typescript
   const [poseResult, setPoseResult] = useState<PoseDetectionResult | null>(null);
   const [isDetectionMode, setIsDetectionMode] = useState(true); // New prop
   ```

3. **Initialize pose detector:**
   ```typescript
   const { initialize, detectPose, cleanup } = usePoseDetection({
     onPlankDetected: handlePlankDetected,
     onPlankLost: handlePlankLost,
   });

   useEffect(() => {
     if (isDetectionMode) {
       initialize();
     }
     return () => cleanup();
   }, [isDetectionMode]);
   ```

4. **Add detection loop (runs parallel to canvas rendering):**
   ```typescript
   useEffect(() => {
     if (phase !== 'detecting' && phase !== 'recording') return;
     if (!videoRef.current) return;

     let lastDetectionTime = 0;
     const DETECTION_INTERVAL = 66; // ~15 FPS (every 66ms)

     const runDetection = async () => {
       const now = Date.now();
       if (now - lastDetectionTime < DETECTION_INTERVAL) {
         requestAnimationFrame(runDetection);
         return;
       }

       lastDetectionTime = now;
       const result = await detectPose(videoRef.current!);
       setPoseResult(result);

       if (phase === 'detecting' && result.isPlankPosition) {
         // Start recording
         setPhase('recording');
       } else if (phase === 'recording' && !result.isPlankPosition) {
         // Stop recording (plank lost)
         handlePlankLost();
       }

       requestAnimationFrame(runDetection);
     };

     runDetection();
   }, [phase, detectPose]);
   ```

5. **Update canvas rendering to include pose overlay:**
   ```typescript
   const drawFrame = () => {
     // Existing: Draw video frame
     ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

     // New: Draw pose landmarks if available
     if (poseResult?.landmarks) {
       drawPoseLandmarks(ctx, poseResult.landmarks, canvas.width, canvas.height);
     }

     // Existing: Draw timer overlay (if recording)
     if (phase === 'recording') {
       drawTimerOverlay(ctx, ...);
     }

     // New: Draw detection feedback (if detecting)
     if (phase === 'detecting') {
       drawDetectionFeedback(ctx, poseResult);
     }

     animationFrameRef.current = requestAnimationFrame(drawFrame);
   };
   ```

6. **Add visual feedback functions:**
   ```typescript
   function drawPoseLandmarks(
     ctx: CanvasRenderingContext2D,
     landmarks: PoseLandmark[],
     width: number,
     height: number
   ) {
     // Draw skeleton connections
     const connections = [
       [11, 13], [13, 15], // Left arm
       [12, 14], [14, 16], // Right arm
       [11, 23], [23, 25], [25, 27], // Left side
       [12, 24], [24, 26], [26, 28], // Right side
       [23, 24], // Hips
     ];

     ctx.lineWidth = 3;

     connections.forEach(([start, end]) => {
       const p1 = landmarks[start];
       const p2 = landmarks[end];

       // Color based on plank validity
       ctx.strokeStyle = poseResult?.isPlankPosition
         ? 'rgba(0, 255, 0, 0.8)' // Green if good plank
         : 'rgba(255, 0, 0, 0.8)'; // Red if not

       ctx.beginPath();
       ctx.moveTo(p1.x * width, p1.y * height);
       ctx.lineTo(p2.x * width, p2.y * height);
       ctx.stroke();
     });

     // Draw landmark points
     landmarks.forEach((landmark, i) => {
       // Only draw key points
       if (![11,12,13,14,15,16,23,24,25,26,27,28].includes(i)) return;

       ctx.fillStyle = poseResult?.isPlankPosition
         ? 'rgba(0, 255, 0, 0.9)'
         : 'rgba(255, 0, 0, 0.9)';
       ctx.beginPath();
       ctx.arc(landmark.x * width, landmark.y * height, 5, 0, 2 * Math.PI);
       ctx.fill();
     });
   }

   function drawDetectionFeedback(
     ctx: CanvasRenderingContext2D,
     result: PoseDetectionResult | null
   ) {
     const text = result?.isPlankPosition
       ? 'PLANK DETECTED - Starting...'
       : 'Position yourself in plank';

     const bgColor = result?.isPlankPosition
       ? 'rgba(0, 255, 0, 0.8)'
       : 'rgba(255, 165, 0, 0.8)';

     ctx.fillStyle = bgColor;
     ctx.fillRect(20, 20, 400, 60);

     ctx.font = 'bold 24px sans-serif';
     ctx.fillStyle = '#000';
     ctx.fillText(text, 30, 55);

     // Show angle feedback
     if (result?.angles) {
       ctx.font = '16px monospace';
       ctx.fillStyle = '#fff';
       ctx.fillText(`Body: ${result.angles.bodyAngle.toFixed(0)}°`, 30, 90);
       ctx.fillText(`Elbow: ${result.angles.elbowAngle.toFixed(0)}°`, 30, 110);
     }
   }
   ```

---

## 4. Detailed Implementation Steps

### Phase 1: Setup & Dependencies (1-2 hours)

**Step 1.1: Install MediaPipe Package**

```bash
cd /Users/jordantian/Documents/Plank-timer
npm install @mediapipe/tasks-vision
```

**Step 1.2: Add Type Definitions**

Create `types/mediapipe.d.ts` (if needed):
```typescript
declare module '@mediapipe/tasks-vision' {
  export interface PoseLandmark {
    x: number;
    y: number;
    z: number;
    visibility: number;
  }

  export interface PoseLandmarkerResult {
    landmarks: PoseLandmark[][];
    worldLandmarks: PoseLandmark[][];
  }

  export class PoseLandmarker {
    static createFromOptions(
      wasmFileset: any,
      options: PoseLandmarkerOptions
    ): Promise<PoseLandmarker>;

    detectForVideo(
      video: HTMLVideoElement,
      timestamp: number
    ): PoseLandmarkerResult;

    close(): void;
  }

  export interface PoseLandmarkerOptions {
    baseOptions: {
      modelAssetPath: string;
      delegate: 'GPU' | 'CPU';
    };
    runningMode: 'IMAGE' | 'VIDEO';
    numPoses: number;
    minPoseDetectionConfidence: number;
    minPosePresenceConfidence: number;
    minTrackingConfidence: number;
  }

  export class FilesetResolver {
    static forVisionTasks(wasmPath: string): Promise<any>;
  }
}
```

**Step 1.3: Download Model Files**

MediaPipe will auto-download models on first use, but for production:
- Host model files in `/public/models/` folder
- Or use CDN: `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm`

---

### Phase 2: Create Pose Detection Hook (3-4 hours)

**File: `/hooks/usePoseDetection.ts`**

```typescript
'use client';

import { useRef, useState, useCallback } from 'react';
import {
  PoseLandmarker,
  FilesetResolver,
  PoseLandmarkerResult,
  PoseLandmark,
} from '@mediapipe/tasks-vision';

// Landmark indices
const LANDMARKS = {
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
};

interface PoseAngles {
  bodyAngle: number;      // Shoulder-Hip-Ankle
  elbowAngle: number;     // Shoulder-Elbow-Wrist
  legAngle: number;       // Hip-Knee-Ankle
  horizontalAngle: number; // Torso angle from horizontal
}

export interface PoseDetectionResult {
  isPlankPosition: boolean;
  landmarks: PoseLandmark[] | null;
  angles: PoseAngles | null;
  confidence: number;
}

interface UsePoseDetectionConfig {
  minDetectionConfidence?: number;
  minTrackingConfidence?: number;
  onPlankDetected?: () => void;
  onPlankLost?: () => void;
  stabilityFrames?: number; // Frames to confirm plank detected/lost
}

export function usePoseDetection(config: UsePoseDetectionConfig = {}) {
  const {
    minDetectionConfidence = 0.5,
    minTrackingConfidence = 0.5,
    onPlankDetected,
    onPlankLost,
    stabilityFrames = 5,
  } = config;

  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Stability tracking
  const consecutivePlankFrames = useRef(0);
  const consecutiveNoPlankFrames = useRef(0);
  const [isInPlankState, setIsInPlankState] = useState(false);

  /**
   * Initialize MediaPipe Pose Landmarker
   */
  const initialize = useCallback(async () => {
    if (isInitialized || isLoading) return;

    setIsLoading(true);
    setError(null);

    try {
      // Load Wasm files
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
      );

      // Create pose landmarker
      const landmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
          delegate: 'GPU',
        },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence,
        minPosePresenceConfidence: minDetectionConfidence,
        minTrackingConfidence,
      });

      poseLandmarkerRef.current = landmarker;
      setIsInitialized(true);
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to initialize pose detector:', err);
      setError(err instanceof Error ? err.message : 'Failed to initialize');
      setIsLoading(false);
    }
  }, [isInitialized, isLoading, minDetectionConfidence, minTrackingConfidence]);

  /**
   * Calculate angle between three points
   */
  const calculateAngle = (
    p1: PoseLandmark,
    p2: PoseLandmark,
    p3: PoseLandmark
  ): number => {
    const radians =
      Math.atan2(p3.y - p2.y, p3.x - p2.x) -
      Math.atan2(p1.y - p2.y, p1.x - p2.x);
    let angle = Math.abs((radians * 180.0) / Math.PI);

    if (angle > 180) {
      angle = 360 - angle;
    }

    return angle;
  };

  /**
   * Check if all required landmarks are visible
   */
  const hasRequiredLandmarks = (landmarks: PoseLandmark[]): boolean => {
    const requiredIndices = [
      LANDMARKS.LEFT_SHOULDER,
      LANDMARKS.LEFT_ELBOW,
      LANDMARKS.LEFT_WRIST,
      LANDMARKS.LEFT_HIP,
      LANDMARKS.LEFT_KNEE,
      LANDMARKS.LEFT_ANKLE,
    ];

    return requiredIndices.every(
      (idx) => landmarks[idx] && landmarks[idx].visibility > 0.5
    );
  };

  /**
   * Calculate all relevant angles for plank detection
   */
  const calculateAngles = (landmarks: PoseLandmark[]): PoseAngles => {
    const bodyAngle = calculateAngle(
      landmarks[LANDMARKS.LEFT_SHOULDER],
      landmarks[LANDMARKS.LEFT_HIP],
      landmarks[LANDMARKS.LEFT_ANKLE]
    );

    const elbowAngle = calculateAngle(
      landmarks[LANDMARKS.LEFT_SHOULDER],
      landmarks[LANDMARKS.LEFT_ELBOW],
      landmarks[LANDMARKS.LEFT_WRIST]
    );

    const legAngle = calculateAngle(
      landmarks[LANDMARKS.LEFT_HIP],
      landmarks[LANDMARKS.LEFT_KNEE],
      landmarks[LANDMARKS.LEFT_ANKLE]
    );

    // Calculate horizontal angle (torso relative to ground)
    const shoulder = landmarks[LANDMARKS.LEFT_SHOULDER];
    const hip = landmarks[LANDMARKS.LEFT_HIP];
    const horizontalAngle = Math.abs(
      Math.atan2(hip.y - shoulder.y, hip.x - shoulder.x) * (180 / Math.PI)
    );

    return { bodyAngle, elbowAngle, legAngle, horizontalAngle };
  };

  /**
   * Check if the detected pose is a valid plank position
   */
  const isValidPlank = (landmarks: PoseLandmark[]): boolean => {
    if (!hasRequiredLandmarks(landmarks)) {
      return false;
    }

    const angles = calculateAngles(landmarks);

    // Plank criteria:
    // 1. Body roughly straight (160-180°)
    const bodyAligned = angles.bodyAngle >= 160 && angles.bodyAngle <= 180;

    // 2. Elbows bent at ~90° (70-110° for forearm plank)
    const elbowsCorrect = angles.elbowAngle >= 70 && angles.elbowAngle <= 110;

    // 3. Legs straight (160-180°)
    const legsStrait = angles.legAngle >= 160 && angles.legAngle <= 180;

    // 4. Body roughly horizontal (0-30° from ground)
    const bodyHorizontal = angles.horizontalAngle <= 30;

    // 5. Wrists below shoulders (proper support position)
    const wristBelowShoulder =
      landmarks[LANDMARKS.LEFT_WRIST].y >
      landmarks[LANDMARKS.LEFT_SHOULDER].y;

    return (
      bodyAligned &&
      elbowsCorrect &&
      legsStrait &&
      bodyHorizontal &&
      wristBelowShoulder
    );
  };

  /**
   * Detect pose from video frame
   */
  const detectPose = useCallback(
    async (video: HTMLVideoElement): Promise<PoseDetectionResult> => {
      if (!poseLandmarkerRef.current || !isInitialized) {
        return {
          isPlankPosition: false,
          landmarks: null,
          angles: null,
          confidence: 0,
        };
      }

      try {
        const timestamp = performance.now();
        const result = poseLandmarkerRef.current.detectForVideo(video, timestamp);

        if (!result.landmarks || result.landmarks.length === 0) {
          // No pose detected
          return {
            isPlankPosition: false,
            landmarks: null,
            angles: null,
            confidence: 0,
          };
        }

        const landmarks = result.landmarks[0];
        const isPlank = isValidPlank(landmarks);
        const angles = hasRequiredLandmarks(landmarks)
          ? calculateAngles(landmarks)
          : null;

        // Calculate average confidence
        const avgConfidence =
          landmarks.reduce((sum, lm) => sum + lm.visibility, 0) /
          landmarks.length;

        // Stability check
        if (isPlank) {
          consecutivePlankFrames.current++;
          consecutiveNoPlankFrames.current = 0;

          if (
            consecutivePlankFrames.current >= stabilityFrames &&
            !isInPlankState
          ) {
            setIsInPlankState(true);
            onPlankDetected?.();
          }
        } else {
          consecutiveNoPlankFrames.current++;
          consecutivePlankFrames.current = 0;

          if (
            consecutiveNoPlankFrames.current >= stabilityFrames * 2 &&
            isInPlankState
          ) {
            setIsInPlankState(false);
            onPlankLost?.();
          }
        }

        return {
          isPlankPosition: isPlank,
          landmarks,
          angles,
          confidence: avgConfidence,
        };
      } catch (err) {
        console.error('Pose detection error:', err);
        return {
          isPlankPosition: false,
          landmarks: null,
          angles: null,
          confidence: 0,
        };
      }
    },
    [
      isInitialized,
      stabilityFrames,
      isInPlankState,
      onPlankDetected,
      onPlankLost,
    ]
  );

  /**
   * Cleanup resources
   */
  const cleanup = useCallback(() => {
    if (poseLandmarkerRef.current) {
      poseLandmarkerRef.current.close();
      poseLandmarkerRef.current = null;
    }
    setIsInitialized(false);
    setIsInPlankState(false);
    consecutivePlankFrames.current = 0;
    consecutiveNoPlankFrames.current = 0;
  }, []);

  return {
    initialize,
    detectPose,
    cleanup,
    isInitialized,
    isLoading,
    error,
    isInPlankState,
  };
}
```

---

### Phase 3: Integrate with VideoRecorder Component (4-5 hours)

**Modifications to `/components/VideoRecorder.tsx`:**

**3.1: Add imports and props**

```typescript
// Add to imports
import { usePoseDetection, PoseDetectionResult } from '@/hooks/usePoseDetection';

// Add to props interface
interface VideoRecorderProps {
  targetDuration: number;
  onComplete: () => void;
  onError: (error: string) => void;
  enablePoseDetection?: boolean; // NEW: Toggle detection mode
}

// Update component signature
export default function VideoRecorder({
  targetDuration,
  onComplete,
  onError,
  enablePoseDetection = false // NEW: default to false for backward compatibility
}: VideoRecorderProps) {
```

**3.2: Add pose detection state**

```typescript
// Add after existing state declarations
const [poseResult, setPoseResult] = useState<PoseDetectionResult | null>(null);

// Initialize pose detection hook
const {
  initialize: initializePose,
  detectPose,
  cleanup: cleanupPose,
  isInitialized: isPoseInitialized,
  isLoading: isPoseLoading,
  error: poseError,
  isInPlankState,
} = usePoseDetection({
  onPlankDetected: handlePlankDetected,
  onPlankLost: handlePlankLost,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
  stabilityFrames: 5,
});
```

**3.3: Add plank detection handlers**

```typescript
// Add new handler functions
const handlePlankDetected = useCallback(() => {
  console.log('Plank detected! Starting timer...');
  if (phase === 'detecting') {
    setPhase('recording');
    startTimeRef.current = Date.now();
  }
}, [phase]);

const handlePlankLost = useCallback(() => {
  console.log('Plank lost! Stopping timer...');
  if (phase === 'recording') {
    stopRecording();
  }
}, [phase]);
```

**3.4: Update initialization useEffect**

```typescript
// Modify existing camera setup useEffect
useEffect(() => {
  let mounted = true;

  async function setupCamera() {
    try {
      const stream = await getCameraStream();

      if (!mounted) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      // Wait for video metadata
      await new Promise<void>((resolve) => {
        if (videoRef.current) {
          videoRef.current.onloadedmetadata = () => resolve();
        }
      });

      // NEW: Initialize pose detection if enabled
      if (enablePoseDetection && mounted) {
        await initializePose();
      }

      // NEW: Start in detecting mode if pose detection enabled
      if (mounted) {
        setPhase(enablePoseDetection ? 'detecting' : 'countdown');
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
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    // NEW: Cleanup pose detection
    if (enablePoseDetection) {
      cleanupPose();
    }
  };
}, [onError, enablePoseDetection, initializePose, cleanupPose]);
```

**3.5: Add pose detection loop**

```typescript
// NEW: Pose detection loop (runs parallel to canvas rendering)
useEffect(() => {
  if (!enablePoseDetection) return;
  if (phase !== 'detecting' && phase !== 'recording') return;
  if (!videoRef.current || !isPoseInitialized) return;

  let animationId: number;
  let lastDetectionTime = 0;
  const DETECTION_INTERVAL = 66; // ~15 FPS

  const runDetection = async () => {
    const now = performance.now();

    if (now - lastDetectionTime >= DETECTION_INTERVAL && videoRef.current) {
      lastDetectionTime = now;

      try {
        const result = await detectPose(videoRef.current);
        setPoseResult(result);
      } catch (err) {
        console.error('Detection error:', err);
      }
    }

    animationId = requestAnimationFrame(runDetection);
  };

  runDetection();

  return () => {
    if (animationId) {
      cancelAnimationFrame(animationId);
    }
  };
}, [
  enablePoseDetection,
  phase,
  isPoseInitialized,
  detectPose,
]);
```

**3.6: Update canvas rendering to include pose overlay**

```typescript
// Modify existing drawFrame function
const drawFrame = () => {
  if (!ctx || !video) return;
  if (phase !== 'countdown' && phase !== 'detecting' && phase !== 'recording') return;

  // Draw video frame
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  // NEW: Draw pose landmarks if detection enabled
  if (enablePoseDetection && poseResult?.landmarks) {
    drawPoseLandmarks(
      ctx,
      poseResult.landmarks,
      canvas.width,
      canvas.height,
      poseResult.isPlankPosition
    );
  }

  // Draw timer overlay (if recording)
  if (phase === 'recording') {
    const elapsed = Math.floor((Date.now() - (startTimeRef.current || 0)) / 1000);
    setElapsedTime(elapsed);
    drawTimerOverlay(ctx, canvas.width, canvas.height, elapsed);

    // Check if target duration reached
    if (elapsed >= targetDuration) {
      const finalFrame = canvas.toDataURL('image/png');
      setFinalFrameData(finalFrame);
      stopRecording();
      return;
    }
  }

  // NEW: Draw detection feedback (if detecting)
  if (phase === 'detecting' && poseResult) {
    drawDetectionFeedback(ctx, canvas.width, canvas.height, poseResult);
  }

  animationFrameRef.current = requestAnimationFrame(drawFrame);
};
```

**3.7: Add visual feedback functions**

```typescript
// NEW: Draw pose skeleton overlay
function drawPoseLandmarks(
  ctx: CanvasRenderingContext2D,
  landmarks: any[],
  width: number,
  height: number,
  isValidPlank: boolean
) {
  // Define skeleton connections
  const connections = [
    [11, 13], [13, 15], // Left arm
    [12, 14], [14, 16], // Right arm
    [11, 12], // Shoulders
    [11, 23], [12, 24], // Torso
    [23, 24], // Hips
    [23, 25], [25, 27], // Left leg
    [24, 26], [26, 28], // Right leg
  ];

  // Draw connections
  ctx.lineWidth = 4;
  ctx.strokeStyle = isValidPlank
    ? 'rgba(0, 255, 0, 0.8)'
    : 'rgba(255, 100, 100, 0.8)';

  connections.forEach(([start, end]) => {
    const p1 = landmarks[start];
    const p2 = landmarks[end];

    if (p1 && p2 && p1.visibility > 0.5 && p2.visibility > 0.5) {
      ctx.beginPath();
      ctx.moveTo(p1.x * width, p1.y * height);
      ctx.lineTo(p2.x * width, p2.y * height);
      ctx.stroke();
    }
  });

  // Draw landmark points
  const keyPoints = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
  ctx.fillStyle = isValidPlank
    ? 'rgba(0, 255, 0, 0.9)'
    : 'rgba(255, 100, 100, 0.9)';

  keyPoints.forEach((idx) => {
    const point = landmarks[idx];
    if (point && point.visibility > 0.5) {
      ctx.beginPath();
      ctx.arc(point.x * width, point.y * height, 6, 0, 2 * Math.PI);
      ctx.fill();
    }
  });
}

// NEW: Draw detection feedback overlay
function drawDetectionFeedback(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  result: PoseDetectionResult
) {
  const { isPlankPosition, angles } = result;

  // Background box
  const boxWidth = width * 0.9;
  const boxHeight = 120;
  const boxX = (width - boxWidth) / 2;
  const boxY = 20;

  ctx.fillStyle = isPlankPosition
    ? 'rgba(0, 200, 0, 0.85)'
    : 'rgba(255, 165, 0, 0.85)';
  ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

  // Main message
  ctx.font = 'bold 32px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  const message = isPlankPosition
    ? '✓ PLANK DETECTED - Hold position!'
    : 'Position yourself in plank';
  ctx.fillText(message, width / 2, boxY + 45);

  // Angle feedback (if available)
  if (angles) {
    ctx.font = '18px monospace';
    ctx.textAlign = 'left';
    const angleY = boxY + 75;
    const spacing = boxWidth / 4;

    // Body alignment
    const bodyColor = angles.bodyAngle >= 160 ? '#fff' : '#ff0';
    ctx.fillStyle = bodyColor;
    ctx.fillText(
      `Body: ${angles.bodyAngle.toFixed(0)}°`,
      boxX + 20,
      angleY
    );

    // Elbow angle
    const elbowColor =
      angles.elbowAngle >= 70 && angles.elbowAngle <= 110 ? '#fff' : '#ff0';
    ctx.fillStyle = elbowColor;
    ctx.fillText(
      `Elbow: ${angles.elbowAngle.toFixed(0)}°`,
      boxX + spacing + 20,
      angleY
    );

    // Leg angle
    const legColor = angles.legAngle >= 160 ? '#fff' : '#ff0';
    ctx.fillStyle = legColor;
    ctx.fillText(
      `Legs: ${angles.legAngle.toFixed(0)}°`,
      boxX + spacing * 2 + 20,
      angleY
    );
  }

  // Loading indicator if no pose detected yet
  if (!angles) {
    ctx.font = '20px sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText('Detecting pose...', width / 2, boxY + 80);
  }
}
```

**3.8: Update phase type to include 'detecting'**

```typescript
// Modify type definition at top of file
type RecordingPhase = 'preparing' | 'detecting' | 'countdown' | 'recording' | 'preview' | 'completed';
```

**3.9: Add detecting overlay in JSX**

```typescript
// Add to JSX before existing countdown overlay
{/* Detecting overlay (NEW) */}
{phase === 'detecting' && (
  <div className="absolute inset-0 flex items-center justify-center">
    {isPoseLoading && (
      <div className="text-white text-2xl font-semibold bg-black bg-opacity-50 px-8 py-4 rounded-lg">
        Loading pose detector...
      </div>
    )}
  </div>
)}
```

---

### Phase 4: Update PlankTimer Component (1-2 hours)

**Modifications to `/components/PlankTimer.tsx`:**

**4.1: Add detection mode toggle**

```typescript
// Add state for detection mode
const [detectionMode, setDetectionMode] = useState(true); // Default to detection mode

// Add UI toggle (optional, for testing)
<div className="mb-4">
  <label className="flex items-center justify-center space-x-2">
    <input
      type="checkbox"
      checked={detectionMode}
      onChange={(e) => setDetectionMode(e.target.checked)}
      className="w-5 h-5"
    />
    <span className="text-gray-700 font-medium">
      Enable Auto-Detection Mode
    </span>
  </label>
  <p className="text-sm text-gray-500 text-center mt-1">
    Timer will start automatically when plank position is detected
  </p>
</div>
```

**4.2: Pass detection mode to VideoRecorder**

```typescript
{/* Recording State */}
{appState === 'recording' && (
  <VideoRecorder
    targetDuration={targetDuration}
    onComplete={handleComplete}
    onError={handleError}
    enablePoseDetection={detectionMode} // NEW
  />
)}
```

**4.3: Update button text based on mode**

```typescript
<button
  onClick={handleStart}
  className="w-full py-4 bg-purple-600 text-white text-xl font-bold rounded-xl hover:bg-purple-700 transition-colors shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95"
>
  {detectionMode ? 'Start Detection Mode' : 'Start Recording'}
</button>
```

---

### Phase 5: Testing & Refinement (2-3 hours)

**5.1: Unit Tests**

Create `/hooks/__tests__/usePoseDetection.test.ts`:
```typescript
import { renderHook, act } from '@testing-library/react';
import { usePoseDetection } from '../usePoseDetection';

describe('usePoseDetection', () => {
  it('initializes correctly', async () => {
    const { result } = renderHook(() => usePoseDetection());

    await act(async () => {
      await result.current.initialize();
    });

    expect(result.current.isInitialized).toBe(true);
  });

  // Add more tests...
});
```

**5.2: Integration Testing Checklist**

- [ ] Camera initializes correctly in detection mode
- [ ] Pose landmarks render on video feed
- [ ] Plank detection triggers timer start after 5 frames (~167ms)
- [ ] Timer stops when plank position is lost
- [ ] Video recording includes pose overlay
- [ ] Download works correctly with detection mode
- [ ] Performance: 15+ FPS detection on target devices
- [ ] Memory: No leaks after multiple sessions
- [ ] Error handling: Graceful degradation if MediaPipe fails to load

**5.3: Browser Compatibility Testing**

Test on:
- **Chrome Desktop:** 90+ (primary target)
- **Safari Desktop:** 14+ (WebGL support required)
- **Chrome Android:** 90+ (mobile primary)
- **Safari iOS:** 14+ (mobile primary)
- **Firefox:** 88+ (secondary)

**5.4: Performance Optimization**

If performance issues arise:

1. **Reduce detection frequency:** Change from 15 FPS to 10 FPS
   ```typescript
   const DETECTION_INTERVAL = 100; // 10 FPS instead of 15
   ```

2. **Use lower resolution for detection:**
   ```typescript
   // Scale video down for detection
   const detectionCanvas = document.createElement('canvas');
   detectionCanvas.width = 640;
   detectionCanvas.height = 480;
   const dCtx = detectionCanvas.getContext('2d');
   dCtx.drawImage(video, 0, 0, 640, 480);
   // Run detection on scaled canvas
   ```

3. **Reduce model complexity:**
   ```typescript
   // Use 'pose_landmarker_lite' instead of 'pose_landmarker_full'
   modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'
   ```

4. **Lazy-load MediaPipe:**
   ```typescript
   // Only load when user clicks "Enable Detection"
   const loadMediaPipe = dynamic(() => import('@mediapipe/tasks-vision'), {
     ssr: false,
     loading: () => <LoadingSpinner />
   });
   ```

---

## 5. Technical Challenges & Solutions

### Challenge 1: Model Loading Time

**Problem:** MediaPipe models are ~8-10MB, can take 2-3 seconds to load on slow connections.

**Solutions:**
1. **Preload on app initialization:**
   ```typescript
   // In app/layout.tsx or page.tsx
   useEffect(() => {
     // Preload MediaPipe
     const link = document.createElement('link');
     link.rel = 'preload';
     link.as = 'fetch';
     link.href = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
     document.head.appendChild(link);
   }, []);
   ```

2. **Show loading indicator:**
   ```typescript
   {isPoseLoading && (
     <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
       <div className="bg-white rounded-lg p-6 text-center">
         <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-purple-600 mx-auto mb-4"></div>
         <p className="text-lg font-semibold">Loading pose detector...</p>
         <p className="text-sm text-gray-500 mt-2">This may take a few seconds</p>
       </div>
     </div>
   )}
   ```

3. **Cache models locally (PWA):**
   - Use Service Worker to cache model files
   - Subsequent loads will be instant

### Challenge 2: False Positives/Negatives

**Problem:** Pose detection might incorrectly identify plank position or miss valid planks.

**Solutions:**

1. **Stability filter (already implemented):**
   - Require 5 consecutive frames to confirm plank detected
   - Require 10 consecutive frames to confirm plank lost
   - Reduces jitter from momentary misdetections

2. **Adjustable thresholds:**
   ```typescript
   // Allow users to adjust sensitivity
   interface DetectionSettings {
     bodyAngleMin: number;    // default: 160
     bodyAngleMax: number;    // default: 180
     elbowAngleMin: number;   // default: 70
     elbowAngleMax: number;   // default: 110
     stabilityFrames: number; // default: 5
   }

   // Add UI controls in settings menu
   ```

3. **Visual feedback:**
   - Show color-coded skeleton (green = good, red = needs adjustment)
   - Display angle values in real-time
   - Users can self-correct based on feedback

4. **Calibration mode:**
   ```typescript
   // Optional: Let user calibrate their "perfect plank"
   function calibratePlankPosition(landmarks: PoseLandmark[]) {
     // Record user's plank position as reference
     // Adjust thresholds based on their body proportions
   }
   ```

### Challenge 3: Performance on Mobile Devices

**Problem:** Older mobile devices may struggle with real-time pose detection at 15 FPS.

**Solutions:**

1. **Adaptive frame rate:**
   ```typescript
   const [detectionFPS, setDetectionFPS] = useState(15);

   useEffect(() => {
     // Measure actual FPS
     let frameCount = 0;
     const startTime = Date.now();

     const measurePerformance = () => {
       frameCount++;
       const elapsed = Date.now() - startTime;

       if (elapsed > 2000) {
         const actualFPS = (frameCount / elapsed) * 1000;

         // If struggling, reduce detection frequency
         if (actualFPS < 10) {
           setDetectionFPS(8); // Reduce to 8 FPS
         }
       }
     };

     // Call in detection loop
   }, []);
   ```

2. **Device-specific settings:**
   ```typescript
   const isMobile = /iPhone|iPad|Android/i.test(navigator.userAgent);
   const isLowEnd = navigator.hardwareConcurrency <= 4;

   const detectionConfig = {
     fps: isLowEnd ? 10 : 15,
     modelPath: isLowEnd
       ? 'pose_landmarker_lite'  // Use lite model
       : 'pose_landmarker_full',
   };
   ```

3. **Fallback to manual mode:**
   ```typescript
   // If detection fails or is too slow, offer manual mode
   if (poseError || averageFPS < 5) {
     return (
       <div className="alert">
         <p>Pose detection is running slow on your device.</p>
         <button onClick={() => setDetectionMode(false)}>
           Switch to Manual Mode
         </button>
       </div>
     );
   }
   ```

### Challenge 4: Camera Angle & Positioning

**Problem:** Users need to position camera correctly to capture full body in frame.

**Solutions:**

1. **Setup guide:**
   ```typescript
   // Add setup screen before detection starts
   <div className="setup-guide">
     <h3>Camera Setup</h3>
     <ul>
       <li>Place phone/camera 3-4 feet away</li>
       <li>Position at chest height</li>
       <li>Ensure full body is visible in frame</li>
       <li>Use landscape orientation (optional)</li>
     </ul>
     <img src="/plank-setup-guide.png" alt="Setup example" />
     <button onClick={startDetection}>I'm Ready</button>
   </div>
   ```

2. **Real-time framing feedback:**
   ```typescript
   function checkFraming(landmarks: PoseLandmark[]): string[] {
     const warnings = [];

     // Check if body is centered
     const centerX = (landmarks[11].x + landmarks[12].x) / 2;
     if (centerX < 0.3 || centerX > 0.7) {
       warnings.push('Move closer to center of frame');
     }

     // Check if full body is visible
     const headVisible = landmarks[0].visibility > 0.5;
     const feetVisible = landmarks[31].visibility > 0.5 && landmarks[32].visibility > 0.5;

     if (!headVisible) warnings.push('Move camera to show your head');
     if (!feetVisible) warnings.push('Move camera to show your feet');

     // Check if too close/far
     const bodyHeight = Math.abs(landmarks[0].y - landmarks[31].y);
     if (bodyHeight > 0.9) warnings.push('Move camera farther away');
     if (bodyHeight < 0.5) warnings.push('Move camera closer');

     return warnings;
   }

   // Display warnings in UI
   {framingWarnings.map(warning => (
     <div className="warning-badge">{warning}</div>
   ))}
   ```

3. **Guide overlay:**
   ```typescript
   // Draw human silhouette outline on canvas as guide
   function drawFramingGuide(ctx: CanvasRenderingContext2D, width: number, height: number) {
     ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
     ctx.lineWidth = 2;
     ctx.setLineDash([10, 5]);

     // Draw oval outline where body should fit
     ctx.beginPath();
     ctx.ellipse(width / 2, height / 2, width * 0.3, height * 0.4, 0, 0, 2 * Math.PI);
     ctx.stroke();

     ctx.setLineDash([]);
   }
   ```

### Challenge 5: Privacy & Data Security

**Problem:** Users may be concerned about video data being sent to external servers.

**Solutions:**

1. **100% Client-Side Processing:**
   - Clearly state: "All pose detection happens locally in your browser"
   - No video data sent to servers
   - MediaPipe runs entirely client-side (Wasm)

2. **Privacy policy notice:**
   ```typescript
   <div className="privacy-notice mb-4 p-3 bg-blue-50 rounded border border-blue-200">
     <p className="text-sm text-blue-800">
       🔒 Your privacy is protected: All pose detection runs locally in your browser.
       No video data is sent to external servers.
     </p>
   </div>
   ```

3. **Optional feature:**
   - Make detection mode opt-in
   - Keep manual mode as default option
   - Allow users to choose their comfort level

---

## 6. Testing Strategy

### 6.1 Unit Tests

**Test Files to Create:**

1. **/hooks/__tests__/usePoseDetection.test.ts**
   - Test initialization
   - Test angle calculation
   - Test plank validation logic
   - Test stability filter

2. **/utils/__tests__/poseHelpers.test.ts** (if you extract helpers)
   - Test landmark visibility checks
   - Test angle threshold validation

### 6.2 Integration Tests

**Scenarios:**

1. **Happy Path:**
   - User clicks "Start Detection"
   - Camera initializes
   - User gets into plank
   - Plank detected after 5 frames
   - Timer starts
   - User holds plank for target duration
   - Timer stops, video downloads

2. **Plank Lost Mid-Session:**
   - Timer running
   - User drops out of plank
   - Plank lost detected after 10 frames
   - Timer stops
   - Video downloads with elapsed time

3. **False Start:**
   - User clicks start but not in plank yet
   - Detection mode active, no timer running
   - User fidgets, briefly enters/exits plank-like position
   - Stability filter prevents false trigger
   - User gets into stable plank
   - Timer starts correctly

4. **Performance Degradation:**
   - Slow device
   - Detection FPS drops below 10
   - App automatically reduces detection frequency
   - Or offers manual mode fallback

### 6.3 Cross-Browser Testing

**Test Matrix:**

| Browser | OS | Camera | Detection | Recording | Pass/Fail |
|---------|-----|--------|-----------|-----------|-----------|
| Chrome 120 | macOS | ✓ | ✓ | ✓ | PASS |
| Safari 17 | macOS | ✓ | ✓ | ✓ | PASS |
| Chrome 120 | Android | ✓ | ✓ | ✓ | PASS |
| Safari 17 | iOS | ✓ | ✓ | ✓ | PASS |
| Firefox 121 | Windows | ✓ | ✓ | ✓ | PASS |

**Known Issues:**
- iOS Safari < 15: WebGL may be limited (use CPU fallback)
- Old Android devices: May struggle with performance (offer manual mode)

### 6.4 Acceptance Criteria

Feature is complete when:

- [ ] User can enable/disable detection mode
- [ ] Detection mode starts camera and pose detector
- [ ] Valid plank position triggers timer start (after 5 frame stability check)
- [ ] Timer stops when plank is lost (after 10 frame stability check)
- [ ] Pose skeleton overlay displays in real-time
- [ ] Detection feedback shows angle values
- [ ] Video recording includes pose overlay
- [ ] Performance: 15+ FPS detection on desktop, 10+ FPS on mobile
- [ ] Works on Chrome, Safari, Firefox (desktop & mobile)
- [ ] Error handling: Graceful fallback if MediaPipe fails
- [ ] Privacy: All processing client-side, no external data transmission
- [ ] Documentation: User guide explains how to position camera

---

## 7. Deployment Plan

### 7.1 Rollout Strategy

**Phase 1: Beta Testing (Week 1)**
- Deploy to staging environment
- Enable detection mode as opt-in feature
- Test with 10-20 beta users from Discord community
- Gather feedback on:
  - Detection accuracy
  - Performance on various devices
  - UX clarity
  - Camera positioning challenges

**Phase 2: Soft Launch (Week 2)**
- Deploy to production with feature flag
- Make detection mode default for new users
- Keep manual mode available
- Monitor metrics:
  - Detection activation rate
  - Detection success rate
  - Error rate
  - User retention

**Phase 3: Full Launch (Week 3)**
- Remove feature flag
- Make detection mode the primary experience
- Add tutorial/onboarding for first-time users
- Announce feature in Discord

### 7.2 Feature Flags

Add to `/utils/featureFlags.ts`:
```typescript
export const FEATURE_FLAGS = {
  POSE_DETECTION_ENABLED: process.env.NEXT_PUBLIC_POSE_DETECTION === 'true',
  POSE_DETECTION_DEFAULT: process.env.NEXT_PUBLIC_POSE_DETECTION_DEFAULT === 'true',
};
```

`.env.local`:
```bash
# Set to 'true' to enable pose detection feature
NEXT_PUBLIC_POSE_DETECTION=true

# Set to 'true' to make detection mode the default
NEXT_PUBLIC_POSE_DETECTION_DEFAULT=false
```

### 7.3 Monitoring & Analytics

**Metrics to Track:**

1. **Feature Usage:**
   - % of users enabling detection mode
   - % of sessions using detection vs manual
   - Avg time to first plank detection
   - Plank detection success rate

2. **Performance:**
   - Avg detection FPS by device type
   - Model load time (p50, p95, p99)
   - Memory usage during detection
   - Error rate (pose detection failures)

3. **User Behavior:**
   - Avg session duration with detection
   - % of users completing full target duration
   - Plank hold time distribution
   - Retry rate (multiple attempts)

**Implementation:**
```typescript
// Add to VideoRecorder.tsx
useEffect(() => {
  if (enablePoseDetection) {
    // Track detection mode usage
    analytics.track('pose_detection_enabled', {
      targetDuration,
      dayNumber: getDayNumber(),
    });
  }
}, [enablePoseDetection]);

useEffect(() => {
  if (isInPlankState) {
    analytics.track('plank_detected', {
      detectionTime: Date.now() - sessionStartTime,
    });
  }
}, [isInPlankState]);
```

### 7.4 Documentation Updates

**Files to Update:**

1. **README.md:** Add section on pose detection feature
2. **ARCHITECTURE.md:** Document new hooks and components
3. **IMPLEMENTATION_GUIDE.md:** Add detection mode setup instructions
4. **User Guide (new):** Create `/docs/USER_GUIDE.md` with:
   - How to use detection mode
   - Camera positioning tips
   - Troubleshooting common issues
   - Privacy/security information

---

## 8. Success Metrics

### 8.1 Technical Success Criteria

- [ ] **Accuracy:** >90% plank detection accuracy (based on manual validation)
- [ ] **Performance:** >15 FPS detection on desktop, >10 FPS on mobile
- [ ] **Reliability:** <5% error rate (pose detection failures)
- [ ] **Compatibility:** Works on Chrome, Safari, Firefox (90%+ browser coverage)
- [ ] **Load Time:** MediaPipe initialization <3 seconds
- [ ] **Memory:** <100MB additional overhead

### 8.2 User Experience Success Criteria

- [ ] **Adoption:** >60% of users try detection mode in first session
- [ ] **Retention:** Detection mode users have >20% higher retention vs manual
- [ ] **Completion:** >70% of detection mode sessions complete target duration
- [ ] **Satisfaction:** >4/5 average rating in feedback surveys
- [ ] **Support:** <5% of users report issues with detection

### 8.3 Business Success Criteria

- [ ] **Engagement:** +20% increase in daily active users
- [ ] **Sharing:** +30% increase in videos shared to Discord
- [ ] **Growth:** +15% increase in new user signups (organic)
- [ ] **Virality:** Feature mentioned in >5 external communities/forums

---

## 9. Risks & Mitigation

### Risk 1: MediaPipe Loading Failures

**Likelihood:** Medium | **Impact:** High

**Mitigation:**
- Implement robust error handling
- Provide manual mode fallback
- Cache models using Service Worker
- Host models on CDN with fallback URLs

### Risk 2: Poor Detection Accuracy

**Likelihood:** Medium | **Impact:** High

**Mitigation:**
- Extensive testing with diverse body types
- Adjustable sensitivity settings
- Clear visual feedback for positioning
- Option to recalibrate/restart detection

### Risk 3: Performance Issues on Low-End Devices

**Likelihood:** High | **Impact:** Medium

**Mitigation:**
- Adaptive frame rate based on device performance
- Lite model for low-end devices
- Automatic fallback to manual mode
- Clear messaging about device requirements

### Risk 4: User Confusion About Positioning

**Likelihood:** Medium | **Impact:** Medium

**Mitigation:**
- Interactive tutorial on first use
- Real-time framing feedback
- Example images/videos of correct setup
- Help/FAQ accessible during setup

### Risk 5: Privacy Concerns

**Likelihood:** Low | **Impact:** High

**Mitigation:**
- Prominent privacy notice
- Clear explanation of client-side processing
- Opt-in rather than forced adoption
- Privacy policy documentation

---

## 10. Timeline & Milestones

### Week 1: Core Implementation

**Day 1-2: Setup & Hook Development**
- Install MediaPipe package
- Create `usePoseDetection` hook
- Implement angle calculation and validation logic
- Unit tests for detection logic

**Day 3-4: VideoRecorder Integration**
- Integrate pose detection into VideoRecorder component
- Implement detection loop (parallel to rendering)
- Add pose skeleton overlay rendering
- Add detection feedback UI

**Day 5: PlankTimer Integration**
- Add detection mode toggle to PlankTimer
- Update state machine for detection flow
- Test end-to-end integration

**Day 6-7: Testing & Bug Fixes**
- Cross-browser testing
- Performance optimization
- Fix identified bugs
- Refine detection thresholds

### Week 2: Polish & Beta Testing

**Day 8-9: UX Improvements**
- Add camera setup guide
- Implement framing feedback
- Add loading states and error messages
- Create tutorial/onboarding flow

**Day 10-11: Beta Testing**
- Deploy to staging
- Beta test with 10-20 users
- Gather feedback
- Make adjustments based on feedback

**Day 12-14: Documentation & Preparation**
- Write user documentation
- Update technical documentation
- Prepare analytics tracking
- Create feature announcement

### Week 3: Launch

**Day 15: Soft Launch**
- Deploy to production with feature flag
- Enable for 50% of users
- Monitor metrics and errors

**Day 16-17: Monitoring & Iteration**
- Review analytics
- Fix critical issues
- Gather user feedback

**Day 18: Full Launch**
- Enable for 100% of users
- Announce in Discord
- Share demo videos

**Day 19-21: Post-Launch Support**
- Monitor feedback channels
- Address issues
- Plan future improvements

---

## 11. Future Enhancements

### Phase 2 Features (Post-MVP)

1. **Form Analysis & Coaching**
   - Detect poor plank form (sagging hips, piked hips)
   - Provide real-time coaching tips
   - Score plank quality (0-100)

2. **Multi-Pose Detection**
   - Support side plank
   - Support high plank (straight arm)
   - Support dynamic planks (with leg lifts)

3. **Progressive Difficulty**
   - Detect and reward advanced variations
   - Gamification: "Perfect form" badges
   - Streak tracking for consecutive good-form days

4. **Social Features**
   - Compare form with friends
   - Leaderboard for longest holds
   - Share form analysis in Discord

5. **Offline Mode**
   - Download models for offline use (PWA)
   - Run detection without internet
   - Sync results when back online

6. **Customization**
   - Adjustable detection sensitivity
   - Custom angle thresholds
   - Personal calibration for body proportions

7. **Advanced Analytics**
   - Track form improvement over time
   - Identify weak points (e.g., hip stability)
   - Export data for external analysis

---

## 12. Appendix

### A. MediaPipe Resources

- **Official Docs:** https://ai.google.dev/edge/mediapipe/solutions/vision/pose_landmarker
- **NPM Package:** https://www.npmjs.com/package/@mediapipe/tasks-vision
- **Code Examples:** https://codepen.io/mediapipe/pen/abRWvyN
- **Model Files:** https://storage.googleapis.com/mediapipe-models/pose_landmarker/

### B. Useful Libraries

- **React Webcam:** For easier camera handling (optional)
- **Canvas-based drawing:** Native CanvasRenderingContext2D is sufficient
- **date-fns:** Already installed for date calculations

### C. Learning Resources

- **MediaPipe Pose Tutorial:** https://developers.google.com/mediapipe/solutions/vision/pose_landmarker/web_js
- **Exercise Detection with MediaPipe:** https://bleedaiacademy.com/introduction-to-pose-detection-and-basic-pose-classification/
- **React + MediaPipe Examples:** https://github.com/topics/mediapipe?l=typescript

### D. Performance Benchmarks

**Expected Performance (MediaPipe Pose Lite):**

| Device | Model | FPS | Latency | Notes |
|--------|-------|-----|---------|-------|
| Desktop (Intel i7) | Lite | 60+ | 16ms | Excellent |
| Desktop (M1 Mac) | Lite | 60+ | 10ms | Excellent |
| Laptop (Intel i5) | Lite | 30-45 | 22-33ms | Good |
| iPhone 13 | Lite | 30-45 | 22-33ms | Good |
| iPhone 11 | Lite | 20-30 | 33-50ms | Acceptable |
| Android (High-end) | Lite | 30-45 | 22-33ms | Good |
| Android (Mid-range) | Lite | 15-25 | 40-66ms | Acceptable |
| Android (Low-end) | Lite | 5-15 | 66-200ms | Fallback needed |

---

## 13. Summary & Next Steps

### Implementation Summary

This plan provides a comprehensive roadmap for integrating MediaPipe Pose detection into the Plank Timer app. The solution:

1. **Uses MediaPipe Tasks Vision** (@mediapipe/tasks-vision) for modern, optimized pose detection
2. **Detects plank position automatically** using body angle analysis (shoulders-hips-ankles alignment)
3. **Auto-starts timer** when valid plank detected (after 5-frame stability check)
4. **Auto-stops timer** when plank is lost (after 10-frame stability check)
5. **Provides real-time visual feedback** with color-coded skeleton overlay
6. **Runs entirely client-side** (privacy-first, no data transmission)
7. **Maintains backward compatibility** with manual mode option

### Key Technical Decisions

- **Library:** @mediapipe/tasks-vision (official, actively maintained)
- **Model:** pose_landmarker_lite (best balance of performance/accuracy)
- **Detection Rate:** 15 FPS (desktop), 10 FPS (mobile) - adaptive
- **Stability Filter:** 5 frames to confirm plank, 10 frames to confirm lost
- **Integration Pattern:** Custom React hook (`usePoseDetection`) + modified VideoRecorder component
- **Fallback Strategy:** Manual mode always available if detection fails/slow

### Immediate Next Steps

1. **Install Dependencies:**
   ```bash
   npm install @mediapipe/tasks-vision
   ```

2. **Create Hook:**
   - Implement `/hooks/usePoseDetection.ts` (from Phase 2 section)
   - Add angle calculation and validation logic
   - Test standalone hook functionality

3. **Integrate with VideoRecorder:**
   - Modify `/components/VideoRecorder.tsx` (from Phase 3 section)
   - Add detection loop
   - Add pose overlay rendering

4. **Update PlankTimer:**
   - Add detection mode toggle (from Phase 4 section)
   - Test end-to-end flow

5. **Test & Iterate:**
   - Cross-browser testing
   - Performance optimization
   - User testing with feedback

### Questions or Issues?

- **Unclear requirements:** Refer to PRODUCT_PLAN.md
- **Technical questions:** See MediaPipe docs or create GitHub issue
- **Implementation help:** Review code examples in Appendix C
- **Performance problems:** See Challenge 3 solutions (section 5)

---

**Document Version:** 1.0
**Last Updated:** 2025-11-17
**Status:** Ready for Implementation
**Estimated Effort:** 3-4 developer weeks (including testing)
