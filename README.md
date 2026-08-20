# 💖 Your AI Companion

An interactive 3D virtual AI girlfriend platform powered by **Google Gemini 3.1 Flash Live API** with bidirectional audio/video streaming, real-time webcam vision, Japanese 5-vowel lip-sync, dynamic facial expressions & animations, and persistent long-term memory stored in **Neon PostgreSQL**.

---

## ✨ Features

- **🎮 3D VRM Anime Avatars**: Interactive WebGL avatar powered by `@pixiv/three-vrm` and Three.js with realistic idle breathing, smooth head tracking, and customizable shirt colors.
- **👁️ Real-Time Webcam Vision**: Sees you through your webcam (1 frame/sec) and reacts proactively when you drink water, eat, look tired, or stay quiet.
- **🎙️ Zero-Latency Voice Streaming**: Low-latency bidirectional PCM audio using Web Audio API with automatic voice-detection barge-in and cancellation.
- **🎭 Multi-Persona System**:
  - **Sara (Wholesome)**: Sweet, caring, and encouraging.
  - **Asuka (Tsundere)**: Feisty, prideful, flustered, secretly affectionate.
  - **Yuno (Yandere)**: Deeply devoted, obsessive, clingy.
  - **Maya (Playful)**: Witty, energetic, teasing & joking.
  - **Custom AI Personas**: Build your own companion with automatic Gemini persona prompt enrichment.
- **🧠 Single Consolidated Rolling Memory**: Synthesizes past chats and recent life events into a single evolving memory state stored in Neon PostgreSQL.
- **🔑 Custom Gemini API Key & Premium Tier Support**: Bring your own free Gemini API key in the navbar or upgrade to dedicated high-speed access.
- **⚡ Cloudflare Ready**: Pre-configured with `wrangler.jsonc` for instant Cloudflare Workers / Pages deployment.

---

## 🚀 Quick Start

### 1. Backend Setup (FastAPI + Neon PostgreSQL)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
```

Edit `backend/.env` and add:
```env
GEMINI_API_KEY=your_gemini_api_key_here
DATABASE_URL=postgresql://user:password@ep-your-neon-host.aws.neon.tech/neondb?sslmode=require
JWT_SECRET=your_super_secret_jwt_key
CORS_ORIGINS=*
```

Start backend:
```bash
python main.py
```

---

### 2. Frontend Setup (React + Vite + Three.js)

```bash
# In the project root
npm install
npm run dev
```

Visit **`http://localhost:5173`** in your browser.

---

## ☁️ Cloudflare Deployment

Deploy the frontend SPA to Cloudflare Workers with static assets:

```bash
npm run deploy
```

---

## 📬 Contact & Premium Tier Access

For dedicated high-speed quota, custom avatars, or business inquiries, contact:
- **Email**: [sapandeep318@gmail.com](mailto:sapandeep318@gmail.com)
