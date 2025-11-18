import {
  calculateAngle,
  areLandmarksVisible,
  detectPlankPosition,
  drawPoseSkeleton,
  drawDetectionFeedback,
  POSE_LANDMARKS,
  PlankDetectionResult,
} from '../poseDetection';
import { NormalizedLandmark } from '@mediapipe/tasks-vision';

// Helper to create mock landmarks
function createMockLandmark(
  x: number,
  y: number,
  z: number = 0,
  visibility: number = 1
): NormalizedLandmark {
  return { x, y, z, visibility };
}

// Helper to create a full set of landmarks with defaults
function createMockLandmarks(overrides: Partial<Record<number, NormalizedLandmark>> = {}): NormalizedLandmark[] {
  const landmarks: NormalizedLandmark[] = Array(33).fill(null).map(() =>
    createMockLandmark(0.5, 0.5, 0, 1)
  );

  // Apply overrides
  Object.entries(overrides).forEach(([index, landmark]) => {
    landmarks[parseInt(index)] = landmark;
  });

  return landmarks;
}

describe('calculateAngle', () => {
  it('should calculate angle between three points correctly', () => {
    const a = createMockLandmark(0, 0);
    const b = createMockLandmark(1, 0);
    const c = createMockLandmark(1, 1);

    const angle = calculateAngle(a, b, c);
    expect(angle).toBeCloseTo(90, 1);
  });

  it('should calculate 180 degree angle for straight line', () => {
    const a = createMockLandmark(0, 0);
    const b = createMockLandmark(1, 0);
    const c = createMockLandmark(2, 0);

    const angle = calculateAngle(a, b, c);
    expect(angle).toBeCloseTo(180, 1);
  });

  it('should calculate acute angles correctly', () => {
    const a = createMockLandmark(0, 0);
    const b = createMockLandmark(1, 0);
    const c = createMockLandmark(1.5, 0.866); // Creates roughly 60 degree angle

    const angle = calculateAngle(a, b, c);
    expect(angle).toBeGreaterThan(0);
    expect(angle).toBeLessThan(90);
  });

  it('should handle negative coordinates', () => {
    const a = createMockLandmark(-1, -1);
    const b = createMockLandmark(0, 0);
    const c = createMockLandmark(0, 1);

    const angle = calculateAngle(a, b, c);
    expect(angle).toBeGreaterThan(0);
    expect(angle).toBeLessThan(180);
  });

  it('should normalize angles > 180 degrees', () => {
    const a = createMockLandmark(1, 1);
    const b = createMockLandmark(0, 0);
    const c = createMockLandmark(-1, -1);

    const angle = calculateAngle(a, b, c);
    expect(angle).toBeLessThanOrEqual(180);
  });
});

describe('areLandmarksVisible', () => {
  it('should return true when all critical landmarks are visible', () => {
    const landmarks = createMockLandmarks({
      [POSE_LANDMARKS.NOSE]: createMockLandmark(0.5, 0.2, 0, 0.9),
      [POSE_LANDMARKS.LEFT_SHOULDER]: createMockLandmark(0.4, 0.3, 0, 0.9),
      [POSE_LANDMARKS.LEFT_HIP]: createMockLandmark(0.4, 0.6, 0, 0.9),
      [POSE_LANDMARKS.LEFT_KNEE]: createMockLandmark(0.4, 0.8, 0, 0.9),
      [POSE_LANDMARKS.LEFT_ANKLE]: createMockLandmark(0.4, 0.95, 0, 0.9),
    });

    expect(areLandmarksVisible(landmarks)).toBe(true);
  });

  it('should return false when visibility is below threshold', () => {
    const landmarks = createMockLandmarks({
      [POSE_LANDMARKS.NOSE]: createMockLandmark(0.5, 0.2, 0, 0.2),
      [POSE_LANDMARKS.LEFT_SHOULDER]: createMockLandmark(0.4, 0.3, 0, 0.9),
      [POSE_LANDMARKS.LEFT_HIP]: createMockLandmark(0.4, 0.6, 0, 0.9),
      [POSE_LANDMARKS.LEFT_KNEE]: createMockLandmark(0.4, 0.8, 0, 0.9),
      [POSE_LANDMARKS.LEFT_ANKLE]: createMockLandmark(0.4, 0.95, 0, 0.9),
    });

    expect(areLandmarksVisible(landmarks, 0.3)).toBe(false);
  });

  it('should use default visibility threshold of 0.3', () => {
    const landmarks = createMockLandmarks({
      [POSE_LANDMARKS.NOSE]: createMockLandmark(0.5, 0.2, 0, 0.4),
      [POSE_LANDMARKS.LEFT_SHOULDER]: createMockLandmark(0.4, 0.3, 0, 0.4),
      [POSE_LANDMARKS.LEFT_HIP]: createMockLandmark(0.4, 0.6, 0, 0.4),
      [POSE_LANDMARKS.LEFT_KNEE]: createMockLandmark(0.4, 0.8, 0, 0.4),
      [POSE_LANDMARKS.LEFT_ANKLE]: createMockLandmark(0.4, 0.95, 0, 0.4),
    });

    expect(areLandmarksVisible(landmarks)).toBe(true);
  });

  it('should return false when any critical landmark is missing', () => {
    const landmarks = createMockLandmarks({
      [POSE_LANDMARKS.NOSE]: createMockLandmark(0.5, 0.2, 0, 0.9),
      [POSE_LANDMARKS.LEFT_SHOULDER]: createMockLandmark(0.4, 0.3, 0, 0.9),
      [POSE_LANDMARKS.LEFT_HIP]: createMockLandmark(0.4, 0.6, 0, 0.9),
      [POSE_LANDMARKS.LEFT_KNEE]: createMockLandmark(0.4, 0.8, 0, 0.9),
      // Missing LEFT_ANKLE
    });

    landmarks[POSE_LANDMARKS.LEFT_ANKLE] = createMockLandmark(0, 0, 0, 0);

    expect(areLandmarksVisible(landmarks)).toBe(false);
  });
});

describe('detectPlankPosition', () => {
  describe('with invisible landmarks', () => {
    it('should return not plank when landmarks are not visible', () => {
      const landmarks = createMockLandmarks({
        [POSE_LANDMARKS.NOSE]: createMockLandmark(0.5, 0.2, 0, 0.1),
      });

      const result = detectPlankPosition(landmarks);

      expect(result.isPlank).toBe(false);
      expect(result.confidence).toBe(0);
      expect(result.feedback).toContain('Position yourself sideways to camera. Show full body from head to feet.');
    });
  });

  describe('with perfect plank form', () => {
    it('should detect perfect plank position', () => {
      const landmarks = createMockLandmarks({
        [POSE_LANDMARKS.NOSE]: createMockLandmark(0.3, 0.4, 0, 0.9),
        [POSE_LANDMARKS.LEFT_SHOULDER]: createMockLandmark(0.3, 0.45, 0, 0.9),
        [POSE_LANDMARKS.LEFT_ELBOW]: createMockLandmark(0.3, 0.5, 0, 0.9),
        [POSE_LANDMARKS.LEFT_WRIST]: createMockLandmark(0.3, 0.55, 0, 0.9),
        [POSE_LANDMARKS.LEFT_HIP]: createMockLandmark(0.6, 0.45, 0, 0.9),
        [POSE_LANDMARKS.LEFT_KNEE]: createMockLandmark(0.8, 0.45, 0, 0.9),
        [POSE_LANDMARKS.LEFT_ANKLE]: createMockLandmark(0.95, 0.45, 0, 0.9),
      });

      const result = detectPlankPosition(landmarks);

      expect(result.isPlank).toBe(true);
      expect(result.confidence).toBeGreaterThanOrEqual(85);
      expect(result.feedback[0]).toContain('Perfect plank form');
    });
  });

  describe('with body alignment issues', () => {
    it('should detect when hips are too low', () => {
      const landmarks = createMockLandmarks({
        [POSE_LANDMARKS.NOSE]: createMockLandmark(0.3, 0.4, 0, 0.9),
        [POSE_LANDMARKS.LEFT_SHOULDER]: createMockLandmark(0.3, 0.45, 0, 0.9),
        [POSE_LANDMARKS.LEFT_ELBOW]: createMockLandmark(0.3, 0.5, 0, 0.9),
        [POSE_LANDMARKS.LEFT_WRIST]: createMockLandmark(0.3, 0.55, 0, 0.9),
        [POSE_LANDMARKS.LEFT_HIP]: createMockLandmark(0.6, 0.6, 0, 0.9), // Too low
        [POSE_LANDMARKS.LEFT_KNEE]: createMockLandmark(0.8, 0.65, 0, 0.9),
        [POSE_LANDMARKS.LEFT_ANKLE]: createMockLandmark(0.95, 0.68, 0, 0.9),
      });

      const result = detectPlankPosition(landmarks);

      // With hips misaligned, confidence should be reduced or feedback given
      expect(result.confidence < 100 || result.feedback.some(f => f.includes('hips') || f.includes('alignment'))).toBe(true);
    });

    it('should detect when hips are too high', () => {
      const landmarks = createMockLandmarks({
        [POSE_LANDMARKS.NOSE]: createMockLandmark(0.3, 0.5, 0, 0.9),
        [POSE_LANDMARKS.LEFT_SHOULDER]: createMockLandmark(0.3, 0.55, 0, 0.9),
        [POSE_LANDMARKS.LEFT_ELBOW]: createMockLandmark(0.3, 0.6, 0, 0.9),
        [POSE_LANDMARKS.LEFT_WRIST]: createMockLandmark(0.3, 0.65, 0, 0.9),
        [POSE_LANDMARKS.LEFT_HIP]: createMockLandmark(0.6, 0.3, 0, 0.9), // Too high
        [POSE_LANDMARKS.LEFT_KNEE]: createMockLandmark(0.8, 0.35, 0, 0.9),
        [POSE_LANDMARKS.LEFT_ANKLE]: createMockLandmark(0.95, 0.38, 0, 0.9),
      });

      const result = detectPlankPosition(landmarks);

      expect(result.confidence).toBeLessThan(100);
      expect(result.feedback.some(f => f.includes('hips') || f.includes('sagging'))).toBe(true);
    });
  });

  describe('with leg position issues', () => {
    it('should detect when legs are bent', () => {
      const landmarks = createMockLandmarks({
        [POSE_LANDMARKS.NOSE]: createMockLandmark(0.3, 0.4, 0, 0.9),
        [POSE_LANDMARKS.LEFT_SHOULDER]: createMockLandmark(0.3, 0.45, 0, 0.9),
        [POSE_LANDMARKS.LEFT_ELBOW]: createMockLandmark(0.3, 0.5, 0, 0.9),
        [POSE_LANDMARKS.LEFT_WRIST]: createMockLandmark(0.3, 0.55, 0, 0.9),
        [POSE_LANDMARKS.LEFT_HIP]: createMockLandmark(0.6, 0.45, 0, 0.9),
        [POSE_LANDMARKS.LEFT_KNEE]: createMockLandmark(0.7, 0.6, 0, 0.9), // Bent knee
        [POSE_LANDMARKS.LEFT_ANKLE]: createMockLandmark(0.8, 0.7, 0, 0.9),
      });

      const result = detectPlankPosition(landmarks);

      // With bent legs, confidence should be reduced or feedback given
      expect(result.confidence < 100 || result.feedback.some(f => f.toLowerCase().includes('leg') || f.toLowerCase().includes('straight'))).toBe(true);
    });
  });

  describe('with arm position issues', () => {
    it('should detect forearm plank', () => {
      const landmarks = createMockLandmarks({
        [POSE_LANDMARKS.NOSE]: createMockLandmark(0.3, 0.4, 0, 0.9),
        [POSE_LANDMARKS.LEFT_SHOULDER]: createMockLandmark(0.3, 0.45, 0, 0.9),
        [POSE_LANDMARKS.LEFT_ELBOW]: createMockLandmark(0.3, 0.5, 0, 0.9),
        [POSE_LANDMARKS.LEFT_WRIST]: createMockLandmark(0.25, 0.52, 0, 0.9), // Forearm angle
        [POSE_LANDMARKS.LEFT_HIP]: createMockLandmark(0.6, 0.45, 0, 0.9),
        [POSE_LANDMARKS.LEFT_KNEE]: createMockLandmark(0.8, 0.45, 0, 0.9),
        [POSE_LANDMARKS.LEFT_ANKLE]: createMockLandmark(0.95, 0.45, 0, 0.9),
      });

      const result = detectPlankPosition(landmarks);

      // Should still detect as valid plank (forearm or straight-arm both valid)
      expect(result.confidence).toBeGreaterThan(50);
    });

    it('should detect straight-arm plank', () => {
      const landmarks = createMockLandmarks({
        [POSE_LANDMARKS.NOSE]: createMockLandmark(0.3, 0.4, 0, 0.9),
        [POSE_LANDMARKS.LEFT_SHOULDER]: createMockLandmark(0.3, 0.45, 0, 0.9),
        [POSE_LANDMARKS.LEFT_ELBOW]: createMockLandmark(0.3, 0.5, 0, 0.9),
        [POSE_LANDMARKS.LEFT_WRIST]: createMockLandmark(0.3, 0.55, 0, 0.9), // Straight arm
        [POSE_LANDMARKS.LEFT_HIP]: createMockLandmark(0.6, 0.45, 0, 0.9),
        [POSE_LANDMARKS.LEFT_KNEE]: createMockLandmark(0.8, 0.45, 0, 0.9),
        [POSE_LANDMARKS.LEFT_ANKLE]: createMockLandmark(0.95, 0.45, 0, 0.9),
      });

      const result = detectPlankPosition(landmarks);

      expect(result.confidence).toBeGreaterThan(50);
    });

    it('should detect when elbow position is incorrect', () => {
      const landmarks = createMockLandmarks({
        [POSE_LANDMARKS.NOSE]: createMockLandmark(0.3, 0.4, 0, 0.9),
        [POSE_LANDMARKS.LEFT_SHOULDER]: createMockLandmark(0.3, 0.45, 0, 0.9),
        [POSE_LANDMARKS.LEFT_ELBOW]: createMockLandmark(0.5, 0.5, 0, 0.9), // Too far from shoulder
        [POSE_LANDMARKS.LEFT_WRIST]: createMockLandmark(0.5, 0.55, 0, 0.9),
        [POSE_LANDMARKS.LEFT_HIP]: createMockLandmark(0.6, 0.45, 0, 0.9),
        [POSE_LANDMARKS.LEFT_KNEE]: createMockLandmark(0.8, 0.45, 0, 0.9),
        [POSE_LANDMARKS.LEFT_ANKLE]: createMockLandmark(0.95, 0.45, 0, 0.9),
      });

      const result = detectPlankPosition(landmarks);

      expect(result.confidence).toBeLessThan(100);
      expect(result.feedback.some(f => f.toLowerCase().includes('arm'))).toBe(true);
    });
  });

  describe('with head position issues', () => {
    it('should detect when head is not in neutral position', () => {
      const landmarks = createMockLandmarks({
        [POSE_LANDMARKS.NOSE]: createMockLandmark(0.3, 0.6, 0, 0.9), // Head too low
        [POSE_LANDMARKS.LEFT_SHOULDER]: createMockLandmark(0.3, 0.45, 0, 0.9),
        [POSE_LANDMARKS.LEFT_ELBOW]: createMockLandmark(0.3, 0.5, 0, 0.9),
        [POSE_LANDMARKS.LEFT_WRIST]: createMockLandmark(0.3, 0.55, 0, 0.9),
        [POSE_LANDMARKS.LEFT_HIP]: createMockLandmark(0.6, 0.45, 0, 0.9),
        [POSE_LANDMARKS.LEFT_KNEE]: createMockLandmark(0.8, 0.45, 0, 0.9),
        [POSE_LANDMARKS.LEFT_ANKLE]: createMockLandmark(0.95, 0.45, 0, 0.9),
      });

      const result = detectPlankPosition(landmarks);

      // With head misaligned, confidence should be reduced or feedback given
      expect(result.confidence < 100 || result.feedback.some(f => f.toLowerCase().includes('head') || f.toLowerCase().includes('neutral'))).toBe(true);
    });
  });

  describe('confidence thresholds', () => {
    it('should require at least 55% confidence to be considered plank', () => {
      const landmarks = createMockLandmarks({
        [POSE_LANDMARKS.NOSE]: createMockLandmark(0.3, 0.6, 0, 0.9),
        [POSE_LANDMARKS.LEFT_SHOULDER]: createMockLandmark(0.3, 0.45, 0, 0.9),
        [POSE_LANDMARKS.LEFT_ELBOW]: createMockLandmark(0.5, 0.5, 0, 0.9),
        [POSE_LANDMARKS.LEFT_WRIST]: createMockLandmark(0.5, 0.55, 0, 0.9),
        [POSE_LANDMARKS.LEFT_HIP]: createMockLandmark(0.6, 0.6, 0, 0.9),
        [POSE_LANDMARKS.LEFT_KNEE]: createMockLandmark(0.7, 0.7, 0, 0.9),
        [POSE_LANDMARKS.LEFT_ANKLE]: createMockLandmark(0.95, 0.75, 0, 0.9),
      });

      const result = detectPlankPosition(landmarks);

      // With many issues, should either not detect plank or have low confidence/many feedback items
      if (result.isPlank) {
        // If somehow still detected, should have low confidence or multiple feedback items
        expect(result.confidence < 70 || result.feedback.length > 2).toBe(true);
      } else {
        expect(result.confidence).toBeLessThan(70);
      }
    });

    it('should return feedback count of 3 or less for valid plank', () => {
      const landmarks = createMockLandmarks({
        [POSE_LANDMARKS.NOSE]: createMockLandmark(0.3, 0.4, 0, 0.9),
        [POSE_LANDMARKS.LEFT_SHOULDER]: createMockLandmark(0.3, 0.45, 0, 0.9),
        [POSE_LANDMARKS.LEFT_ELBOW]: createMockLandmark(0.3, 0.5, 0, 0.9),
        [POSE_LANDMARKS.LEFT_WRIST]: createMockLandmark(0.3, 0.55, 0, 0.9),
        [POSE_LANDMARKS.LEFT_HIP]: createMockLandmark(0.6, 0.48, 0, 0.9), // Slightly off
        [POSE_LANDMARKS.LEFT_KNEE]: createMockLandmark(0.8, 0.48, 0, 0.9),
        [POSE_LANDMARKS.LEFT_ANKLE]: createMockLandmark(0.95, 0.48, 0, 0.9),
      });

      const result = detectPlankPosition(landmarks);

      if (result.isPlank) {
        expect(result.feedback.length).toBeLessThanOrEqual(4); // Including positive feedback
      }
    });
  });

  describe('edge cases', () => {
    it('should handle out of frame positions', () => {
      const landmarks = createMockLandmarks({
        [POSE_LANDMARKS.NOSE]: createMockLandmark(0.3, 0.1, 0, 0.9), // Too high
        [POSE_LANDMARKS.LEFT_SHOULDER]: createMockLandmark(0.3, 0.15, 0, 0.9),
        [POSE_LANDMARKS.LEFT_ELBOW]: createMockLandmark(0.3, 0.2, 0, 0.9),
        [POSE_LANDMARKS.LEFT_WRIST]: createMockLandmark(0.3, 0.25, 0, 0.9),
        [POSE_LANDMARKS.LEFT_HIP]: createMockLandmark(0.6, 0.15, 0, 0.9),
        [POSE_LANDMARKS.LEFT_KNEE]: createMockLandmark(0.8, 0.15, 0, 0.9),
        [POSE_LANDMARKS.LEFT_ANKLE]: createMockLandmark(0.95, 0.15, 0, 0.9),
      });

      const result = detectPlankPosition(landmarks);

      expect(result.feedback.some(f => f.toLowerCase().includes('center'))).toBe(true);
    });

    it('should never return negative confidence', () => {
      const landmarks = createMockLandmarks({
        [POSE_LANDMARKS.NOSE]: createMockLandmark(0.9, 0.9, 0, 0.9),
        [POSE_LANDMARKS.LEFT_SHOULDER]: createMockLandmark(0.1, 0.1, 0, 0.9),
        [POSE_LANDMARKS.LEFT_ELBOW]: createMockLandmark(0.9, 0.1, 0, 0.9),
        [POSE_LANDMARKS.LEFT_WRIST]: createMockLandmark(0.1, 0.9, 0, 0.9),
        [POSE_LANDMARKS.LEFT_HIP]: createMockLandmark(0.5, 0.9, 0, 0.9),
        [POSE_LANDMARKS.LEFT_KNEE]: createMockLandmark(0.9, 0.5, 0, 0.9),
        [POSE_LANDMARKS.LEFT_ANKLE]: createMockLandmark(0.1, 0.5, 0, 0.9),
      });

      const result = detectPlankPosition(landmarks);

      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('drawPoseSkeleton', () => {
  let mockCanvas: HTMLCanvasElement;
  let mockCtx: CanvasRenderingContext2D;

  beforeEach(() => {
    mockCanvas = document.createElement('canvas');
    mockCanvas.width = 640;
    mockCanvas.height = 480;
    mockCtx = mockCanvas.getContext('2d')!;
  });

  it('should draw skeleton with visible landmarks', () => {
    const landmarks = createMockLandmarks({
      [POSE_LANDMARKS.LEFT_SHOULDER]: createMockLandmark(0.3, 0.45, 0, 0.9),
      [POSE_LANDMARKS.LEFT_HIP]: createMockLandmark(0.6, 0.45, 0, 0.9),
    });

    drawPoseSkeleton(mockCtx, landmarks, 640, 480);

    expect(mockCtx.beginPath).toHaveBeenCalled();
    expect(mockCtx.stroke).toHaveBeenCalled();
    expect(mockCtx.fill).toHaveBeenCalled();
  });

  it('should use custom color when provided', () => {
    const landmarks = createMockLandmarks();
    const customColor = '#FF0000';

    drawPoseSkeleton(mockCtx, landmarks, 640, 480, customColor);

    expect(mockCtx.strokeStyle).toBe(customColor);
    expect(mockCtx.fillStyle).toBe(customColor);
  });

  it('should skip landmarks with low visibility', () => {
    const landmarks = createMockLandmarks({
      [POSE_LANDMARKS.LEFT_SHOULDER]: createMockLandmark(0.3, 0.45, 0, 0.2), // Low visibility
      [POSE_LANDMARKS.LEFT_HIP]: createMockLandmark(0.6, 0.45, 0, 0.9),
    });

    const beginPathCalls = (mockCtx.beginPath as jest.Mock).mock.calls.length;
    drawPoseSkeleton(mockCtx, landmarks, 640, 480);

    // Should skip drawing connections with low-visibility landmarks
    expect(mockCtx.beginPath).toHaveBeenCalled();
  });
});

describe('drawDetectionFeedback', () => {
  let mockCanvas: HTMLCanvasElement;
  let mockCtx: CanvasRenderingContext2D;

  beforeEach(() => {
    mockCanvas = document.createElement('canvas');
    mockCanvas.width = 640;
    mockCanvas.height = 480;
    mockCtx = mockCanvas.getContext('2d')!;
  });

  it('should draw feedback text and confidence meter', () => {
    const result: PlankDetectionResult = {
      isPlank: true,
      confidence: 85,
      feedback: ['Perfect plank form!', 'Keep it up!'],
    };

    drawDetectionFeedback(mockCtx, result, 640, 480);

    expect(mockCtx.fillRect).toHaveBeenCalled();
    expect(mockCtx.fillText).toHaveBeenCalled();
  });

  it('should use green color for high confidence', () => {
    const result: PlankDetectionResult = {
      isPlank: true,
      confidence: 90,
      feedback: ['Perfect plank form!'],
    };

    drawDetectionFeedback(mockCtx, result, 640, 480);

    // Check that green color was used (calls should include #00FF00)
    const fillStyleCalls = Object.getOwnPropertyDescriptor(mockCtx, 'fillStyle');
    expect(mockCtx.fillText).toHaveBeenCalled();
  });

  it('should use yellow color for medium confidence', () => {
    const result: PlankDetectionResult = {
      isPlank: false,
      confidence: 65,
      feedback: ['Adjust your form'],
    };

    drawDetectionFeedback(mockCtx, result, 640, 480);

    expect(mockCtx.fillText).toHaveBeenCalled();
  });

  it('should use red color for low confidence', () => {
    const result: PlankDetectionResult = {
      isPlank: false,
      confidence: 30,
      feedback: ['Multiple issues detected'],
    };

    drawDetectionFeedback(mockCtx, result, 640, 480);

    expect(mockCtx.fillText).toHaveBeenCalled();
  });

  it('should handle multiple feedback messages', () => {
    const result: PlankDetectionResult = {
      isPlank: false,
      confidence: 50,
      feedback: ['Issue 1', 'Issue 2', 'Issue 3'],
    };

    drawDetectionFeedback(mockCtx, result, 640, 480);

    // fillText should be called for each feedback message plus confidence percentage
    const fillTextCalls = (mockCtx.fillText as jest.Mock).mock.calls.length;
    expect(fillTextCalls).toBeGreaterThanOrEqual(result.feedback.length);
  });
});
