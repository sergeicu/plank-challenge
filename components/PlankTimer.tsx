'use client';

import { useState } from 'react';
import { calculateTargetDuration, getDayNumber, formatDuration } from '@/utils/timerLogic';
import VideoRecorder from './VideoRecorder';
import RestDay from './RestDay';

type AppState = 'idle' | 'recording' | 'completed';

export default function PlankTimer() {
  const [appState, setAppState] = useState<AppState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [detectionMode, setDetectionMode] = useState(false);

  const targetDuration = calculateTargetDuration();
  const dayNumber = getDayNumber();

  // If it's a rest day (Sunday), show rest day component
  if (targetDuration === null) {
    return <RestDay />;
  }

  const handleStart = () => {
    setAppState('recording');
    setErrorMessage(null);
  };

  const handleComplete = () => {
    setAppState('completed');
  };

  const handleError = (error: string) => {
    setErrorMessage(error);
    setAppState('idle');
  };

  const handleReset = () => {
    setAppState('idle');
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-blue-50 p-4">
      <div className="max-w-4xl mx-auto py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-gray-800 mb-2">
            Plank Timer
          </h1>
          <p className="text-xl text-gray-600">
            Day {dayNumber} Challenge
          </p>
        </div>

        {/* Idle State - Start Screen */}
        {appState === 'idle' && (
          <div className="flex flex-col items-center">
            {/* Challenge Card */}
            <div className="bg-white rounded-2xl shadow-xl p-6 mb-6 max-w-md w-full">
              <div className="text-center mb-4">
                <div className="inline-block p-3 bg-purple-100 rounded-full mb-3">
                  <svg
                    className="w-10 h-10 text-purple-600"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-2">
                  Today's Goal
                </h2>
                <p className="text-5xl font-bold text-purple-600 font-mono">
                  {formatDuration(targetDuration)}
                </p>
                <p className="text-gray-600 mt-1 text-sm">
                  {targetDuration} seconds
                </p>
              </div>

              {errorMessage && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-red-600 text-sm font-medium">{errorMessage}</p>
                </div>
              )}

              {/* Detection Mode Toggle */}
              <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={detectionMode}
                    onChange={(e) => setDetectionMode(e.target.checked)}
                    className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500 focus:ring-2 mr-3"
                  />
                  <div className="flex-1">
                    <div className="font-semibold text-gray-800">Auto-Detection Mode</div>
                    <div className="text-xs text-gray-600 mt-1">
                      Timer starts when you get into plank, stops when you drop
                    </div>
                  </div>
                </label>
              </div>

              <button
                onClick={handleStart}
                className="w-full py-4 bg-purple-600 text-white text-xl font-bold rounded-xl hover:bg-purple-700 transition-colors shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95"
              >
                {detectionMode ? 'Start Detection Mode' : 'Start Recording'}
              </button>
            </div>

            {/* Discord Link */}
            <div className="mt-4">
              <a
                href={process.env.NEXT_PUBLIC_DISCORD_URL || 'https://discord.com/channels/1210290974601773056/1438326766279196782'}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-semibold"
              >
                <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.317 4.37a19.791 19.791 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.736 19.736 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.107 13.107 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.299 12.299 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.839 19.839 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                </svg>
                Plank-Challenge Discord
              </a>
            </div>

            {/* Info Box */}
            <div className="mt-8 max-w-md w-full bg-blue-50 rounded-lg p-4">
              <p className="text-blue-800 text-sm text-center">
                <strong>Tip:</strong> Position your device so the camera can see your plank form. The timer will be recorded in the video!
              </p>
            </div>
          </div>
        )}

        {/* Recording State */}
        {appState === 'recording' && (
          <VideoRecorder
            targetDuration={targetDuration}
            onComplete={handleComplete}
            onError={handleError}
            detectionMode={detectionMode}
          />
        )}

        {/* Completed State */}
        {appState === 'completed' && (
          <div className="flex flex-col items-center">
            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
              {/* Success Icon */}
              <div className="mb-6">
                <div className="inline-block p-6 bg-green-100 rounded-full">
                  <svg
                    className="w-16 h-16 text-green-600"
                    fill="none"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>

              <h2 className="text-4xl font-bold text-gray-800 mb-2">
                Congratulations!
              </h2>
              <p className="text-xl text-gray-600 mb-6">
                Day {dayNumber} Complete
              </p>

              <div className="bg-green-50 rounded-lg p-4 mb-6">
                <p className="text-green-800 font-medium">
                  You held your plank for {formatDuration(targetDuration)}!
                </p>
                <p className="text-green-700 text-sm mt-2">
                  Your video has been downloaded automatically.
                </p>
              </div>

              <button
                onClick={handleReset}
                className="w-full py-3 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 transition-colors"
              >
                Record Another
              </button>

              {/* Share Section */}
              <div className="mt-6 pt-6 border-t">
                <p className="text-gray-600 mb-3">Share your progress!</p>
                <a
                  href={process.env.NEXT_PUBLIC_DISCORD_URL || 'https://discord.com/channels/1210290974601773056/1438326766279196782'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-semibold"
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
      </div>
    </div>
  );
}
