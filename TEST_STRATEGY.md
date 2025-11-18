# Test Strategy - Plank Timer Application

## Overview

This document outlines the comprehensive testing strategy for the Plank Timer application, including unit tests, integration tests, and end-to-end tests designed to ensure quality, prevent regressions, and catch bugs before production.

## Testing Infrastructure

### Tools & Libraries

- **Jest** (v30.2.0): Primary testing framework
- **React Testing Library** (v16.3.0): Component testing
- **Playwright** (v1.56.1): End-to-end browser testing
- **@testing-library/user-event**: User interaction simulation
- **@testing-library/jest-dom**: DOM matchers

### Configuration

- **Jest Config**: `jest.config.js` - Configured for Next.js 16 with jsdom environment
- **Playwright Config**: `playwright.config.ts` - Multi-browser E2E testing setup
- **Jest Setup**: `jest.setup.js` - Mocks for MediaPipe, MediaRecorder, canvas APIs

## Test Structure

### 1. Unit Tests

Unit tests verify individual functions and utilities in isolation.

#### Timer Logic (`utils/__tests__/timerLogic.test.ts`)
**Coverage: 100% lines, 86% branches**

Tests cover:
- Duration calculation based on day number
- Sunday rest day handling
- Day number calculation with Sunday exclusions
- Next training day calculation
- Date edge cases (leap years, year boundaries)
- Duration formatting
- Filename generation

**Key Test Scenarios:**
- Base duration on start date (Nov 17, 2025)
- Daily increment of 6 seconds
- Null duration on Sundays
- Correct Sunday skipping in calculations
- Dates before start date
- Multi-week progression
- Edge cases (leap year, year boundary)

#### Pose Detection (`lib/__tests__/poseDetection.test.ts`)
**Coverage: 94% lines, 92% branches**

Tests cover:
- Angle calculation between three points
- Landmark visibility checks
- Plank position detection algorithm
- Body alignment detection (shoulder-hip-ankle)
- Leg straightness verification
- Arm position validation (forearm vs straight-arm)
- Head/neck position checks
- Confidence scoring system
- Drawing functions (skeleton, feedback overlay)

**Key Test Scenarios:**
- Perfect plank form detection
- Various form issues (hips too low/high, bent legs, incorrect arm position)
- Missing or low-visibility landmarks
- Confidence thresholds (55% minimum for plank detection)
- Edge cases (out of frame, extreme positions)
- Canvas drawing with different landmark sets

#### Video Recorder (`utils/__tests__/videoRecorder.test.ts`)
**Coverage: 92% lines, 90% branches**

Tests cover:
- VideoRecorder class initialization
- Recording start/stop functionality
- Blob creation and MIME type handling
- State management (inactive/recording/paused)
- Download functionality
- Camera stream access with proper constraints
- Error handling (permission denied, camera unavailable)
- Multiple recording cycles

**Key Test Scenarios:**
- Default and custom recorder options
- MIME type support detection
- Data chunk collection during recording
- Proper cleanup after recording
- Camera permission errors
- Rear camera (environment) selection
- Landscape orientation (1920x1080, 16:9)
- Rapid start/stop cycles

### 2. Hook Tests

Tests for custom React hooks that manage complex state and side effects.

#### usePoseDetection (`hooks/__tests__/usePoseDetection.test.tsx`)
**Coverage: 71% lines, 55% branches**

Tests cover:
- MediaPipe initialization and loading
- Pose detection from video frames
- Detection throttling (~10 FPS)
- Plank detected/lost callbacks
- Stability frames (5 consecutive frames)
- Grace period (30 frames before confirming plank lost)
- Error handling (MediaPipe errors, null video)
- Cleanup and memory management
- Reset functionality

**Key Test Scenarios:**
- Initialization with/without detection enabled
- Detection result updates
- Callback invocation after stability threshold
- Grace period before declaring plank lost
- MediaPipe internal error recovery (code 5)
- Memory cleanup between frames

### 3. Component Tests

Tests for React components verifying UI behavior and user interactions.

#### PlankTimer (`components/__tests__/PlankTimer.test.tsx`)
**Coverage: 18% lines (mocked VideoRecorder)**

Tests cover:
- Initial render in idle state
- Day number and duration display
- Detection mode toggle
- State transitions (idle → recording → completed)
- Error handling and recovery
- Reset functionality
- Discord link presence
- Accessibility (headings, buttons, labels)

**Key Test Scenarios:**
- Display of correct day and duration
- Detection mode checkbox behavior
- Button text changes with detection mode
- Transition to recording when start clicked
- Transition to completed after recording
- Error message display and recovery
- Rest day component rendering (Sunday)
- Multi-day progression simulation

### 4. Integration Tests

Tests that verify multiple components working together.

#### User Flows (`__tests__/integration/user-flows.test.tsx`)

Tests cover complete user journeys:

1. **Manual Recording Flow**
   - View challenge → Enable manual mode → Start → Record → Complete → View results
   - Multiple consecutive recordings

2. **Detection Mode Flow**
   - Enable detection → Start → Auto-detect plank → Record → Auto-stop → Complete
   - Detection mode persistence across recordings

3. **Error Recovery Flow**
   - Start recording → Error occurs → Return to idle → Retry successful
   - Multiple error scenarios

4. **Rest Day Flow**
   - Sunday detection → Display rest day component → No recording controls

5. **Multi-Day Progression**
   - Verify increasing durations across multiple days
   - Correct day numbering with Sunday skips

6. **UI State Consistency**
   - Proper element visibility in each state
   - No lingering elements from previous states

### 5. End-to-End Tests

Browser-based tests using Playwright to verify the complete application.

#### E2E Tests (`e2e/plank-timer.spec.ts`)

**Test Suites:**

1. **Plank Timer E2E Tests**
   - Home page display and information
   - Detection mode toggle
   - Discord link functionality
   - Recording flow initiation
   - Responsive design (mobile, tablet)
   - State persistence

2. **Accessibility Tests**
   - No accessibility violations
   - Keyboard navigation support
   - Proper ARIA labels
   - Heading hierarchy

3. **Performance Tests**
   - Page load time < 3 seconds
   - No console errors on load

4. **Error Scenarios**
   - Missing camera permission handling
   - Offline mode functionality

## Running Tests

### All Tests
```bash
npm test                 # Run all Jest tests with coverage
npm run test:watch       # Run tests in watch mode
```

### Specific Test Suites
```bash
npm run test:unit        # Run unit tests only (lib, utils, hooks)
npm run test:component   # Run component tests only
npm run test:integration # Run integration tests only
npm run test:e2e         # Run Playwright E2E tests
npm run test:e2e:ui      # Run E2E tests with UI
```

### Complete Test Suite
```bash
npm run test:all         # Run all Jest + Playwright tests
```

## Coverage Goals

### Current Coverage (Jan 2025)

| Metric     | Target | Current | Status |
|------------|--------|---------|--------|
| Statements | 35%    | 37.18%  | ✅     |
| Branches   | 30%    | 28.96%  | ⚠️     |
| Functions  | 25%    | 26.98%  | ✅     |
| Lines      | 35%    | 37.67%  | ✅     |

### High-Coverage Modules

- **poseDetection.ts**: 94% lines, 92% branches ✨
- **timerLogic.ts**: 100% lines, 86% branches ✨
- **videoRecorder.ts**: 92% lines, 90% branches ✨
- **usePoseDetection.ts**: 71% lines, 55% branches ✅

### Areas for Improvement

- **VideoRecorder component**: Currently 0% (heavy browser API usage, requires E2E)
- **PlankTimer component**: 18% lines (improve integration test coverage)
- **ServiceWorker**: 0% (future enhancement)
- **canvasOptimizations**: 0% (future enhancement)

## Test Data & Mocks

### Mocked Dependencies

1. **MediaPipe Pose** (`@mediapipe/tasks-vision`)
   - FilesetResolver.forVisionTasks
   - PoseLandmarker.createFromOptions
   - detectForVideo method

2. **Browser APIs**
   - MediaRecorder (video recording)
   - navigator.mediaDevices.getUserMedia (camera access)
   - HTMLCanvasElement methods (drawing, captureStream)
   - requestAnimationFrame / cancelAnimationFrame
   - URL.createObjectURL / revokeObjectURL

3. **Performance APIs**
   - performance.now()
   - Date.now()

### Test Fixtures

- Mock NormalizedLandmark arrays for pose detection
- Mock MediaStream objects for video recording
- Mock canvas contexts with all drawing methods
- Mock video elements with proper dimensions

## Continuous Integration

### Pre-commit Checks
```bash
npm test                 # All tests must pass
npm run lint             # Linting must pass
```

### CI Pipeline Recommendations

1. **On Pull Request**
   - Run all unit tests
   - Run integration tests
   - Generate coverage report
   - Check coverage thresholds

2. **On Merge to Main**
   - Run full test suite including E2E
   - Generate and publish coverage report
   - Run performance benchmarks

3. **Nightly Builds**
   - Full E2E test suite across all browsers
   - Visual regression tests
   - Performance profiling

## Test Best Practices

### 1. Test Organization
- One test file per source file
- Clear describe blocks for functionality groups
- Descriptive test names following "should..." pattern
- Setup/teardown in beforeEach/afterEach

### 2. Test Independence
- Each test should run independently
- No shared state between tests
- Proper cleanup in afterEach
- Reset mocks between tests

### 3. Coverage vs Quality
- Focus on meaningful tests, not just coverage numbers
- Test edge cases and error paths
- Verify behavior, not implementation details
- Use integration tests for critical user flows

### 4. Maintainability
- Keep tests simple and readable
- Use helper functions for repetitive setup
- Comment complex test scenarios
- Update tests when requirements change

## Known Limitations

1. **VideoRecorder Component**: Difficult to test fully in jsdom due to heavy browser API usage (MediaRecorder, canvas streams). Best tested via E2E.

2. **MediaPipe Integration**: Real MediaPipe library not loaded in tests; uses mocks. Actual pose detection accuracy must be validated manually.

3. **Camera Permissions**: E2E tests mock camera permissions; real device testing needed for permission flows.

4. **Performance Tests**: Current E2E performance tests are basic. More comprehensive performance testing (memory leaks, frame rates) should be added.

5. **Visual Regression**: No automated visual regression testing currently implemented.

## Future Enhancements

1. **Visual Regression Testing**
   - Add Playwright screenshot comparisons
   - Test UI consistency across browsers

2. **Performance Profiling**
   - Memory leak detection tests
   - Frame rate consistency tests
   - Detection latency benchmarks

3. **Accessibility Testing**
   - Automated axe-core integration
   - Screen reader compatibility tests

4. **Load Testing**
   - Multiple concurrent users
   - Long-duration sessions
   - Memory usage over time

5. **Cross-Browser Testing**
   - Expand E2E to Safari, Edge, Firefox
   - Mobile browser testing (iOS Safari, Chrome Mobile)

## Debugging Failed Tests

### Common Issues

1. **Timeout Errors**
   - Increase test timeout in jest.config.js
   - Check for missing `await` in async tests
   - Verify mock implementations are synchronous

2. **Async State Updates**
   - Use `waitFor` from @testing-library/react
   - Wrap state updates in `act()`
   - Check for race conditions

3. **Mock Issues**
   - Verify mocks are cleared between tests
   - Check mock return values match expected types
   - Ensure jest.setup.js loads before tests

4. **Flaky Tests**
   - Add explicit waits for async operations
   - Avoid time-dependent assertions
   - Use deterministic test data

## Contributing Guidelines

When adding new features:

1. **Write tests first** (TDD approach recommended)
2. **Maintain coverage** - New code should have ≥70% coverage
3. **Test error paths** - Don't just test happy paths
4. **Update this document** - Add new test scenarios to strategy
5. **Run full suite** before submitting PR

## Support & Resources

- **Jest Documentation**: https://jestjs.io/
- **React Testing Library**: https://testing-library.com/react
- **Playwright Docs**: https://playwright.dev/
- **Testing Best Practices**: https://kentcdodds.com/blog/common-mistakes-with-react-testing-library

---

**Last Updated**: January 2025
**Version**: 1.0
**Maintained By**: QA Team
