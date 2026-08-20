# Gemini Live Multimodal Voice & Video Application

A real-time Python FastAPI backend and modern HTML/JS web client for bidirectional streaming audio and video interactions with Google Gemini Live API (`gemini-3.1-flash-live-preview`).

## Features
- **Real-Time Audio**: Captures mic input (16kHz PCM), decodes Gemini native audio responses (24kHz PCM), and streams continuous audio playback over WebSockets.
- **Webcam Video Stream**: Captures video frames (~1 FPS JPEG canvas) and sends visual context to Gemini in real time.
- **Voice Activity & Interruptions**: Supports instant audio playback clearing when you interrupt Gemini's response.
- **Live Transcripts**: Displays real-time user speech and Gemini response transcripts.
- **Modern Glassmorphism UI**: Audio visualizer waveform, camera stream preview, and session control badges.

## Prerequisites
- Python 3.10+
- Google Gemini API Key (get one from [Google AI Studio](https://aistudio.google.com/app/apikey))

## Setup & Running

1. **Navigate to the backend directory**:
   ```bash
   cd projects/my-ex/backend
   ```

2. **Set up Virtual Environment**:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   ```

3. **Install Dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure API Key**:
   Create a `.env` file from `.env.example`:
   ```bash
   cp .env.example .env
   ```
   Open `.env` and replace `your_gemini_api_key_here` with your actual Gemini API Key:
   ```env
   GEMINI_API_KEY=AIzaSy...
   ```

5. **Start the FastAPI Server**:
   ```bash
   python main.py
   ```
   or using uvicorn:
   ```bash
   uvicorn main:app --reload --port 8000
   ```

6. **Open in Browser**:
   Navigate to `http://localhost:8000` in your web browser (Chrome/Edge recommended).
   Click **Start Session** and allow camera and microphone permissions.

> 💡 **Tip**: Use headphones to prevent microphone echo loop / self-interruption during voice interaction!
