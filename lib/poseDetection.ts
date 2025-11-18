/**
 * Pose Detection Utilities for Plank Detection
 * Uses MediaPipe Pose to detect body landmarks and validate plank position
 * SIDE VIEW (LANDSCAPE MODE): Camera captures plank from the side
 */

import { PoseLandmarker, PoseLandmarkerResult, NormalizedLandmark } from '@mediapipe/tasks-vision';

export interface PlankDetectionResult {
  isPlank: boolean;
  confidence: number;
  feedback: string[];
  landmarks?: NormalizedLandmark[];
}

export interface PoseAngles {
  leftShoulder: number;
  rightShoulder: number;
  leftElbow: number;
  rightElbow: number;
  leftHip: number;
  rightHip: number;
  leftKnee: number;
  rightKnee: number;
  bodyAlignment: number; // Shoulder-Hip-Ankle alignment
}

// MediaPipe Pose landmark indices
export const POSE_LANDMARKS = {
  NOSE: 0,
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

/**
 * Calculate angle between three points (in degrees)
 * @param a First point
 * @param b Middle point (vertex)
 * @param c Last point
 */
export function calculateAngle(
  a: NormalizedLandmark,
  b: NormalizedLandmark,
  c: NormalizedLandmark
): number {
  const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
  let angle = Math.abs((radians * 180.0) / Math.PI);

  if (angle > 180.0) {
    angle = 360 - angle;
  }

  return angle;
}

/**
 * Check if key landmarks are visible with sufficient confidence
 * More forgiving for side-view plank
 */
export function areLandmarksVisible(
  landmarks: NormalizedLandmark[],
  minVisibility: number = 0.3
): boolean {
  // For side-view plank, we need at least one side visible (left or right)
  const criticalIndices = [
    POSE_LANDMARKS.NOSE,
    POSE_LANDMARKS.LEFT_SHOULDER,
    POSE_LANDMARKS.LEFT_HIP,
    POSE_LANDMARKS.LEFT_KNEE,
    POSE_LANDMARKS.LEFT_ANKLE,
  ];

  // All critical landmarks must be visible for side view
  return criticalIndices.every(
    (idx) => landmarks[idx] && landmarks[idx].visibility && landmarks[idx].visibility >= minVisibility
  );
}

/**
 * Detect if the pose represents a valid plank position
 * SIDE VIEW (LANDSCAPE): User is in plank position, camera captures from the side
 * Camera sees: Profile view with shoulders, hips, knees, ankles forming straight line
 * Returns detection result with confidence and feedback
 */
export function detectPlankPosition(landmarks: NormalizedLandmark[]): PlankDetectionResult {
  // Check if landmarks are visible
  if (!areLandmarksVisible(landmarks)) {
    return {
      isPlank: false,
      confidence: 0,
      feedback: ['Position yourself sideways to camera. Show full body from head to feet.'],
      landmarks,
    };
  }

  const feedback: string[] = [];
  let confidence = 100;

  // Get key landmarks (use left side for side view, as it's typically more visible)
  const nose = landmarks[POSE_LANDMARKS.NOSE];
  const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
  const leftElbow = landmarks[POSE_LANDMARKS.LEFT_ELBOW];
  const leftWrist = landmarks[POSE_LANDMARKS.LEFT_WRIST];
  const leftHip = landmarks[POSE_LANDMARKS.LEFT_HIP];
  const leftKnee = landmarks[POSE_LANDMARKS.LEFT_KNEE];
  const leftAnkle = landmarks[POSE_LANDMARKS.LEFT_ANKLE];

  // SIDE VIEW DETECTION: Check body alignment from profile
  // In proper plank, shoulder-hip-ankle should form a straight line (160-180°)

  // 1. CHECK BODY ALIGNMENT (most important for side view)
  // Calculate angle between shoulder, hip, and ankle
  const bodyAngle = calculateAngle(leftShoulder, leftHip, leftAnkle);

  if (bodyAngle < 150) {
    feedback.push('Lift your hips higher');
    confidence -= 35;
  } else if (bodyAngle > 195) {
    feedback.push('Lower your hips - avoid sagging');
    confidence -= 35;
  } else if (bodyAngle < 160 || bodyAngle > 185) {
    feedback.push('Adjust hips for straighter alignment');
    confidence -= 20;
  }

  // 2. CHECK LEGS ARE STRAIGHT
  // Knee angle should be 160-180° (straight leg)
  const kneeAngle = calculateAngle(leftHip, leftKnee, leftAnkle);

  if (kneeAngle < 155) {
    feedback.push('Straighten your legs');
    confidence -= 25;
  } else if (kneeAngle < 165) {
    confidence -= 10;
  }

  // 3. CHECK ARM POSITION
  // Elbow should be roughly below shoulder (supporting weight)
  const elbowAngle = calculateAngle(leftShoulder, leftElbow, leftWrist);

  // For forearm plank: 70-110° (bent)
  // For straight-arm plank: 160-200° (straight)
  const isForearmPlank = elbowAngle < 130;
  const isStraightArmPlank = elbowAngle > 145;

  if (!isForearmPlank && !isStraightArmPlank) {
    feedback.push('Choose forearm or straight-arm plank');
    confidence -= 20;
  }

  // Check elbow is positioned correctly (should be roughly under shoulder)
  const elbowShoulderDistance = Math.abs(leftElbow.x - leftShoulder.x);

  if (elbowShoulderDistance > 0.15) {
    feedback.push('Position arms under shoulders');
    confidence -= 15;
  }

  // 4. CHECK HEAD/NECK POSITION
  // Head should be in neutral position (not drooping or too high)
  const shoulderNoseDistance = Math.abs(leftShoulder.y - nose.y);

  if (shoulderNoseDistance > 0.15) {
    feedback.push('Keep head in neutral position');
    confidence -= 10;
  }

  // 5. CHECK BODY IS HORIZONTAL
  // Shoulders and hips should be at similar Y coordinates (horizontal alignment)
  const shoulderHipLevelness = Math.abs(leftShoulder.y - leftHip.y);

  if (shoulderHipLevelness > 0.15) {
    feedback.push('Keep body parallel to ground');
    confidence -= 15;
  }

  // 6. CHECK BODY POSITIONING IN FRAME
  // Body should be well-centered and visible
  const avgBodyY = (leftShoulder.y + leftHip.y + leftAnkle.y) / 3;

  if (avgBodyY < 0.25 || avgBodyY > 0.75) {
    feedback.push('Center yourself in frame');
    confidence -= 10;
  }

  // Determine if it's a valid plank
  // Require at least 55% confidence to consider it a plank
  const isPlank = confidence >= 55 && feedback.length <= 3;

  // Add positive feedback if plank is good
  if (isPlank && confidence >= 85) {
    feedback.unshift('Perfect plank form! 💪');
  } else if (isPlank && confidence >= 70) {
    feedback.unshift('Good plank position - keep it up!');
  } else if (isPlank) {
    feedback.unshift('Plank detected - maintain form');
  }

  return {
    isPlank,
    confidence: Math.max(0, confidence),
    feedback,
    landmarks,
  };
}

/**
 * Draw pose skeleton on canvas
 * Shows body landmarks and connections for visual feedback
 */
export function drawPoseSkeleton(
  ctx: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  canvasWidth: number,
  canvasHeight: number,
  color: string = '#00FF00'
): void {
  // Define connections between landmarks for side view
  const POSE_CONNECTIONS = [
    // Torso
    [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.LEFT_HIP],
    [POSE_LANDMARKS.RIGHT_SHOULDER, POSE_LANDMARKS.RIGHT_HIP],

    // Left arm
    [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.LEFT_ELBOW],
    [POSE_LANDMARKS.LEFT_ELBOW, POSE_LANDMARKS.LEFT_WRIST],

    // Right arm
    [POSE_LANDMARKS.RIGHT_SHOULDER, POSE_LANDMARKS.RIGHT_ELBOW],
    [POSE_LANDMARKS.RIGHT_ELBOW, POSE_LANDMARKS.RIGHT_WRIST],

    // Left leg
    [POSE_LANDMARKS.LEFT_HIP, POSE_LANDMARKS.LEFT_KNEE],
    [POSE_LANDMARKS.LEFT_KNEE, POSE_LANDMARKS.LEFT_ANKLE],

    // Right leg
    [POSE_LANDMARKS.RIGHT_HIP, POSE_LANDMARKS.RIGHT_KNEE],
    [POSE_LANDMARKS.RIGHT_KNEE, POSE_LANDMARKS.RIGHT_ANKLE],

    // Head/neck
    [POSE_LANDMARKS.NOSE, POSE_LANDMARKS.LEFT_SHOULDER],
    [POSE_LANDMARKS.NOSE, POSE_LANDMARKS.RIGHT_SHOULDER],
  ];

  // Draw connections
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;

  for (let i = 0; i < POSE_CONNECTIONS.length; i++) {
    const [startIdx, endIdx] = POSE_CONNECTIONS[i];
    const startLandmark = landmarks[startIdx];
    const endLandmark = landmarks[endIdx];

    if (startLandmark && endLandmark &&
        startLandmark.visibility && startLandmark.visibility > 0.5 &&
        endLandmark.visibility && endLandmark.visibility > 0.5) {
      ctx.beginPath();
      ctx.moveTo(startLandmark.x * canvasWidth, startLandmark.y * canvasHeight);
      ctx.lineTo(endLandmark.x * canvasWidth, endLandmark.y * canvasHeight);
      ctx.stroke();
    }
  }

  // Draw landmarks
  ctx.fillStyle = color;

  for (let i = 0; i < landmarks.length; i++) {
    const landmark = landmarks[i];
    if (landmark && landmark.visibility && landmark.visibility > 0.5) {
      ctx.beginPath();
      ctx.arc(
        landmark.x * canvasWidth,
        landmark.y * canvasHeight,
        5,
        0,
        2 * Math.PI
      );
      ctx.fill();
    }
  }
}

/**
 * Draw detection feedback overlay
 */
export function drawDetectionFeedback(
  ctx: CanvasRenderingContext2D,
  result: PlankDetectionResult,
  canvasWidth: number,
  canvasHeight: number
): void {
  // Draw feedback text at top
  const fontSize = Math.min(canvasWidth, canvasHeight) * 0.04;
  ctx.font = `bold ${fontSize}px sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';

  // Background for feedback
  const padding = 15;
  const lineHeight = fontSize * 1.4;
  const feedbackHeight = result.feedback.length * lineHeight + padding * 2;

  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(padding, padding, canvasWidth - padding * 2, feedbackHeight);

  // Draw feedback text
  for (let i = 0; i < result.feedback.length; i++) {
    const text = result.feedback[i];
    const color = result.isPlank && i === 0 ? '#00FF00' : '#FFFF00';
    ctx.fillStyle = color;
    ctx.fillText(text, padding * 2, padding * 1.5 + i * lineHeight);
  }

  // Draw confidence meter at bottom right (with more padding to avoid cutoff)
  const meterWidth = Math.min(200, canvasWidth * 0.3);
  const meterHeight = 20;
  const meterX = canvasWidth - meterWidth - padding * 2;
  const meterY = canvasHeight - meterHeight - padding * 3;

  // Background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(meterX - 10, meterY - 10, meterWidth + 20, meterHeight + 30);

  // Label
  ctx.font = `${fontSize * 0.8}px sans-serif`;
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'left';
  ctx.fillText('Detection:', meterX, meterY - 5);

  // Meter background
  ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.fillRect(meterX, meterY + 15, meterWidth, meterHeight);

  // Meter fill
  const fillWidth = (result.confidence / 100) * meterWidth;
  const meterColor = result.confidence >= 80 ? '#00FF00' :
                     result.confidence >= 60 ? '#FFFF00' : '#FF0000';
  ctx.fillStyle = meterColor;
  ctx.fillRect(meterX, meterY + 15, fillWidth, meterHeight);

  // Confidence percentage
  ctx.font = `bold ${fontSize * 0.9}px sans-serif`;
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.fillText(
    `${Math.round(result.confidence)}%`,
    meterX + meterWidth / 2,
    meterY + 15 + meterHeight / 2 + 2
  );
}
