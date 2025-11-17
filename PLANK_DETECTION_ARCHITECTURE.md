# Plank Detection Architecture - MediaPipe Pose Integration

## Executive Summary

This document outlines the technical architecture for adding real-time plank detection to the existing plank timer application using MediaPipe Pose. The system will automatically detect when a user is in plank position, start the timer, and stop when the plank position is lost, creating a hands-free, intelligent fitness tracking experience.

---

## 1. System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         Browser (Client)                      │
├───────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐     ┌──────────────┐    ┌──────────────┐ │
│  │   Camera     │────▶│  MediaPipe   │───▶│    Plank     │ │
│  │   Stream     │     │     Pose     │    │   Detector   │ │
│  └──────────────┘     └──────────────┘    └──────────────┘ │
│         │                     │                    │         │
│         ▼                     ▼                    ▼         │
│  ┌──────────────┐     ┌──────────────┐    ┌──────────────┐ │
│  │    Video     │     │   Landmark   │    │    State     │ │
│  │   Recorder   │◀────│  Visualizer  │◀───│   Machine    │ │
│  └──────────────┘     └──────────────┘    └──────────────┘ │
│         │                                          │         │
│         ▼                                          ▼         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                   Timer Component                      │  │
│  │  (Idle → Detecting → Prep → Plank → Complete)        │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### Data Flow

```
1. Camera Stream → 2. Frame Extraction → 3. Pose Detection
        ↓                    ↓                    ↓
4. Landmark Analysis → 5. Plank Classification → 6. State Transition
        ↓                    ↓                    ↓
7. Timer Control → 8. Video Recording → 9. Overlay Rendering
```

---

## 2. Technology Stack & Integration Strategy

### Core Dependencies

```json
{
  "dependencies": {
    // Existing
    "next": "^16.0.3",
    "react": "^19.2.0",
    "date-fns": "^4.1.0",

    // New for Plank Detection
    "@mediapipe/pose": "^0.5.1675469404",
    "@mediapipe/camera_utils": "^0.3.1675457924",
    "@mediapipe/drawing_utils": "^0.3.1675465747"
  }
}
```

### Integration Approach

**Client-Side Processing** (Recommended)
- **Rationale**:
  - Zero latency for real-time detection
  - No server costs or API limits
  - Privacy-preserving (no video sent to servers)
  - Works offline once loaded
  - MediaPipe is optimized for browser execution

**Alternative: Server-Side Processing** (Not Recommended)
- Would require WebSocket for real-time communication
- Increased latency (network round-trip)
- Higher infrastructure costs
- Privacy concerns with video streaming

---

## 3. MediaPipe Pose Integration Architecture

### Pose Detection Pipeline

```typescript
interface PoseDetectionPipeline {
  // 1. Initialize MediaPipe Pose
  pose: Pose = new Pose({
    locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
    }
  });

  // 2. Configuration
  config: PoseConfig = {
    modelComplexity: 1,          // 0, 1, or 2 (accuracy vs speed)
    smoothLandmarks: true,       // Smooth detection over time
    minDetectionConfidence: 0.5, // Detection threshold
    minTrackingConfidence: 0.5,  // Tracking threshold
    enableSegmentation: false,    // Not needed for plank detection
  };

  // 3. Process Frame
  async processFrame(videoElement: HTMLVideoElement): Promise<PoseLandmarks> {
    await this.pose.send({ image: videoElement });
    return this.landmarks;
  }

  // 4. Landmark Output (33 points)
  landmarks: NormalizedLandmark[] = [
    { x: 0-1, y: 0-1, z: depth, visibility: 0-1 },
    // ... 33 total landmarks
  ];
}
```

### Landmark Mapping

```typescript
enum PoseLandmark {
  NOSE = 0,
  LEFT_SHOULDER = 11,
  RIGHT_SHOULDER = 12,
  LEFT_ELBOW = 13,
  RIGHT_ELBOW = 14,
  LEFT_WRIST = 15,
  RIGHT_WRIST = 16,
  LEFT_HIP = 23,
  RIGHT_HIP = 24,
  LEFT_KNEE = 25,
  RIGHT_KNEE = 26,
  LEFT_ANKLE = 27,
  RIGHT_ANKLE = 28,
  LEFT_HEEL = 29,
  RIGHT_HEEL = 30,
  LEFT_FOOT_INDEX = 31,
  RIGHT_FOOT_INDEX = 32
}
```

---

## 4. Plank Detection Algorithm

### Detection Strategy

```typescript
interface PlankDetector {
  // Core detection logic
  detectPlank(landmarks: NormalizedLandmark[]): PlankDetectionResult {
    const checks = {
      bodyAlignment: this.checkBodyAlignment(landmarks),
      elbowAngle: this.checkElbowAngle(landmarks),
      hipPosition: this.checkHipPosition(landmarks),
      shoulderPosition: this.checkShoulderPosition(landmarks),
      stabilityScore: this.calculateStability(landmarks)
    };

    return {
      isPlank: this.evaluateChecks(checks),
      confidence: this.calculateConfidence(checks),
      feedback: this.generateFeedback(checks)
    };
  }

  // Body alignment check (shoulders, hips, ankles in line)
  checkBodyAlignment(landmarks: NormalizedLandmark[]): AlignmentResult {
    const shoulder = this.getMidpoint(
      landmarks[PoseLandmark.LEFT_SHOULDER],
      landmarks[PoseLandmark.RIGHT_SHOULDER]
    );
    const hip = this.getMidpoint(
      landmarks[PoseLandmark.LEFT_HIP],
      landmarks[PoseLandmark.RIGHT_HIP]
    );
    const ankle = this.getMidpoint(
      landmarks[PoseLandmark.LEFT_ANKLE],
      landmarks[PoseLandmark.RIGHT_ANKLE]
    );

    // Calculate angle formed by shoulder-hip-ankle
    const angle = this.calculateAngle(shoulder, hip, ankle);

    // Ideal plank has ~170-180 degree angle (nearly straight)
    const isAligned = angle >= 160 && angle <= 190;
    const score = 1 - Math.abs(180 - angle) / 20;

    return { isAligned, score, angle };
  }

  // Elbow angle check (for standard plank on elbows)
  checkElbowAngle(landmarks: NormalizedLandmark[]): AngleResult {
    const leftAngle = this.calculateAngle(
      landmarks[PoseLandmark.LEFT_SHOULDER],
      landmarks[PoseLandmark.LEFT_ELBOW],
      landmarks[PoseLandmark.LEFT_WRIST]
    );

    const rightAngle = this.calculateAngle(
      landmarks[PoseLandmark.RIGHT_SHOULDER],
      landmarks[PoseLandmark.RIGHT_ELBOW],
      landmarks[PoseLandmark.RIGHT_WRIST]
    );

    // For elbow plank: ~90 degrees
    // For straight-arm plank: ~180 degrees
    const isElbowPlank = (leftAngle >= 70 && leftAngle <= 110) &&
                         (rightAngle >= 70 && rightAngle <= 110);

    const isStraightArmPlank = (leftAngle >= 160 && leftAngle <= 200) &&
                                (rightAngle >= 160 && rightAngle <= 200);

    return {
      isValid: isElbowPlank || isStraightArmPlank,
      type: isElbowPlank ? 'elbow' : 'straight-arm',
      leftAngle,
      rightAngle
    };
  }

  // Hip position check (not too high or too low)
  checkHipPosition(landmarks: NormalizedLandmark[]): HipResult {
    const shoulder = this.getMidpoint(
      landmarks[PoseLandmark.LEFT_SHOULDER],
      landmarks[PoseLandmark.RIGHT_SHOULDER]
    );
    const hip = this.getMidpoint(
      landmarks[PoseLandmark.LEFT_HIP],
      landmarks[PoseLandmark.RIGHT_HIP]
    );
    const knee = this.getMidpoint(
      landmarks[PoseLandmark.LEFT_KNEE],
      landmarks[PoseLandmark.RIGHT_KNEE]
    );

    // Calculate relative hip height
    const shoulderToKneeDistance = this.calculateDistance(shoulder, knee);
    const hipDeviation = Math.abs(hip.y - ((shoulder.y + knee.y) / 2));
    const deviationRatio = hipDeviation / shoulderToKneeDistance;

    // Hip should be roughly in line (small deviation allowed)
    const isCorrect = deviationRatio < 0.15;

    return {
      isCorrect,
      deviation: deviationRatio,
      feedback: deviationRatio > 0.15 ?
        (hip.y < shoulder.y ? 'Hips too high' : 'Hips too low') :
        'Good hip position'
    };
  }

  // Stability detection (low movement over time)
  calculateStability(
    landmarks: NormalizedLandmark[],
    history: LandmarkHistory
  ): number {
    if (history.length < 5) return 0;

    const keyPoints = [
      PoseLandmark.LEFT_SHOULDER,
      PoseLandmark.RIGHT_SHOULDER,
      PoseLandmark.LEFT_HIP,
      PoseLandmark.RIGHT_HIP
    ];

    let totalMovement = 0;
    for (const point of keyPoints) {
      const current = landmarks[point];
      const previous = history[history.length - 1][point];

      totalMovement += this.calculateDistance(current, previous);
    }

    // Lower movement = higher stability
    const stability = Math.max(0, 1 - totalMovement * 10);
    return stability;
  }
}
```

### Confidence Scoring

```typescript
interface ConfidenceCalculator {
  calculateConfidence(checks: PlankChecks): number {
    const weights = {
      bodyAlignment: 0.35,
      elbowAngle: 0.25,
      hipPosition: 0.25,
      stability: 0.15
    };

    const score =
      checks.bodyAlignment.score * weights.bodyAlignment +
      (checks.elbowAngle.isValid ? 1 : 0) * weights.elbowAngle +
      (checks.hipPosition.isCorrect ? 1 : 0) * weights.hipPosition +
      checks.stabilityScore * weights.stability;

    return score;
  }

  // Require 70% confidence for plank detection
  isPlankDetected(confidence: number): boolean {
    return confidence >= 0.7;
  }
}
```

---

## 5. State Management Architecture

### Enhanced State Machine

```typescript
interface PlankDetectionStateMachine {
  states: {
    IDLE: 'idle',
    CAMERA_INIT: 'camera_init',
    DETECTING: 'detecting',         // New: Looking for plank
    PLANK_DETECTED: 'plank_detected', // New: Plank found, prep countdown
    PREP_COUNTDOWN: 'prep_countdown',
    RECORDING: 'recording',
    PLANK_LOST: 'plank_lost',      // New: Plank position lost
    COMPLETING: 'completing',
    COMPLETED: 'completed',
    ERROR: 'error'
  };

  transitions: {
    // Enhanced transitions with detection states
    idle: {
      START_DETECTION: 'camera_init'
    },
    camera_init: {
      CAMERA_READY: 'detecting',
      CAMERA_ERROR: 'error'
    },
    detecting: {
      PLANK_DETECTED: 'plank_detected',
      STOP: 'idle'
    },
    plank_detected: {
      START_PREP: 'prep_countdown',
      PLANK_LOST: 'detecting'
    },
    prep_countdown: {
      COUNTDOWN_COMPLETE: 'recording',
      PLANK_LOST: 'detecting'
    },
    recording: {
      TIMER_COMPLETE: 'completing',
      PLANK_LOST: 'plank_lost',
      STOP: 'idle'
    },
    plank_lost: {
      TIMEOUT: 'completing',        // Grace period expired
      PLANK_DETECTED: 'recording',  // Resume if plank regained
      FORCE_COMPLETE: 'completing'
    },
    completing: {
      SAVE_COMPLETE: 'completed'
    },
    completed: {
      RESTART: 'idle',
      NEW_SESSION: 'detecting'
    }
  };

  // Configuration
  config: {
    detectionBufferTime: 2000,      // 2s stable plank before starting
    lostPlankGracePeriod: 3000,     // 3s to get back in position
    minPlankDuration: 5000,          // Minimum 5s before allowing completion
    prepCountdownDuration: 3000      // 3s prep after detection
  };
}
```

### State Context Management

```typescript
interface DetectionContext {
  // Detection state
  isDetecting: boolean;
  detectionStartTime: number | null;
  lastDetectionTime: number | null;
  detectionConfidence: number;
  consecutiveDetections: number;

  // Plank state
  plankStartTime: number | null;
  plankLostTime: number | null;
  totalPlankTime: number;

  // Feedback
  currentFeedback: string;
  feedbackHistory: FeedbackEntry[];

  // Performance metrics
  frameRate: number;
  processingTime: number;

  // Pose data
  currentLandmarks: NormalizedLandmark[] | null;
  landmarkHistory: LandmarkHistory;

  // Recording state
  isRecording: boolean;
  videoBlob: Blob | null;
}
```

---

## 6. Component Architecture

### New Components Structure

```typescript
// hooks/usePoseDetection.ts
interface UsePoseDetection {
  // Initialize MediaPipe
  initializePose(): Promise<void>;

  // Process video frame
  detectPose(videoElement: HTMLVideoElement): Promise<PoseResult>;

  // Cleanup
  cleanup(): void;

  // State
  isLoading: boolean;
  isReady: boolean;
  error: Error | null;
  landmarks: NormalizedLandmark[] | null;
  worldLandmarks: Landmark[] | null;
}

// hooks/usePlankDetection.ts
interface UsePlankDetection {
  // Detection logic
  detectPlank(landmarks: NormalizedLandmark[]): PlankDetectionResult;

  // State management
  detectionState: DetectionState;
  confidence: number;
  feedback: string;
  isPlankDetected: boolean;

  // Configuration
  updateConfig(config: Partial<DetectionConfig>): void;
}

// components/PoseOverlay.tsx
interface PoseOverlayProps {
  landmarks: NormalizedLandmark[] | null;
  canvasRef: React.RefObject<HTMLCanvasElement>;
  showSkeleton: boolean;
  showConfidence: boolean;
  plankDetected: boolean;
}

// components/DetectionFeedback.tsx
interface DetectionFeedbackProps {
  isDetecting: boolean;
  confidence: number;
  feedback: string;
  plankDetected: boolean;
  preparingToStart: boolean;
}

// components/PlankTimerWithDetection.tsx
interface PlankTimerWithDetectionProps {
  targetDuration: number;
  detectionMode: 'automatic' | 'manual';
  onComplete: (videoBlob: Blob) => void;
  onError: (error: string) => void;
}
```

### Component Integration Flow

```
PlankTimer (Main Component)
    ├── PlankTimerWithDetection
    │   ├── VideoRecorder
    │   ├── PoseDetection (MediaPipe)
    │   ├── PlankDetector
    │   ├── PoseOverlay
    │   ├── DetectionFeedback
    │   └── TimerDisplay
    └── Manual Mode (existing)
```

---

## 7. Implementation Architecture

### Module Organization

```
src/
├── lib/
│   ├── mediapipe/
│   │   ├── pose.ts              # MediaPipe Pose wrapper
│   │   ├── config.ts            # Configuration
│   │   └── types.ts             # TypeScript definitions
│   │
│   ├── detection/
│   │   ├── plankDetector.ts     # Core detection algorithm
│   │   ├── angleCalculator.ts   # Angle calculations
│   │   ├── stabilityTracker.ts  # Stability analysis
│   │   └── feedbackGenerator.ts # User feedback
│   │
│   └── visualization/
│       ├── poseRenderer.ts      # Skeleton rendering
│       ├── confidenceMeter.ts   # Confidence visualization
│       └── overlayRenderer.ts   # Canvas overlay rendering
│
├── hooks/
│   ├── usePoseDetection.ts
│   ├── usePlankDetection.ts
│   ├── useDetectionState.ts
│   └── usePoseVisualization.ts
│
├── components/
│   ├── detection/
│   │   ├── PoseOverlay.tsx
│   │   ├── DetectionFeedback.tsx
│   │   ├── ConfidenceIndicator.tsx
│   │   └── CalibrationGuide.tsx
│   │
│   └── timer/
│       ├── PlankTimerWithDetection.tsx
│       └── DetectionModeToggle.tsx
│
└── utils/
    ├── performanceMonitor.ts
    └── detectionHelpers.ts
```

---

## 8. Performance Optimization

### Frame Processing Strategy

```typescript
interface PerformanceOptimization {
  // Adaptive frame rate based on device capability
  adaptiveFrameRate: {
    high: 30,    // High-end devices
    medium: 20,  // Mid-range devices
    low: 15      // Low-end devices
  };

  // Skip frames if processing is slow
  frameSkipping: {
    enabled: true,
    maxSkip: 2,
    threshold: 50 // ms per frame
  };

  // Reduce model complexity on weak devices
  modelComplexity: {
    detect: () => {
      const fps = this.measureFPS();
      if (fps < 15) return 0;  // Lite model
      if (fps < 25) return 1;  // Full model
      return 2;                 // Heavy model
    }
  };

  // Web Worker for heavy calculations
  offloadToWorker: {
    angleCalculations: true,
    stabilityAnalysis: true,
    feedbackGeneration: false // Keep in main thread for UI
  };

  // Canvas optimization
  canvasSettings: {
    willReadFrequently: false,
    desynchronized: true,
    alpha: false,
    imageSmoothingEnabled: false
  };

  // Memory management
  memoryManagement: {
    maxLandmarkHistory: 30,     // ~1 second at 30fps
    clearInterval: 10000,       // Clear old data every 10s
    reuseCanvasContext: true
  };
}
```

### Browser Optimization

```typescript
interface BrowserOptimization {
  // Use OffscreenCanvas if available
  useOffscreenCanvas: 'OffscreenCanvas' in window;

  // Hardware acceleration hints
  gpuHints: {
    powerPreference: 'high-performance',
    preserveDrawingBuffer: false
  };

  // RequestAnimationFrame optimization
  rafOptimization: {
    useRAF: true,
    targetFPS: 30,
    fpsLimiter: (callback: Function) => {
      let lastTime = 0;
      const targetInterval = 1000 / this.targetFPS;

      return (currentTime: number) => {
        if (currentTime - lastTime >= targetInterval) {
          lastTime = currentTime;
          callback(currentTime);
        }
      };
    }
  };
}
```

---

## 9. Error Handling & Edge Cases

### Error Scenarios

```typescript
interface ErrorHandling {
  scenarios: {
    // MediaPipe loading failures
    MEDIAPIPE_LOAD_ERROR: {
      fallback: 'manual_mode',
      message: 'Pose detection unavailable. Using manual mode.',
      retry: true,
      maxRetries: 3
    },

    // Camera issues
    CAMERA_BLOCKED: {
      fallback: 'manual_mode',
      message: 'Camera access denied. Please allow camera access.',
      showPermissionGuide: true
    },

    // Performance issues
    LOW_FPS: {
      action: 'reduce_quality',
      message: 'Adjusting quality for better performance',
      threshold: 10 // fps
    },

    // Detection issues
    NO_PERSON_DETECTED: {
      timeout: 30000, // 30s
      message: 'No person detected. Please position yourself in view.',
      showGuide: true
    },

    // Partial visibility
    PARTIAL_BODY: {
      message: 'Please ensure your full body is visible',
      requiredLandmarks: ['shoulders', 'hips', 'ankles']
    },

    // Network issues (CDN loading)
    NETWORK_ERROR: {
      fallback: 'cached_model',
      message: 'Loading pose detection...',
      cacheStrategy: 'aggressive'
    }
  };

  // Graceful degradation
  degradationLevels: [
    { fps: 30, modelComplexity: 2, showSkeleton: true },
    { fps: 20, modelComplexity: 1, showSkeleton: true },
    { fps: 15, modelComplexity: 0, showSkeleton: false },
    { fps: 10, modelComplexity: 0, showSkeleton: false },
    { fallback: 'manual_mode' }
  ];
}
```

### Edge Case Handling

```typescript
interface EdgeCases {
  // Multiple people in frame
  multiplePeople: {
    strategy: 'closest_to_center',
    warning: 'Multiple people detected. Tracking closest person.'
  },

  // Lighting conditions
  poorLighting: {
    detection: 'low_confidence_persistent',
    suggestion: 'Please improve lighting for better detection'
  },

  // Camera angle issues
  extremeAngles: {
    detect: () => this.checkCameraAngle(),
    message: 'Please adjust camera to side view for best results'
  },

  // Rapid movement
  rapidMovement: {
    threshold: 0.3, // position change per frame
    action: 'pause_detection',
    message: 'Please hold still for detection'
  },

  // Browser minimized/backgrounded
  backgroundTab: {
    action: 'pause_processing',
    resume: 'automatic',
    saveState: true
  }
}
```

---

## 10. User Experience Design

### Detection UI States

```typescript
interface DetectionUIStates {
  // Initial state
  idle: {
    message: "Click 'Start with Pose Detection' to begin",
    showManualOption: true,
    showCalibrationTips: true
  },

  // Camera initializing
  initializing: {
    message: "Setting up camera and pose detection...",
    showLoader: true,
    estimatedTime: "5-10 seconds"
  },

  // Actively detecting
  detecting: {
    message: "Get into plank position",
    showSkeleton: true,
    showConfidence: true,
    showFeedback: true,
    feedbackExamples: [
      "Move back to see full body",
      "Lower your hips slightly",
      "Straighten your back",
      "Hold position steady"
    ]
  },

  // Plank detected, preparing
  preparing: {
    message: "Plank detected! Get ready...",
    countdown: 3,
    showStabilityIndicator: true,
    allowCancel: true
  },

  // Recording
  recording: {
    message: "Hold your plank!",
    showTimer: true,
    showProgress: true,
    showEncouragement: true,
    encouragementMessages: [
      "Great form!",
      "Keep it up!",
      "Almost there!",
      "You're doing great!"
    ]
  },

  // Plank lost during recording
  plankLost: {
    message: "Get back in position!",
    showGraceTimer: true,
    gracePeriod: 3,
    showLastPosition: true
  },

  // Completed
  completed: {
    message: "Excellent work!",
    showStats: true,
    showReplay: true,
    showShare: true
  }
}
```

### Visual Feedback Components

```
┌──────────────────────────────────────┐
│          Camera View                  │
│  ┌──────────────────────────────┐    │
│  │                                │    │
│  │     [Skeleton Overlay]         │    │
│  │                                │    │
│  │   ○═══○═══○  <- Detected Pose │    │
│  │   ║   ║   ║                    │    │
│  │   ○═══○═══○                    │    │
│  │                                │    │
│  └──────────────────────────────┘    │
│                                        │
│  ┌──────────────────────────────┐    │
│  │  Confidence: ████████░░ 85%   │    │
│  └──────────────────────────────┘    │
│                                        │
│  ┌──────────────────────────────┐    │
│  │  📍 Lower your hips slightly   │    │
│  └──────────────────────────────┘    │
│                                        │
│  [Start Recording] [Manual Mode]      │
└──────────────────────────────────────┘
```

---

## 11. Testing Strategy

### Unit Tests

```typescript
// Detection algorithm tests
describe('PlankDetector', () => {
  it('detects valid elbow plank position', () => {
    const landmarks = mockElbowPlankLandmarks();
    const result = detector.detectPlank(landmarks);
    expect(result.isPlank).toBe(true);
    expect(result.type).toBe('elbow');
  });

  it('detects valid straight-arm plank', () => {
    const landmarks = mockStraightArmPlankLandmarks();
    const result = detector.detectPlank(landmarks);
    expect(result.isPlank).toBe(true);
    expect(result.type).toBe('straight-arm');
  });

  it('rejects incorrect hip position', () => {
    const landmarks = mockHighHipsLandmarks();
    const result = detector.detectPlank(landmarks);
    expect(result.isPlank).toBe(false);
    expect(result.feedback).toContain('hips');
  });

  it('requires minimum stability', () => {
    const landmarks = mockUnstableLandmarks();
    const result = detector.detectPlank(landmarks);
    expect(result.isPlank).toBe(false);
    expect(result.feedback).toContain('steady');
  });
});
```

### Integration Tests

```typescript
// End-to-end detection flow
describe('Plank Detection Flow', () => {
  it('completes full detection cycle', async () => {
    const { getByText, getByTestId } = render(<PlankTimerWithDetection />);

    // Start detection
    fireEvent.click(getByText('Start with Pose Detection'));

    // Mock camera and MediaPipe
    await waitFor(() => expect(getByTestId('pose-overlay')).toBeInTheDocument());

    // Simulate plank detection
    mockPoseDetection.mockReturnValue(mockPlankLandmarks);

    // Wait for detection confirmation
    await waitFor(() => expect(getByText(/Plank detected/)).toBeInTheDocument());

    // Verify countdown starts
    await waitFor(() => expect(getByText(/Get ready/)).toBeInTheDocument());

    // Verify recording starts
    await waitFor(() => expect(getByTestId('timer')).toBeInTheDocument());
  });
});
```

### Performance Tests

```typescript
describe('Performance', () => {
  it('maintains 20+ FPS on detection', async () => {
    const monitor = new PerformanceMonitor();
    const detector = new PlankDetector();

    // Run detection for 10 seconds
    const startTime = performance.now();
    let frames = 0;

    while (performance.now() - startTime < 10000) {
      await detector.detectPlank(mockLandmarks());
      frames++;
    }

    const fps = frames / 10;
    expect(fps).toBeGreaterThanOrEqual(20);
  });

  it('uses less than 150MB memory', () => {
    // Monitor memory usage during detection
    const initialMemory = performance.memory.usedJSHeapSize;

    // Run detection
    runDetectionFor(30000); // 30 seconds

    const finalMemory = performance.memory.usedJSHeapSize;
    const increase = (finalMemory - initialMemory) / 1024 / 1024;

    expect(increase).toBeLessThan(150);
  });
});
```

---

## 12. Deployment & Configuration

### Environment Variables

```bash
# .env.local
NEXT_PUBLIC_ENABLE_POSE_DETECTION=true
NEXT_PUBLIC_MEDIAPIPE_CDN=https://cdn.jsdelivr.net/npm/@mediapipe/pose
NEXT_PUBLIC_DETECTION_MODE=automatic # automatic | manual | hybrid
NEXT_PUBLIC_MIN_CONFIDENCE=0.7
NEXT_PUBLIC_DETECTION_BUFFER_MS=2000
NEXT_PUBLIC_GRACE_PERIOD_MS=3000
```

### Feature Flags

```typescript
interface FeatureFlags {
  enablePoseDetection: boolean;
  enableAutoStart: boolean;
  enableVisualFeedback: boolean;
  enableVoiceFeedback: boolean;
  enableDebugOverlay: boolean;
  enablePerformanceMonitor: boolean;

  // A/B testing flags
  detectionAlgorithmVersion: 'v1' | 'v2';
  confidenceThreshold: number;
}
```

### Progressive Enhancement

```typescript
// Detect feature support
const features = {
  mediaRecorder: typeof MediaRecorder !== 'undefined',
  getUserMedia: navigator.mediaDevices?.getUserMedia,
  offscreenCanvas: 'OffscreenCanvas' in window,
  webgl: (() => {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl') || canvas.getContext('webgl2'));
  })(),
  webAssembly: typeof WebAssembly !== 'undefined'
};

// Progressive feature activation
if (features.webgl && features.webAssembly) {
  // Full pose detection
  enablePoseDetection();
} else if (features.mediaRecorder) {
  // Manual mode only
  enableManualMode();
} else {
  // Basic timer only
  showCompatibilityWarning();
}
```

---

## 13. Migration Path

### Phase 1: Foundation (Week 1)
- [ ] Install MediaPipe dependencies
- [ ] Create basic pose detection hook
- [ ] Implement landmark visualization
- [ ] Test camera integration

### Phase 2: Detection Logic (Week 2)
- [ ] Implement plank detection algorithm
- [ ] Add confidence scoring
- [ ] Create feedback system
- [ ] Add stability tracking

### Phase 3: Integration (Week 3)
- [ ] Integrate with existing timer
- [ ] Add state management
- [ ] Implement auto-start/stop
- [ ] Add grace period handling

### Phase 4: Polish (Week 4)
- [ ] Optimize performance
- [ ] Add visual feedback
- [ ] Implement error handling
- [ ] Complete testing

### Phase 5: Rollout
- [ ] Feature flag deployment
- [ ] A/B testing setup
- [ ] Performance monitoring
- [ ] User feedback collection

---

## 14. Future Enhancements

### Advanced Features Roadmap

1. **Form Correction AI**
   - Real-time form feedback
   - Personalized corrections
   - Progress tracking

2. **Multiple Exercise Support**
   - Push-ups detection
   - Squats detection
   - Custom exercise builder

3. **Social Features**
   - Live plank battles
   - Group challenges
   - Leaderboards

4. **Advanced Analytics**
   - Form quality score
   - Progress graphs
   - Muscle engagement analysis

5. **Mobile App**
   - React Native implementation
   - Offline support
   - Watch integration

---

## Conclusion

This architecture provides a comprehensive blueprint for integrating MediaPipe Pose detection into the plank timer application. The design prioritizes:

- **Real-time Performance**: Client-side processing for zero-latency detection
- **User Experience**: Progressive enhancement with graceful fallbacks
- **Accuracy**: Multi-point validation for reliable plank detection
- **Maintainability**: Modular architecture with clear separation of concerns
- **Scalability**: Performance optimizations and adaptive quality settings

The implementation follows a phased approach, allowing for iterative development and testing while maintaining the existing manual mode as a fallback option.