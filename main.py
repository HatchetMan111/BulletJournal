from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any
import json
import os

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import Boolean, Date, DateTime, Float, Integer, String, Text, create_engine, inspect, select, text
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column

BASE_DIR = Path(__file__).resolve().parents[2]
DATA_DIR = Path(os.getenv("BULLETJOURNAL_DATA_DIR", BASE_DIR / "data"))
DATA_DIR.mkdir(parents=True, exist_ok=True)
DB_URL = os.getenv("BULLETJOURNAL_DB_URL", f"sqlite:///{DATA_DIR / 'bulletjournal.db'}")

engine = create_engine(DB_URL, connect_args={"check_same_thread": False} if DB_URL.startswith("sqlite") else {})

class Base(DeclarativeBase):
    pass

class DailyEntry(Base):
    __tablename__ = "daily_entries"
    id: Mapped[int] = mapped_column(primary_key=True)
    day: Mapped[date] = mapped_column(Date, unique=True, index=True)
    mood: Mapped[int | None] = mapped_column(Integer)
    productivity: Mapped[int | None] = mapped_column(Integer)
    sleep_hours: Mapped[float | None] = mapped_column(Float)
    water_liters: Mapped[float | None] = mapped_column(Float)
    day_rating: Mapped[int | None] = mapped_column(Integer)
    stress: Mapped[int | None] = mapped_column(Integer)
    energy: Mapped[int | None] = mapped_column(Integer)
    running: Mapped[bool] = mapped_column(Boolean, default=False)
    strength_training: Mapped[bool] = mapped_column(Boolean, default=False)
    reading_30min: Mapped[bool] = mapped_column(Boolean, default=False)
    self_cooked: Mapped[bool] = mapped_column(Boolean, default=False)
    protein_grams: Mapped[float | None] = mapped_column(Float)
    new_customer: Mapped[bool] = mapped_column(Boolean, default=False)
    new_person: Mapped[bool] = mapped_column(Boolean, default=False)
    money_saved: Mapped[float | None] = mapped_column(Float)
    money_earned: Mapped[float | None] = mapped_column(Float)
    expenses: Mapped[float | None] = mapped_column(Float)
    highlight: Mapped[str | None] = mapped_column(Text)
    work_note: Mapped[str | None] = mapped_column(Text)
    success: Mapped[str | None] = mapped_column(Text)
    learned: Mapped[str | None] = mapped_column(Text)
    funny: Mapped[str | None] = mapped_column(Text)
    gratitude: Mapped[str | None] = mapped_column(Text)
    wisdom: Mapped[str | None] = mapped_column(Text)
    food_note: Mapped[str | None] = mapped_column(Text)
    album: Mapped[str | None] = mapped_column(String(255))
    tool_of_day: Mapped[str | None] = mapped_column(String(255))
    trade_note: Mapped[str | None] = mapped_column(Text)
    watchlist: Mapped[str | None] = mapped_column(Text)
    future_action: Mapped[str | None] = mapped_column(Text)
    journal: Mapped[str | None] = mapped_column(Text)
    tomorrow_1: Mapped[str | None] = mapped_column(Text)
    tomorrow_2: Mapped[str | None] = mapped_column(Text)
    tomorrow_3: Mapped[str | None] = mapped_column(Text)
    tomorrow_1_done: Mapped[bool] = mapped_column(Boolean, default=False)
    tomorrow_2_done: Mapped[bool] = mapped_column(Boolean, default=False)
    tomorrow_3_done: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Goal(Base):
    __tablename__ = "goals"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    horizon: Mapped[str] = mapped_column(String(20), default="1y")
    area: Mapped[str] = mapped_column(String(50), default="meaning")
    year: Mapped[int | None] = mapped_column(Integer)
    progress: Mapped[int] = mapped_column(Integer, default=0)
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class Project(Base):
    __tablename__ = "projects"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    area: Mapped[str] = mapped_column(String(50), default="work")
    progress: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(20), default="active")
    next_action: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class Vision(Base):
    __tablename__ = "visions"
    id: Mapped[int] = mapped_column(primary_key=True)
    horizon: Mapped[str] = mapped_column(String(20), unique=True)
    content: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class Tracker(Base):
    __tablename__ = "trackers"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    kind: Mapped[str] = mapped_column(String(20), default="boolean")
    unit: Mapped[str | None] = mapped_column(String(30))
    target: Mapped[float | None] = mapped_column(Float)
    area: Mapped[str] = mapped_column(String(50), default="health")
    active: Mapped[bool] = mapped_column(Boolean, default=True)

class JournalEntry(Base):
    __tablename__ = "journal_entries"
    id: Mapped[int] = mapped_column(primary_key=True)
    day: Mapped[date] = mapped_column(Date, index=True)
    category: Mapped[str] = mapped_column(String(50), default="note")
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class Settings(Base):
    __tablename__ = "settings"
    key: Mapped[str] = mapped_column(String(100), primary_key=True)
    value: Mapped[str] = mapped_column(Text, default="")

Base.metadata.create_all(engine)

def migrate_schema() -> None:
    """Add columns that were introduced after a database already existed.
    create_all() only creates missing TABLES, not missing COLUMNS on tables
    that already exist on disk (relevant for existing self-hosted installs).
    """
    inspector = inspect(engine)
    with engine.begin() as conn:
        for table in Base.metadata.sorted_tables:
            if not inspector.has_table(table.name):
                continue
            existing = {c["name"] for c in inspector.get_columns(table.name)}
            for column in table.columns:
                if column.name in existing:
                    continue
                col_type = column.type.compile(engine.dialect)
                default_sql = ""
                if column.default is not None and getattr(column.default, "is_scalar", False):
                    val = column.default.arg
                    if isinstance(val, bool):
                        default_sql = f" DEFAULT {1 if val else 0}"
                    elif isinstance(val, (int, float)):
                        default_sql = f" DEFAULT {val}"
                conn.execute(text(f'ALTER TABLE "{table.name}" ADD COLUMN "{column.name}" {col_type}{default_sql}'))

migrate_schema()

app = FastAPI(title="BulletJournal API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

AREAS = [
    ("health", "Körper & Gesundheit"), ("mental", "Mental & Emotionen"), ("social", "Familie & Freunde"),
    ("intimacy", "Liebe & Intimität"), ("safety", "Sicherheit"), ("work", "Arbeit & Business"),
    ("learning", "Lernen & Entwicklung"), ("inspiration", "Inspiration & Kreativität"),
    ("environment", "Umgebung & Lebensqualität"), ("meaning", "Sinn, Werte & Vision"),
]

class DailyIn(BaseModel):
    day: date
    mood: int | None = Field(default=None, ge=1, le=6)
    productivity: int | None = Field(default=None, ge=1, le=10)
    sleep_hours: float | None = Field(default=None, ge=0, le=24)
    water_liters: float | None = Field(default=None, ge=0, le=20)
    day_rating: int | None = Field(default=None, ge=1, le=10)
    stress: int | None = Field(default=None, ge=1, le=10)
    energy: int | None = Field(default=None, ge=1, le=10)
    running: bool = False
    strength_training: bool = False
    reading_30min: bool = False
    self_cooked: bool = False
    protein_grams: float | None = None
    new_customer: bool = False
    new_person: bool = False
    money_saved: float | None = None
    money_earned: float | None = None
    expenses: float | None = None
    highlight: str | None = None
    work_note: str | None = None
    success: str | None = None
    learned: str | None = None
    funny: str | None = None
    gratitude: str | None = None
    wisdom: str | None = None
    food_note: str | None = None
    album: str | None = None
    tool_of_day: str | None = None
    trade_note: str | None = None
    watchlist: str | None = None
    future_action: str | None = None
    journal: str | None = None
    tomorrow_1: str | None = None
    tomorrow_2: str | None = None
    tomorrow_3: str | None = None
    tomorrow_1_done: bool = False
    tomorrow_2_done: bool = False
    tomorrow_3_done: bool = False

class GoalIn(BaseModel):
    title: str
    description: str | None = None
    horizon: str = "1y"
    area: str = "meaning"
    year: int | None = None
    progress: int = Field(default=0, ge=0, le=100)

class ProjectIn(BaseModel):
    title: str
    description: str | None = None
    area: str = "work"
    progress: int = Field(default=0, ge=0, le=100)
    next_action: str | None = None

class VisionIn(BaseModel):
    horizon: str
    content: str

class TrackerIn(BaseModel):
    name: str
    kind: str = "boolean"
    unit: str | None = None
    target: float | None = None
    area: str = "health"

class JournalIn(BaseModel):
    day: date
    category: str = "note"
    content: str

class OllamaSettings(BaseModel):
    enabled: bool = False
    url: str = "http://127.0.0.1:11434"
    model: str = "llama3.2:3b"
    include_sensitive: bool = False


def serialize(model: Any) -> dict[str, Any]:
    data = {}
    for col in model.__table__.columns:
        value = getattr(model, col.name)
        if isinstance(value, (date, datetime)):
            value = value.isoformat()
        data[col.name] = value
    return data

@app.get("/api/health")
def health():
    return {"status": "ok", "app": "BulletJournal", "version": app.version}

@app.get("/api/meta")
def meta():
    return {"areas": [{"id": a, "name": n} for a, n in AREAS], "today": date.today().isoformat()}

@app.get("/api/daily/{day}")
def get_daily(day: date):
    with Session(engine) as db:
        entry = db.scalar(select(DailyEntry).where(DailyEntry.day == day))
        return serialize(entry) if entry else {"day": day.isoformat()}

@app.put("/api/daily")
def upsert_daily(payload: DailyIn):
    with Session(engine) as db:
        entry = db.scalar(select(DailyEntry).where(DailyEntry.day == payload.day))
        if not entry:
            entry = DailyEntry(day=payload.day)
            db.add(entry)
        for key, value in payload.model_dump().items():
            setattr(entry, key, value)
        db.commit()
        db.refresh(entry)
        return serialize(entry)

@app.get("/api/dashboard")
def dashboard(recent_days: int = Query(7, ge=1, le=60)):
    """Bundles everything the main dashboard needs in a single request:
    today's entry, yesterday's entry (source of today's Top 3 + recap) and
    a short recent-days strip for quickly jumping into past/other days."""
    day_today = date.today()
    day_yesterday = day_today - timedelta(days=1)
    start = day_today - timedelta(days=recent_days - 1)
    with Session(engine) as db:
        today_entry = db.scalar(select(DailyEntry).where(DailyEntry.day == day_today))
        yesterday_entry = db.scalar(select(DailyEntry).where(DailyEntry.day == day_yesterday))
        recent = db.scalars(select(DailyEntry).where(DailyEntry.day >= start).order_by(DailyEntry.day)).all()
    return {
        "today": serialize(today_entry) if today_entry else {"day": day_today.isoformat()},
        "yesterday": serialize(yesterday_entry) if yesterday_entry else None,
        "recent": [serialize(r) for r in recent],
    }

@app.get("/api/daily")
def list_daily(days: int = Query(90, ge=1, le=730)):
    start = date.today() - timedelta(days=days - 1)
    with Session(engine) as db:
        rows = db.scalars(select(DailyEntry).where(DailyEntry.day >= start).order_by(DailyEntry.day)).all()
        return [serialize(r) for r in rows]

@app.get("/api/goals")
def list_goals():
    with Session(engine) as db:
        return [serialize(x) for x in db.scalars(select(Goal).order_by(Goal.created_at.desc())).all()]

@app.post("/api/goals")
def create_goal(payload: GoalIn):
    with Session(engine) as db:
        goal = Goal(**payload.model_dump())
        db.add(goal); db.commit(); db.refresh(goal)
        return serialize(goal)

@app.get("/api/projects")
def list_projects():
    with Session(engine) as db:
        return [serialize(x) for x in db.scalars(select(Project).order_by(Project.created_at.desc())).all()]

@app.post("/api/projects")
def create_project(payload: ProjectIn):
    with Session(engine) as db:
        project = Project(**payload.model_dump())
        db.add(project); db.commit(); db.refresh(project)
        return serialize(project)

@app.get("/api/visions")
def list_visions():
    with Session(engine) as db:
        return [serialize(x) for x in db.scalars(select(Vision).order_by(Vision.horizon)).all()]

@app.put("/api/visions")
def save_vision(payload: VisionIn):
    with Session(engine) as db:
        vision = db.scalar(select(Vision).where(Vision.horizon == payload.horizon))
        if not vision:
            vision = Vision(horizon=payload.horizon)
            db.add(vision)
        vision.content = payload.content
        db.commit(); db.refresh(vision)
        return serialize(vision)

@app.get("/api/trackers")
def list_trackers():
    with Session(engine) as db:
        return [serialize(x) for x in db.scalars(select(Tracker).where(Tracker.active == True).order_by(Tracker.id)).all()]

@app.post("/api/trackers")
def create_tracker(payload: TrackerIn):
    with Session(engine) as db:
        tracker = Tracker(**payload.model_dump())
        db.add(tracker); db.commit(); db.refresh(tracker)
        return serialize(tracker)

@app.get("/api/journal")
def list_journal(limit: int = Query(50, ge=1, le=500)):
    with Session(engine) as db:
        return [serialize(x) for x in db.scalars(select(JournalEntry).order_by(JournalEntry.created_at.desc()).limit(limit)).all()]

@app.post("/api/journal")
def create_journal(payload: JournalIn):
    with Session(engine) as db:
        item = JournalEntry(**payload.model_dump())
        db.add(item); db.commit(); db.refresh(item)
        return serialize(item)

@app.get("/api/insights")
def insights(days: int = Query(30, ge=7, le=3650)):
    start = date.today() - timedelta(days=days - 1)
    with Session(engine) as db:
        rows = db.scalars(select(DailyEntry).where(DailyEntry.day >= start).order_by(DailyEntry.day)).all()
        def avg(field):
            vals = [getattr(r, field) for r in rows if getattr(r, field) is not None]
            return round(sum(vals) / len(vals), 2) if vals else None
        return {
            "days": len(rows),
            "mood_avg": avg("mood"), "rating_avg": avg("day_rating"), "productivity_avg": avg("productivity"),
            "sleep_avg": avg("sleep_hours"), "water_avg": avg("water_liters"), "stress_avg": avg("stress"), "energy_avg": avg("energy"),
            "running_days": sum(bool(r.running) for r in rows), "strength_days": sum(bool(r.strength_training) for r in rows),
            "reading_days": sum(bool(r.reading_30min) for r in rows), "customer_days": sum(bool(r.new_customer) for r in rows),
            "social_days": sum(bool(r.new_person) for r in rows),
        }

@app.get("/api/export")
def export_data():
    with Session(engine) as db:
        payload = {
            "exported_at": datetime.utcnow().isoformat(),
            "daily_entries": [serialize(x) for x in db.scalars(select(DailyEntry)).all()],
            "goals": [serialize(x) for x in db.scalars(select(Goal)).all()],
            "projects": [serialize(x) for x in db.scalars(select(Project)).all()],
            "visions": [serialize(x) for x in db.scalars(select(Vision)).all()],
            "trackers": [serialize(x) for x in db.scalars(select(Tracker)).all()],
            "journal": [serialize(x) for x in db.scalars(select(JournalEntry)).all()],
        }
    out = DATA_DIR / "bulletjournal-export.json"
    out.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    return FileResponse(out, media_type="application/json", filename="bulletjournal-export.json")

@app.get("/api/ollama/settings")
def get_ollama_settings():
    with Session(engine) as db:
        values = {x.key: x.value for x in db.scalars(select(Settings)).all()}
    return {
        "enabled": values.get("ollama_enabled", "false") == "true",
        "url": values.get("ollama_url", "http://127.0.0.1:11434"),
        "model": values.get("ollama_model", "llama3.2:3b"),
        "include_sensitive": values.get("ollama_include_sensitive", "false") == "true",
    }

@app.put("/api/ollama/settings")
def save_ollama_settings(payload: OllamaSettings):
    with Session(engine) as db:
        values = {
            "ollama_enabled": str(payload.enabled).lower(), "ollama_url": payload.url.rstrip("/"),
            "ollama_model": payload.model, "ollama_include_sensitive": str(payload.include_sensitive).lower()
        }
        for key, value in values.items():
            item = db.get(Settings, key)
            if not item: db.add(Settings(key=key, value=value))
            else: item.value = value
        db.commit()
    return payload.model_dump()

async def build_context(day: date, include_sensitive: bool = False) -> dict[str, Any]:
    with Session(engine) as db:
        entry = db.scalar(select(DailyEntry).where(DailyEntry.day == day))
        previous = db.scalars(select(DailyEntry).where(DailyEntry.day < day).order_by(DailyEntry.day.desc()).limit(30)).all()
        goals = db.scalars(select(Goal).where(Goal.active == True)).all()
        projects = db.scalars(select(Project).where(Project.status == "active")).all()
    if not entry:
        raise HTTPException(404, "No daily entry for this date")
    data = serialize(entry)
    if not include_sensitive:
        data["trade_note"] = None
    return {"today": data, "previous_30_days": [serialize(x) for x in previous], "goals": [serialize(x) for x in goals], "projects": [serialize(x) for x in projects]}

@app.post("/api/ollama/briefing/{day}")
async def ollama_briefing(day: date):
    settings = get_ollama_settings()
    if not settings["enabled"]:
        raise HTTPException(400, "Ollama is disabled")
    context = await build_context(day, settings["include_sensitive"])
    prompt = f"""Du bist der lokale Analyse-Assistent von BulletJournal. Erstelle einen kurzen Tagesbericht auf Deutsch. Trenne sauber zwischen Fakten, beobachteten Mustern und Hypothesen. Keine Diagnosen, keine medizinischen Behauptungen. Nutze nur die gelieferten Daten. Weise auf Unsicherheiten hin. Beziehe Ziele und Projekte ein und schlage maximal 3 konkrete Schritte für morgen vor.\n\nDATEN:\n{json.dumps(context, ensure_ascii=False, indent=2)}"""
    try:
        async with httpx.AsyncClient(timeout=90) as client:
            response = await client.post(f"{settings['url']}/api/generate", json={"model": settings["model"], "prompt": prompt, "stream": False})
            response.raise_for_status()
            result = response.json()
    except Exception as exc:
        raise HTTPException(502, f"Ollama request failed: {exc}")
    return {"model": settings["model"], "response": result.get("response", "")}

# Serve frontend in production when present.
DIST = BASE_DIR / "frontend" / "dist"
if DIST.exists():
    @app.get("/{path:path}")
    def frontend(path: str):
        candidate = DIST / path
        if candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(DIST / "index.html")
