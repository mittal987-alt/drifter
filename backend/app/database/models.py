from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship
from sqlalchemy.types import TypeDecorator

from app.database.database import Base
from app.services.crypto import encrypt_token, decrypt_token


def _utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class EncryptedToken(TypeDecorator):
    """
    SQLAlchemy TypeDecorator that encrypts sensitive OAuth tokens at rest
    using authenticated Fernet encryption, and decrypts them on load.
    Transparently falls back to plaintext if the token is not prefixed with 'v1:'.
    """
    impl = Text
    cache_ok = True

    def process_bind_param(self, value, dialect):
        if value is not None and isinstance(value, str):
            return encrypt_token(value)
        return value

    def process_result_value(self, value, dialect):
        if value is not None and isinstance(value, str):
            return decrypt_token(value)
        return value


# =========================================================
# USER
# =========================================================

class User(Base):
    __tablename__ = "users"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    email = Column(
        String(255),
        unique=True,
        nullable=True,
        index=True,
    )

    password_hash = Column(
        String(255),
        nullable=True,
    )

    name = Column(
        String(255),
        nullable=True,
    )

    is_active = Column(
        Boolean,
        default=True,
        nullable=False,
    )

    created_at = Column(
        DateTime,
        default=_utcnow,
    )

    # Relationships with cascade for clean account data wiping
    connections = relationship(
        "Connection",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    history_events = relationship(
        "HistoryEvent",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    analysis_results = relationship(
        "AnalysisResult",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    export_jobs = relationship(
        "PortabilityExportJob",
        back_populates="user",
        cascade="all, delete-orphan",
    )


# =========================================================
# CONNECTION
# =========================================================

class Connection(Base):
    __tablename__ = "connections"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    provider = Column(
        String(50),
        nullable=False,
        index=True,
    )

    access_token = Column(
        EncryptedToken,
        nullable=False,
    )

    refresh_token = Column(
        EncryptedToken,
        nullable=True,
    )

    expires_at = Column(
        DateTime,
        nullable=True,
    )

    scope = Column(
        Text,
        nullable=True,
    )

    created_at = Column(
        DateTime,
        default=_utcnow,
    )

    user = relationship("User", back_populates="connections")

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "provider",
            name="uq_user_provider",
        ),
    )


# =========================================================
# HISTORY EVENT
# =========================================================

class HistoryEvent(Base):
    __tablename__ = "history_events"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    timestamp = Column(
        DateTime,
        nullable=False,
        index=True,
    )

    source = Column(
        String(50),
        nullable=False,
        index=True,
    )

    title = Column(
        Text,
        nullable=False,
    )

    artist = Column(
        Text,
        nullable=True,
    )

    url = Column(
        Text,
        nullable=True,
    )

    duration = Column(
        Float,
        nullable=True,
    )

    event_hash = Column(
        String(64),
        nullable=False,
        index=True,
    )

    metadata_json = Column(
        Text,
        nullable=True,
    )

    created_at = Column(
        DateTime,
        default=_utcnow,
    )

    user = relationship("User", back_populates="history_events")

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "event_hash",
            name="uq_user_event_hash",
        ),
    )


# =========================================================
# ANALYSIS RESULT
# =========================================================

class AnalysisResult(Base):
    __tablename__ = "analysis_results"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    source = Column(
        String(50),
        nullable=True,
        index=True,
    )

    event_count = Column(
        Integer,
        nullable=False,
        default=0,
    )

    status = Column(
        String(32),
        nullable=False,
        default="READY",
    )

    error = Column(
        Text,
        nullable=True,
    )

    analysis_json = Column(
        Text,
        nullable=False,
    )

    created_at = Column(
        DateTime,
        default=_utcnow,
    )

    updated_at = Column(
        DateTime,
        default=_utcnow,
        onupdate=_utcnow,
    )

    user = relationship("User", back_populates="analysis_results")


# =========================================================
# GOOGLE DATA PORTABILITY EXPORT JOB
# =========================================================

class PortabilityExportJob(Base):
    __tablename__ = "portability_export_jobs"

    id = Column(
        Integer,
        primary_key=True,
        index=True,
    )

    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    archive_job_id = Column(
        String(255),
        nullable=False,
        unique=True,
        index=True,
    )

    status = Column(
        String(32),
        nullable=False,
        default="IN_PROGRESS",
    )

    error = Column(
        Text,
        nullable=True,
    )

    imported = Column(
        Integer,
        nullable=False,
        default=0,
    )

    duplicates = Column(
        Integer,
        nullable=False,
        default=0,
    )

    skipped = Column(
        Integer,
        nullable=False,
        default=0,
    )

    created_at = Column(
        DateTime,
        default=_utcnow,
    )

    updated_at = Column(
        DateTime,
        default=_utcnow,
        onupdate=_utcnow,
    )

    user = relationship("User", back_populates="export_jobs")