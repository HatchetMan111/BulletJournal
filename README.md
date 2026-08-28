# BulletJournal – Dein persönliches Life-OS

Eine selbstgehostete, datenschutzfreundliche Bullet-Journal-Anwendung mit lokaler KI-Unterstützung durch Ollama. Alle Daten bleiben auf deinem Rechner.

---

## Installation (Proxmox / Debian / Ubuntu)

**One-Liner – einfach kopieren und ausführen:**

```bash
bash -c "$(wget -qLO - https://github.com/HatchetMan111/BulletJournal/raw/main/install.sh)"
```

Das installiert automatisch:
- Python 3 + FastAPI-Backend in einem venv
- Node.js + Frontend-Build (Vite/React -> statische Dateien)
- Systemd-Service (`bulletjournal.service`)
- Datenbank unter `/opt/bulletjournal/data/`

**Nach der Installation:**
- URL: `http://<DEINE-IP>:8000`
- Service: `systemctl status bulletjournal`
- Logs: `journalctl -u bulletjournal -f`
- Daten-Export: `http://<DEINE-IP>:8000/api/export`

**Optional – Ollama für KI-Briefing:**
```bash
curl -fsSL https://ollama.com/install.sh | sh
ollama pull llama3.2:3b
```

---

## Features

### Tägliches Journaling
- **Mood-Tracking** (1–6 Emoji-Skala)
- **Tagesrating, Produktivität, Energie, Stress** (je 1–10)
- **Schlaf & Wasseraufnahme** protookollieren
- **Daily Check**: Laufen, Krafttraining, Lesen, Selbst kochen, Neue Menschen, Neuer Kunde

### Reflexion & Dankbarkeit
- Highlight, Erfolg, Arbeit, Lustiges, Gelernt, Dankbarkeit, Weisheit
- Zukunftsfelder: Was habe ich heute für mein zukünftiges Leben getan?
- **Morgen · Top 3**: Plane abends die 3 wichtigsten Aufgaben für morgen

### Ziele & Projekte
- **Ziele** mit Horizon (1 Jahr / 5 Jahre / 10 Jahre) und Fortschritt
- **Projekte** mit nächster Aktion und Status
- **Vision**: 10-Jahres-, 5-Jahres- und Jahresvision als Text

### Auswertung & Trends
- **KPI-Dashboard**: Stimmung, Schlaf, Laufen, Lesen, Schreiben im Vergleich
- **Trend-Diagramme** nach Tag, Monat oder Jahr
- **Zieltreue-Tracker**: Gewohnheiten über 4 Wochen visualisieren
- **30-Tage-Baseline**: Durchschnittswerte für alle Kennzahlen

### Ollama-KI-Briefing
- Lokale KI (z. B. `llama3.2:3b`) erstellt ein Tagesbriefing
- Vergleicht dich mit deiner eigenen Basislinie
- Formuliert **Hypothesen statt Diagnosen**
- Sensible Daten können optional ein- oder ausgeschaltet werden

### Daten & Export
- **JSON-Export** aller Daten über die API
- **SQLite-Datenbank** lokal gespeichert
- Automatisches Schema-Migration bei Updates

---

## Stack

| Komponente | Technologie |
|---|---|
| Backend | Python 3.11+ / FastAPI / SQLAlchemy / SQLite |
| Frontend | React 18 / JSX / Lucide Icons |
| Styling | CSS (kein Framework) |
| KI | Ollama (optional) |

---

## Schnellstart

### 1. Backend starten

```bash
pip install fastapi uvicorn sqlalchemy httpx pydantic
cd BulletJournalClaudeVerbessert
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

Die API ist dann unter `http://localhost:8000` erreichbar.

### 2. Frontend

Das Frontend liegt unter `frontend/` (Vite + React). Entwicklung:

```bash
cd frontend
npm install
npm run dev        # Dev-Server auf http://localhost:5173 (Proxy /api -> :8000)
```

Produktions-Build:

```bash
cd frontend
npm run build      # erstellt frontend/dist/ – wird vom Backend ausgeliefert
```

### 3. Ollama (optional)

```bash
# Ollama installieren und Modell laden
ollama pull llama3.2:3b
```

In den Einstellungen der App Ollama aktivieren und URL/Modell konfigurieren.

---

## API-Endpunkte

| Methode | Pfad | Beschreibung |
|---|---|---|
| `GET` | `/api/health` | Gesundheitscheck |
| `GET` | `/api/meta` | Lebensbereiche & heute |
| `GET` | `/api/dashboard` | Dashboard-Daten (heute, gestern, letzte 7 Tage) |
| `GET` | `/api/daily/{day}` | Tageseintrag lesen |
| `PUT` | `/api/daily` | Tageseintrag schreiben (Tag im Body) |
| `GET` | `/api/daily?days=90` | Letzte X Tage auflisten |
| `GET` | `/api/insights?days=30` | Statistiken & Trends |
| `GET/POST` | `/api/goals` | Ziele verwalten |
| `GET/POST` | `/api/projects` | Projekte verwalten |
| `GET/PUT` | `/api/visions` | Visionen (10y/5y/1y) |
| `GET/POST` | `/api/trackers` | Tracker verwalten |
| `GET/POST` | `/api/journal` | Journal-Einträge |
| `GET` | `/api/export` | Daten als JSON exportieren |
| `PUT` | `/api/ollama/settings` | Ollama-Einstellungen |
| `POST` | `/api/ollama/briefing/{day}` | KI-Tagesbriefing |

---

## Datenmodell

### Lebensbereiche
- Körper & Gesundheit
- Mental & Emotionen
- Familie & Freunde
- Liebe & Intimität
- Sicherheit
- Arbeit & Business
- Lernen & Entwicklung
- Inspiration & Kreativität
- Umgebung & Lebensqualität
- Sinn, Werte & Vision

---

## License

MIT
