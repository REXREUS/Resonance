# 📖 Resonance User Guide

Complete guide to using all features of Resonance.

## 📱 Navigation

Resonance uses a bottom tab navigation with 5 sections:

| Tab | Icon | Description |
|-----|------|-------------|
| Dashboard | 🏠 | Home screen with stats and quick actions |
| History | 📜 | View past training sessions |
| **FAB** | 🎤 | Start new training (yellow button) |
| Voice Lab | 🎙️ | Manage voice clones and TTS |
| Settings | ⚙️ | App configuration |

---

## 🏠 Dashboard

The Dashboard shows your training overview:

### Stats Grid
- **Flight Hours**: Total training time
- **Average Score**: Your overall performance
- **Streak**: Consecutive training days
- **Quota Usage**: API usage tracking

### Achievement Progress
Track your gamification progress and unlock achievements.

### Daily Budget
Monitor your API spending with visual indicators:
- 🟢 **Normal** (0-70%)
- 🟡 **High** (70-90%)
- 🔴 **Critical** (90%+)

---

## 🎯 Training Sessions

### Starting a Session

1. Tap the **yellow microphone FAB** button
2. Configure your session:

#### Scenario Selection
Choose from 25+ scenarios across categories:

| Category | Examples |
|----------|----------|
| **Sales & Negotiation** | Crisis Negotiation, Price Negotiation, Closing Deal |
| **Customer Service** | Customer Complaint, Refund Request, Technical Support |
| **Management & HR** | Performance Review, Salary Negotiation, Conflict Resolution |
| **Presentations** | Investor Pitch, Board Meeting, Q&A Session |
| **Other** | Job Interview, Media Interview, Cold Calling |

#### Language
- 🇮🇩 Indonesian
- 🇬🇧 English

#### Training Mode

**Standard Training**
- Single conversation practice
- Focus on specific scenarios
- Detailed feedback

**Stress Mode**
- Multiple callers in queue
- Time pressure simulation
- Stamina management
- Difficulty curve progression

### Context Files

Upload documents for scenario-specific training:
- **Manual Input**: Type context directly
- **File Upload**: PDF, DOCX, DOC, TXT (max 10MB)

The AI will use this context to create realistic scenarios.

---

## 🔥 Chaos Engine

Simulate real-world disruptions to build resilience:

### Random Voice Gen
- Varies AI voice pitch and speed
- Simulates different caller personalities
- Builds adaptability

### Background Noise
Choose from:
- 🏢 Office sounds
- 🌧️ Rain
- 🚗 Traffic
- ☕ Cafe ambiance

### Hardware Failure
Simulates:
- Microphone muting
- Connection drops
- Audio glitches

---

## 🎙️ Active Simulation

### Interface Elements

**Central Orb**
- Visualizes audio amplitude
- Pulses with your voice
- Changes color based on state

**HUD Metrics**
- Real-time WPM (Words Per Minute)
- Clarity percentage
- Confidence score
- Filler word count

**Controls**
- 🔇 Mute/Unmute
- 📞 End Call
- ⏸️ Pause (Stress Mode)

### Voice Interaction

**Speaking**
- Speak naturally into your device
- VAD automatically detects when you're talking
- Interrupt the AI anytime (barge-in)

**Listening**
- AI responds with natural voice
- Haptic feedback on successful interruption
- Real-time transcription (unless Blind Mode)

---

## 📊 Session Reports

After each session, you'll receive a comprehensive report:

### Overall Score
- Letter grade (A+ to F)
- Numerical score (0-100)
- Performance category

### Metrics Breakdown

| Metric | Description | Target |
|--------|-------------|--------|
| **Pace** | Words per minute | 120-150 WPM |
| **Clarity** | Speech clarity percentage | >80% |
| **Confidence** | Voice confidence level | >75% |
| **Filler Words** | "um", "uh", "like" count | <5 per minute |

### AI Coach Feedback
- ✅ Positive aspects
- 📈 Areas for improvement
- 🎯 Next steps

### Emotional Telemetry
Chart showing AI's emotional state throughout the conversation.

### Export Options
- 📄 Export as PDF
- 📊 Export as CSV
- 📤 Share report

---

## 🎙️ Voice Lab

### Voice Slots
- Maximum 5 cloned voices
- System voices always available

### Cloning a Voice
1. Tap **"Clone Voice"**
2. Upload audio sample (10-30 seconds recommended)
3. Name your voice
4. Adjust settings

### Voice Settings
- **Stability** (0-100%): Higher = more consistent
- **Similarity** (0-100%): Higher = closer to original

### TTS Playground
Test voices with custom text before using in training.

---

## ⚙️ Settings

### Appearance
- **Theme**: Dark / Light / System
- **Language**: Indonesian / English

### Audio & Feedback
- **VAD Sensitivity**:
  - Low: Noise Floor + 20dB (less sensitive)
  - Medium: Noise Floor + 12dB (balanced)
  - High: Noise Floor + 5dB (more sensitive)
- **Haptic Feedback**: Vibration on barge-in

### API & Security
- Configure ElevenLabs and Gemini API keys
- Set daily budget limits
- View current usage

### Data Management
- Export all data
- Clear session history
- Reset quota tracking

### System
- **Mock Mode**: Run without real API calls
- **Debug Logs**: Enable verbose logging

---

## 💡 Tips & Best Practices

### For Better Scores
1. **Speak clearly** and at a moderate pace
2. **Avoid filler words** - pause instead of saying "um"
3. **Practice interruption** - it's a skill!
4. **Use context files** for realistic scenarios
5. **Review reports** and focus on weak areas

### For Realistic Training
1. **Enable Chaos Engine** gradually
2. **Start with Standard Mode** before Stress Mode
3. **Use headphones** for better audio quality
4. **Train in a quiet environment** initially

### For Cost Management
1. **Set a daily budget** in Settings
2. **Use Mock Mode** for practice
3. **Monitor quota usage** on Dashboard
4. **Export reports** instead of re-running sessions

---

## 🔒 Privacy & Data

- All data stored locally on your device
- API keys encrypted with secure storage
- No cloud sync - your data stays private
- Export and delete data anytime

---

**Need more help?** Check the [FAQ](./FAQ.md) or [Troubleshooting](./TROUBLESHOOTING.md) guide.
