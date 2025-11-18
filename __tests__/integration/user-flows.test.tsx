/**
 * Integration tests for complete user flows
 * These tests verify that multiple components work together correctly
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PlankTimer from '@/components/PlankTimer';
import * as timerLogic from '@/utils/timerLogic';

// Mock video recorder to avoid camera access
jest.mock('@/components/VideoRecorder', () => {
  return function MockVideoRecorder({ onComplete, onError, detectionMode, targetDuration }: any) {
    return (
      <div data-testid="video-recorder">
        <div data-testid="detection-mode">{detectionMode ? 'enabled' : 'disabled'}</div>
        <div data-testid="target-duration">{targetDuration}</div>
        <button onClick={onComplete}>Complete Recording</button>
        <button onClick={() => onError('Camera error')}>Simulate Error</button>
      </div>
    );
  };
});

jest.mock('@/components/RestDay', () => {
  return function MockRestDay() {
    return <div data-testid="rest-day">Rest Day - Take a break!</div>;
  };
});

describe('User Flow Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Manual Recording Flow', () => {
    it('should complete full manual recording workflow', async () => {
      jest.spyOn(timerLogic, 'calculateTargetDuration').mockReturnValue(30);
      jest.spyOn(timerLogic, 'getDayNumber').mockReturnValue(1);
      jest.spyOn(timerLogic, 'formatDuration').mockReturnValue('00:30');

      render(<PlankTimer />);

      // 1. Verify initial idle state
      expect(screen.getByText('Plank Timer')).toBeInTheDocument();
      expect(screen.getByText('Day 1 Challenge')).toBeInTheDocument();

      // 2. Ensure detection mode is OFF
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).not.toBeChecked();

      // 3. Start recording
      const startButton = screen.getByRole('button', { name: /Start Recording/i });
      fireEvent.click(startButton);

      // 4. Verify recording state
      await waitFor(() => {
        expect(screen.getByTestId('video-recorder')).toBeInTheDocument();
      });

      expect(screen.getByTestId('detection-mode')).toHaveTextContent('disabled');
      expect(screen.getByTestId('target-duration')).toHaveTextContent('30');

      // 5. Complete recording
      const completeButton = screen.getByRole('button', { name: /Complete Recording/i });
      fireEvent.click(completeButton);

      // 6. Verify completion state
      await waitFor(() => {
        expect(screen.getByText('Congratulations!')).toBeInTheDocument();
      });

      expect(screen.getByText('Day 1 Complete')).toBeInTheDocument();

      // 7. Reset and verify can record again
      const recordAnotherButton = screen.getByRole('button', { name: /Record Another/i });
      fireEvent.click(recordAnotherButton);

      await waitFor(() => {
        expect(screen.getByText("Today's Goal")).toBeInTheDocument();
      });
    });

    it('should handle consecutive recordings', async () => {
      jest.spyOn(timerLogic, 'calculateTargetDuration').mockReturnValue(36);
      jest.spyOn(timerLogic, 'getDayNumber').mockReturnValue(2);
      jest.spyOn(timerLogic, 'formatDuration').mockReturnValue('00:36');

      render(<PlankTimer />);

      // First recording
      const startButton1 = screen.getByRole('button', { name: /Start Recording/i });
      fireEvent.click(startButton1);

      await waitFor(() => {
        expect(screen.getByTestId('video-recorder')).toBeInTheDocument();
      });

      const completeButton1 = screen.getByRole('button', { name: /Complete Recording/i });
      fireEvent.click(completeButton1);

      await waitFor(() => {
        expect(screen.getByText('Congratulations!')).toBeInTheDocument();
      });

      // Start second recording
      const recordAnotherButton = screen.getByRole('button', { name: /Record Another/i });
      fireEvent.click(recordAnotherButton);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Start Recording/i })).toBeInTheDocument();
      });

      const startButton2 = screen.getByRole('button', { name: /Start Recording/i });
      fireEvent.click(startButton2);

      // Should start second recording
      await waitFor(() => {
        expect(screen.getByTestId('video-recorder')).toBeInTheDocument();
      });
    });
  });

  describe('Detection Mode Flow', () => {
    it('should complete full detection mode workflow', async () => {
      jest.spyOn(timerLogic, 'calculateTargetDuration').mockReturnValue(42);
      jest.spyOn(timerLogic, 'getDayNumber').mockReturnValue(3);
      jest.spyOn(timerLogic, 'formatDuration').mockReturnValue('00:42');

      render(<PlankTimer />);

      // 1. Enable detection mode
      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);
      expect(checkbox).toBeChecked();

      // 2. Verify button text changed
      expect(screen.getByRole('button', { name: /Start Detection Mode/i })).toBeInTheDocument();

      // 3. Start detection mode
      const startButton = screen.getByRole('button', { name: /Start Detection Mode/i });
      fireEvent.click(startButton);

      // 4. Verify detection mode is active
      await waitFor(() => {
        expect(screen.getByTestId('video-recorder')).toBeInTheDocument();
      });

      expect(screen.getByTestId('detection-mode')).toHaveTextContent('enabled');

      // 5. Complete recording
      const completeButton = screen.getByRole('button', { name: /Complete Recording/i });
      fireEvent.click(completeButton);

      // 6. Verify completion
      await waitFor(() => {
        expect(screen.getByText('Congratulations!')).toBeInTheDocument();
      });
    });

    it('should preserve detection mode across recordings', async () => {
      jest.spyOn(timerLogic, 'calculateTargetDuration').mockReturnValue(48);
      jest.spyOn(timerLogic, 'getDayNumber').mockReturnValue(4);
      jest.spyOn(timerLogic, 'formatDuration').mockReturnValue('00:48');

      render(<PlankTimer />);

      // Enable detection mode
      const checkbox = screen.getByRole('checkbox');
      fireEvent.click(checkbox);

      // Start and complete first recording
      const startButton = screen.getByRole('button', { name: /Start Detection Mode/i });
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(screen.getByTestId('detection-mode')).toHaveTextContent('enabled');
      });

      const completeButton = screen.getByRole('button', { name: /Complete Recording/i });
      fireEvent.click(completeButton);

      await waitFor(() => {
        expect(screen.getByText('Congratulations!')).toBeInTheDocument();
      });

      // Start another recording
      const recordAnotherButton = screen.getByRole('button', { name: /Record Another/i });
      fireEvent.click(recordAnotherButton);

      // Detection mode checkbox should still be checked
      await waitFor(() => {
        const checkboxAgain = screen.getByRole('checkbox');
        expect(checkboxAgain).toBeChecked();
      });
    });
  });

  describe('Error Recovery Flow', () => {
    it('should recover from camera error and allow retry', async () => {
      jest.spyOn(timerLogic, 'calculateTargetDuration').mockReturnValue(30);
      jest.spyOn(timerLogic, 'getDayNumber').mockReturnValue(1);

      render(<PlankTimer />);

      // Start recording
      const startButton = screen.getByRole('button', { name: /Start Recording/i });
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(screen.getByTestId('video-recorder')).toBeInTheDocument();
      });

      // Trigger error
      const errorButton = screen.getByRole('button', { name: /Simulate Error/i });
      fireEvent.click(errorButton);

      // Verify error is displayed and returned to idle
      await waitFor(() => {
        expect(screen.getByText('Camera error')).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /Start Recording/i })).toBeInTheDocument();

      // Retry
      const retryButton = screen.getByRole('button', { name: /Start Recording/i });
      fireEvent.click(retryButton);

      // Error should be cleared
      await waitFor(() => {
        expect(screen.queryByText('Camera error')).not.toBeInTheDocument();
      });

      expect(screen.getByTestId('video-recorder')).toBeInTheDocument();
    });

    it('should handle multiple errors gracefully', async () => {
      jest.spyOn(timerLogic, 'calculateTargetDuration').mockReturnValue(30);
      jest.spyOn(timerLogic, 'getDayNumber').mockReturnValue(1);

      render(<PlankTimer />);

      // First error
      const startButton1 = screen.getByRole('button', { name: /Start Recording/i });
      fireEvent.click(startButton1);

      await waitFor(() => {
        expect(screen.getByTestId('video-recorder')).toBeInTheDocument();
      });

      const errorButton1 = screen.getByRole('button', { name: /Simulate Error/i });
      fireEvent.click(errorButton1);

      await waitFor(() => {
        expect(screen.getByText('Camera error')).toBeInTheDocument();
      });

      // Second error
      const startButton2 = screen.getByRole('button', { name: /Start Recording/i });
      fireEvent.click(startButton2);

      await waitFor(() => {
        expect(screen.getByTestId('video-recorder')).toBeInTheDocument();
      });

      const errorButton2 = screen.getByRole('button', { name: /Simulate Error/i });
      fireEvent.click(errorButton2);

      // Should still handle gracefully
      await waitFor(() => {
        expect(screen.getByText('Camera error')).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /Start Recording/i })).toBeInTheDocument();
    });
  });

  describe('Rest Day Flow', () => {
    it('should show rest day component when target duration is null', () => {
      jest.spyOn(timerLogic, 'calculateTargetDuration').mockReturnValue(null);

      render(<PlankTimer />);

      expect(screen.getByTestId('rest-day')).toBeInTheDocument();
      expect(screen.getByText(/Rest Day - Take a break!/i)).toBeInTheDocument();
    });

    it('should not show recording controls on rest day', () => {
      jest.spyOn(timerLogic, 'calculateTargetDuration').mockReturnValue(null);

      render(<PlankTimer />);

      expect(screen.queryByRole('button', { name: /Start Recording/i })).not.toBeInTheDocument();
      expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    });
  });

  describe('Multi-day Progression', () => {
    it('should show increasing durations over multiple days', () => {
      const testDays = [
        { day: 1, duration: 30 },
        { day: 2, duration: 36 },
        { day: 3, duration: 42 },
        { day: 10, duration: 84 },
      ];

      testDays.forEach(({ day, duration }) => {
        jest.spyOn(timerLogic, 'calculateTargetDuration').mockReturnValue(duration);
        jest.spyOn(timerLogic, 'getDayNumber').mockReturnValue(day);
        jest.spyOn(timerLogic, 'formatDuration').mockReturnValue(
          `${Math.floor(duration / 60)
            .toString()
            .padStart(2, '0')}:${(duration % 60).toString().padStart(2, '0')}`
        );

        const { unmount } = render(<PlankTimer />);

        expect(screen.getByText(`Day ${day} Challenge`)).toBeInTheDocument();
        expect(screen.getByText(`${duration} seconds`)).toBeInTheDocument();

        unmount();
      });
    });
  });

  describe('UI State Consistency', () => {
    it('should maintain consistent UI state during transitions', async () => {
      jest.spyOn(timerLogic, 'calculateTargetDuration').mockReturnValue(30);
      jest.spyOn(timerLogic, 'getDayNumber').mockReturnValue(1);
      jest.spyOn(timerLogic, 'formatDuration').mockReturnValue('00:30');

      render(<PlankTimer />);

      // Idle state elements
      const initialTitle = screen.getByText('Plank Timer');
      expect(initialTitle).toBeInTheDocument();

      // Start recording
      const startButton = screen.getByRole('button', { name: /Start Recording/i });
      fireEvent.click(startButton);

      // Recording state - idle elements should not be visible
      await waitFor(() => {
        expect(screen.queryByText("Today's Goal")).not.toBeInTheDocument();
      });

      // Complete
      const completeButton = screen.getByRole('button', { name: /Complete Recording/i });
      fireEvent.click(completeButton);

      // Completed state
      await waitFor(() => {
        expect(screen.getByText('Congratulations!')).toBeInTheDocument();
      });

      // Recording elements should not be visible
      expect(screen.queryByTestId('video-recorder')).not.toBeInTheDocument();
    });
  });

  describe('Discord Integration', () => {
    it('should display Discord link in all appropriate states', async () => {
      jest.spyOn(timerLogic, 'calculateTargetDuration').mockReturnValue(30);
      jest.spyOn(timerLogic, 'getDayNumber').mockReturnValue(1);
      jest.spyOn(timerLogic, 'formatDuration').mockReturnValue('00:30');

      render(<PlankTimer />);

      // Discord link in idle state
      let discordLinks = screen.getAllByText(/Plank-Challenge Discord/i);
      expect(discordLinks.length).toBeGreaterThan(0);

      // Start recording
      const startButton = screen.getByRole('button', { name: /Start Recording/i });
      fireEvent.click(startButton);

      await waitFor(() => {
        expect(screen.getByTestId('video-recorder')).toBeInTheDocument();
      });

      // Complete
      const completeButton = screen.getByRole('button', { name: /Complete Recording/i });
      fireEvent.click(completeButton);

      // Discord link in completed state
      await waitFor(() => {
        discordLinks = screen.getAllByText(/Plank-Challenge Discord/i);
        expect(discordLinks.length).toBeGreaterThan(0);
      });
    });
  });
});
