from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    Float,
    Integer,
    String,
    Text,
    UniqueConstraint,
)

from app.database.database import Base


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

    created_at = Column(
        DateTime,
        default=datetime.utcnow,
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
        nullable=False,
        index=True,
    )

    provider = Column(
        String(50),
        nullable=False,
    )

    access_token = Column(
        Text,
        nullable=False,
    )

    refresh_token = Column(
        Text,
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
        default=datetime.utcnow,
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
        default=datetime.utcnow,
    )

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
        default=datetime.utcnow,
    )

    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )


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
        default=datetime.utcnow,
    )

    updated_at = Column(
        DateTime,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )