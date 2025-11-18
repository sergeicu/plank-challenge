import { renderHook, waitFor, act } from '@testing-library/react';
import { usePoseDetection } from '../usePoseDetection';
import { PoseLandmarker, FilesetResolver } from '@mediapipe/tasks-vision';

// Mock MediaPipe
jest.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: {
    forVisionTasks: jest.fn(),
  },
  PoseLandmarker: {
    createFromOptions: jest.fn(),
  },
}));

describe('usePoseDetection', () => {
  let mockPoseLandmarker: any;
  let mockVideo: HTMLVideoElement;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Create mock video element with proper getters
    mockVideo = document.createElement('video');
    Object.defineProperty(mockVideo, 'videoWidth', { value: 640, writable: false });
    Object.defineProperty(mockVideo, 'videoHeight', { value: 480, writable: false });

    // Create mock PoseLandmarker
    mockPoseLandmarker = {
      detectForVideo: jest.fn(() => ({
        landmarks: [
          Array(33).fill(null).map(() => ({
            x: 0.5,
            y: 0.5,
            z: 0,
            visibility: 0.9,
          })),
        ],
      })),
      close: jest.fn(),
    };

    // Mock FilesetResolver
    (FilesetResolver.forVisionTasks as jest.Mock).mockResolvedValue({});

    // Mock PoseLandmarker creation
    (PoseLandmarker.createFromOptions as jest.Mock).mockResolvedValue(mockPoseLandmarker);
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('initialization', () => {
    it('should initialize with default state', () => {
      const { result } = renderHook(() => usePoseDetection());

      expect(result.current.isReady).toBe(false);
      expect(result.current.isProcessing).toBe(false);
      expect(result.current.error).toBe(null);
      expect(result.current.detectionResult).toBe(null);
    });

    it('should load MediaPipe when enableDetection is true', async () => {
      const { result } = renderHook(() =>
        usePoseDetection({ enableDetection: true })
      );

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      expect(FilesetResolver.forVisionTasks).toHaveBeenCalled();
      expect(PoseLandmarker.createFromOptions).toHaveBeenCalled();
    });

    it('should not load MediaPipe when enableDetection is false', async () => {
      const { result } = renderHook(() =>
        usePoseDetection({ enableDetection: false })
      );

      await waitFor(() => {
        expect(result.current.isReady).toBe(false);
      });

      expect(FilesetResolver.forVisionTasks).not.toHaveBeenCalled();
    });

    it('should set processing state during initialization', async () => {
      const { result } = renderHook(() =>
        usePoseDetection({ enableDetection: true })
      );

      // Initially processing
      expect(result.current.isProcessing).toBe(true);

      await waitFor(() => {
        expect(result.current.isProcessing).toBe(false);
      });
    });

    it('should handle initialization errors', async () => {
      (FilesetResolver.forVisionTasks as jest.Mock).mockRejectedValue(
        new Error('Failed to load')
      );

      const { result } = renderHook(() =>
        usePoseDetection({ enableDetection: true })
      );

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      expect(result.current.error).toContain('Failed to load pose detection');
    });
  });

  describe('detectPose', () => {
    it('should detect pose from video frame', async () => {
      const { result } = renderHook(() =>
        usePoseDetection({ enableDetection: true })
      );

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      act(() => {
        result.current.detectPose(mockVideo);
      });

      expect(mockPoseLandmarker.detectForVideo).toHaveBeenCalledWith(
        mockVideo,
        expect.any(Number)
      );
    });

    it('should not detect if not ready', async () => {
      const { result } = renderHook(() =>
        usePoseDetection({ enableDetection: false })
      );

      act(() => {
        result.current.detectPose(mockVideo);
      });

      expect(mockPoseLandmarker.detectForVideo).not.toHaveBeenCalled();
    });

    it('should throttle detection to ~10 FPS', async () => {
      const { result } = renderHook(() =>
        usePoseDetection({ enableDetection: true })
      );

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      // Call multiple times rapidly
      act(() => {
        result.current.detectPose(mockVideo);
        result.current.detectPose(mockVideo);
        result.current.detectPose(mockVideo);
      });

      // Should only call once due to throttling
      expect(mockPoseLandmarker.detectForVideo).toHaveBeenCalledTimes(1);
    });

    it('should update detection result', async () => {
      const { result } = renderHook(() =>
        usePoseDetection({ enableDetection: true })
      );

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      act(() => {
        result.current.detectPose(mockVideo);
      });

      await waitFor(() => {
        expect(result.current.detectionResult).toBeTruthy();
      });
    });

    it('should handle no person detected', async () => {
      mockPoseLandmarker.detectForVideo = jest.fn(() => ({
        landmarks: [],
      }));

      const { result } = renderHook(() =>
        usePoseDetection({ enableDetection: true })
      );

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      act(() => {
        result.current.detectPose(mockVideo);
      });

      await waitFor(() => {
        expect(result.current.detectionResult).toBeTruthy();
      });

      expect(result.current.detectionResult?.isPlank).toBe(false);
      expect(result.current.detectionResult?.feedback).toContain(
        'No person detected. Position yourself in frame.'
      );
    });
  });

  describe('plank detection callbacks', () => {
    it('should call onPlankDetected after stability frames', async () => {
      const onPlankDetected = jest.fn();

      // Mock perfect plank position
      mockPoseLandmarker.detectForVideo = jest.fn(() => ({
        landmarks: [
          [
            { x: 0.3, y: 0.4, z: 0, visibility: 0.9 }, // NOSE (0)
            ...Array(10).fill({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }),
            { x: 0.3, y: 0.45, z: 0, visibility: 0.9 }, // LEFT_SHOULDER (11)
            { x: 0.4, y: 0.45, z: 0, visibility: 0.9 }, // RIGHT_SHOULDER (12)
            { x: 0.3, y: 0.5, z: 0, visibility: 0.9 }, // LEFT_ELBOW (13)
            { x: 0.4, y: 0.5, z: 0, visibility: 0.9 }, // RIGHT_ELBOW (14)
            { x: 0.3, y: 0.55, z: 0, visibility: 0.9 }, // LEFT_WRIST (15)
            { x: 0.4, y: 0.55, z: 0, visibility: 0.9 }, // RIGHT_WRIST (16)
            ...Array(6).fill({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }),
            { x: 0.6, y: 0.45, z: 0, visibility: 0.9 }, // LEFT_HIP (23)
            { x: 0.65, y: 0.45, z: 0, visibility: 0.9 }, // RIGHT_HIP (24)
            { x: 0.8, y: 0.45, z: 0, visibility: 0.9 }, // LEFT_KNEE (25)
            { x: 0.82, y: 0.45, z: 0, visibility: 0.9 }, // RIGHT_KNEE (26)
            { x: 0.95, y: 0.45, z: 0, visibility: 0.9 }, // LEFT_ANKLE (27)
            { x: 0.97, y: 0.45, z: 0, visibility: 0.9 }, // RIGHT_ANKLE (28)
            ...Array(5).fill({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }),
          ],
        ],
      }));

      const { result } = renderHook(() =>
        usePoseDetection({
          enableDetection: true,
          onPlankDetected,
          stabilityFrames: 3,
        })
      );

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      // Simulate multiple detections
      for (let i = 0; i < 5; i++) {
        act(() => {
          result.current.detectPose(mockVideo);
        });
        // Wait for throttle
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 110));
        });
      }

      await waitFor(() => {
        expect(onPlankDetected).toHaveBeenCalled();
      });
    });

    it('should call onPlankLost after grace period', async () => {
      const onPlankLost = jest.fn();

      // Start with plank position
      mockPoseLandmarker.detectForVideo = jest.fn(() => ({
        landmarks: [
          [
            { x: 0.3, y: 0.4, z: 0, visibility: 0.9 },
            ...Array(10).fill({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }),
            { x: 0.3, y: 0.45, z: 0, visibility: 0.9 },
            { x: 0.4, y: 0.45, z: 0, visibility: 0.9 },
            { x: 0.3, y: 0.5, z: 0, visibility: 0.9 },
            { x: 0.4, y: 0.5, z: 0, visibility: 0.9 },
            { x: 0.3, y: 0.55, z: 0, visibility: 0.9 },
            { x: 0.4, y: 0.55, z: 0, visibility: 0.9 },
            ...Array(6).fill({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }),
            { x: 0.6, y: 0.45, z: 0, visibility: 0.9 },
            { x: 0.65, y: 0.45, z: 0, visibility: 0.9 },
            { x: 0.8, y: 0.45, z: 0, visibility: 0.9 },
            { x: 0.82, y: 0.45, z: 0, visibility: 0.9 },
            { x: 0.95, y: 0.45, z: 0, visibility: 0.9 },
            { x: 0.97, y: 0.45, z: 0, visibility: 0.9 },
            ...Array(5).fill({ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }),
          ],
        ],
      }));

      const { result } = renderHook(() =>
        usePoseDetection({
          enableDetection: true,
          onPlankLost,
          stabilityFrames: 2,
          gracePeriodFrames: 3,
        })
      );

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      // Detect plank first
      for (let i = 0; i < 3; i++) {
        act(() => {
          result.current.detectPose(mockVideo);
        });
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 110));
        });
      }

      // Change to no plank
      mockPoseLandmarker.detectForVideo = jest.fn(() => ({
        landmarks: [],
      }));

      // Detect no plank for grace period
      for (let i = 0; i < 5; i++) {
        act(() => {
          result.current.detectPose(mockVideo);
        });
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 110));
        });
      }

      await waitFor(() => {
        expect(onPlankLost).toHaveBeenCalled();
      });
    });

    it('should not call callbacks without stability', async () => {
      const onPlankDetected = jest.fn();

      const { result } = renderHook(() =>
        usePoseDetection({
          enableDetection: true,
          onPlankDetected,
          stabilityFrames: 10,
        })
      );

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      // Only detect a few times (less than stability frames)
      for (let i = 0; i < 3; i++) {
        act(() => {
          result.current.detectPose(mockVideo);
        });
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 110));
        });
      }

      expect(onPlankDetected).not.toHaveBeenCalled();
    });
  });

  describe('reset', () => {
    it('should reset all detection state', async () => {
      const { result } = renderHook(() =>
        usePoseDetection({ enableDetection: true })
      );

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      // Detect something
      act(() => {
        result.current.detectPose(mockVideo);
      });

      await waitFor(() => {
        expect(result.current.detectionResult).toBeTruthy();
      });

      // Reset
      act(() => {
        result.current.reset();
      });

      expect(result.current.detectionResult).toBe(null);
      expect(result.current.error).toBe(null);
    });

    it('should reset plank active state', async () => {
      const onPlankDetected = jest.fn();

      const { result } = renderHook(() =>
        usePoseDetection({
          enableDetection: true,
          onPlankDetected,
          stabilityFrames: 2,
        })
      );

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      // Detect plank
      for (let i = 0; i < 3; i++) {
        act(() => {
          result.current.detectPose(mockVideo);
        });
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 110));
        });
      }

      // Reset
      act(() => {
        result.current.reset();
      });

      // Should need to detect again from scratch
      onPlankDetected.mockClear();

      for (let i = 0; i < 3; i++) {
        act(() => {
          result.current.detectPose(mockVideo);
        });
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 110));
        });
      }

      await waitFor(() => {
        expect(onPlankDetected).toHaveBeenCalled();
      });
    });
  });

  describe('cleanup', () => {
    it('should close PoseLandmarker on unmount', async () => {
      const { unmount } = renderHook(() =>
        usePoseDetection({ enableDetection: true })
      );

      await waitFor(() => {
        expect(PoseLandmarker.createFromOptions).toHaveBeenCalled();
      });

      unmount();

      expect(mockPoseLandmarker.close).toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      mockPoseLandmarker.close = jest.fn(() => {
        throw new Error('Close failed');
      });

      const { unmount } = renderHook(() =>
        usePoseDetection({ enableDetection: true })
      );

      await waitFor(() => {
        expect(PoseLandmarker.createFromOptions).toHaveBeenCalled();
      });

      expect(() => unmount()).not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle MediaPipe internal errors', async () => {
      mockPoseLandmarker.detectForVideo = jest.fn(() => {
        const error: any = new Error('Internal error');
        error.code = 5;
        throw error;
      });

      const { result } = renderHook(() =>
        usePoseDetection({ enableDetection: true })
      );

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      act(() => {
        result.current.detectPose(mockVideo);
      });

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });

      expect(result.current.error).toContain('Detection error');
    });

    it('should handle generic detection errors', async () => {
      mockPoseLandmarker.detectForVideo = jest.fn(() => {
        throw new Error('Generic error');
      });

      const { result } = renderHook(() =>
        usePoseDetection({ enableDetection: true })
      );

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      act(() => {
        result.current.detectPose(mockVideo);
      });

      await waitFor(() => {
        expect(result.current.error).toBeTruthy();
      });
    });

    it('should not crash on null video element', async () => {
      const { result } = renderHook(() =>
        usePoseDetection({ enableDetection: true })
      );

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      expect(() => {
        act(() => {
          result.current.detectPose(null as any);
        });
      }).not.toThrow();
    });
  });

  describe('memory management', () => {
    it('should clean up previous results', async () => {
      const { result } = renderHook(() =>
        usePoseDetection({ enableDetection: true })
      );

      await waitFor(() => {
        expect(result.current.isReady).toBe(true);
      });

      // Multiple detections
      for (let i = 0; i < 3; i++) {
        act(() => {
          result.current.detectPose(mockVideo);
        });
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 110));
        });
      }

      // Should not accumulate results
      expect(mockPoseLandmarker.detectForVideo).toHaveBeenCalled();
    });
  });
});
