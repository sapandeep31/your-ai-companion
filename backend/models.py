import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(50), unique=True, index=True, nullable=False)
    password_hash = Column(String(255), nullable=False)
    about = Column(Text, default="A friendly user who likes tech, gaming, and relaxing after work.")
    context_memory = Column(JSONB, default=list) # User-level shared memory across all companions
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    personas = relationship("Persona", back_populates="owner", cascade="all, delete-orphan")
    summaries = relationship("ConversationSummary", back_populates="user", cascade="all, delete-orphan")


class Persona(Base):
    __tablename__ = "personas"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(100), nullable=False)
    slug = Column(String(100), index=True, nullable=False)
    preset_type = Column(String(50), default="wholesome") # wholesome, tsundere, yandere, playful, custom
    system_prompt = Column(Text, nullable=False)
    voice_name = Column(String(50), default="Kore") # Kore, Aoede, Puck, Fenrir, etc.
    shirt_color = Column(String(20), default="#e84393")
    # context_memory stores an array of key memory points, summaries, and inside jokes:
    # [{"timestamp": "...", "summary": "...", "highlights": ["user is tired from project X", "he likes pizza"]}]
    context_memory = Column(JSONB, default=list)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    owner = relationship("User", back_populates="personas")
    summaries = relationship("ConversationSummary", back_populates="persona", cascade="all, delete-orphan")


class ConversationSummary(Base):
    __tablename__ = "conversation_summaries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    persona_id = Column(UUID(as_uuid=True), ForeignKey("personas.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    summary_text = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    user = relationship("User", back_populates="summaries")
    persona = relationship("Persona", back_populates="summaries")
