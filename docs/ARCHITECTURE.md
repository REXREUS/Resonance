# 🏗️ Architecture Overview

Technical architecture documentation for Resonance.

## 📐 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        RESONANCE APP                            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Screens   │  │ Components  │  │   Hooks     │             │
│  │  (Expo      │  │  (UI/Audio/ │  │  (useVAD,   │             │
│  │   Router)   │  │   Charts)   │  │  useTheme)  │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                     │
│         └────────────────┼────────────────┘                     │
│                          ▼                                      │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                    STATE MANAGEMENT                        │ │
│  │                      (Zustand)                             │ │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │ │
│  │  │ Settings │  │ Session  │  │  Theme   │  │  Quota   │  │ │
│  │  │  Store   │  │  Store   │  │  Store   │  │  Store   │  │ │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │ │
│  └───────────────────────────────────────────────────────────┘ │
│                          │                                      │
│                          ▼                                      │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                      SERVICES                              │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │ │
│  │  │AudioEngine  │  │ VADService  │  │ChaosEngine  │       │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘       │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐       │ │
│  │  │ElevenLabs   │  │GeminiService│  │SessionMgr   │       │ │
│  │  │  Service    │  │             │  │             │       │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘       │ │
│  └───────────────────────────────────────────────────────────┘ │
│                          │                                      │
│                          ▼                                      │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                    DATA LAYER                              │ │
│  │  ┌─────────────────┐      ┌─────────────────┐            │ │
│  │  │   SQLite DB     │      │  Secure Store   │            │ │
│  │  │  (resonansi.db) │      │  (API Keys)     │            │ │
│  │  └─────────────────┘      └─────────────────┘            │ │
│  └───────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    EXTERNAL SERVICES                            │
│  ┌─────────────────┐              ┌─────────────────┐          │
│  │   ElevenLabs    │              │  Google Gemini  │          │
│  │   WebSocket     │              │    REST API     │          │
│  │   (TTS)         │              │    (AI Chat)    │          │
│  └─────────────────┘              └─────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 📁 Directory Structure

```
resonance-mobile-app/
├── app/                          # Expo Router (File-based routing)
│   ├── (tabs)/                   # Tab navigation group
│   │   ├── _layout.jsx          # Tab bar configuration
│   │   ├── index.jsx            # Dashboard (Home)
│   │   ├── history.jsx          # Session history
│   │   ├── stats.jsx            # Voice Lab
│   │   └── settings.jsx         # Settings
│   ├── _layout.jsx              # Root layout
│   ├── index.jsx                # Entry redirect
│   ├── splash.jsx               # Splash screen + VAD calibration
│   ├── onboarding.jsx           # Onboarding carousel
│   ├── session-setup.jsx        # Training configuration
│   ├── simulation.jsx           # Active simulation
│   ├── stress-mode.jsx          # Stress test mode
│   ├── report.jsx               # Session report
│   └── voice-lab.jsx            # Voice management
│
├── components/                   # Reusable components
│   ├── ui/                      # Base UI components
│   │   ├── Button.jsx
│   │   ├── Card.jsx
│   │   ├── Dropdown.jsx
│   │   ├── Header.jsx
│   │   ├── Slider.jsx
│   │   ├── Toggle.jsx
│   │   └── ...
│   ├── audio/                   # Audio components
│   │   ├── VoiceVisualizer.jsx
│   │   └── VADIndicator.jsx
│   ├── charts/                  # Data visualization
│   │   ├── TrendChart.jsx
│   │   └── EmotionChart.jsx
│   └── session/                 # Session components
│       ├── MetricsHUD.jsx
│       └── TranscriptView.jsx
│
├── services/                     # Business logic
│   ├── audioEngine.js           # Audio I/O management
│   ├── vadService.js            # Voice Activity Detection
│   ├── elevenLabsService.js     # ElevenLabs WebSocket
│   ├── geminiService.js         # Gemini AI integration
│   ├── chaosEngine.js           # Disruption simulation
│   ├── sessionManager.js        # Session orchestration
│   └── databaseService.js       # SQLite operations
│
├── hooks/                        # Custom React hooks
│   ├── useTheme.js              # Theme management
│   ├── useTranslation.js        # i18n translations
│   ├── useVAD.js                # VAD hook
│   └── useAudioEngine.js        # Audio hook
│
├── stores/                       # Zustand stores
│   ├── settingsStore.js         # App settings
│   ├── sessionStore.js          # Session state
│   └── quotaStore.js            # API quota tracking
│
├── constants/                    # Configuration
│   ├── theme.js                 # Colors, spacing, typography
│   ├── audio.js                 # Audio settings
│   ├── languages.js             # Translations (id/en)
│   └── database.js              # DB schema
│
├── utils/                        # Utilities
│   ├── scoreCalculator.js       # Scoring algorithm
│   ├── fillerWordDetector.js    # Filler word detection
│   ├── documentProcessor.js     # PDF/DOCX extraction
│   └── exportGenerator.js       # Report export
│
└── assets/                       # Static assets
    ├── icon/                    # App icons
    └── animations/              # Lottie animations
```

---

## 🔄 Data Flow

### Training Session Flow

```
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│  Setup   │───▶│Simulation│───▶│ Report   │───▶│ History  │
│  Screen  │    │  Screen  │    │  Screen  │    │  Screen  │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
     │               │               │               │
     ▼               ▼               ▼               ▼
┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
│ Session  │    │  Audio   │    │  Score   │    │ Database │
│  Config  │    │ Engine   │    │Calculator│    │  Query   │
└──────────┘    └──────────┘    └──────────┘    └──────────┘
```

### Audio Processing Pipeline

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Microphone  │────▶│ VAD Service │────▶│   Gemini    │
│   Input     │     │ (Detection) │     │   (AI)      │
└─────────────┘     └─────────────┘     └─────────────┘
                                              │
                                              ▼
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Speaker   │◀────│ Audio Engine│◀────│ ElevenLabs  │
│   Output    │     │  (Playback) │     │   (TTS)     │
└─────────────┘     └─────────────┘     └─────────────┘
```

---

## 🗄️ Database Schema

### SQLite Database: `resonansi.db`

```sql
-- App Settings
CREATE TABLE app_settings (
  id INTEGER PRIMARY KEY,
  key TEXT UNIQUE,
  value TEXT,
  updated_at INTEGER
);

-- Training Sessions
CREATE TABLE sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp INTEGER,
  scenario TEXT,
  mode TEXT,
  duration INTEGER,
  overall_score REAL,
  pace_score REAL,
  clarity_score REAL,
  confidence_score REAL,
  filler_count INTEGER,
  completed INTEGER DEFAULT 0
);

-- Chat Logs
CREATE TABLE chat_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER,
  role TEXT,
  content TEXT,
  timestamp INTEGER,
  audio_path TEXT,
  hesitation_markers TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

-- Context Files
CREATE TABLE context_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  file_name TEXT,
  file_size INTEGER,
  extracted_text_content TEXT,
  created_at INTEGER
);

-- Voice Assets
CREATE TABLE voice_assets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  voice_id TEXT,
  name TEXT,
  type TEXT,
  stability REAL DEFAULT 0.5,
  similarity REAL DEFAULT 0.75,
  is_default INTEGER DEFAULT 0,
  created_at INTEGER
);

-- Emotional Telemetry
CREATE TABLE emotional_telemetry (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER,
  timestamp INTEGER,
  emotion TEXT,
  intensity REAL,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);
```

---

## 🎯 Key Services

### AudioEngine
Manages audio input/output with real-time streaming.

```javascript
// Key methods
audioEngine.startRecording()
audioEngine.stopRecording()
audioEngine.playAudio(audioData)
audioEngine.getAmplitude()
```

### VADService
Voice Activity Detection using Signal Energy (RMS).

```javascript
// Configuration
const VAD_THRESHOLDS = {
  low: noiseFloor + 20,    // dB
  medium: noiseFloor + 12, // dB
  high: noiseFloor + 5,    // dB
};

// Key methods
vadService.calibrate()      // 2-second noise floor sampling
vadService.isVoiceActive()  // Returns boolean
vadService.getEnergy()      // Returns current RMS energy
```

### ChaosEngine
Simulates real-world disruptions.

```javascript
// Effects
chaosEngine.applyRandomVoice()    // Pitch/speed variation
chaosEngine.applyBackgroundNoise() // Ambient sounds
chaosEngine.simulateFailure()      // Hardware glitches
```

### GeminiService
AI conversation logic with context injection.

```javascript
// Key methods
geminiService.initializeSession(scenario, context)
geminiService.sendMessage(userMessage)
geminiService.generateFeedback(sessionData)
```

### ElevenLabsService
WebSocket-based TTS streaming.

```javascript
// Key methods
elevenLabsService.connect(voiceId)
elevenLabsService.synthesize(text)
elevenLabsService.streamAudio(text, onChunk)
```

---

## 🔐 Security Architecture

```
┌─────────────────────────────────────────┐
│           SECURE STORAGE                │
│  ┌─────────────────────────────────┐   │
│  │     expo-secure-store           │   │
│  │  ┌───────────┐ ┌───────────┐   │   │
│  │  │ElevenLabs │ │  Gemini   │   │   │
│  │  │  API Key  │ │  API Key  │   │   │
│  │  └───────────┘ └───────────┘   │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
              │
              ▼ (encrypted retrieval)
┌─────────────────────────────────────────┐
│           API SERVICES                  │
│  - Keys never logged                    │
│  - Direct HTTPS/WSS connections         │
│  - No intermediate servers              │
└─────────────────────────────────────────┘
```

---

## 📊 Performance Targets

| Metric | Target | Implementation |
|--------|--------|----------------|
| Audio Latency | < 800ms | WebSocket streaming |
| VAD Response | < 150ms | Signal Energy RMS |
| App Launch | < 3s | Lazy loading |
| Memory Usage | < 200MB | Optimized assets |
| Database Query | < 50ms | Indexed SQLite |

---

## 🧪 Testing Strategy

```
┌─────────────────────────────────────────┐
│              TEST PYRAMID               │
│                                         │
│              ┌───────┐                  │
│              │  E2E  │                  │
│              └───────┘                  │
│           ┌─────────────┐               │
│           │ Integration │               │
│           └─────────────┘               │
│        ┌─────────────────────┐          │
│        │    Unit Tests       │          │
│        │  (Property-Based)   │          │
│        └─────────────────────┘          │
└─────────────────────────────────────────┘
```

- **Unit Tests**: Jest + fast-check (100+ iterations)
- **Integration Tests**: Service interactions
- **E2E Tests**: Complete user flows
