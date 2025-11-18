/**
 * Video recorder utility for capturing canvas stream with MediaRecorder API
 */

export interface RecorderOptions {
  mimeType?: string;
  videoBitsPerSecond?: number;
}

export class VideoRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private stream: MediaStream | null = null;

  constructor(private options: RecorderOptions = {}) {
    this.options = {
      mimeType: this.getSupportedMimeType(),
      videoBitsPerSecond: 2500000, // 2.5 Mbps
      ...options,
    };
  }

  /**
   * Get the best supported MIME type for video recording
   */
  private getSupportedMimeType(): string {
    const types = [
      'video/webm;codecs=vp9',
      'video/webm;codecs=vp8',
      'video/webm',
      'video/mp4',
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return 'video/webm'; // Fallback
  }

  /**
   * Start recording from a canvas stream
   */
  start(canvasStream: MediaStream): void {
    this.recordedChunks = [];
    this.stream = canvasStream;

    try {
      this.mediaRecorder = new MediaRecorder(canvasStream, {
        mimeType: this.options.mimeType,
        videoBitsPerSecond: this.options.videoBitsPerSecond,
      });

      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      this.mediaRecorder.start(100); // Collect data every 100ms
    } catch (error) {
      console.error('Failed to start recording:', error);
      throw new Error('Failed to start recording');
    }
  }

  /**
   * Stop recording and return the recorded blob
   */
  async stop(): Promise<Blob> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('No active recording'));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.recordedChunks, {
          type: this.options.mimeType,
        });
        resolve(blob);
      };

      this.mediaRecorder.onerror = (event) => {
        reject(new Error('Recording error'));
      };

      try {
        this.mediaRecorder.stop();

        // Don't stop stream tracks here - let the component handle cleanup
        // Stopping tracks immediately causes recording to end prematurely
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Check if currently recording
   */
  isRecording(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }

  /**
   * Get the current recording state
   */
  getState(): RecordingState {
    return this.mediaRecorder?.state || 'inactive';
  }
}

export type RecordingState = 'inactive' | 'recording' | 'paused';

/**
 * Download a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();

  // Cleanup
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
}

/**
 * Request camera access with specified camera facing mode for landscape side-view plank recording
 */
export async function getCameraStream(facingMode: 'user' | 'environment' = 'environment'): Promise<MediaStream> {
  try {
    // Check if mediaDevices API is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Camera API not available. Please use HTTPS or a supported browser.');
    }

    // Use specified camera in landscape mode for side-view plank recording
    const constraints: MediaStreamConstraints = {
      video: {
        facingMode: { ideal: facingMode }, // User-selected camera (front or back)
        width: { ideal: 1920 },  // Landscape mode
        height: { ideal: 1080 },
        aspectRatio: { ideal: 16 / 9 },
      },
      audio: false,
    };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    return stream;
  } catch (error) {
    console.error('Failed to get camera stream:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Camera access denied or unavailable');
  }
}
