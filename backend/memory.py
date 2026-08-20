import os
import json
import logging
from datetime import datetime, timezone
from typing import Optional
from google import genai
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import models

logger = logging.getLogger("gemini-memory-summarizer")

async def summarize_and_save_memory(
    db: AsyncSession,
    persona_id,
    user_id,
    transcript_turns: list,
    custom_api_key: Optional[str] = None
):
    if not transcript_turns or len(transcript_turns) < 2:
        logger.info("Not enough conversation turns to generate a memory summary.")
        return

    api_key = (custom_api_key or "").strip() or os.getenv("GEMINI_API_KEY")
    if not api_key:
        logger.warning("No GEMINI_API_KEY available for memory summarization.")
        return

    conversation_text = "\n".join(
        f"{t.get('role', 'Speaker')}: {t.get('text', '')}"
        for t in transcript_turns
        if t.get('text')
    )

    # Fetch existing user & persona to get previous rolling memory
    u_result = await db.execute(select(models.User).where(models.User.id == user_id))
    user = u_result.scalars().first()

    result = await db.execute(select(models.Persona).where(models.Persona.id == persona_id))
    persona = result.scalars().first()

    prev_summary = "No previous memory recorded yet."
    if user and user.context_memory:
        if isinstance(user.context_memory, dict):
            prev_summary = f"{user.context_memory.get('summary', '')} (Key details: {', '.join(user.context_memory.get('highlights', []))})"
        elif isinstance(user.context_memory, list) and len(user.context_memory) > 0:
            last = user.context_memory[-1]
            if isinstance(last, dict):
                prev_summary = f"{last.get('summary', '')} (Key details: {', '.join(last.get('highlights', []))})"

    prompt = f"""You are an expert AI companion memory consolidator.
Maintain a SINGLE, continuously evolving, concise long-term memory about the user.

PREVIOUS EXISTING MEMORY (if any):
{prev_summary}

NEW CONVERSATION TRANSCRIPT:
{conversation_text}

Task:
Synthesize the new conversation with the previous memory into a SINGLE updated, concise memory state (2 to 4 sentences maximum) capturing:
- Enduring facts about the user (job, habits, personality, preferences).
- Recent events, what he did, mood/health, and promises or plans.
- 3 to 6 key bullet points.

Format your response STRICTLY as valid JSON:
{{
  "summary": "Concise consolidated rolling summary...",
  "highlights": ["Key detail 1", "Key detail 2", "Key detail 3"]
}}"""

    try:
        client = genai.Client(api_key=api_key)
        response = await client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
        )

        response_text = response.text.strip()
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]

        parsed = json.loads(response_text.strip())
        summary_text = parsed.get("summary", "")
        highlights = parsed.get("highlights", [])

        if not summary_text:
            return

        now_iso = datetime.now(timezone.utc).isoformat()
        single_memory_obj = {
            "summary": summary_text,
            "highlights": highlights,
            "updated_at": now_iso,
            "last_companion": persona.name if persona else "Companion"
        }

        # Store single consolidated memory in both User and Persona
        if persona:
            persona.context_memory = single_memory_obj

        if user:
            user.context_memory = single_memory_obj

        # Also create record in conversation_summaries table for auditing
        summary_record = models.ConversationSummary(
            persona_id=persona_id,
            user_id=user_id,
            summary_text=f"{summary_text} | Highlights: {'; '.join(highlights)}"
        )
        db.add(summary_record)
        await db.commit()
        logger.info(f"Successfully saved single consolidated context memory for user & persona {persona.name if persona else ''}: {summary_text}")
        return single_memory_obj

    except Exception as e:
        logger.error(f"Failed to generate memory summary: {e}", exc_info=True)
        return None
