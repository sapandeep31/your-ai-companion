import os
import json
import base64
import asyncio
import logging
import uuid
from typing import Optional, List
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, status, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from google import genai
from google.genai import types
from dotenv import load_dotenv

# Database & Auth
from database import get_db, AsyncSessionLocal, init_sync_db
import models
import auth
from presets import PRESET_TEMPLATES, build_full_system_prompt, enrich_persona_prompt_async
from memory import summarize_and_save_memory

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("gemini-live-backend")

load_dotenv()

# Initialize DB tables synchronously on startup
try:
    init_sync_db()
    logger.info("Database schema initialized successfully.")
except Exception as e:
    logger.error(f"DB initialization warning: {e}")

app = FastAPI(title="Sara AI Multi-Persona Live Platform")

# CORS middleware - Allow all origins for seamless client access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")

if os.path.exists(STATIC_DIR):
    app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


# ==============================================================================
# Pydantic Schemas
# ==============================================================================
class SignupRequest(BaseModel):
    username: str
    password: str
    about: Optional[str] = "A hard-working software developer who loves tech and gaming."

class LoginRequest(BaseModel):
    username: str
    password: str

class UserProfileUpdate(BaseModel):
    about: str

class PersonaCreateRequest(BaseModel):
    name: str
    slug: Optional[str] = None
    preset_type: str = "wholesome" # wholesome, tsundere, yandere, playful, custom
    system_prompt: Optional[str] = None
    voice_name: str = "Kore"
    shirt_color: str = "#e84393"

class PersonaUpdateRequest(BaseModel):
    name: Optional[str] = None
    system_prompt: Optional[str] = None
    voice_name: Optional[str] = None
    shirt_color: Optional[str] = None


# ==============================================================================
# REST API Endpoints: Auth & Profile
# ==============================================================================
@app.post("/api/auth/signup")
async def signup(req: SignupRequest, db: AsyncSession = Depends(get_db)):
    # Check if username exists
    existing = await db.execute(select(models.User).where(models.User.username == req.username.strip()))
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Username already taken.")

    hashed_pw = auth.get_password_hash(req.password)
    user = models.User(
        username=req.username.strip(),
        password_hash=hashed_pw,
        about=req.about.strip() if req.about else "A friendly user."
    )
    db.add(user)
    await db.flush()

    # Seed default "Sara" persona for new user
    default_preset = PRESET_TEMPLATES["wholesome"]
    default_persona = models.Persona(
        user_id=user.id,
        name=default_preset["name"],
        slug=default_preset["slug"],
        preset_type="wholesome",
        system_prompt=default_preset["system_prompt"],
        voice_name=default_preset["voice_name"],
        shirt_color=default_preset["shirt_color"],
        context_memory=[]
    )
    db.add(default_persona)
    await db.commit()
    await db.refresh(user)

    token = auth.create_access_token({"sub": str(user.id), "username": user.username})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": str(user.id),
            "username": user.username,
            "about": user.about
        }
    }

@app.post("/api/auth/login")
async def login(req: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(models.User).where(models.User.username == req.username.strip()))
    user = result.scalars().first()
    if not user or not auth.verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Invalid username or password.")

    token = auth.create_access_token({"sub": str(user.id), "username": user.username})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": str(user.id),
            "username": user.username,
            "about": user.about
        }
    }

@app.get("/api/auth/me")
async def get_me(current_user: models.User = Depends(auth.get_current_user)):
    return {
        "id": str(current_user.id),
        "username": current_user.username,
        "about": current_user.about
    }

@app.put("/api/auth/me")
async def update_me(req: UserProfileUpdate, current_user: models.User = Depends(auth.get_current_user), db: AsyncSession = Depends(get_db)):
    current_user.about = req.about.strip()
    await db.commit()
    return {"message": "Profile updated successfully.", "about": current_user.about}


# ==============================================================================
# REST API Endpoints: Personas & Presets
# ==============================================================================
@app.get("/api/presets")
async def get_presets():
    return PRESET_TEMPLATES

@app.get("/api/personas")
async def list_personas(
    current_user: Optional[models.User] = Depends(auth.get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    if current_user:
        result = await db.execute(select(models.Persona).where(models.Persona.user_id == current_user.id).order_by(models.Persona.created_at.desc()))
        personas = result.scalars().all()
    else:
        # Return all public/demo personas
        result = await db.execute(select(models.Persona).limit(10))
        personas = result.scalars().all()

    return [
        {
            "id": str(p.id),
            "name": p.name,
            "slug": p.slug,
            "preset_type": p.preset_type,
            "voice_name": p.voice_name,
            "shirt_color": p.shirt_color,
            "system_prompt": p.system_prompt,
            "context_memory": p.context_memory or {},
            "created_at": p.created_at.isoformat() if p.created_at else None
        }
        for p in personas
    ]

@app.post("/api/personas")
async def create_persona(
    req: PersonaCreateRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    slug = (req.slug or req.name).lower().strip().replace(" ", "-")
    
    # Check if preset applies with no custom prompt
    if req.preset_type in PRESET_TEMPLATES and not req.system_prompt:
        preset = PRESET_TEMPLATES[req.preset_type]
        system_prompt = preset["system_prompt"]
        voice_name = req.voice_name or preset["voice_name"]
        shirt_color = req.shirt_color or preset["shirt_color"]
    else:
        # Auto-enrich if the user provided a brief description or customized prompt
        logger.info(f"Auto-enriching personality prompt for companion '{req.name}'...")
        system_prompt = await enrich_persona_prompt_async(
            name=req.name.strip(),
            raw_concept=req.system_prompt or "",
            preset_type=req.preset_type or "custom"
        )
        voice_name = req.voice_name or "Kore"
        shirt_color = req.shirt_color or "#e84393"

    persona = models.Persona(
        user_id=current_user.id,
        name=req.name.strip(),
        slug=slug,
        preset_type=req.preset_type,
        system_prompt=system_prompt,
        voice_name=voice_name,
        shirt_color=shirt_color,
        context_memory=[]
    )
    db.add(persona)
    await db.commit()
    await db.refresh(persona)

    return {
        "id": str(persona.id),
        "name": persona.name,
        "slug": persona.slug,
        "preset_type": persona.preset_type,
        "voice_name": persona.voice_name,
        "shirt_color": persona.shirt_color,
        "system_prompt": persona.system_prompt
    }

@app.get("/api/personas/{slug}")
async def get_persona_by_slug(
    slug: str,
    current_user: Optional[models.User] = Depends(auth.get_current_user_optional),
    db: AsyncSession = Depends(get_db)
):
    # Try finding user's persona or default fallback
    query = select(models.Persona).where(models.Persona.slug == slug.lower())
    if current_user:
        query = query.where(models.Persona.user_id == current_user.id)
    
    result = await db.execute(query)
    persona = result.scalars().first()

    # Fallback to any persona with matching slug or preset
    if not persona:
        fallback_query = select(models.Persona).where(models.Persona.slug == slug.lower())
        res = await db.execute(fallback_query)
        persona = res.scalars().first()

    if not persona:
        # Check standard static presets
        if slug.lower() in PRESET_TEMPLATES:
            preset = PRESET_TEMPLATES[slug.lower()]
            return {
                "name": preset["name"],
                "slug": preset["slug"],
                "preset_type": preset["preset_type"],
                "voice_name": preset["voice_name"],
                "shirt_color": preset["shirt_color"],
                "system_prompt": preset["system_prompt"],
                "context_memory": []
            }
        raise HTTPException(status_code=404, detail=f"Persona '{slug}' not found.")

    return {
        "id": str(persona.id),
        "name": persona.name,
        "slug": persona.slug,
        "preset_type": persona.preset_type,
        "voice_name": persona.voice_name,
        "shirt_color": persona.shirt_color,
        "system_prompt": persona.system_prompt,
        "context_memory": persona.context_memory or []
    }

@app.put("/api/personas/{slug}")
async def update_persona(
    slug: str,
    req: PersonaUpdateRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(models.Persona).where(
            models.Persona.slug == slug.lower(),
            models.Persona.user_id == current_user.id
        )
    )
    persona = result.scalars().first()
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found.")

    if req.name: persona.name = req.name.strip()
    if req.system_prompt: persona.system_prompt = req.system_prompt
    if req.voice_name: persona.voice_name = req.voice_name
    if req.shirt_color: persona.shirt_color = req.shirt_color

    await db.commit()
    return {"message": "Persona updated successfully."}

@app.post("/api/personas/{slug}/clear-memory")
async def clear_persona_memory(
    slug: str,
    current_user: models.User = Depends(auth.get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(models.Persona).where(
            models.Persona.slug == slug.lower(),
            models.Persona.user_id == current_user.id
        )
    )
    persona = result.scalars().first()
    if not persona:
        raise HTTPException(status_code=404, detail="Persona not found.")

    persona.context_memory = []
    
    # Also delete associated conversation summary records
    await db.execute(
        models.ConversationSummary.__table__.delete().where(
            models.ConversationSummary.persona_id == persona.id,
            models.ConversationSummary.user_id == current_user.id
        )
    )
    await db.commit()
    return {"message": f"All memories for {persona.name} have been cleared.", "memory_count": 0}


@app.websocket("/ws/{slug}")
@app.websocket("/ws")
async def websocket_endpoint(
    websocket: WebSocket,
    slug: Optional[str] = "sara",
    token: Optional[str] = Query(None),
    gemini_api_key: Optional[str] = Query(None)
):
    await websocket.accept()
    logger.info(f"Browser client connecting to WebSocket for persona slug: '{slug}'.")

    if not token:
        logger.warning("WebSocket rejected: Authentication token is missing.")
        await websocket.send_json({
            "type": "error",
            "message": "Authentication required. Please log in first."
        })
        await websocket.close(code=1008)
        return

    # Use client-provided custom key if available, else server environment key
    api_key = (gemini_api_key or "").strip() or os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.error("GEMINI_API_KEY is not set!")
        await websocket.send_json({
            "type": "error",
            "message": "GEMINI_API_KEY is missing. Please provide a key in the navbar."
        })
        await websocket.close()
        return

    # Load User & Persona from DB
    target_persona = None
    target_user = None

    async with AsyncSessionLocal() as db:
        try:
            payload = auth.jwt.decode(token, auth.SECRET_KEY, algorithms=[auth.ALGORITHM])
            user_id = payload.get("sub")
            if user_id:
                u_res = await db.execute(select(models.User).where(models.User.id == user_id))
                target_user = u_res.scalars().first()
        except Exception as e:
            logger.warning(f"WebSocket token validation failed: {e}")

        if not target_user:
            logger.warning("WebSocket rejected: Invalid or expired user token.")
            await websocket.send_json({
                "type": "error",
                "message": "Invalid or expired session. Please log in again."
            })
            await websocket.close(code=1008)
            return

        # Find persona for this authenticated user
        p_query = select(models.Persona).where(
            models.Persona.slug == (slug or "sara").lower(),
            models.Persona.user_id == target_user.id
        )
        p_res = await db.execute(p_query)
        target_persona = p_res.scalars().first()

        # If persona doesn't exist for this user, check if it's a known preset and auto-create it for this user
        if not target_persona:
            preset_key = (slug or "wholesome").lower()
            preset = PRESET_TEMPLATES.get(preset_key, PRESET_TEMPLATES["wholesome"])
            target_persona = models.Persona(
                user_id=target_user.id,
                name=preset["name"],
                slug=preset["slug"],
                preset_type=preset["preset_type"],
                system_prompt=preset["system_prompt"],
                voice_name=preset["voice_name"],
                shirt_color=preset["shirt_color"],
                context_memory=[]
            )
            db.add(target_persona)
            await db.commit()
            await db.refresh(target_persona)

    # Generate full persona prompt with user bio & past context memory
    full_instruction = build_full_system_prompt(target_persona, target_user)
    voice_name = target_persona.voice_name or "Kore"

    logger.info(f"Loaded Persona: '{target_persona.name}' | Voice: '{voice_name}' | Memories: {len(target_persona.context_memory or [])}")

    # Tool definitions for controlling the VRM Avatar
    set_expression = {
        "name": "set_expression",
        "description": "Sets a facial expression or emotion on the VRM avatar.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "expression": {
                    "type": "STRING",
                    "description": "The name of the expression (e.g., 'happy', 'angry', 'sad', 'surprised', 'neutral')."
                }
            },
            "required": ["expression"]
        }
    }

    play_animation = {
        "name": "play_animation",
        "description": "Plays a body animation or pose on the VRM avatar.",
        "parameters": {
            "type": "OBJECT",
            "properties": {
                "animation": {
                    "type": "STRING",
                    "description": "The name of the animation (e.g., 'wave', 'nod', 'idle')."
                }
            },
            "required": ["animation"]
        }
    }

    tools = [{"function_declarations": [set_expression, play_animation]}]

    model_name = os.getenv("MODEL_NAME", "gemini-3.1-flash-live-preview")
    client = genai.Client(api_key=api_key)

    config = types.LiveConnectConfig(
        response_modalities=[types.Modality.AUDIO],
        input_audio_transcription=types.AudioTranscriptionConfig(),
        output_audio_transcription=types.AudioTranscriptionConfig(),
        system_instruction=types.Content(parts=[types.Part(text=full_instruction)]),
        speech_config=types.SpeechConfig(
            voice_config=types.VoiceConfig(
                prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice_name)
            )
        ),
        tools=tools
    )

    transcript_turns = []
    persona_id = target_persona.id
    user_id = target_user.id
    persona_name = target_persona.name

    try:
        logger.info(f"Connecting to Gemini Live API with model: {model_name}")
        async with client.aio.live.connect(model=model_name, config=config) as session:
            logger.info(f"Gemini Live API session connected for {persona_name}.")
            try:
                await websocket.send_json({
                    "type": "status",
                    "status": "connected",
                    "model": model_name,
                    "persona": {
                        "name": target_persona.name,
                        "slug": target_persona.slug,
                        "shirt_color": target_persona.shirt_color,
                        "voice_name": target_persona.voice_name
                    }
                })
            except (WebSocketDisconnect, Exception):
                logger.info("Client disconnected immediately after session connect.")
                return

            # Proactively trigger personalized initial greeting based on consolidated memory
            try:
                mem = target_persona.context_memory or target_user.context_memory
                summary_val = ""
                highlights_val = []

                if isinstance(mem, dict):
                    summary_val = mem.get("summary", "")
                    highlights_val = mem.get("highlights", [])
                elif isinstance(mem, list) and len(mem) > 0:
                    last = mem[-1]
                    if isinstance(last, dict):
                        summary_val = last.get("summary", "")
                        highlights_val = last.get("highlights", [])
                    elif isinstance(last, str):
                        summary_val = last

                if summary_val:
                    hl_str = f" Key highlights: {', '.join(highlights_val)}." if highlights_val else ""
                    greeting_cue = (
                        f"[System Event: The user just entered the call. In your {persona_name} character, warmly greet him by referencing your knowledge about his recent life events: '{summary_val}'.{hl_str} Ask him a natural follow-up about that or how he is feeling right now!]"
                    )
                else:
                    greeting_cue = (
                        f"[System Event: The user just entered the room. In character as {persona_name}, look at his webcam feed and greet him excitedly, saying you were waiting for him!]"
                    )
                
                await session.send_realtime_input(text=greeting_cue)
            except Exception as e:
                logger.warning(f"Could not send initial proactive greeting trigger: {e}")

            # State tracking for proactive silence nudging
            loop = asyncio.get_running_loop()
            last_activity_time = loop.time()
            is_ai_speaking = False
            user_wants_silence = False

            # Background Task: Proactive Silence Detector (Checks if user is quiet for >10s)
            async def silence_monitor():
                nonlocal last_activity_time, is_ai_speaking, user_wants_silence
                try:
                    while True:
                        await asyncio.sleep(1.0)
                        now = loop.time()
                        if not is_ai_speaking and not user_wants_silence:
                            idle_time = now - last_activity_time
                            if idle_time >= 10.0:
                                logger.info(f"User has been quiet for {idle_time:.1f}s. Triggering proactive silence nudge for {persona_name}...")
                                # Reset last_activity_time and give 15s grace period
                                last_activity_time = now + 15.0
                                try:
                                    await session.send_realtime_input(
                                        text=f"[System Prompt: The user has been completely quiet for more than 10 seconds. In your {persona_name} persona, look at his webcam feed right now and speak up! Ask him 'Hey, are you listening to me?' or comment on what he is doing, his facial expression, or ask what he is thinking about!]"
                                    )
                                except Exception as e:
                                    logger.warning(f"Could not send silence nudge: {e}")
                except asyncio.CancelledError:
                    pass

            # Background Task: Periodic Conversation Memory Summarizer (Every 6 minutes)
            async def periodic_memory_summarizer():
                try:
                    while True:
                        await asyncio.sleep(240) # 4 minutes
                        if transcript_turns and len(transcript_turns) >= 2:
                            logger.info("Running periodic AI memory summarizer...")
                            async with AsyncSessionLocal() as db_session:
                                mem_obj = await summarize_and_save_memory(
                                    db_session,
                                    persona_id,
                                    user_id,
                                    list(transcript_turns),
                                    custom_api_key=custom_gemini_key
                                )
                                if mem_obj:
                                    await websocket.send_json({
                                        "type": "memory_updated",
                                        "context_memory": mem_obj
                                    })
                except asyncio.CancelledError:
                    pass
                except Exception as e:
                    logger.error(f"Error in periodic_memory_summarizer: {e}")

            # Task 1: Receive server events from Gemini Live API and send to Browser Client
            async def receive_from_gemini():
                nonlocal last_activity_time, is_ai_speaking
                current_ai_text = []
                try:
                    while True:
                        async for response in session.receive():
                            server_content = response.server_content

                            if server_content:
                                if server_content.model_turn and server_content.model_turn.parts:
                                    is_ai_speaking = True
                                    last_activity_time = loop.time()
                                    for part in server_content.model_turn.parts:
                                        if part.inline_data and part.inline_data.data:
                                            audio_b64 = base64.b64encode(part.inline_data.data).decode('utf-8')
                                            await websocket.send_json({
                                                "type": "audio",
                                                "data": audio_b64
                                            })

                                if server_content.input_transcription and server_content.input_transcription.text:
                                    user_text = server_content.input_transcription.text
                                    last_activity_time = loop.time()
                                    transcript_turns.append({"role": "User", "text": user_text})
                                    await websocket.send_json({
                                        "type": "input_transcript",
                                        "text": user_text
                                    })

                                if server_content.output_transcription and server_content.output_transcription.text:
                                    ai_text = server_content.output_transcription.text
                                    current_ai_text.append(ai_text)
                                    await websocket.send_json({
                                        "type": "output_transcript",
                                        "text": ai_text
                                    })

                                if server_content.interrupted is True:
                                    logger.info("User interrupted turn.")
                                    is_ai_speaking = False
                                    last_activity_time = loop.time()
                                    await websocket.send_json({"type": "interrupted"})

                                if server_content.turn_complete is True:
                                    is_ai_speaking = False
                                    last_activity_time = loop.time()
                                    if current_ai_text:
                                        transcript_turns.append({"role": persona_name, "text": "".join(current_ai_text)})
                                        current_ai_text = []

                            if response.tool_call:
                                function_responses = []
                                for fc in response.tool_call.function_calls:
                                    await websocket.send_json({
                                        "type": "tool_call",
                                        "function": fc.name,
                                        "args": dict(fc.args) if fc.args else {}
                                    })
                                    function_response = types.FunctionResponse(
                                        id=fc.id,
                                        name=fc.name,
                                        response={"result": "ok"}
                                    )
                                    function_responses.append(function_response)

                                await session.send_tool_response(function_responses=function_responses)

                        await asyncio.sleep(0.01)

                except (WebSocketDisconnect, asyncio.CancelledError):
                    logger.info("receive_from_gemini cancelled or disconnected.")
                except Exception as e:
                    err_str = str(e).lower()
                    logger.error(f"Error in receive_from_gemini: {e}", exc_info=True)
                    is_exhausted = any(k in err_str for k in ["429", "resource_exhausted", "quota", "rate limit", "limit exceeded", "exhausted", "403", "api_key_invalid", "permission_denied", "not valid", "unregistered"])
                    try:
                        if is_exhausted:
                            await websocket.send_json({
                                "type": "api_key_exhausted",
                                "title": "API Key Quota Exhausted / Rate Limited",
                                "message": "The Gemini API key quota has been exhausted or rate limited. Please add your own free Gemini API key from Google AI Studio, or contact sapandeep318@gmail.com for premium tier access.",
                                "contact_email": "sapandeep318@gmail.com"
                            })
                        else:
                            await websocket.send_json({
                                "type": "error",
                                "message": f"Connection error: {str(e)}"
                            })
                    except Exception:
                        pass

            # Task 2: Receive realtime audio/video/text from Browser Client and send to Gemini
            async def receive_from_client():
                nonlocal last_activity_time, user_wants_silence
                try:
                    while True:
                        msg_raw = await websocket.receive_text()
                        msg = json.loads(msg_raw)
                        msg_type = msg.get("type")

                        if msg_type == "audio":
                            audio_bytes = base64.b64decode(msg["data"])
                            await session.send_realtime_input(
                                audio=types.Blob(data=audio_bytes, mime_type="audio/pcm;rate=16000")
                            )
                        elif msg_type == "video":
                            video_bytes = base64.b64decode(msg["data"])
                            await session.send_realtime_input(
                                video=types.Blob(data=video_bytes, mime_type="image/jpeg")
                            )
                        elif msg_type == "text":
                            text_input = msg.get("text", "")
                            if text_input.strip():
                                last_activity_time = loop.time()
                                lower_text = text_input.lower()
                                if any(kw in lower_text for kw in ["shut up", "be quiet", "stop talking", "chup", "shh", "stay quiet"]):
                                    user_wants_silence = True
                                else:
                                    user_wants_silence = False

                                transcript_turns.append({"role": "User", "text": text_input})
                                await session.send_realtime_input(text=text_input)
                        elif msg_type == "ping":
                            await websocket.send_json({"type": "pong"})

                except WebSocketDisconnect:
                    logger.info("Browser client WebSocket disconnected.")
                except asyncio.CancelledError:
                    pass
                except Exception as e:
                    logger.error(f"Error in receive_from_client: {e}", exc_info=True)

            gemini_task = asyncio.create_task(receive_from_gemini())
            client_task = asyncio.create_task(receive_from_client())
            memory_timer_task = asyncio.create_task(periodic_memory_summarizer())
            silence_task = asyncio.create_task(silence_monitor())

            done, pending = await asyncio.wait(
                [gemini_task, client_task, memory_timer_task, silence_task],
                return_when=asyncio.FIRST_COMPLETED
            )
            for t in pending:
                t.cancel()

    except WebSocketDisconnect:
        logger.info("WebSocket disconnected.")
    except Exception as e:
        err_str = str(e).lower()
        logger.error(f"Live Session error: {e}", exc_info=True)
        is_exhausted = any(k in err_str for k in ["429", "resource_exhausted", "quota", "rate limit", "limit exceeded", "exhausted", "403", "api_key_invalid", "permission_denied", "not valid", "unregistered"])
        try:
            if is_exhausted:
                await websocket.send_json({
                    "type": "api_key_exhausted",
                    "title": "API Key Quota Exhausted / Rate Limited",
                    "message": "The Gemini API key quota has been exhausted or rate limited. Please add your own free Gemini API key from Google AI Studio, or contact sapandeep318@gmail.com for premium tier access.",
                    "contact_email": "sapandeep318@gmail.com"
                })
            else:
                await websocket.send_json({
                    "type": "error",
                    "message": f"Live Session error: {str(e)}"
                })
        except Exception:
            pass
    finally:
        # On session end, summarize remaining memory context and save to Neon DB
        if transcript_turns and len(transcript_turns) >= 2:
            logger.info("Session ended. Saving final conversation memory summary to Neon DB...")
            try:
                async with AsyncSessionLocal() as db_session:
                    await summarize_and_save_memory(
                        db_session,
                        persona_id,
                        user_id,
                        list(transcript_turns),
                        custom_api_key=custom_gemini_key
                    )
            except Exception as e:
                logger.error(f"Final memory save error: {e}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
