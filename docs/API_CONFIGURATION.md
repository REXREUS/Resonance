# 🔑 API Configuration Guide

This guide explains how to obtain and configure API keys for Resonance.

## 📋 Overview

Resonance uses two AI services:

| Service | Purpose | Required |
|---------|---------|----------|
| **ElevenLabs** | Voice synthesis (TTS) | Optional* |
| **Google Gemini** | AI conversation logic | Optional* |

> *The app works in **Mock Mode** without API keys, but AI features will be simulated.

---

## 🎙️ ElevenLabs API Key

ElevenLabs provides ultra-realistic voice synthesis for AI responses.

### Getting Your Key

1. Go to [elevenlabs.io](https://elevenlabs.io/)
2. Click **"Sign Up"** (or log in)
3. Navigate to your **Profile** → **API Keys**
4. Click **"Create API Key"**
5. Copy the generated key

### Pricing

| Plan | Price | Characters/Month | Best For |
|------|-------|------------------|----------|
| Free | $0 | 10,000 | Testing |
| Starter | $5/mo | 30,000 | Light use |
| Creator | $22/mo | 100,000 | Regular training |
| Pro | $99/mo | 500,000 | Heavy use |

> 💡 **Tip**: Start with the Free plan to test, then upgrade as needed.

### Voice Cloning

With ElevenLabs, you can:
- Use pre-made system voices (free)
- Clone up to 5 custom voices (paid plans)
- Adjust stability and similarity settings

---

## 🤖 Google Gemini API Key

Gemini powers the AI conversation logic and coaching feedback.

### Getting Your Key

1. Go to [makersuite.google.com/app/apikey](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click **"Create API Key"**
4. Select or create a Google Cloud project
5. Copy the generated key

### Pricing

| Tier | Price | Requests/Minute | Best For |
|------|-------|-----------------|----------|
| Free | $0 | 60 | Testing & light use |
| Pay-as-you-go | ~$0.001/1K chars | Unlimited | Production |

> 💡 **Tip**: The free tier is generous enough for most personal use.

---

## ⚙️ Configuring in Resonance

### Step-by-Step

1. Open Resonance app
2. Go to **Settings** (gear icon in bottom tab)
3. Tap **"API Configuration"** or **"API Keys"**
4. Enter your keys:
   - Paste **ElevenLabs API Key**
   - Paste **Gemini API Key**
5. Tap **"Validate Keys"** to test
6. Tap **"Save Keys"**

### Validation Status

| Status | Meaning |
|--------|---------|
| ✅ Valid | Key is working correctly |
| ❌ Invalid | Key is incorrect or expired |
| ⏳ Validating | Testing connection |

---

## 💰 Budget Management

Protect yourself from unexpected charges:

### Setting Daily Budget

1. Go to **Settings** → **Daily Budget**
2. Enter your limit (e.g., $5.00)
3. Tap **Save**

### Usage Indicators

| Color | Usage Level | Action |
|-------|-------------|--------|
| 🟢 Green | 0-70% | Normal usage |
| 🟡 Yellow | 70-90% | Consider slowing down |
| 🔴 Red | 90%+ | Near limit, be cautious |

### Monitoring Usage

- View current usage on **Dashboard** → **Daily Budget** card
- Check detailed breakdown in **Settings** → **API Configuration**
- Reset quota tracking in **Settings** → **Reset Quota**

---

## 🔒 Security

Your API keys are protected:

- ✅ Stored using **expo-secure-store** (encrypted)
- ✅ Never sent to any server except the API providers
- ✅ Never logged or tracked
- ✅ Can be deleted anytime

### Best Practices

1. **Never share** your API keys
2. **Set budget limits** to prevent overuse
3. **Rotate keys** periodically
4. **Use separate keys** for development/production

---

## 🧪 Mock Mode

Don't want to use real APIs? Enable Mock Mode:

1. Go to **Settings**
2. Enable **"Mock Mode"**
3. AI responses will be simulated

Mock Mode is perfect for:
- Testing the app
- Practicing without costs
- Offline usage
- Demonstrations

---

## ❓ Troubleshooting

### "Invalid API Key"

- Double-check you copied the entire key
- Ensure no extra spaces before/after
- Verify the key hasn't expired
- Check if you have billing enabled (for paid features)

### "Rate Limit Exceeded"

- Wait a few minutes and try again
- Upgrade to a higher tier
- Reduce session frequency

### "Network Error"

- Check your internet connection
- Verify the API service is not down
- Try again later

### Keys Not Saving

- Ensure you have storage permissions
- Try clearing app cache
- Reinstall the app (backup data first)

---

## 📚 Additional Resources

- [ElevenLabs Documentation](https://docs.elevenlabs.io/)
- [Gemini API Documentation](https://ai.google.dev/docs)
- [Resonance FAQ](./FAQ.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md)
