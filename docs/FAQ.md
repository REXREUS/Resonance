# ❓ Frequently Asked Questions

Common questions and answers about Resonance.

---

## 📱 General

### What is Resonance?
Resonance is an AI-powered communication training app that helps you practice high-stakes conversations through realistic voice simulations.

### Who is Resonance for?
- Sales professionals
- Customer service representatives
- Managers and team leaders
- Public speakers
- Anyone who wants to improve communication skills

### Is Resonance free?
The app itself is free. However, AI features require API keys from ElevenLabs and Google Gemini, which may have associated costs depending on usage.

### Does Resonance work offline?
Yes! Resonance is offline-first. All your data is stored locally. However, AI voice features require an internet connection.

---

## 🔑 API Keys

### Do I need API keys to use Resonance?
No, you can use **Mock Mode** without any API keys. Mock Mode simulates AI responses for testing and practice.

### How much do the APIs cost?
- **ElevenLabs**: Free tier offers 10,000 characters/month. Paid plans start at $5/month.
- **Google Gemini**: Free tier offers 60 requests/minute, which is sufficient for most users.

### Are my API keys safe?
Yes. API keys are stored using encrypted secure storage on your device. They are never sent to any server except the official API providers.

### Can I use my own API keys?
Yes, you must use your own API keys. Resonance does not provide shared keys.

---

## 🎙️ Training Sessions

### How long should a training session be?
Sessions typically last 2-10 minutes. Start with shorter sessions and gradually increase duration.

### What scenarios are available?
25+ scenarios across categories:
- Sales & Negotiation
- Customer Service
- Management & HR
- Presentations & Meetings
- And more!

### Can I create custom scenarios?
You can customize scenarios by uploading context files (PDF, DOCX) with specific information for your training needs.

### What is Stress Mode?
Stress Mode simulates handling multiple callers in a queue, with time pressure and increasing difficulty. It's designed to build resilience.

---

## 🔥 Chaos Engine

### What is the Chaos Engine?
The Chaos Engine simulates real-world disruptions during training:
- Random voice variations
- Background noise
- Hardware failures (mic mute, connection drops)

### Should I enable Chaos Engine?
Start without it, then gradually enable features as you improve. It makes training more realistic but also more challenging.

### Can I choose which disruptions to enable?
Yes, each Chaos Engine feature can be toggled individually.

---

## 🎙️ Voice & Audio

### Why can't the AI hear me?
Check these:
1. Microphone permission is granted
2. VAD sensitivity is appropriate for your environment
3. You're speaking loud enough
4. No other app is using the microphone

### What is VAD?
VAD (Voice Activity Detection) automatically detects when you're speaking. It enables natural conversation flow and interruption.

### What VAD sensitivity should I use?
- **Low**: Noisy environments
- **Medium**: Normal environments (recommended)
- **High**: Quiet environments

### Can I interrupt the AI?
Yes! This is called "barge-in." The AI will stop speaking when you start talking.

---

## 📊 Scores & Metrics

### How is my score calculated?
Your score is based on:
- **Pace**: Words per minute (target: 120-150 WPM)
- **Clarity**: Speech clarity percentage
- **Confidence**: Voice confidence level
- **Filler Words**: Count of "um," "uh," "like," etc.

### What's a good score?
- **A+ (90-100)**: Excellent
- **A (85-89)**: Very Good
- **B (75-84)**: Good
- **C (65-74)**: Average
- **D (50-64)**: Needs Improvement
- **F (<50)**: Poor

### How can I improve my score?
1. Speak at a moderate, consistent pace
2. Pause instead of using filler words
3. Practice regularly
4. Review AI feedback after each session
5. Focus on one metric at a time

---

## 🎙️ Voice Lab

### What is Voice Lab?
Voice Lab lets you manage AI voices, including cloning custom voices using ElevenLabs.

### How many voices can I clone?
Up to 5 custom voices (ElevenLabs limit for instant voice cloning).

### What audio quality is needed for cloning?
- 10-30 seconds of clear speech
- Minimal background noise
- Single speaker only
- WAV or MP3 format

### Can I delete cloned voices?
Yes, you can delete cloned voices anytime. System voices cannot be deleted.

---

## 💾 Data & Privacy

### Where is my data stored?
All data is stored locally on your device in an SQLite database. Nothing is uploaded to external servers (except API calls to ElevenLabs/Gemini).

### Can I export my data?
Yes, you can export session reports as PDF or CSV from the report screen.

### How do I delete my data?
Go to **Settings** → **Clear All Data** to delete all sessions, documents, and voice assets.

### Is my conversation recorded?
Conversations are processed in real-time but not permanently recorded unless you explicitly save them.

---

## 🐛 Troubleshooting

### The app crashes on startup
1. Clear app cache
2. Reinstall the app
3. Ensure you have enough storage space
4. Check for app updates

### AI responses are slow
1. Check your internet connection
2. Try a different network
3. API servers might be busy - try again later

### Voice quality is poor
1. Use headphones for better audio
2. Reduce background noise
3. Adjust voice stability/similarity settings
4. Try a different voice

### My progress isn't saving
1. Ensure storage permission is granted
2. Don't force-close the app during sessions
3. Check available storage space

---

## 📞 Support

### How do I report a bug?
Open an issue on [GitHub](https://github.com/YOUR_USERNAME/resonance-mobile-app/issues) with:
- Device model
- Android version
- Steps to reproduce
- Screenshots if applicable

### How do I request a feature?
Open a feature request on [GitHub](https://github.com/YOUR_USERNAME/resonance-mobile-app/issues) describing your idea.

### Is there a community?
Join discussions on the GitHub repository!

---

**Still have questions?** Check the [Troubleshooting Guide](./TROUBLESHOOTING.md) or open an issue on GitHub.
