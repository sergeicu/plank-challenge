# Technical Architecture Specification Document
## Plank Timer - 30-Day Challenge Web Application

**Version:** 1.0.0
**Date:** November 2024
**Status:** Current Implementation

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Current Architecture Analysis](#2-current-architecture-analysis)
3. [Component Architecture](#3-component-architecture)
4. [Data Architecture](#4-data-architecture)
5. [Integration Points](#5-integration-points)
6. [Ideal Architecture Recommendations](#6-ideal-architecture-recommendations)
7. [Performance & Optimization](#7-performance--optimization)
8. [Security & Privacy](#8-security--privacy)
9. [Testing Strategy](#9-testing-strategy)
10. [Development & Deployment](#10-development--deployment)

---

## 1. System Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser Client                           │
├─────────────────────────────────────────────────────────────────┤
│                    Next.js 16 App (React 19)                    │
├────────────────┬────────────────┬─────────────┬────────────────┤
│   UI Layer     │  State Machine  │  MediaPipe  │  Local Storage │
│  (Tailwind)    │   (React State) │   (Pose)    │   (Progress)   │
└────────────────┴────────────────┴─────────────┴────────────────┘
                              ▼
                    ┌──────────────────┐
                    │  Vercel Platform  │
                    │   (Static Host)   │
                    └──────────────────┘
```

### 1.2 Technology Stack

#### Frontend Framework
- **Next.js 16.0.3**: React meta-framework with App Router
- **React 19.2.0**: UI library with concurrent features
- **TypeScript 5.9.3**: Type-safe JavaScript

#### Styling & UI
- **Tailwind CSS 4.1.17**: Utility-first CSS framework
- **PostCSS**: CSS processing with autoprefixer

#### Computer Vision
- **MediaPipe Pose 0.10.22**: Body landmark detection
- **WebGL/GPU acceleration**: Hardware-accelerated processing

#### Utilities
- **date-fns 4.1.0**: Date manipulation
- **MediaRecorder API**: Native browser video recording

#### Development & Testing
- **Jest 30.2.0**: Unit testing framework
- **Playwright 1.56.1**: E2E testing
- **Testing Library**: React component testing

### 1.3 Deployment Architecture

```
┌────────────────────────────────────────────────────────┐
│                     GitHub Repository                   │
└────────────────────────┬───────────────────────────────┘
                         │ Push to main
                         ▼
┌────────────────────────────────────────────────────────┐
│                    Vercel Build                         │
│  • Next.js build with Turbopack                        │
│  • Static optimization                                  │
│  • Edge network deployment                              │
└────────────────────────┬───────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────┐
│                  Vercel Edge Network                    │
├────────────────────────────────────────────────────────┤
│    CDN Nodes    │    Edge Functions    │    Analytics  │
└────────────────────────────────────────────────────────┘
```

---

## 2. Current Architecture Analysis

### 2.1 Application Flow

```
User Journey:
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│   Idle   │────▶│ Recording│────▶│ Preview  │────▶│ Complete │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                │                  │               │
     │                │                  │               │
     ▼                ▼                  ▼               ▼
[Start Button]  [Canvas Stream]    [Video Blob]    [Download]
                [Pose Detection]                    [localStorage]
```

### 2.2 Data Flow

```
Camera Stream ──▶ Video Element ──▶ Canvas
                        │              │
                        ▼              ▼
                  Pose Detection   Canvas Stream
                        │              │
                        ▼              ▼
                  Plank Validation  MediaRecorder
                        │              │
                        ▼              ▼
                  UI Feedback      Video Blob
                                      │
                                      ▼
                                  Download/Save
```

### 2.3 State Management Pattern

The application uses a **Phase-Based State Machine** implemented with React hooks:

```typescript
type RecordingPhase =
  | 'preparing'   // Camera initialization
  | 'countdown'   // 10-second countdown
  | 'detecting'   // Waiting for plank position
  | 'recording'   // Active recording
  | 'preview'     // Review recorded video
  | 'completed';  // Final state

type AppState =
  | 'idle'        // Main menu
  | 'recording'   // Recording flow active
  | 'completed';  // Challenge complete
```

### 2.4 Performance Characteristics

#### Current Metrics
- **Initial Load**: ~400KB JS (gzipped)
- **MediaPipe Lazy Load**: ~300KB (separate chunk)
- **FPS Performance**:
  - Video rendering: 30 FPS
  - Pose detection: 10 FPS (throttled)
  - Canvas drawing: 30 FPS
- **Memory Usage**: ~150-250MB during recording
- **GPU Usage**: 20-40% (with hardware acceleration)

---

## 3. Component Architecture

### 3.1 Component Hierarchy

```
App
├── PlankTimer (Main Controller)
│   ├── VideoRecorder (Recording Engine)
│   │   ├── usePoseDetection (Hook)
│   │   ├── Canvas (Video + Overlays)
│   │   └── MediaRecorder (API)
│   ├── RestDay (Sunday Screen)
│   ├── ShareToDiscord (Social)
│   └── UsernamePrompt (Modal)
├── LocalLeaderboard (Progress)
│   ├── StatsCards
│   ├── ProgressGrid
│   └── CompletionList
└── ServiceWorkerProvider (PWA)
```

### 3.2 Component Responsibilities

#### PlankTimer.tsx
**Type**: Container Component
**State**: App phase, user preferences, completion data
**Props**: None (root component)
**Responsibilities**:
- Main application state machine
- User preference management (camera, detection mode)
- Orchestration of child components
- Navigation between phases

#### VideoRecorder.tsx
**Type**: Complex Functional Component
**State**: Recording phase, timer, video blob, detection results
**Props**:
```typescript
{
  targetDuration: number;
  onComplete: (elapsedTime: number) => void;
  onError: (error: string) => void;
  detectionMode?: boolean;
  cameraMode?: 'user' | 'environment';
}
```
**Responsibilities**:
- Camera stream management
- Canvas rendering pipeline
- Video recording via MediaRecorder API
- Pose detection integration
- Timer overlay rendering
- Performance optimization

#### usePoseDetection Hook
**Type**: Custom React Hook
**Returns**: Detection state and methods
**Responsibilities**:
- MediaPipe initialization
- Frame-by-frame pose detection
- Plank position validation
- Stability filtering (5 frames to confirm)
- Grace period handling (30 frames before stop)
- Memory management

### 3.3 Component Interaction Patterns

```
PlankTimer ──props──▶ VideoRecorder
    │                      │
    │                      ├──uses──▶ usePoseDetection
    │                      │              │
    │                      │              └──loads──▶ MediaPipe
    │                      │
    │                      └──emits──▶ onComplete/onError
    │
    └──updates──▶ localStorage (via utils)
```

---

## 4. Data Architecture

### 4.1 localStorage Schema

#### Completions Storage
**Key**: `plank_completions`
**Type**: JSON Array
```typescript
interface Completion {
  day: number;              // 1-30
  date: string;            // "YYYY-MM-DD"
  duration: number;        // seconds held
  targetDuration: number;  // required seconds
  success: boolean;        // met target?
  timestamp: number;       // Date.now()
}
```

#### User Profile
**Key**: `plank_username`
**Type**: String

### 4.2 Data Models (TypeScript Interfaces)

```typescript
// Pose Detection
interface PlankDetectionResult {
  isPlank: boolean;
  confidence: number;        // 0-100
  feedback: string[];
  landmarks?: NormalizedLandmark[];
}

// User Statistics
interface UserStats {
  username: string;
  completions: Completion[];
  daysCompleted: number;
  currentStreak: number;
  longestStreak: number;
  totalSeconds: number;
  stillInRunning: boolean;
  missedDays: number[];
}

// Recording State
interface RecordingState {
  phase: RecordingPhase;
  countdown: number;
  elapsedTime: number;
  videoBlob: Blob | null;
  finalFrameData: string | null;
}
```

### 4.3 Data Lifecycle

```
1. Session Start
   ├── Load username from localStorage
   └── Calculate current day from START_DATE

2. Recording
   ├── Stream camera to video element
   ├── Draw video + overlays to canvas
   ├── Capture canvas stream (30 FPS)
   └── Record to blob via MediaRecorder

3. Completion
   ├── Generate video blob
   ├── Auto-download video file
   ├── Save completion to localStorage
   └── Update statistics

4. Progress View
   ├── Load all completions
   ├── Calculate statistics
   └── Generate visualizations
```

---

## 5. Integration Points

### 5.1 MediaPipe Pose Integration

#### Architecture
```
Video Element ──▶ MediaPipe PoseLandmarker
                         │
                         ▼
                  33 Body Landmarks
                         │
                         ▼
                  Plank Detection Algorithm
                         │
                         ▼
                  UI Feedback + Skeleton Overlay
```

#### Configuration
- **Model**: pose_landmarker_lite (float16)
- **Delegate**: GPU (WebGL acceleration)
- **Detection Rate**: 10 FPS (throttled)
- **Confidence Thresholds**: 0.3
- **Lazy Loading**: Dynamic import with code splitting

### 5.2 MediaRecorder API

#### Implementation
```javascript
const canvasStream = canvas.captureStream(30);
const recorder = new MediaRecorder(canvasStream, {
  mimeType: 'video/webm',
  videoBitsPerSecond: 2500000
});
```

#### Codec Support
- Primary: VP9 (video/webm;codecs=vp9)
- Fallback: VP8 (video/webm;codecs=vp8)
- Format: WebM container

### 5.3 Discord Integration

**Current**: Link-only integration
```
User clicks Discord button
    ├── Opens Discord channel link
    └── User manually shares results
```

**Future Potential**: Webhook integration for automated posting

---

## 6. Ideal Architecture Recommendations

### 6.1 Current vs Ideal State Comparison

| Aspect | Current State | Ideal State | Migration Path |
|--------|--------------|-------------|----------------|
| **Data Storage** | localStorage only | Firebase/Supabase backend | Phase 2: Add backend API |
| **Authentication** | None (local only) | OAuth2/Social login | Implement NextAuth.js |
| **State Management** | React useState | Zustand/Redux Toolkit | Gradual migration |
| **Video Storage** | Local download only | Cloud storage (S3/Cloudinary) | Add upload capability |
| **Social Features** | Manual Discord share | Automated posting, leaderboard | Discord bot integration |
| **Offline Support** | Limited PWA | Full offline capability | Enhanced service worker |
| **Analytics** | None | Vercel Analytics + custom | Add tracking events |

### 6.2 Scalability Concerns

#### Current Limitations
1. **Data Persistence**: Browser-only storage vulnerable to data loss
2. **Multi-Device**: No sync between devices
3. **Social Features**: No real multiplayer/competition features
4. **Performance**: Large MediaPipe library affects initial load
5. **Mobile Support**: Limited mobile browser compatibility

#### Recommended Improvements

##### Short-term (Phase 1.5)
```typescript
// Add IndexedDB for video storage
interface VideoStorage {
  saveVideo(blob: Blob, metadata: VideoMetadata): Promise<string>;
  getVideo(id: string): Promise<Blob>;
  listVideos(): Promise<VideoMetadata[]>;
}

// Implement state persistence
interface AppStateManager {
  saveState(state: AppState): void;
  loadState(): AppState | null;
  subscribe(listener: StateListener): Unsubscribe;
}
```

##### Medium-term (Phase 2)
```typescript
// Backend API structure
interface PlankAPI {
  auth: {
    login(provider: AuthProvider): Promise<User>;
    logout(): Promise<void>;
  };

  challenges: {
    submitCompletion(data: CompletionData): Promise<void>;
    getLeaderboard(filter: LeaderboardFilter): Promise<Entry[]>;
    getUserStats(userId: string): Promise<UserStats>;
  };

  videos: {
    upload(blob: Blob, metadata: VideoMetadata): Promise<VideoUrl>;
    getPresignedUrl(videoId: string): Promise<string>;
  };
}
```

### 6.3 Technical Debt to Address

#### Priority 1 - Critical
1. **Error Boundary Implementation**: Add React error boundaries
2. **Memory Leak Prevention**: Ensure all streams/workers are cleaned up
3. **Browser Compatibility**: Add feature detection and fallbacks

#### Priority 2 - Important
1. **Code Splitting**: Further optimize bundle sizes
2. **Test Coverage**: Increase from current ~0% to 80%+
3. **Type Safety**: Stricter TypeScript configurations
4. **Accessibility**: WCAG 2.1 AA compliance

#### Priority 3 - Enhancement
1. **Component Library**: Extract reusable UI components
2. **Monitoring**: Add error tracking (Sentry)
3. **Documentation**: API documentation, component storybook

### 6.4 Migration Path to Backend

```
Phase 2.0: Foundation
├── Setup Supabase/Firebase project
├── Implement authentication
└── Create database schema

Phase 2.1: Data Migration
├── Sync local data to cloud
├── Implement conflict resolution
└── Add offline queue

Phase 2.2: Social Features
├── Real-time leaderboard
├── User profiles
└── Challenge groups

Phase 2.3: Enhanced Features
├── Video cloud storage
├── AI form coaching
└── Progress analytics
```

---

## 7. Performance & Optimization

### 7.1 Current Optimizations

#### Bundle Optimization
```javascript
// Dynamic imports for code splitting
const MediaPipe = lazy(() => import('@mediapipe/tasks-vision'));

// Tree shaking with optimizePackageImports
experimental: {
  optimizePackageImports: ['@mediapipe/tasks-vision', 'date-fns']
}
```

#### Memory Management
```javascript
// Canvas context reuse
let ctx = canvasContextRef.current;
if (!ctx) {
  ctx = getOptimizedCanvasContext(canvas, {
    alpha: false,
    desynchronized: true,
    willReadFrequently: false
  });
}

// Cleanup on unmount
useEffect(() => {
  return () => {
    stream?.getTracks().forEach(track => track.stop());
    cancelAnimationFrame(animationFrameRef.current);
  };
}, []);
```

#### Rendering Optimization
```javascript
// Memoized components
export default memo(VideoRecorder);

// Memoized calculations
const targetDuration = useMemo(() => calculateTargetDuration(), []);

// Throttled detection (100ms intervals)
if (now - lastDetectionTimeRef.current < 100) return;
```

### 7.2 Bundle Size Analysis

```
Page                Size     First Load JS
┌ ○ /               12.3 kB        412 kB
├ ○ /progress       8.7 kB         408 kB
└ ○ /_not-found     2.1 kB         397 kB

Chunks:
├ main.js           395 kB (shared)
├ mediapipe.js      298 kB (lazy loaded)
└ framework.js      89 kB
```

### 7.3 Further Optimization Opportunities

#### 1. Image/Video Optimization
```javascript
// Implement adaptive quality based on device
const getVideoQuality = () => {
  const connection = navigator.connection;
  if (connection?.effectiveType === '4g') return 2500000;
  if (connection?.effectiveType === '3g') return 1500000;
  return 1000000;
};
```

#### 2. Web Workers for Heavy Processing
```javascript
// Move pose detection to worker thread
const poseWorker = new Worker('/workers/pose-detection.js');
poseWorker.postMessage({ frame: videoFrame });
poseWorker.onmessage = (e) => handleDetectionResult(e.data);
```

#### 3. Request Animation Frame Optimization
```javascript
// Use frame budget monitoring
const frameDeadline = 16; // 60fps target
let frameStart = performance.now();

const drawFrame = () => {
  const elapsed = performance.now() - frameStart;
  if (elapsed < frameDeadline) {
    // Render frame
  } else {
    // Skip frame to maintain performance
  }
};
```

---

## 8. Security & Privacy

### 8.1 Current Approach

#### Privacy-First Design
- **No Backend**: All data stored locally
- **No Tracking**: No analytics or user tracking
- **No Account Required**: Anonymous usage
- **Local Processing**: Pose detection runs in-browser
- **Explicit Permissions**: Camera access requested explicitly

#### Security Headers (via Next.js config)
```javascript
headers: [
  'Strict-Transport-Security: max-age=63072000',
  'X-Content-Type-Options: nosniff',
  'X-Frame-Options: SAMEORIGIN',
  'Referrer-Policy: strict-origin-when-cross-origin'
]
```

### 8.2 Future Backend Security Considerations

#### Authentication & Authorization
```typescript
// Recommended implementation
interface SecurityLayer {
  auth: {
    provider: 'Supabase' | 'Firebase' | 'Auth0';
    methods: ['email', 'oauth2', 'magic-link'];
    mfa: boolean;
  };

  api: {
    rateLimit: '100 req/min per user';
    cors: ['https://plank-timer.vercel.app'];
    validation: 'zod schemas';
  };

  data: {
    encryption: 'at-rest and in-transit';
    pii: 'minimal collection, GDPR compliant';
    retention: '90 days for videos, indefinite for stats';
  };
}
```

#### Privacy Compliance
- GDPR compliance with data export/deletion
- COPPA compliance (no users under 13)
- Privacy policy and terms of service
- Cookie consent for analytics

---

## 9. Testing Strategy

### 9.1 Current Test Coverage

```json
{
  "coverage": {
    "statements": 0,
    "branches": 0,
    "functions": 0,
    "lines": 0
  }
}
```

### 9.2 Recommended Testing Approach

#### Unit Testing (Jest + Testing Library)
```typescript
// Component testing example
describe('PlankTimer', () => {
  it('should start recording when button clicked', async () => {
    render(<PlankTimer />);
    const startButton = screen.getByText(/Start Recording/i);
    fireEvent.click(startButton);
    await waitFor(() => {
      expect(screen.getByText(/Recording/i)).toBeInTheDocument();
    });
  });
});

// Hook testing example
describe('usePoseDetection', () => {
  it('should detect plank after stability frames', () => {
    const { result } = renderHook(() => usePoseDetection({
      stabilityFrames: 5
    }));
    // Simulate 5 frames of plank position
    act(() => result.current.detectPose(mockVideo));
    expect(result.current.detectionResult?.isPlank).toBe(true);
  });
});
```

#### Integration Testing
```typescript
// API integration tests (Phase 2)
describe('Challenge API', () => {
  it('should submit completion and update leaderboard', async () => {
    const completion = await api.submitCompletion(mockData);
    const leaderboard = await api.getLeaderboard();
    expect(leaderboard).toContainEqual(
      expect.objectContaining({ id: completion.id })
    );
  });
});
```

#### E2E Testing (Playwright)
```typescript
test('complete plank challenge flow', async ({ page }) => {
  await page.goto('/');
  await page.click('text=Start Recording');
  await page.waitForSelector('canvas');
  // Wait for recording
  await page.waitForTimeout(10000);
  await page.click('text=Stop');
  await page.click('text=Download Video');
  // Verify completion
  expect(await page.textContent('h2')).toContain('Congratulations');
});
```

### 9.3 Test Coverage Goals

| Component | Target Coverage | Priority |
|-----------|----------------|----------|
| Business Logic (utils) | 95% | High |
| Hooks | 90% | High |
| UI Components | 80% | Medium |
| Integration | 70% | Medium |
| E2E Critical Paths | 100% | High |

---

## 10. Development & Deployment

### 10.1 Build Process

```bash
# Development
npm run dev        # Next.js dev server with HMR
npm run test:watch # Jest in watch mode

# Production
npm run build      # Next.js production build
npm run test:all   # Full test suite
npm run start      # Production server

# Analysis
npm run analyze    # Bundle analyzer
npm run lighthouse # Performance audit
```

### 10.2 CI/CD Pipeline

```yaml
# Recommended GitHub Actions workflow
name: Deploy
on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm ci
      - run: npm run test
      - run: npm run build

  deploy:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: vercel/action@v3
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
```

### 10.3 Environment Configuration

#### Development
```env
NODE_ENV=development
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_DISCORD_URL=https://discord.test
```

#### Production
```env
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://api.plank-timer.com
NEXT_PUBLIC_DISCORD_URL=https://discord.com/channels/...
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
```

### 10.4 Monitoring & Observability

#### Recommended Stack
1. **Performance**: Vercel Analytics + Web Vitals
2. **Errors**: Sentry for error tracking
3. **Uptime**: Better Uptime or Pingdom
4. **User Analytics**: Plausible or Fathom (privacy-first)

#### Key Metrics to Track
```typescript
interface MetricsToTrack {
  performance: {
    pageLoadTime: number;
    timeToInteractive: number;
    fps: number;
    memoryUsage: number;
  };

  usage: {
    dailyActiveUsers: number;
    completionRate: number;
    averagePlankDuration: number;
    detectionModeUsage: number;
  };

  errors: {
    cameraAccessFailures: number;
    mediaPipeLoadFailures: number;
    recordingErrors: number;
  };
}
```

---

## Conclusion

The Plank Timer application demonstrates a well-architected client-side web application with sophisticated computer vision capabilities. The current implementation successfully delivers core functionality with good performance characteristics and user experience.

### Strengths
- Clean component architecture with clear separation of concerns
- Effective use of React 19 and Next.js 16 features
- Performance-conscious implementation with lazy loading and optimization
- Privacy-first approach with local-only data storage
- Modern development practices with TypeScript

### Areas for Growth
- Backend integration for multi-device sync and social features
- Comprehensive test coverage
- Enhanced error handling and monitoring
- Accessibility improvements
- Mobile app development (React Native or PWA enhancement)

### Next Steps
1. Implement error boundaries and improved error handling
2. Add comprehensive test suite
3. Plan and implement Phase 2 backend architecture
4. Enhance mobile experience
5. Add analytics and monitoring

This architecture provides a solid foundation for both current operation and future expansion while maintaining code quality, performance, and user privacy.

---

**Document Version History**
- v1.0.0 - Initial comprehensive specification (November 2024)