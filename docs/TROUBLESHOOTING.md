# 🔧 Troubleshooting Guide

Solutions for common issues in Resonance.

---

## 🚀 Installation Issues

### APK won't install

**Symptoms**: "App not installed" or "Installation blocked" error

**Solutions**:
1. Enable "Install from Unknown Sources":
   - Go to **Settings** → **Security** → **Unknown Sources**
   - Or **Settings** → **Apps** → **Special Access** → **Install Unknown Apps**
2. Ensure you have enough storage space (at least 200MB free)
3. Uninstall any previous version first
4. Download the APK again (file might be corrupted)

### App crashes immediately after install

**Solutions**:
1. Clear app data: **Settings** → **Apps** → **Resonance** → **Clear Data**
2. Restart your device
3. Check Android version (minimum Android 7.0 / API 24)
4. Try reinstalling

---

## 🔑 API Key Issues

### "Invalid API Key" error

**For ElevenLabs**:
1. Go to [elevenlabs.io](https://elevenlabs.io/) → Profile → API Keys
2. Create a new key if needed
3. Copy the ENTIRE key (no spaces)
4. Paste in Resonance Settings

**For Gemini**:
1. Go to [makersuite.google.com/app/apikey](https://makersuite.google.com/app/apikey)
2. Ensure billing is enabled (for paid features)
3. Create a new key
4. Copy and paste carefully

### "Rate Limit Exceeded"

**Solutions**:
1. Wait 1-2 minutes before trying again
2. Reduce session frequency
3. Upgrade to a higher API tier
4. Enable Mock Mode for practice

### Keys not saving

**Solutions**:
1. Grant storage permissions
2. Clear app cache and try again
3. Check if secure storage is working:
   - Some custom ROMs have issues with secure storage
   - Try reinstalling the app

---

## 🎙️ Audio Issues

### Microphone not working

**Solutions**:
1. Grant microphone permission:
   - **Settings** → **Apps** → **Resonance** → **Permissions** → **Microphone**
2. Check if another app is using the microphone
3. Restart the app
4. Test microphone in another app

### AI can't hear me (VAD not detecting voice)

**Solutions**:
1. Increase VAD sensitivity:
   - **Settings** → **VAD Sensitivity** → **High**
2. Speak louder and clearer
3. Reduce background noise
4. Recalibrate by restarting the app (calibration happens on splash screen)
5. Use headphones with a built-in microphone

### No audio output / Can't hear AI

**Solutions**:
1. Check device volume (media volume, not ringtone)
2. Ensure not in silent/vibrate mode
3. Try with headphones
4. Check if audio is playing in another app
5. Restart the app

### Audio is choppy or laggy

**Solutions**:
1. Check internet connection speed
2. Close other apps using bandwidth
3. Try on WiFi instead of mobile data
4. Reduce voice quality settings
5. Move closer to WiFi router

### Echo or feedback

**Solutions**:
1. Use headphones (recommended)
2. Lower speaker volume
3. Move away from reflective surfaces

---

## 📱 App Performance Issues

### App is slow or laggy

**Solutions**:
1. Close other apps
2. Clear app cache:
   - **Settings** → **Apps** → **Resonance** → **Clear Cache**
3. Restart your device
4. Ensure at least 500MB free RAM
5. Disable animations in Developer Options

### App freezes during session

**Solutions**:
1. Don't switch apps during active sessions
2. Disable battery optimization for Resonance:
   - **Settings** → **Battery** → **Resonance** → **Don't Optimize**
3. Keep screen on during sessions
4. Check for overheating

### High battery drain

**Solutions**:
1. Reduce session length
2. Lower screen brightness
3. Use headphones (reduces speaker power)
4. Close app when not in use

---

## 💾 Data Issues

### Sessions not saving

**Solutions**:
1. Don't force-close app during sessions
2. Wait for "Session Completed" message
3. Check storage space
4. Grant storage permissions

### History is empty

**Solutions**:
1. Complete at least one full session
2. Check if data was cleared accidentally
3. Restart the app

### Can't export reports

**Solutions**:
1. Grant storage/file permissions
2. Ensure enough storage space
3. Try exporting to a different location
4. Check if PDF viewer is installed

### Context files not uploading

**Solutions**:
1. Check file format (PDF, DOCX, DOC, TXT only)
2. File must be under 10MB
3. Grant file access permissions
4. Try a different file

---

## 🌐 Network Issues

### "Network Error" message

**Solutions**:
1. Check internet connection
2. Try switching between WiFi and mobile data
3. Disable VPN if using one
4. Check if API services are down:
   - [ElevenLabs Status](https://status.elevenlabs.io/)
   - [Google Cloud Status](https://status.cloud.google.com/)

### Slow AI responses

**Solutions**:
1. Check internet speed (minimum 1 Mbps recommended)
2. Move closer to WiFi router
3. Try at a different time (servers might be busy)
4. Use Mock Mode for offline practice

### WebSocket connection failed

**Solutions**:
1. Check if firewall is blocking WebSocket connections
2. Try a different network
3. Disable any proxy settings
4. Restart the app

---

## 🎙️ Voice Lab Issues

### Can't clone voice

**Solutions**:
1. Check ElevenLabs API key is valid
2. Ensure you haven't reached 5 voice limit
3. Audio sample requirements:
   - 10-30 seconds long
   - Clear speech, minimal noise
   - Single speaker only
   - WAV or MP3 format

### Cloned voice sounds wrong

**Solutions**:
1. Use a longer, clearer audio sample
2. Adjust stability slider (higher = more consistent)
3. Adjust similarity slider (higher = closer to original)
4. Try recording in a quieter environment

### Voice preview not playing

**Solutions**:
1. Check device volume
2. Wait for audio to load (may take a few seconds)
3. Check internet connection
4. Try a different voice

---

## 🔄 Update Issues

### App won't update

**Solutions**:
1. Uninstall old version first
2. Download latest APK from Releases
3. Clear Google Play cache (if applicable)
4. Restart device and try again

### Lost data after update

**Prevention**:
1. Export important reports before updating
2. Backup app data if possible

**Recovery**:
- Unfortunately, if data is lost, it cannot be recovered
- Start fresh and rebuild your training history

---

## 🆘 Still Having Issues?

If none of the above solutions work:

1. **Collect Information**:
   - Device model and Android version
   - App version (Settings → About)
   - Steps to reproduce the issue
   - Screenshots or screen recordings

2. **Report the Issue**:
   - Open an issue on [GitHub](https://github.com/YOUR_USERNAME/resonance-mobile-app/issues)
   - Include all collected information
   - Be as detailed as possible

3. **Temporary Workarounds**:
   - Use Mock Mode for offline practice
   - Try on a different device
   - Wait for a fix in the next update

---

## 📋 Quick Diagnostic Checklist

```
□ Android version 7.0+ (API 24+)
□ At least 200MB free storage
□ Microphone permission granted
□ Storage permission granted
□ Internet connection working
□ API keys configured (or Mock Mode enabled)
□ Battery optimization disabled for app
□ Latest app version installed
```
