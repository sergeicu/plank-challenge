# Product Specification Document
## Plank Timer - 30-Day Challenge Application

**Version:** 1.0.0
**Date:** November 19, 2025
**Product Owner:** Jordan Tian
**Status:** Active Development

---

## Executive Summary

### Product Name
Plank Timer - 30-Day Progressive Challenge

### Purpose
Plank Timer is a web-based fitness application designed to help users complete a structured 30-day plank challenge. The app provides video recording capabilities with timer overlays, AI-powered form detection, and local progress tracking to support user accountability and motivation throughout the challenge.

### Target Audience
**Primary Users:**
- Fitness enthusiasts looking for structured plank training
- Users participating in community fitness challenges
- Individuals seeking to build core strength through progressive training
- Discord community members in the Plank-Challenge server

**User Demographics:**
- Age: 18-45
- Fitness level: Beginner to intermediate
- Tech-savvy mobile users
- Self-motivated with interest in gamification and tracking

### Key Value Proposition
Plank Timer solves the problem of accountability and form verification in self-directed fitness challenges by:
1. **Automated progression tracking** - Takes the guesswork out of daily targets
2. **Visual proof of completion** - Records video evidence with embedded timer overlay
3. **AI-powered form detection** - Helps users maintain proper plank position
4. **Community integration** - Seamlessly connects with Discord for social accountability
5. **Zero-setup tracking** - Local storage means no account creation required

---

## Product Overview

### What the Product Does
Plank Timer is a progressive fitness challenge application that guides users through a 30-day plank training program. Starting at 30 seconds and increasing by 6 seconds per training day, users record themselves performing planks while the app captures video with an embedded timer overlay. The app features optional AI-powered pose detection to automatically start/stop recording based on proper plank form.

### Problem It Solves

**User Pain Points:**
1. **Lack of structure** - Users don't know how long to hold planks or how to progress
2. **Accountability gaps** - Easy to skip days or exaggerate completion without proof
3. **Form uncertainty** - Users unsure if they're maintaining proper plank position
4. **Manual tracking burden** - Tedious to calculate daily targets and track progress
5. **Social isolation** - Solo fitness challenges lack community motivation

**Solution:**
Plank Timer automates progression, captures verifiable video proof, uses AI to validate form, and integrates with Discord communities for social accountability and motivation.

### User Journey

#### First-Time User Flow
1. User visits app URL on mobile device
2. Sees Day 1 challenge: 30 seconds
3. Chooses camera mode (front/back) and recording mode (manual/auto-detection)
4. Grants camera permission
5. Records first plank (10-second countdown or auto-detection)
6. Video automatically downloads with timer overlay
7. Prompted to create username
8. Copies formatted results to share in Discord
9. Progress saved locally to device

#### Returning User Flow
1. User returns next day
2. Sees updated daily target (e.g., Day 2: 36 seconds)
3. Views progress page showing completed days and streaks
4. Records new plank session
5. Shares completion to Discord community
6. Checks "Still in Running" status

#### Rest Day Flow
1. User visits app on Sunday
2. Sees rest day message with next challenge preview
3. Can view progress page to check stats
4. Returns Monday for next challenge

---

## Feature Specifications

### 1. Progressive Challenge System

**Description:**
Automated 30-day challenge with calculated daily targets based on start date, excluding rest days (Sundays).

**Functionality:**
- Start date: November 17, 2025
- Base duration: 30 seconds (Day 1)
- Daily increment: 6 seconds per training day
- Formula: `Target = 30 + (Training Days × 6)`
- Sundays automatically designated as rest days
- Final target (Day 30): 30 + (30 × 6) = 210 seconds (3:30)

**User Flow:**
1. User opens app
2. App calculates current day number (excluding Sundays)
3. Target duration displayed prominently
4. User informed if today is rest day

**Acceptance Criteria:**
- Given it's a Sunday, When user opens app, Then rest day message is shown
- Given it's Day 1 (Nov 17, 2025), When user opens app, Then target is 30 seconds
- Given it's Day 5 (Nov 22, 2025), When user opens app, Then target is 54 seconds (30 + 4×6)
- Given user opens app before Nov 17, 2025, When target is calculated, Then target is 30 seconds
- Given it's Day 30, When user opens app, Then target is 210 seconds

**Technical Requirements:**
- Uses date-fns library for date calculations
- Client-side calculation based on device time
- Accounts for Sundays in day counting

---

### 2. Manual Recording Mode

**Description:**
Standard recording mode with countdown timer before capture begins.

**Functionality:**
- 10-second countdown before recording starts
- Countdown displayed as large transparent overlay
- Video + timer recorded at 30 FPS
- Stop button available during countdown and recording
- Recording continues until target reached or manually stopped

**User Flow:**
1. User selects camera mode (front/back)
2. Taps "Start Recording" button
3. Camera activates, user sees self
4. 10-second countdown begins with large numbers
5. User gets into plank position
6. Recording starts automatically at 0
7. Timer overlay shows elapsed time vs target (e.g., "00:45 / 01:00")
8. Recording stops when target reached OR user taps Stop
9. Preview screen shows options: Download Video, Download Screenshot, Record Another

**Acceptance Criteria:**
- Given manual mode is selected, When user starts, Then 10-second countdown is shown
- Given countdown is active, When user can see video feed, Then user can position themselves
- Given recording is in progress, When target duration is reached, Then recording stops automatically
- Given user presses Stop, When countdown or recording is active, Then process stops immediately
- Given recording completes, When preview shows, Then user can download video or screenshot
- Given video is downloaded, When file is saved, Then filename format is `plank-dayX-YYYY-MM-DD.webm`

**Technical Requirements:**
- MediaRecorder API for video capture
- Canvas compositing for timer overlay
- 1280×720 resolution (16:9 aspect ratio)
- WebM video format (browser-dependent)
- Real-time canvas rendering at 30 FPS

---

### 3. Auto-Detection Mode (AI-Powered)

**Description:**
Advanced recording mode using MediaPipe Pose to detect plank position and automatically control recording.

**Functionality:**
- Real-time pose landmark detection (33 body points)
- Side-view plank detection (user in landscape position)
- Visual skeleton overlay (green = good form, red = bad form)
- On-screen feedback messages for form corrections
- Detection confidence meter
- 5-frame stability filter (plank held for 5 consecutive frames to start)
- 30-frame grace period (~3 seconds at 10 FPS before stopping when plank lost)
- Recording starts immediately when plank detected (no countdown)
- Recording stops automatically when plank position lost

**Plank Detection Algorithm:**
- Validates body landmarks are visible (shoulders, hips, knees, ankles)
- Calculates body angle from shoulders to ankles
- Acceptable range: 160-180 degrees (relatively horizontal)
- Validates elbow angle for forearm plank: 70-110 degrees
- All conditions must be met for "plank detected" status

**User Flow:**
1. User enables "Auto-Detection Mode" checkbox
2. Taps "Start Detection Mode" button
3. Camera activates with skeleton overlay
4. Message shows: "Get into plank position"
5. User gets into plank, skeleton turns green
6. After 5 stable frames, recording starts automatically
7. User holds plank while timer counts up
8. If form breaks (red skeleton), 30-frame grace period begins
9. If form not recovered in 3 seconds, recording stops automatically
10. Preview screen shown with download options

**Acceptance Criteria:**
- Given detection mode is enabled, When user starts, Then pose detection model loads
- Given user is not in plank, When camera shows user, Then skeleton is red
- Given user is in proper plank, When position held 5 frames, Then recording starts automatically
- Given user is recording, When plank form breaks, Then 30-frame grace period begins
- Given grace period expires, When form not recovered, Then recording stops automatically
- Given recording is active, When timer overlay shows, Then timer is visible in recorded video
- Given detection running, When feedback messages show, Then user sees form correction hints

**Technical Requirements:**
- MediaPipe Pose Landmarker (v0.10.22)
- Pose detection at ~10 FPS (independent from rendering)
- Canvas rendering at 30 FPS (video recording frame rate)
- Stability filtering to prevent false starts
- Grace period to handle brief form breaks

---

### 4. Video Recording & Download

**Description:**
Core video capture functionality with embedded timer overlay and automatic download.

**Functionality:**
- Records camera feed with timer overlay burned into video
- Timer shows elapsed time vs target duration
- Large, readable font with semi-transparent background
- Canvas-based compositing for overlay
- Automatic download when recording completes
- Manual download options in preview screen
- Screenshot capture of final frame

**Technical Details:**
- Canvas size: 1280×720 (or device video resolution)
- Recording frame rate: 30 FPS
- Timer font size: 15% of canvas height
- Timer position: Top center
- Format: WebM (Chrome/Edge), MP4 (Safari, if supported)
- Filename: `plank-dayX-YYYY-MM-DD.webm`
- Screenshot filename: `plank-dayX-YYYYMMDD-screenshot.png`

**User Flow:**
1. Recording completes (target reached or stopped)
2. Preview screen shows captured video duration
3. Options presented: Download Video, Download Screenshot, Record Another
4. "Download Video" triggers automatic file download
5. "Download Screenshot" saves final frame as PNG
6. "Record Another" resets to countdown/detection phase

**Acceptance Criteria:**
- Given recording completes, When video is ready, Then preview screen is shown
- Given user taps Download Video, When file downloads, Then filename includes day number and date
- Given user taps Download Screenshot, When PNG downloads, Then final frame with timer is captured
- Given video is downloaded, When user plays video, Then timer overlay is visible throughout
- Given user taps Record Another, When reset occurs, Then new recording can start immediately

**Technical Requirements:**
- MediaRecorder API with canvas stream
- Blob creation and download
- Canvas toDataURL for screenshot capture
- File download via anchor element with download attribute

---

### 5. Local Progress Tracking (Phase 1 Leaderboard)

**Description:**
Client-side progress tracking using localStorage with "Still in Running" status calculation.

**Functionality:**
- All completions saved to browser localStorage
- No backend, no account required
- 30-day progress grid visualization
- Statistics calculation: days completed, streaks, total time
- "Still in Running" status (strict mode: miss 1 day = eliminated)
- Recent completions history (last 10)
- Username persistence

**Data Structure:**
```typescript
interface Completion {
  day: number;
  date: string; // YYYY-MM-DD
  duration: number; // seconds held
  targetDuration: number; // required duration
  success: boolean; // met or exceeded target
  timestamp: number; // Date.now()
}
```

**Calculated Metrics:**
- Days Completed: Count of successful completions
- Current Streak: Consecutive days completed (ending today/yesterday)
- Longest Streak: Best consecutive day streak ever
- Total Time: Sum of all duration values
- Still in Running: Boolean - true if no days missed since start

**User Flow:**
1. User completes plank and downloads video
2. Completion screen shows "Save & Copy Results" button
3. User taps button - saves to localStorage + copies Discord text
4. User navigates to "/progress" page
5. Views 30-day grid (green = completed, red = missed, gray = upcoming)
6. Sees status banner: "Still in Running" or "Missed Days Detected"
7. Reviews statistics cards and recent completions

**Acceptance Criteria:**
- Given user completes a plank, When they save results, Then completion is stored in localStorage
- Given user completes Day 5, When they check progress, Then grid shows days 1-5 as green or red
- Given user has completed days 1-5 consecutively, When stats are calculated, Then current streak is 5
- Given user missed Day 3, When they check status, Then "Still in Running" is false
- Given user missed Day 3, When they view grid, Then Day 3 shows as red with X
- Given user visits progress page, When data loads, Then statistics are recalculated from localStorage
- Given user has 15 completions, When viewing recent completions, Then only 10 most recent are shown

**Technical Requirements:**
- localStorage API for persistence
- Client-side streak calculation
- Day completion validation (excludes Sundays)
- Missed day detection (expected days vs completed days)

---

### 6. Discord Integration

**Description:**
Seamless sharing to Discord community with formatted text and one-click copy.

**Functionality:**
- Generates formatted share text with emojis
- Includes: day number, time held, target, username, streak, status
- Copy to clipboard with one click
- Direct link to Discord channel
- Status indicators based on performance and streak

**Share Text Format:**
```
🏋️ Day 5 Complete! ✅
⏱️ Time: 00:54
🎯 Target: 00:54
👤 YourUsername
🔥 Streak: 5 days
✨ Still in the running!
```

**User Flow:**
1. User completes plank session
2. Completion screen shows Discord share component
3. Preview of formatted text displayed
4. User taps "Save & Copy Results" (first time) or "Copy Results" (subsequent)
5. Text copied to clipboard
6. Success message: "✓ Copied! Paste in Discord"
7. User taps "Open Discord to Share" link
8. Opens Discord in new tab
9. User pastes copied text in channel

**Acceptance Criteria:**
- Given user completes plank, When share component renders, Then preview shows formatted text
- Given user taps copy button, When clipboard writes, Then success message shows
- Given user has 7+ day streak, When share text generates, Then fire emoji (🔥) is used
- Given user is still in running, When share text generates, Then "✨ Still in the running!" is included
- Given user missed a day, When share text generates, Then warning message shows missed day
- Given user taps Discord link, When link opens, Then new tab opens to Discord channel
- Given user saves for first time, When button is pressed, Then both save and copy occur

**Technical Requirements:**
- Clipboard API (navigator.clipboard.writeText)
- Fallback for older browsers (document.execCommand)
- Discord URL from environment variable or default
- Emoji encoding support

---

### 7. Username System

**Description:**
Simple username prompt and persistence for personalized sharing and progress tracking.

**Functionality:**
- Username prompt appears after first completion
- Stored in localStorage
- Used in Discord share text
- Displayed on progress page
- 3-20 character validation
- Allowed characters: letters, numbers, dashes, underscores

**User Flow:**
1. User completes first plank session
2. Modal appears: "Choose Your Username"
3. Input field with validation
4. User enters username (e.g., "FitWarrior23")
5. Taps "Save Username"
6. Modal closes, completion screen shown
7. Username appears in share text immediately
8. Username persists for all future sessions

**Acceptance Criteria:**
- Given user completes first plank, When completion finishes, Then username prompt modal appears
- Given user enters username "ab", When validation runs, Then error shows "3-20 characters required"
- Given user enters "Valid_User-123", When validation runs, Then username is accepted
- Given user enters "Invalid User!", When validation runs, Then error shows "Letters, numbers, dashes, underscores only"
- Given username is saved, When user completes another plank, Then username modal does not appear
- Given username is saved, When share text generates, Then saved username is used
- Given user has no username, When share text generates, Then "Anonymous" is used

**Technical Requirements:**
- localStorage for persistence
- Regex validation: `/^[a-zA-Z0-9_-]{3,20}$/`
- Modal overlay with form
- Input field with real-time validation

---

### 8. Camera Controls

**Description:**
Toggle between front-facing and back-facing camera before recording.

**Functionality:**
- Toggle switch on start screen
- Front camera (user/selfie mode)
- Back camera (environment mode)
- Selection persists during session
- Visual indicator of selected camera

**User Flow:**
1. User on idle screen
2. Sees camera toggle switch
3. Default: Back camera
4. User taps switch to toggle to Front camera
5. Label updates: "Front Camera"
6. User starts recording
7. Selected camera is used

**Acceptance Criteria:**
- Given user is on idle screen, When camera switch is shown, Then default is back camera
- Given user toggles switch, When selection changes, Then label updates immediately
- Given user selects front camera, When recording starts, Then front camera is used
- Given user selects back camera, When recording starts, Then back camera is used
- Given user has selected a camera, When they Record Another, Then same camera is used

**Technical Requirements:**
- MediaDevices API with facingMode constraint
- Toggle switch component with state management
- Camera stream initialization with selected mode

---

### 9. Rest Day Display

**Description:**
Sunday rest day screen with motivational message and next challenge preview.

**Functionality:**
- Automatically displayed on Sundays
- Shows rest day message
- Previews next day's challenge (Monday)
- Links to progress page
- Links to Discord community

**User Flow:**
1. User opens app on Sunday
2. Sees rest day message: "Today is a Rest Day"
3. Message: "You've earned it! Take a break and recover."
4. Next challenge preview: "Next Challenge: Monday, Day X - XX:XX"
5. Options: View My Progress, Join Discord Community

**Acceptance Criteria:**
- Given today is Sunday, When user opens app, Then rest day screen is shown instead of timer
- Given rest day screen is shown, When next challenge is displayed, Then it shows Monday's date
- Given rest day screen is shown, When user taps "View My Progress", Then progress page opens
- Given rest day screen is shown, When user taps Discord link, Then Discord opens in new tab

**Technical Requirements:**
- Date detection (isSunday check)
- Next training day calculation
- Conditional rendering based on day of week

---

## User Stories

### Epic: Complete Daily Plank Challenge

**US-001: View Daily Target**
**As a** challenge participant
**I want to** see my target duration for today
**So that** I know how long to hold my plank

**Acceptance Criteria:**
- Target duration displayed in large, readable format (MM:SS)
- Day number shown (e.g., "Day 5")
- Target calculated based on current date and start date
- Sunday shows rest day message instead

---

**US-002: Record Plank with Timer**
**As a** challenge participant
**I want to** record myself doing a plank with a visible timer
**So that** I have proof of completion

**Acceptance Criteria:**
- Camera permission requested and granted
- 10-second countdown before recording (manual mode)
- Timer overlay visible in camera feed
- Timer burns into recorded video
- Recording stops at target duration or when manually stopped
- Video automatically downloads

---

**US-003: Use Auto-Detection Mode**
**As a** user concerned about form
**I want to** use AI to detect my plank position
**So that** the timer starts and stops based on proper form

**Acceptance Criteria:**
- Toggle for auto-detection mode on start screen
- Pose detection model loads when enabled
- Skeleton overlay shows in real-time (green/red)
- Recording starts automatically when proper plank detected
- Recording stops when plank position lost (after grace period)
- Form feedback messages displayed

---

**US-004: Share Results to Discord**
**As a** community member
**I want to** easily share my completion to Discord
**So that** I can stay accountable and motivate others

**Acceptance Criteria:**
- Formatted text with emojis generated after completion
- One-click copy to clipboard
- Direct link to Discord channel
- Includes day, time, target, username, streak, status

---

**US-005: Track My Progress**
**As a** challenge participant
**I want to** view my 30-day progress and statistics
**So that** I can see my consistency and achievements

**Acceptance Criteria:**
- 30-day grid shows completed (green), missed (red), upcoming (gray) days
- Statistics cards show: days completed, current streak, longest streak, total time
- "Still in Running" status banner displayed
- Recent completions list (last 10) shown
- Link to progress page from main screen

---

**US-006: Know If I'm Still in the Running**
**As a** competitive participant
**I want to** see if I've missed any days
**So that** I know if I'm still eligible for completion

**Acceptance Criteria:**
- "Still in Running" status calculated based on completions
- Missed days identified and displayed
- Status banner shows on progress page (green = still in, yellow = missed)
- Share text includes status

---

**US-007: Choose Camera Mode**
**As a** user recording in different positions
**I want to** select front or back camera
**So that** I can position my device conveniently

**Acceptance Criteria:**
- Toggle switch on start screen
- Front camera and back camera options
- Selection persists during session
- Visual indicator of selected camera

---

**US-008: Rest on Sundays**
**As a** challenge participant following the schedule
**I want to** see a rest day message on Sundays
**So that** I know recovery is part of the program

**Acceptance Criteria:**
- Sunday automatically shows rest day screen
- Next challenge preview displayed
- Links to progress and Discord available

---

**US-009: Set My Username**
**As a** user sharing results
**I want to** choose a username
**So that** my completions are personalized

**Acceptance Criteria:**
- Username prompt after first completion
- 3-20 character validation
- Only letters, numbers, dashes, underscores allowed
- Stored locally and used in all shares
- Defaults to "Anonymous" if not set

---

**US-010: Stop Recording Early**
**As a** user who needs to exit
**I want to** stop recording before target duration
**So that** I can still save my attempt

**Acceptance Criteria:**
- Stop button visible during countdown and recording
- Pressing Stop immediately halts recording
- Preview screen shows actual duration recorded
- Download options available for partial completion

---

## Technical Requirements

### Platform Requirements

**Client-Side:**
- Modern web browser with ES6+ JavaScript support
- MediaRecorder API support
- getUserMedia API support
- Canvas API support
- LocalStorage API support
- WebAssembly support (for MediaPipe)

**Framework & Libraries:**
- Next.js 16+ (React 19+)
- TypeScript 5.9+
- Tailwind CSS 4.1+
- MediaPipe Pose Landmarker v0.10.22
- date-fns 4.1+

**Build System:**
- Node.js 18+
- npm or yarn package manager

---

### Browser Compatibility

**Supported Browsers:**
| Browser | Version | Notes |
|---------|---------|-------|
| Chrome | 90+ | Full support, recommended |
| Safari | 14+ | iOS and macOS, WebM may fall back to MP4 |
| Edge | 90+ | Full support |
| Firefox | 90+ | Full support |
| Mobile Safari | iOS 14+ | Primary mobile target |
| Chrome Android | 90+ | Full support |

**Required APIs:**
- MediaRecorder API (video recording)
- Canvas API (overlay compositing)
- getUserMedia (camera access)
- LocalStorage (data persistence)
- Clipboard API (copy to clipboard)
- WebAssembly (MediaPipe execution)

**Known Limitations:**
- MediaPipe performance varies on older mobile devices
- iOS Safari requires user gesture for camera access
- Some browsers may use different video codecs (WebM vs MP4)

---

### Performance Requirements

**Video Recording:**
- Target frame rate: 30 FPS
- Resolution: 1280×720 (HD ready, 16:9 aspect ratio)
- Canvas rendering: <33ms per frame (30 FPS target)
- Video encoding: Real-time (no dropped frames)

**Pose Detection:**
- Inference rate: ~10 FPS (100ms per frame)
- Model load time: <3 seconds on average connection
- Landmark detection: <100ms per frame
- CPU usage: <50% on mid-range mobile devices

**Storage:**
- LocalStorage limit: <5MB typical usage
- Video file size: ~1-5MB per 1-minute recording (depends on codec)
- Immediate write to localStorage (no lag)

**Page Load:**
- First contentful paint: <1.5 seconds
- Time to interactive: <3 seconds
- MediaPipe model lazy-loaded (on hover or checkbox interaction)

---

### Security & Privacy

**Data Storage:**
- All data stored locally in browser (localStorage)
- No data transmitted to backend servers
- No user accounts or authentication required
- Videos stored locally on device only

**Camera Access:**
- Browser permission required for camera
- HTTPS required for camera access (or localhost in development)
- Camera stream not transmitted or stored by app (only recorded video)
- User can deny camera permission

**Discord Integration:**
- No direct Discord API integration
- User manually copies and pastes text
- No Discord tokens or credentials stored

---

## Future Roadmap

### Phase 2: Backend & Community Features

**Global Leaderboard (Backend Required):**
- User registration and authentication
- Backend API for storing completions
- Public leaderboard with rankings
- Filter by: all-time, monthly, weekly
- Privacy controls (public/private profile)

**Social Features:**
- Follow other users
- Comment on completions
- Like/react to achievements
- User profiles with stats and videos
- Badges and achievements

**Video Upload & Gallery:**
- Cloud storage for recorded videos
- Public video gallery
- Video thumbnails with day number
- Playback in-app
- Share video links directly

**Enhanced Discord Integration:**
- Direct Discord webhook posting (optional)
- Bot integration for automatic posting
- Discord role rewards for streaks
- Challenge leaderboard in Discord

---

### Phase 3: Advanced Features

**Custom Challenges:**
- User-created challenges (duration, progression)
- Group challenges with friends
- Coach-created programs
- Different exercise types (not just planks)

**Form Analysis:**
- Detailed form scoring (beyond plank detection)
- Form tips and corrections
- Comparison to ideal plank form
- Progress on form quality over time

**Workout Variations:**
- Side plank tracking
- Plank with leg lifts
- Multiple exercises per day
- Circuit training support

**Analytics & Insights:**
- Detailed progress charts (time series)
- Strength progression over time
- Best time of day for workouts
- Predictive goal achievement

**Progressive Web App (PWA):**
- Install as native app on mobile
- Offline support
- Push notifications for daily reminders
- Background sync for completions

**Multi-Platform:**
- Native iOS app (Swift/SwiftUI)
- Native Android app (Kotlin)
- Apple Watch companion app
- Web app remains available

---

### Phase 4: Monetization & Growth

**Premium Features:**
- Advanced analytics and insights
- Unlimited video storage
- Custom branding for coaches
- Ad-free experience
- Early access to new features

**Coach/Trainer Tools:**
- Create challenges for clients
- Monitor client progress
- Messaging and feedback
- Custom exercise libraries

**Partnerships:**
- Fitness influencer collaborations
- Gym/studio integrations
- Corporate wellness programs
- Fitness equipment brand partnerships

---

## Success Metrics

### Key Performance Indicators (KPIs)

**User Engagement:**
| Metric | Target | Measurement |
|--------|--------|-------------|
| Daily Active Users (DAU) | 500+ by Day 30 | Unique visitors per day |
| Completion Rate | 70%+ of users complete daily challenge | Completions / Expected completions |
| Return Rate | 80%+ users return next day | Day N+1 visitors / Day N visitors |
| 30-Day Completion Rate | 30%+ complete full challenge | Users with 30 days / Total users |
| Average Streak Length | 10+ days | Mean of all user streaks |

**Feature Adoption:**
| Metric | Target | Measurement |
|--------|--------|-------------|
| Auto-Detection Usage | 40%+ of sessions | Sessions with detection / Total sessions |
| Discord Share Rate | 60%+ share completions | Shares / Completions |
| Progress Page Views | 50%+ check progress | Progress views / Total users |
| Video Download Rate | 90%+ download videos | Downloads / Completions |

**Community Growth:**
| Metric | Target | Measurement |
|--------|--------|-------------|
| Discord Shares | 200+ posts by Day 30 | Count of Discord posts |
| New Discord Members | 100+ join from app | New members with app referral |
| Viral Coefficient | 0.3+ (30% refer someone) | New users from referrals / Total users |

**Technical Performance:**
| Metric | Target | Measurement |
|--------|--------|-------------|
| Page Load Time | <3 seconds | Time to interactive |
| Video Recording Success | 95%+ no errors | Successful recordings / Attempts |
| Camera Access Grant Rate | 90%+ grant permission | Granted / Requested |
| Pose Detection Accuracy | 85%+ correctly identify plank | Manual review sample |

**User Satisfaction:**
| Metric | Target | Measurement |
|--------|--------|-------------|
| Net Promoter Score (NPS) | 50+ | Survey: "Recommend to friend?" |
| App Rating | 4.5+ / 5 | User ratings (if app store) |
| Feature Satisfaction | 80%+ satisfied | Survey: "Features meet needs?" |
| Support Request Rate | <5% | Support requests / Total users |

---

### Success Criteria by Timeline

**Week 1 (Days 1-7):**
- 100+ users start challenge
- 70%+ complete Day 1
- 50%+ return for Day 2
- 40%+ still active by Day 7

**Week 2 (Days 8-14):**
- 200+ cumulative users
- 30%+ of Day 1 users still active
- 50+ Discord shares per day
- <5% error rate on recordings

**Week 3 (Days 15-21):**
- 300+ cumulative users
- 25%+ of Day 1 users still active
- 20%+ trying auto-detection mode
- 4.0+ average satisfaction rating

**Week 4 (Days 22-30):**
- 500+ cumulative users
- 30+ users complete full 30 days
- 500+ total Discord shares
- Feature requests for Phase 2 collected

---

### Data Collection & Analysis

**Analytics Implementation:**
- Google Analytics 4 (or similar) for page views and user flows
- Custom events for key actions (start recording, complete, share)
- localStorage analysis for completion patterns
- Error logging for technical issues

**User Feedback:**
- In-app feedback form (optional, non-intrusive)
- Discord channel for community feedback
- Post-challenge survey (Day 30+)
- Net Promoter Score (NPS) survey

**A/B Testing Opportunities:**
- Countdown duration (10s vs 5s vs 3s)
- Auto-detection default (on vs off)
- Share button placement and copy
- Progress page layout and visualizations
- Rest day messaging and motivation

---

## Appendix

### A. Discord Integration Details

**Channel Information:**
- Server ID: 1210290974601773056
- Channel ID: 1438326766279196782
- Full URL: https://discord.com/channels/1210290974601773056/1438326766279196782

**Share Text Format:**
```
🏋️ Day {day} Complete! {statusEmoji}
⏱️ Time: {MM:SS}
🎯 Target: {MM:SS}
👤 {username}
{streakEmoji} Streak: {currentStreak} days
{statusMessage}
```

**Emoji Key:**
- 🏋️ - Workout complete
- ✅ - Success (met or exceeded target)
- ❌ - Incomplete (did not meet target)
- ⏱️ - Time held
- 🎯 - Target duration
- 👤 - Username
- 📊 - Streak (under 7 days)
- 🔥 - Fire streak (7+ days)
- ✨ - Still in running
- ⚠️ - Missed days / eliminated

**Community Guidelines:**
- Users share completions daily
- Supportive community culture
- Encouragement and accountability
- No shaming for missed days
- Celebration of milestones

---

### B. Challenge Rules

**Official 30-Day Plank Challenge Rules:**

1. **Start Date:** November 17, 2025
2. **Duration:** 30 training days (excluding Sundays)
3. **Progression:** Start at 30 seconds, increase by 6 seconds per training day
4. **Rest Days:** Every Sunday is a rest day (no workout required)
5. **Recording:** Video proof required for each completion
6. **Timing:** Must meet or exceed target duration
7. **Form:** Proper plank form required (forearm or high plank)
8. **Completion:** "Still in Running" status requires zero missed days
9. **Sharing:** Encouraged to share to Discord for accountability

**Plank Form Guidelines:**
- Forearm plank or high plank position
- Body in straight line (shoulders to ankles)
- Core engaged, no sagging hips
- Neutral neck position
- Breathing maintained throughout
- Side-view recommended for video

**Disqualifications (for "Still in Running" status):**
- Missing any training day (non-Sunday)
- Not meeting target duration
- Improper form (if using auto-detection)

**Note:** Users can continue after missed days, but "Still in Running" status becomes false.

---

### C. Technical Architecture

**Frontend Stack:**
- Next.js 16 (App Router)
- React 19 with Server Components
- TypeScript 5.9
- Tailwind CSS 4.1

**Key Libraries:**
- @mediapipe/tasks-vision - Pose detection
- date-fns - Date calculations
- React hooks - State management

**Hosting:**
- Vercel (recommended)
- Static site generation (SSG) where possible
- Client-side rendering (CSR) for interactive components

**File Structure:**
```
/app
  /page.tsx - Main challenge page
  /progress/page.tsx - Progress tracking page
  /layout.tsx - Root layout
/components
  /PlankTimer.tsx - Main timer component
  /VideoRecorder.tsx - Video recording logic
  /LocalLeaderboard.tsx - Progress visualization
  /ShareToDiscord.tsx - Discord share component
  /UsernamePrompt.tsx - Username modal
  /RestDay.tsx - Sunday rest day display
/utils
  /timerLogic.ts - Date and duration calculations
  /localLeaderboard.ts - Progress tracking logic
  /videoRecorder.ts - MediaRecorder wrapper
/lib
  /mediapipeLoader.ts - Pose detection model loader
  /poseDetection.ts - Plank detection algorithm
/hooks
  /usePoseDetection.ts - Pose detection React hook
```

---

### D. Browser Permissions

**Required Permissions:**

**Camera Access:**
- Requested on "Start Recording" button press
- Used for: Video recording and pose detection
- Prompt: "Allow [site] to use your camera?"
- Required for core functionality

**Optional Permissions:**

**Clipboard (Automatic):**
- Used for: "Copy Results" functionality
- Prompt: May appear on first copy (browser-dependent)
- Fallback: Manual text selection if denied

**File Download:**
- Used for: Video and screenshot downloads
- Prompt: Browser download notification
- Required for saving recordings

---

### E. Version History

**Version 1.0.0 - November 2025**
- Initial release
- 30-day progressive challenge
- Manual and auto-detection recording modes
- Local progress tracking
- Discord share integration
- Username system
- Front/back camera selection

**Planned Updates:**
- v1.1.0 - Bug fixes and performance improvements
- v1.2.0 - Enhanced pose detection accuracy
- v2.0.0 - Backend integration and global leaderboard (Phase 2)

---

**Document Date:** November 19, 2025

**Document Owner:** Jordan Tian

**Contributors:** Product, Engineering, Design teams

**Review Cycle:** Quarterly or upon major feature release

**Contact:** See GitHub repository issues for questions and feedback

---

**Repository:** https://github.com/JordanTheJet/plank-challenge.git

**Live App:** [URL to be determined upon deployment]

**Discord Community:** https://discord.com/channels/1210290974601773056/1438326766279196782
