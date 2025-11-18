# QA Analysis Report - Plank Timer Application

**Date**: January 2025
**Reviewer**: QA Engineer
**Codebase Version**: Main branch (commit: 3f885b1)
**Test Coverage**: 37% statements, 94% on core utilities

---

## Executive Summary

The Plank Timer application is a well-structured Next.js 16 application with React 19 that implements pose detection using MediaPipe for automated plank timing. The codebase demonstrates good engineering practices with clear separation of concerns, comprehensive utility functions, and thoughtful user experience design.

**Overall Quality Score: B+ (85/100)**

### Strengths
- Excellent separation of concerns (utilities, hooks, components)
- Comprehensive pose detection algorithm with multiple validation checks
- Good error handling in critical paths
- Well-documented code with clear comments
- Solid timer logic with proper date handling

### Areas for Improvement
- Memory leak risks in VideoRecorder component
- Insufficient error boundaries
- Missing input validation in some areas
- Performance optimization opportunities
- Limited accessibility features

---

## Critical Issues (Priority: HIGH)

### 1. Memory Leak Risk in VideoRecorder Component

**File**: `components/VideoRecorder.tsx`
**Lines**: 122-143, 195-288

**Issue**: Multiple animation frames and detection loops running simultaneously without proper coordination could lead to memory accumulation.

**Evidence**:
```typescript
// Two separate animation frame loops
useEffect(() => {
  // Detection loop (lines 166-192)
  const runDetection = () => {
    detectPose(video);
    detectionFrameRef.current = requestAnimationFrame(runDetection);
  };
  runDetection();
}, [phase, detectionMode, detectPose]);

useEffect(() => {
  // Rendering loop (lines 195-288)
  const drawFrame = () => {
    // ... drawing logic
    animationFrameRef.current = requestAnimationFrame(drawFrame);
  };
  drawFrame();
}, [phase, targetDuration, detectionMode, detectionResult]);
```

**Risk**:
- Two `requestAnimationFrame` loops running at full speed
- Detection loop calls `detectPose` which runs at ~10 FPS but frame is requested at 60 FPS
- Canvas context reused but not always properly cleared
- No explicit frame budget or throttling

**Impact**: HIGH - Can cause browser slowdown/freezing during long recording sessions

**Recommendation**:
1. Consolidate into single animation loop
2. Add explicit frame budget tracking
3. Implement proper throttling mechanism
4. Add memory profiling hooks
5. Consider using `setTimeout` for detection loop instead of `requestAnimationFrame`

**Example Fix**:
```typescript
// Single coordinated loop
useEffect(() => {
  let lastDetectionTime = 0;
  const DETECTION_INTERVAL = 100; // 10 FPS

  const mainLoop = (timestamp: number) => {
    // Draw every frame
    drawFrame();

    // Detect at throttled rate
    if (timestamp - lastDetectionTime >= DETECTION_INTERVAL) {
      detectPose(video);
      lastDetectionTime = timestamp;
    }

    animationFrameRef.current = requestAnimationFrame(mainLoop);
  };

  mainLoop(0);

  return () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  };
}, [/* deps */]);
```

---

### 2. Unhandled Promise Rejection in Camera Initialization

**File**: `components/VideoRecorder.tsx`
**Lines**: 73-109

**Issue**: Camera initialization `async` function doesn't handle all error cases, particularly when component unmounts during camera setup.

**Evidence**:
```typescript
async function setupCamera() {
  try {
    const stream = await getCameraStream();

    if (!mounted) {
      stream.getTracks().forEach(track => track.stop());
      return;
    }

    streamRef.current = stream;
    // ... more async operations
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Failed to access camera';
    setError(errorMsg);
    onError(errorMsg);
  }
}
```

**Risk**:
- If component unmounts after `getCameraStream()` but before state updates
- State updates after unmount can cause React warnings
- Camera stream may not be properly cleaned up

**Impact**: MEDIUM - Can cause React warnings and potential resource leaks

**Recommendation**:
1. Check `mounted` flag before ALL state updates
2. Use AbortController for cleanup
3. Add timeout for camera initialization

**Example Fix**:
```typescript
async function setupCamera() {
  const abortController = new AbortController();

  try {
    const stream = await getCameraStream();

    if (!mounted || abortController.signal.aborted) {
      stream.getTracks().forEach(track => track.stop());
      return;
    }

    streamRef.current = stream;

    if (videoRef.current && mounted) {
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
    }

    if (mounted && !abortController.signal.aborted) {
      if (detectionMode) {
        setPhase('detecting');
      } else {
        setPhase('countdown');
      }
    }
  } catch (err) {
    if (mounted && !abortController.signal.aborted) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to access camera';
      setError(errorMsg);
      onError(errorMsg);
    }
  }

  return () => abortController.abort();
}
```

---

### 3. Missing Error Boundary Component

**File**: Application-wide

**Issue**: No Error Boundary components implemented. Any uncaught error in child components will crash the entire app.

**Risk**:
- MediaPipe errors could crash entire application
- React 19 rendering errors not caught
- Poor user experience on unexpected errors

**Impact**: HIGH - Single error can crash entire app

**Recommendation**:
Implement Error Boundary at app level and around critical components:

```typescript
// components/ErrorBoundary.tsx
'use client';

import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Error caught by boundary:', error, errorInfo);
    // Log to error tracking service
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="error-container">
          <h1>Something went wrong</h1>
          <button onClick={() => this.setState({ hasError: false, error: null })}>
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
```

---

## High Priority Issues

### 4. Race Condition in Pose Detection Hook

**File**: `hooks/usePoseDetection.ts`
**Lines**: 112-203

**Issue**: Detection state updates (plankDetectedCountRef, plankLostCountRef) are not protected against race conditions when detection callback fires rapidly.

**Evidence**:
```typescript
if (plankResult.isPlank) {
  plankDetectedCountRef.current++;
  plankLostCountRef.current = 0;

  if (!isPlankActiveRef.current &&
      plankDetectedCountRef.current >= stabilityFrames) {
    isPlankActiveRef.current = true;
    onPlankDetected?.();  // External callback
  }
}
```

**Risk**:
- Multiple rapid detections could trigger callback multiple times
- Ref updates not atomic
- No debouncing on callback invocation

**Impact**: MEDIUM - Could cause duplicate recording starts/stops

**Recommendation**:
1. Add debouncing to callback invocations
2. Use state machine pattern for detection states
3. Add callback guards

**Example Fix**:
```typescript
const [detectionState, setDetectionState] = useState<'idle' | 'stabilizing' | 'active' | 'grace'>('idle');
const callbackInvokedRef = useRef(false);

// In detection logic
if (plankResult.isPlank) {
  plankDetectedCountRef.current++;

  if (detectionState === 'idle' && plankDetectedCountRef.current >= stabilityFrames) {
    setDetectionState('active');
    if (!callbackInvokedRef.current) {
      callbackInvokedRef.current = true;
      onPlankDetected?.();
      setTimeout(() => { callbackInvokedRef.current = false; }, 1000);
    }
  }
}
```

---

### 5. Insufficient Input Validation in Pose Detection

**File**: `lib/poseDetection.ts`
**Lines**: 95-215

**Issue**: `detectPlankPosition` assumes valid landmark data but doesn't validate array bounds or landmark structure.

**Evidence**:
```typescript
export function detectPlankPosition(landmarks: NormalizedLandmark[]): PlankDetectionResult {
  if (!areLandmarksVisible(landmarks)) {
    return { /* ... */ };
  }

  // Direct array access without bounds checking
  const nose = landmarks[POSE_LANDMARKS.NOSE];
  const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
  // ...
}
```

**Risk**:
- MediaPipe could return unexpected landmark arrays
- Missing landmarks could cause undefined access
- Malformed data could crash detection

**Impact**: MEDIUM - Detection could fail silently or crash

**Recommendation**:
Add comprehensive input validation:

```typescript
function validateLandmarks(landmarks: NormalizedLandmark[]): boolean {
  if (!Array.isArray(landmarks) || landmarks.length < 33) {
    return false;
  }

  const requiredIndices = [
    POSE_LANDMARKS.NOSE,
    POSE_LANDMARKS.LEFT_SHOULDER,
    POSE_LANDMARKS.LEFT_HIP,
    POSE_LANDMARKS.LEFT_KNEE,
    POSE_LANDMARKS.LEFT_ANKLE,
  ];

  return requiredIndices.every(idx => {
    const landmark = landmarks[idx];
    return landmark &&
           typeof landmark.x === 'number' &&
           typeof landmark.y === 'number' &&
           typeof landmark.visibility === 'number';
  });
}

export function detectPlankPosition(landmarks: NormalizedLandmark[]): PlankDetectionResult {
  if (!validateLandmarks(landmarks)) {
    return {
      isPlank: false,
      confidence: 0,
      feedback: ['Invalid pose data. Please try again.'],
    };
  }

  // ... rest of detection logic
}
```

---

### 6. Canvas Context Memory Leak

**File**: `components/VideoRecorder.tsx`
**Lines**: 202-211

**Issue**: Canvas context is reused but stored in ref without proper cleanup. Multiple re-renders could accumulate contexts.

**Evidence**:
```typescript
let ctx = canvasContextRef.current;
if (!ctx) {
  ctx = canvas.getContext('2d', {
    willReadFrequently: false,
    alpha: false
  });
  if (!ctx) return;
  canvasContextRef.current = ctx;
}
```

**Risk**:
- Context stored in ref across multiple effect runs
- No cleanup when canvas changes
- Potential memory leak with long-running sessions

**Impact**: MEDIUM - Memory accumulation over time

**Recommendation**:
1. Add canvas cleanup in effect cleanup
2. Verify context is still valid before reuse
3. Add memory monitoring

---

## Medium Priority Issues

### 7. Missing Accessibility Features

**Files**: Multiple components

**Issues**:
- No ARIA labels on video/canvas elements
- Missing keyboard navigation for recording controls
- No screen reader announcements for state changes
- Insufficient color contrast on some UI elements

**Impact**: MEDIUM - Excludes users with disabilities

**Recommendations**:
1. Add ARIA labels: `aria-label="Camera preview"` on canvas
2. Add live regions for state announcements
3. Ensure all interactive elements are keyboard accessible
4. Add focus indicators
5. Test with screen readers

**Example**:
```typescript
<canvas
  ref={canvasRef}
  className="w-full rounded-lg shadow-2xl"
  role="img"
  aria-label={`Plank timer recording ${phase === 'recording' ? 'in progress' : 'preview'}`}
  aria-live="polite"
/>

<div
  role="status"
  aria-live="assertive"
  className="sr-only"
>
  {phase === 'recording' && `Recording for ${elapsedTime} seconds`}
</div>
```

---

### 8. No Request/Response Timeout Handling

**File**: `hooks/usePoseDetection.ts`
**Lines**: 52-87

**Issue**: MediaPipe initialization has no timeout. Could hang indefinitely if CDN is slow/unavailable.

**Recommendation**:
```typescript
const initWithTimeout = async (timeoutMs = 30000) => {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('Initialization timeout')), timeoutMs)
  );

  const init = async () => {
    const vision = await FilesetResolver.forVisionTasks(
      'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm'
    );
    return await PoseLandmarker.createFromOptions(vision, { /* ... */ });
  };

  return Promise.race([init(), timeout]);
};
```

---

### 9. Hardcoded Configuration Values

**Files**: Multiple

**Issue**: Magic numbers and hardcoded URLs scattered throughout code.

**Examples**:
- Throttle interval: 100ms (usePoseDetection.ts:119)
- Stability frames: 5 (VideoRecorder.tsx:65)
- Grace period: 30 frames (VideoRecorder.tsx:66)
- MediaPipe CDN URL (usePoseDetection.ts:57)
- Canvas FPS: 30 (VideoRecorder.tsx:219)

**Recommendation**:
Create configuration file:

```typescript
// config/constants.ts
export const DETECTION_CONFIG = {
  THROTTLE_INTERVAL_MS: 100,
  STABILITY_FRAMES: 5,
  GRACE_PERIOD_FRAMES: 30,
  MIN_PLANK_CONFIDENCE: 55,
  MIN_LANDMARK_VISIBILITY: 0.3,
} as const;

export const VIDEO_CONFIG = {
  CANVAS_FPS: 30,
  VIDEO_BITRATE: 2500000,
  IDEAL_WIDTH: 1920,
  IDEAL_HEIGHT: 1080,
  ASPECT_RATIO: 16 / 9,
} as const;

export const MEDIAPIPE_CONFIG = {
  CDN_URL: process.env.NEXT_PUBLIC_MEDIAPIPE_CDN_URL ||
           'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm',
  MODEL_PATH: process.env.NEXT_PUBLIC_MEDIAPIPE_MODEL_PATH ||
              'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
} as const;
```

---

### 10. Insufficient Error Messages

**File**: `components/VideoRecorder.tsx`
**Lines**: 428-438

**Issue**: Generic error messages don't help users understand what went wrong or how to fix it.

**Current**:
```typescript
<p className="text-red-600 text-center font-semibold mb-4">
  Error: {error || poseError}
</p>
```

**Recommendation**:
Provide actionable error messages:

```typescript
const getErrorMessage = (error: string) => {
  if (error.includes('camera') || error.includes('Camera')) {
    return {
      title: 'Camera Access Denied',
      message: 'Please allow camera access in your browser settings and refresh the page.',
      action: 'Open Settings Guide',
    };
  }
  if (error.includes('MediaPipe') || error.includes('pose')) {
    return {
      title: 'Detection System Error',
      message: 'The pose detection system failed to load. Please check your internet connection.',
      action: 'Retry',
    };
  }
  return {
    title: 'Unexpected Error',
    message: error,
    action: 'Retry',
  };
};
```

---

## Low Priority Issues

### 11. Console Logging in Production

**Files**: Multiple

**Issue**: `console.log`, `console.error`, `console.warn` statements throughout code will run in production.

**Recommendation**:
1. Use proper logging library (e.g., winston, pino)
2. Add log levels based on environment
3. Remove debug logs or gate behind feature flag

---

### 12. Incomplete Type Definitions

**File**: `components/VideoRecorder.tsx`

**Issue**: Some type assertions could be stronger.

**Example**:
```typescript
streamRef.current = null;  // Could be MediaStream | null in type
```

**Recommendation**:
Add stricter types:
```typescript
const streamRef = useRef<MediaStream | null>(null);
```

---

### 13. No Progressive Enhancement

**Issue**: Application requires JavaScript and modern browser APIs. No fallback for unsupported browsers.

**Recommendation**:
1. Add feature detection
2. Show helpful message for unsupported browsers
3. Provide alternative recording method (simple timer without detection)

---

## Security Considerations

### 1. XSS Risk: Low
- No user-generated content rendered
- No innerHTML usage
- React automatic escaping in place

### 2. Data Privacy: Good
- No data sent to external servers
- Camera access properly requested
- Video stored locally only
- Discord link uses HTTPS

### 3. Dependency Vulnerabilities
```bash
npm audit
# 9 high severity vulnerabilities found
```

**Recommendation**: Run `npm audit fix` to update vulnerable dependencies

---

## Performance Analysis

### Strengths
- Lazy loading of MediaPipe (only when detection enabled)
- Canvas context reuse
- Animation frame throttling in pose detection
- Efficient landmark calculations

### Areas for Improvement

1. **Bundle Size**
   - MediaPipe library is large (~2MB)
   - Consider code splitting
   - Evaluate lighter pose detection alternatives

2. **Rendering Performance**
   - 60 FPS rendering loop even when only 10 FPS detection needed
   - Could optimize to match detection rate
   - Consider using OffscreenCanvas for better performance

3. **Memory Usage**
   - No explicit memory profiling
   - Long recording sessions not tested
   - Recommend adding memory leak tests

---

## Testing Recommendations

### Current Test Coverage
- **Utilities**: Excellent (94%+ coverage)
- **Hooks**: Good (71% coverage)
- **Components**: Needs improvement (18% coverage)
- **Integration**: Good coverage of main flows
- **E2E**: Basic coverage, expand recommended

### Specific Test Cases Needed

1. **Memory Leak Tests**
   ```typescript
   test('should not leak memory during long recording', async () => {
     const memoryBefore = performance.memory?.usedJSHeapSize;
     // Record for 60 seconds
     // Force garbage collection
     const memoryAfter = performance.memory?.usedJSHeapSize;
     expect(memoryAfter - memoryBefore).toBeLessThan(10_000_000); // 10MB
   });
   ```

2. **Race Condition Tests**
   - Rapid start/stop cycles
   - Multiple detection callbacks
   - Concurrent state updates

3. **Error Recovery Tests**
   - Camera disconnection during recording
   - MediaPipe crash recovery
   - Out of memory scenarios

4. **Browser Compatibility Tests**
   - Safari (MediaRecorder limitations)
   - Firefox (canvas performance)
   - Mobile browsers (camera orientation)

---

## Code Quality Metrics

### Strengths
- Clear file organization
- Consistent naming conventions
- Good use of TypeScript types
- Helpful code comments

### Areas for Improvement
- Some functions are too long (detectPlankPosition: 120 lines)
- Could benefit from more utility extraction
- Some complex useEffects could be split

### Suggested Refactoring

**Before** (lines 195-288 in VideoRecorder.tsx):
```typescript
useEffect(() => {
  // 93 lines of drawing logic mixed with recording logic
}, [phase, targetDuration, detectionMode, detectionResult]);
```

**After**:
```typescript
// Extract drawing logic
const useCanvasRenderer = (canvas, video, detectionResult) => {
  const drawVideo = () => { /* ... */ };
  const drawOverlay = () => { /* ... */ };
  const drawTimer = () => { /* ... */ };
  return { drawFrame: () => { drawVideo(); drawOverlay(); drawTimer(); } };
};

// Extract recording logic
const useRecordingManager = (canvas, onComplete) => {
  const startRecording = () => { /* ... */ };
  const stopRecording = () => { /* ... */ };
  return { startRecording, stopRecording, isRecording };
};

// Main component cleaner
useEffect(() => {
  const { drawFrame } = useCanvasRenderer(canvas, video, detectionResult);
  const loop = () => {
    drawFrame();
    animationFrameRef.current = requestAnimationFrame(loop);
  };
  loop();
  return () => cancelAnimationFrame(animationFrameRef.current);
}, [/* deps */]);
```

---

## Deployment Considerations

### Pre-Production Checklist

- [ ] Run full test suite (unit + integration + E2E)
- [ ] Fix npm audit vulnerabilities
- [ ] Test on Safari, Firefox, Chrome mobile
- [ ] Verify camera permissions on iOS Safari
- [ ] Test with slow network (MediaPipe loading)
- [ ] Verify Discord link is correct
- [ ] Test with different camera resolutions
- [ ] Verify detection works in various lighting
- [ ] Test Sunday rest day at midnight transition
- [ ] Verify video download on mobile
- [ ] Test landscape/portrait orientations
- [ ] Add error tracking (Sentry, etc.)
- [ ] Add analytics (optional)
- [ ] Add Content Security Policy headers
- [ ] Enable compression (gzip/brotli)
- [ ] Set up CDN for static assets

---

## Recommendations Summary

### Immediate Actions (Before Next Release)
1. Fix memory leak risk in VideoRecorder (consolidate animation loops)
2. Add Error Boundary components
3. Add input validation in pose detection
4. Fix camera initialization race condition
5. Run `npm audit fix`

### Short Term (Next Sprint)
1. Improve error messages with actionable guidance
2. Add accessibility features (ARIA labels, keyboard nav)
3. Extract hardcoded config to constants file
4. Add memory leak tests
5. Improve test coverage for components

### Long Term (Roadmap)
1. Implement performance monitoring
2. Add progressive enhancement/fallbacks
3. Refactor large components/functions
4. Add visual regression testing
5. Implement CI/CD pipeline with automated testing

---

## Conclusion

The Plank Timer application demonstrates solid engineering fundamentals with well-structured code and good separation of concerns. The pose detection algorithm is comprehensive and the timer logic is robust. However, there are critical issues around memory management and error handling that should be addressed before production deployment.

**Key Strengths:**
- Excellent utility function coverage and testing
- Thoughtful user experience design
- Comprehensive pose detection algorithm
- Good use of modern React patterns

**Key Risks:**
- Memory leak potential in long sessions
- Insufficient error boundaries
- Race conditions in detection callbacks
- Limited browser compatibility testing

**Overall Recommendation**: Address critical and high-priority issues before production deployment. The application is on a solid foundation but needs hardening for production use.

---

**Report Generated**: January 2025
**Next Review**: After critical issues resolved
**Questions**: Contact QA Team
