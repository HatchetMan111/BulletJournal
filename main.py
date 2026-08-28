from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Any
import hashlib
import hmac
import json
import os
import secrets
import time

import httpx
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, RedirectResponse
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import Boolean, Date, DateTime, Float, Integer, String, Text, create_engine, inspect, select, text
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column

BASE_DIR = Path(__file__).resolve().parent
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

class MatrixItem(Base):
    """Eisenhower-Matrix: Ziele, Projekte und To-dos nach
    wichtig/dringend in 4 Quadranten einsortieren (1-4)."""
    __tablename__ = "matrix_items"
    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    note: Mapped[str | None] = mapped_column(Text)
    quadrant: Mapped[int] = mapped_column(Integer, default=2)
    kind: Mapped[str] = mapped_column(String(20), default="todo")
    done: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class CheckItem(Base):
    """Eigene Daily-Check-Punkte, die der Nutzer selbst anlegt."""
    __tablename__ = "check_items"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120))
    icon: Mapped[str] = mapped_column(String(16), default="✓")
    active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

class DailyCheckDone(Base):
    """Abgehakte eigene Check-Punkte pro Tag."""
    __tablename__ = "daily_checks_done"
    id: Mapped[int] = mapped_column(primary_key=True)
    day: Mapped[date] = mapped_column(Date, index=True)
    check_id: Mapped[int] = mapped_column(Integer, index=True)
    done: Mapped[bool] = mapped_column(Boolean, default=True)

class DailyProgress(Base):
    """Tagesweise Fortschritte an Zielen und Projekten (in Prozent)."""
    __tablename__ = "daily_progress"
    id: Mapped[int] = mapped_column(primary_key=True)
    day: Mapped[date] = mapped_column(Date, index=True)
    kind: Mapped[str] = mapped_column(String(10))  # goal | project
    ref_id: Mapped[int] = mapped_column(Integer, index=True)
    percent: Mapped[int] = mapped_column(Integer, default=0)

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

# ── Optionaler Passwortschutz (BULLETJOURNAL_PASSWORD) ──────────────
# Quelle 1: Environment-Variable, Quelle 2: Datei data/app.password
PASSWORD = os.getenv("BULLETJOURNAL_PASSWORD", "").strip()
_PW_FILE = DATA_DIR / "app.password"
if not PASSWORD and _PW_FILE.exists():
    PASSWORD = _PW_FILE.read_text().strip()

LOGIN_HTML = """<!DOCTYPE html>
<html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>BulletJournal – Anmeldung</title>
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📓</text></svg>">
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#111827;font-family:Inter,system-ui,sans-serif;color:#e5e7eb}
.card{background:#1f2937;border:1px solid #374151;border-radius:18px;padding:34px 30px;width:min(92vw,360px);text-align:center}
.logo{width:52px;height:52px;border-radius:14px;background:#f4f1e8;color:#111827;display:grid;place-items:center;font-weight:800;font-size:20px;margin:0 auto 14px}
h1{font-size:19px;margin:0 0 4px}p{color:#9ca3af;font-size:13px;margin:0 0 20px}
input{width:100%;padding:12px 14px;border-radius:11px;border:1px solid #374151;background:#111827;color:#e5e7eb;font-size:15px;margin-bottom:12px}
button{width:100%;padding:12px;border:0;border-radius:11px;background:#f4f1e8;color:#111827;font-weight:800;font-size:15px;cursor:pointer}
button:hover{background:#fff}
.err{color:#f87171;font-size:13px;min-height:18px;margin-top:10px}
</style></head><body>
<div class="card"><div class="logo">BJ</div><h1>BulletJournal</h1><p>Bitte mit Passwort anmelden</p>
<input type="password" id="pw" placeholder="Passwort" autofocus>
<button onclick="go()">Anmelden</button><div class="err" id="err"></div></div>
<script>
const pw=document.getElementById('pw'),err=document.getElementById('err');
function go(){fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:pw.value})})
.then(r=>{if(r.ok)location='/';else{err.textContent='Falsches Passwort';pw.value='';pw.focus();}}).catch(()=>err.textContent='Server nicht erreichbar');}
pw.addEventListener('keydown',e=>{if(e.key==='Enter')go();});
</script></body></html>"""

if PASSWORD:
    _SECRET_FILE = DATA_DIR / "session.secret"
    if not _SECRET_FILE.exists():
        _SECRET_FILE.write_text(secrets.token_hex(32))
    _SECRET = _SECRET_FILE.read_text().strip()

    def _make_token() -> str:
        exp = int(time.time()) + 60 * 60 * 24 * 30
        sig = hmac.new(_SECRET.encode(), f"bj:{exp}:{PASSWORD}".encode(), hashlib.sha256).hexdigest()
        return f"{exp}.{sig}"

    def _valid_session(token: str | None) -> bool:
        try:
            exp, sig = token.split(".", 1)
            if int(exp) < time.time():
                return False
            expected = hmac.new(_SECRET.encode(), f"bj:{exp}:{PASSWORD}".encode(), hashlib.sha256).hexdigest()
            return hmac.compare_digest(sig, expected)
        except Exception:
            return False

    @app.middleware("http")
    async def auth_middleware(request, call_next):
        path = request.url.path
        if path in ("/login", "/logout", "/api/login", "/api/health"):
            return await call_next(request)
        if _valid_session(request.cookies.get("bj_session")):
            return await call_next(request)
        if path.startswith("/api/"):
            return JSONResponse({"detail": "Nicht angemeldet"}, status_code=401)
        return RedirectResponse("/login", status_code=302)

    class LoginIn(BaseModel):
        password: str

    @app.get("/login")
    def login_page():
        return HTMLResponse(LOGIN_HTML)

    @app.post("/api/login")
    def login(payload: LoginIn):
        if not hmac.compare_digest(payload.password.encode(), PASSWORD.encode()):
            time.sleep(0.5)
            raise HTTPException(401, "Falsches Passwort")
        response = JSONResponse({"ok": True})
        response.set_cookie("bj_session", _make_token(), httponly=True, samesite="lax", max_age=60 * 60 * 24 * 30, path="/")
        return response

    @app.get("/logout")
    def logout():
        response = RedirectResponse("/login", status_code=302)
        response.delete_cookie("bj_session", path="/")
        return response

AREAS = [
    ("health", "Körper & Gesundheit"), ("mental", "Mental & Emotionen"), ("social", "Familie & Freunde"),
    ("intimacy", "Liebe & Intimität"), ("safety", "Sicherheit"), ("work", "Arbeit & Business"),
    ("learning", "Lernen & Entwicklung"), ("inspiration", "Inspiration & Kreativität"),
    ("environment", "Umgebung & Lebensqualität"), ("meaning", "Sinn, Werte & Vision"),
]

def _parse_number(v: Any) -> float | None:
    """Tolerant parsen: '' -> None, '7,5' -> 7.5, Muell -> None."""
    if v is None:
        return None
    if isinstance(v, str):
        v = v.strip().replace(",", ".")
        if v == "":
            return None
        try:
            v = float(v)
        except ValueError:
            return None
    return float(v)


_INT_BOUNDS = {"mood": (1, 6), "productivity": (1, 10), "day_rating": (1, 10), "stress": (1, 10), "energy": (1, 10)}
_FLOAT_FIELDS = ("sleep_hours", "water_liters", "protein_grams", "money_saved", "money_earned", "expenses")
_FLOAT_BOUNDS = {"sleep_hours": (0, 24), "water_liters": (0, 20)}

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

    @field_validator(*_INT_BOUNDS.keys(), mode="before")
    @classmethod
    def _lenient_int(cls, v: Any, info: Any) -> int | None:
        v = _parse_number(v)
        if v is None:
            return None
        lo, hi = _INT_BOUNDS[info.field_name]
        return max(lo, min(hi, int(round(v))))

    @field_validator(*_FLOAT_FIELDS, mode="before")
    @classmethod
    def _lenient_float(cls, v: Any, info: Any) -> float | None:
        v = _parse_number(v)
        if v is None:
            return None
        bounds = _FLOAT_BOUNDS.get(info.field_name)
        if bounds:
            lo, hi = bounds
            v = max(lo, min(hi, v))
        return v

class GoalIn(BaseModel):
    title: str
    description: str | None = None
    horizon: str = "1y"
    area: str = "meaning"
    year: int | None = None
    progress: int = Field(default=0, ge=0, le=100)

class GoalUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    horizon: str | None = None
    area: str | None = None
    year: int | None = None
    progress: int | None = Field(default=None, ge=0, le=100)
    active: bool | None = None

    @field_validator("progress", mode="before")
    @classmethod
    def _clamp_progress(cls, v: Any) -> int | None:
        v = _parse_number(v)
        return None if v is None else max(0, min(100, int(round(v))))

class ProjectIn(BaseModel):
    title: str
    description: str | None = None
    area: str = "work"
    progress: int = Field(default=0, ge=0, le=100)
    next_action: str | None = None
    status: str = "active"

class ProjectUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    area: str | None = None
    progress: int | None = Field(default=None, ge=0, le=100)
    next_action: str | None = None
    status: str | None = None

    @field_validator("progress", mode="before")
    @classmethod
    def _clamp_progress(cls, v: Any) -> int | None:
        v = _parse_number(v)
        return None if v is None else max(0, min(100, int(round(v))))

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

class MatrixIn(BaseModel):
    title: str
    note: str | None = None
    quadrant: int = Field(default=2, ge=1, le=4)
    kind: str = "todo"

class MatrixUpdate(BaseModel):
    title: str | None = None
    note: str | None = None
    quadrant: int | None = Field(default=None, ge=1, le=4)
    done: bool | None = None

    @field_validator("quadrant", mode="before")
    @classmethod
    def _clamp_quadrant(cls, v: Any) -> int | None:
        v = _parse_number(v)
        return None if v is None else max(1, min(4, int(round(v))))

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
    # auth-Flag ist bewusst oeffentlich: so sieht man sofort, ob Schutz aktiv ist
    return {"status": "ok", "app": "BulletJournal", "version": app.version, "auth": bool(PASSWORD)}

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
        custom_total = len(db.scalars(select(CheckItem).where(CheckItem.active == True)).all())
        done_custom = 0
        if yesterday_entry:
            done_custom = len(db.scalars(select(DailyCheckDone).where(DailyCheckDone.day == day_yesterday, DailyCheckDone.done == True)).all())
    done_fixed = 0
    if yesterday_entry:
        done_fixed = sum(bool(getattr(yesterday_entry, f)) for f in ("running", "strength_training", "reading_30min", "self_cooked", "new_person", "new_customer"))
    return {
        "today": serialize(today_entry) if today_entry else {"day": day_today.isoformat()},
        "yesterday": serialize(yesterday_entry) if yesterday_entry else None,
        "recent": [serialize(r) for r in recent],
        "checks_yesterday": {"done": done_fixed + done_custom, "total": 6 + custom_total},
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

@app.put("/api/goals/{item_id}")
def update_goal(item_id: int, payload: GoalUpdate):
    with Session(engine) as db:
        goal = db.get(Goal, item_id)
        if not goal:
            raise HTTPException(404, "Goal not found")
        for key, value in payload.model_dump(exclude_unset=True).items():
            setattr(goal, key, value)
        db.commit(); db.refresh(goal)
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

@app.put("/api/projects/{item_id}")
def update_project(item_id: int, payload: ProjectUpdate):
    with Session(engine) as db:
        project = db.get(Project, item_id)
        if not project:
            raise HTTPException(404, "Project not found")
        for key, value in payload.model_dump(exclude_unset=True).items():
            setattr(project, key, value)
        db.commit(); db.refresh(project)
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

@app.get("/api/matrix")
def list_matrix():
    with Session(engine) as db:
        rows = db.scalars(select(MatrixItem).order_by(MatrixItem.quadrant, MatrixItem.created_at.desc())).all()
        return [serialize(x) for x in rows]

@app.post("/api/matrix")
def create_matrix_item(payload: MatrixIn):
    with Session(engine) as db:
        item = MatrixItem(**payload.model_dump())
        db.add(item); db.commit(); db.refresh(item)
        return serialize(item)

@app.put("/api/matrix/{item_id}")
def update_matrix_item(item_id: int, payload: MatrixUpdate):
    with Session(engine) as db:
        item = db.get(MatrixItem, item_id)
        if not item:
            raise HTTPException(404, "Matrix item not found")
        for key, value in payload.model_dump(exclude_unset=True).items():
            setattr(item, key, value)
        db.commit(); db.refresh(item)
        return serialize(item)

@app.delete("/api/matrix/{item_id}")
def delete_matrix_item(item_id: int):
    with Session(engine) as db:
        item = db.get(MatrixItem, item_id)
        if not item:
            raise HTTPException(404, "Matrix item not found")
        db.delete(item); db.commit()
    return {"deleted": item_id}

class CheckIn(BaseModel):
    name: str
    icon: str = "✓"

class CheckToggleIn(BaseModel):
    check_id: int
    done: bool

@app.get("/api/checks")
def list_checks():
    with Session(engine) as db:
        rows = db.scalars(select(CheckItem).where(CheckItem.active == True).order_by(CheckItem.id)).all()
        return [serialize(x) for x in rows]

@app.post("/api/checks")
def create_check(payload: CheckIn):
    with Session(engine) as db:
        item = CheckItem(name=payload.name.strip()[:120], icon=payload.icon.strip()[:4] or "✓")
        db.add(item); db.commit(); db.refresh(item)
        return serialize(item)

@app.delete("/api/checks/{item_id}")
def delete_check(item_id: int):
    with Session(engine) as db:
        item = db.get(CheckItem, item_id)
        if not item:
            raise HTTPException(404, "Check not found")
        item.active = False
        db.commit()
    return {"deleted": item_id}

@app.get("/api/checks/{day}")
def checks_for_day(day: date):
    with Session(engine) as db:
        rows = db.scalars(select(DailyCheckDone).where(DailyCheckDone.day == day, DailyCheckDone.done == True)).all()
        return {"done": [r.check_id for r in rows]}

@app.put("/api/checks/{day}")
def toggle_check(day: date, payload: CheckToggleIn):
    with Session(engine) as db:
        row = db.scalar(select(DailyCheckDone).where(DailyCheckDone.day == day, DailyCheckDone.check_id == payload.check_id))
        if not row:
            row = DailyCheckDone(day=day, check_id=payload.check_id, done=payload.done)
            db.add(row)
        else:
            row.done = payload.done
        db.commit()
    return {"day": day.isoformat(), "check_id": payload.check_id, "done": payload.done}

class ProgressItemIn(BaseModel):
    kind: str  # goal | project
    ref_id: int
    percent: int = Field(default=0, ge=0, le=100)

    @field_validator("percent", mode="before")
    @classmethod
    def _clamp_percent(cls, v: Any) -> int:
        v = _parse_number(v)
        return 0 if v is None else max(0, min(100, int(round(v))))

@app.get("/api/progress/{day}")
def get_day_progress(day: date):
    with Session(engine) as db:
        rows = db.scalars(select(DailyProgress).where(DailyProgress.day == day)).all()
        return [{"kind": r.kind, "ref_id": r.ref_id, "percent": r.percent} for r in rows]

@app.put("/api/progress/{day}")
def set_day_progress(day: date, items: list[ProgressItemIn]):
    """Setzt den an einem Tag erreichten Stand von Zielen/Projekten:
     1) ersetzt die Tages-Eintraege, 2) uebernimmt den Stand ins Ziel/Projekt."""
    with Session(engine) as db:
        for old in db.scalars(select(DailyProgress).where(DailyProgress.day == day)).all():
            db.delete(old)
        saved = 0
        for it in items:
            if it.kind == "goal":
                ent = db.get(Goal, it.ref_id)
            elif it.kind == "project":
                ent = db.get(Project, it.ref_id)
            else:
                continue
            if not ent:
                continue
            ent.progress = it.percent
            db.add(DailyProgress(day=day, kind=it.kind, ref_id=it.ref_id, percent=it.percent))
            saved += 1
        db.commit()
    return {"day": day.isoformat(), "saved": saved}

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

@app.get("/api/ollama/models")
async def list_ollama_models():
    """Lists the models actually loaded on the Ollama server so that one
    can be selected in the UI instead of typing a name blindly."""
    settings = get_ollama_settings()
    try:
        async with httpx.AsyncClient(timeout=8) as client:
            response = await client.get(f"{settings['url']}/api/tags")
            response.raise_for_status()
            data = response.json()
    except Exception as exc:
        raise HTTPException(502, f"Ollama nicht erreichbar unter {settings['url']}: {exc}")
    return {"url": settings["url"], "models": sorted(m.get("name", "") for m in data.get("models", []) if m.get("name"))}

class ModelCheckIn(BaseModel):
    model: str | None = None

@app.post("/api/ollama/check-model")
async def check_ollama_model(payload: ModelCheckIn):
    """Testet ein Modell mit einer Mini-Anfrage, damit veraltete/nicht
    geladene Modelle sofort auffallen (z.B. 'was retired ...')."""
    settings = get_ollama_settings()
    model = (payload.model or settings["model"]).strip()
    try:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                f"{settings['url']}/api/generate",
                json={"model": model, "prompt": "Antworte nur mit: OK", "stream": False, "options": {"num_predict": 8}},
            )
            if response.status_code != 200:
                return {"ok": False, "model": model, "status": response.status_code, "detail": response.text[:400]}
            return {"ok": True, "model": model, "response": (response.json().get("response") or "")[:80]}
    except Exception as exc:
        return {"ok": False, "model": model, "detail": str(exc)[:400]}

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
            if response.status_code != 200:
                detail = response.text[:300] or "keine Details"
                raise HTTPException(502, f"Ollama-Fehler {response.status_code} fuer Modell '{settings['model']}': {detail}")
            result = response.json()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(502, f"Ollama request failed: {exc}")
    return {"model": settings["model"], "response": result.get("response", "")}

# Serve frontend in production when present.
DIST = BASE_DIR / "frontend" / "dist"
if DIST.exists():
    _DIST_ROOT = DIST.resolve()

    @app.get("/{path:path}")
    def frontend(path: str):
        if path.startswith("api/"):
            raise HTTPException(404, "Not found")
        candidate = (DIST / path).resolve()
        if candidate.is_file() and candidate.is_relative_to(_DIST_ROOT):
            return FileResponse(candidate)
        return FileResponse(DIST / "index.html")
