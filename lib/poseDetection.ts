/**
 * Pose Detection Utilities for Plank Detection
 * Uses MediaPipe Pose to detect body landmarks and validate plank position
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
 * More forgiving for front-facing plank view
 */
export function areLandmarksVisible(
  landmarks: NormalizedLandmark[],
  minVisibility: number = 0.3
): boolean {
  // For front-facing plank, we need at least shoulders, hips, and some limbs visible
  // More forgiving because some parts may be occluded
  const criticalIndices = [
    POSE_LANDMARKS.NOSE,
    POSE_LANDMARKS.LEFT_SHOULDER,
    POSE_LANDMARKS.RIGHT_SHOULDER,
    POSE_LANDMARKS.LEFT_HIP,
    POSE_LANDMARKS.RIGHT_HIP,
  ];

  const optionalIndices = [
    POSE_LANDMARKS.LEFT_ELBOW,
    POSE_LANDMARKS.RIGHT_ELBOW,
    POSE_LANDMARKS.LEFT_KNEE,
    POSE_LANDMARKS.RIGHT_KNEE,
    POSE_LANDMARKS.LEFT_ANKLE,
    POSE_LANDMARKS.RIGHT_ANKLE,
  ];

  // Critical landmarks MUST be visible
  const criticalVisible = criticalIndices.every(
    (idx) => landmarks[idx] && landmarks[idx].visibility && landmarks[idx].visibility >= minVisibility
  );

  if (!criticalVisible) {
    return false;
  }

  // At least 4 out of 6 optional landmarks should be visible
  const optionalVisible = optionalIndices.filter(
    (idx) => landmarks[idx] && landmarks[idx].visibility && landmarks[idx].visibility >= minVisibility
  ).length;

  return optionalVisible >= 4;
}

/**
 * Calculate all relevant angles for plank detection
 */
export function calculatePoseAngles(landmarks: NormalizedLandmark[]): PoseAngles {
  return {
    // Shoulder angles (Elbow-Shoulder-Hip)
    leftShoulder: calculateAngle(
      landmarks[POSE_LANDMARKS.LEFT_ELBOW],
      landmarks[POSE_LANDMARKS.LEFT_SHOULDER],
      landmarks[POSE_LANDMARKS.LEFT_HIP]
    ),
    rightShoulder: calculateAngle(
      landmarks[POSE_LANDMARKS.RIGHT_ELBOW],
      landmarks[POSE_LANDMARKS.RIGHT_SHOULDER],
      landmarks[POSE_LANDMARKS.RIGHT_HIP]
    ),

    // Elbow angles (Shoulder-Elbow-Wrist)
    leftElbow: calculateAngle(
      landmarks[POSE_LANDMARKS.LEFT_SHOULDER],
      landmarks[POSE_LANDMARKS.LEFT_ELBOW],
      landmarks[POSE_LANDMARKS.LEFT_WRIST]
    ),
    rightElbow: calculateAngle(
      landmarks[POSE_LANDMARKS.RIGHT_SHOULDER],
      landmarks[POSE_LANDMARKS.RIGHT_ELBOW],
      landmarks[POSE_LANDMARKS.RIGHT_WRIST]
    ),

    // Hip angles (Shoulder-Hip-Knee)
    leftHip: calculateAngle(
      landmarks[POSE_LANDMARKS.LEFT_SHOULDER],
      landmarks[POSE_LANDMARKS.LEFT_HIP],
      landmarks[POSE_LANDMARKS.LEFT_KNEE]
    ),
    rightHip: calculateAngle(
      landmarks[POSE_LANDMARKS.RIGHT_SHOULDER],
      landmarks[POSE_LANDMARKS.RIGHT_HIP],
      landmarks[POSE_LANDMARKS.RIGHT_KNEE]
    ),

    // Knee angles (Hip-Knee-Ankle)
    leftKnee: calculateAngle(
      landmarks[POSE_LANDMARKS.LEFT_HIP],
      landmarks[POSE_LANDMARKS.LEFT_KNEE],
      landmarks[POSE_LANDMARKS.LEFT_ANKLE]
    ),
    rightKnee: calculateAngle(
      landmarks[POSE_LANDMARKS.RIGHT_HIP],
      landmarks[POSE_LANDMARKS.RIGHT_KNEE],
      landmarks[POSE_LANDMARKS.RIGHT_ANKLE]
    ),

    // Body alignment (Shoulder-Hip-Ankle) - average of left and right
    bodyAlignment:
      (calculateAngle(
        landmarks[POSE_LANDMARKS.LEFT_SHOULDER],
        landmarks[POSE_LANDMARKS.LEFT_HIP],
        landmarks[POSE_LANDMARKS.LEFT_ANKLE]
      ) +
        calculateAngle(
          landmarks[POSE_LANDMARKS.RIGHT_SHOULDER],
          landmarks[POSE_LANDMARKS.RIGHT_HIP],
          landmarks[POSE_LANDMARKS.RIGHT_ANKLE]
        )) /
      2,
  };
}

/**
 * Calculate vertical distance between two landmarks (Y axis)
 * Useful for checking if body is parallel to ground in front-facing view
 */
function getVerticalDistance(a: NormalizedLandmark, b: NormalizedLandmark): number {
  return Math.abs(a.y - b.y);
}

/**
 * Calculate horizontal distance between two landmarks (X axis)
 */
function getHorizontalDistance(a: NormalizedLandmark, b: NormalizedLandmark): number {
  return Math.abs(a.x - b.x);
}

/**
 * Detect if the pose represents a valid plank position
 * FRONT-FACING VIEW: User is planking toward camera (phone propped against wall)
 * Camera sees: face, shoulders, arms extending toward camera, body parallel to ground
 * Returns detection result with confidence and feedback
 */
export function detectPlankPosition(landmarks: NormalizedLandmark[]): PlankDetectionResult {
  // Check if landmarks are visible
  if (!areLandmarksVisible(landmarks)) {
    // Debug: Check which key parts are missing
    const nose = landmarks[POSE_LANDMARKS.NOSE];
    const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
    const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
    const leftHip = landmarks[POSE_LANDMARKS.LEFT_HIP];
    const rightHip = landmarks[POSE_LANDMARKS.RIGHT_HIP];

    const missingParts: string[] = [];
    if (!nose || !nose.visibility || nose.visibility < 0.3) missingParts.push('face');
    if (!leftShoulder || !leftShoulder.visibility || leftShoulder.visibility < 0.3 ||
        !rightShoulder || !rightShoulder.visibility || rightShoulder.visibility < 0.3) {
      missingParts.push('shoulders');
    }
    if (!leftHip || !leftHip.visibility || leftHip.visibility < 0.3 ||
        !rightHip || !rightHip.visibility || rightHip.visibility < 0.3) {
      missingParts.push('hips');
    }

    const feedbackMsg = missingParts.length > 0
      ? `Cannot see: ${missingParts.join(', ')}. Move back to show full body.`
      : 'Cannot see enough body parts. Move back to show full body.';

    return {
      isPlank: false,
      confidence: 0,
      feedback: [feedbackMsg],
      landmarks,
    };
  }

  const feedback: string[] = [];
  let confidence = 100;

  // Get key landmarks
  const nose = landmarks[POSE_LANDMARKS.NOSE];
  const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
  const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
  const leftElbow = landmarks[POSE_LANDMARKS.LEFT_ELBOW];
  const rightElbow = landmarks[POSE_LANDMARKS.RIGHT_ELBOW];
  const leftWrist = landmarks[POSE_LANDMARKS.LEFT_WRIST];
  const rightWrist = landmarks[POSE_LANDMARKS.RIGHT_WRIST];
  const leftHip = landmarks[POSE_LANDMARKS.LEFT_HIP];
  const rightHip = landmarks[POSE_LANDMARKS.RIGHT_HIP];
  const leftKnee = landmarks[POSE_LANDMARKS.LEFT_KNEE];
  const rightKnee = landmarks[POSE_LANDMARKS.RIGHT_KNEE];
  const leftAnkle = landmarks[POSE_LANDMARKS.LEFT_ANKLE];
  const rightAnkle = landmarks[POSE_LANDMARKS.RIGHT_ANKLE];

  // 1. CHECK BODY IS HORIZONTAL (parallel to ground)
  // In front-facing view, shoulders, hips, knees, ankles should all be at similar Y positions
  const shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
  const hipY = (leftHip.y + rightHip.y) / 2;
  const kneeY = (leftKnee.y + rightKnee.y) / 2;
  const ankleY = (leftAnkle.y + rightAnkle.y) / 2;

  // Body should be relatively level (all parts at similar height)
  const bodyLevelness = Math.max(
    getVerticalDistance({ y: shoulderY, x: 0, z: 0, visibility: 1 }, { y: hipY, x: 0, z: 0, visibility: 1 }),
    getVerticalDistance({ y: hipY, x: 0, z: 0, visibility: 1 }, { y: kneeY, x: 0, z: 0, visibility: 1 })
  );

  if (bodyLevelness > 0.15) {
    feedback.push('Keep your body straight and level');
    confidence -= 30;
  } else if (bodyLevelness > 0.10) {
    feedback.push('Body alignment could be better');
    confidence -= 15;
  }

  // 2. CHECK HEAD POSITION (should be looking at camera, not down)
  // Nose should be at similar Y level as shoulders (not too low)
  const noseShoulderDiff = getVerticalDistance(nose, leftShoulder);

  if (noseShoulderDiff > 0.15) {
    feedback.push('Lift your head - look at the camera');
    confidence -= 20;
  } else if (noseShoulderDiff > 0.10) {
    confidence -= 10;
  }

  // 3. CHECK ARMS ARE EXTENDED (elbows and wrists should be lower/further from camera than shoulders)
  // In front view with arms extended toward camera, elbows appear lower (higher Y) than shoulders
  const leftArmExtended = leftElbow.y > leftShoulder.y - 0.05;
  const rightArmExtended = rightElbow.y > rightShoulder.y - 0.05;

  if (!leftArmExtended || !rightArmExtended) {
    feedback.push('Extend your arms toward the camera');
    confidence -= 25;
  }

  // 4. CHECK ELBOW ALIGNMENT
  // Elbows should be at roughly same Y position (level with each other)
  const elbowLevelness = getVerticalDistance(leftElbow, rightElbow);

  if (elbowLevelness > 0.1) {
    feedback.push('Keep elbows level');
    confidence -= 15;
  }

  // 5. CHECK SHOULDER WIDTH (shoulders should be visible and apart)
  const shoulderWidth = getHorizontalDistance(leftShoulder, rightShoulder);

  if (shoulderWidth < 0.15) {
    feedback.push('Position camera to see both shoulders');
    confidence -= 20;
  }

  // 6. CHECK LEGS ARE STRAIGHT
  // Knees should be at similar Y level as hips and ankles (all aligned)
  const legStraightness = Math.abs(kneeY - hipY) + Math.abs(kneeY - ankleY);

  if (legStraightness > 0.15) {
    feedback.push('Straighten your legs');
    confidence -= 25;
  } else if (legStraightness > 0.10) {
    confidence -= 10;
  }

  // 7. CHECK BODY ISN'T TOO HIGH OR LOW
  // Head/shoulders should be in upper half of frame, legs in lower half
  const avgBodyY = (shoulderY + hipY + kneeY) / 3;

  if (avgBodyY < 0.3) {
    feedback.push('Move camera higher or position yourself lower in frame');
    confidence -= 15;
  } else if (avgBodyY > 0.8) {
    feedback.push('Move camera lower or position yourself higher in frame');
    confidence -= 15;
  }

  // 8. CHECK SYMMETRY (left and right sides should match)
  const leftRightSymmetry = Math.abs(leftShoulder.y - rightShoulder.y) +
                            Math.abs(leftHip.y - rightHip.y) +
                            Math.abs(leftKnee.y - rightKnee.y);

  if (leftRightSymmetry > 0.15) {
    feedback.push('Balance your weight evenly on both sides');
    confidence -= 15;
  }

  // Determine if it's a valid plank
  // Require at least 55% confidence to consider it a plank (slightly lower threshold for front view)
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
  // Define connections between landmarks
  const connections = [
    // Torso
    [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.RIGHT_SHOULDER],
    [POSE_LANDMARKS.LEFT_SHOULDER, POSE_LANDMARKS.LEFT_HIP],
    [POSE_LANDMARKS.RIGHT_SHOULDER, POSE_LANDMARKS.RIGHT_HIP],
    [POSE_LANDMARKS.LEFT_HIP, POSE_LANDMARKS.RIGHT_HIP],

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
  ];

  // Draw connections
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  connections.forEach(([start, end]) => {
    const startLandmark = landmarks[start];
    const endLandmark = landmarks[end];

    if (startLandmark && endLandmark &&
        startLandmark.visibility && startLandmark.visibility > 0.5 &&
        endLandmark.visibility && endLandmark.visibility > 0.5) {
      ctx.beginPath();
      ctx.moveTo(startLandmark.x * canvasWidth, startLandmark.y * canvasHeight);
      ctx.lineTo(endLandmark.x * canvasWidth, endLandmark.y * canvasHeight);
      ctx.stroke();
    }
  });

  // Draw landmarks
  ctx.fillStyle = color;
  landmarks.forEach((landmark) => {
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
  });
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
  result.feedback.forEach((text, index) => {
    const color = result.isPlank && index === 0 ? '#00FF00' : '#FFFF00';
    ctx.fillStyle = color;
    ctx.fillText(text, padding * 2, padding * 1.5 + index * lineHeight);
  });

  // Draw confidence meter at bottom right
  const meterWidth = 200;
  const meterHeight = 20;
  const meterX = canvasWidth - meterWidth - padding;
  const meterY = canvasHeight - meterHeight - padding;

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
