import React, {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {
  Activity, BookOpen, Brain, Calendar, Check, ChevronDown, ChevronRight, CirclePlus,
  Compass, Dumbbell, Droplets, Home, ListTodo, Moon, Save, Sparkles,
  Target, TrendingUp, Wallet, X
} from 'lucide-react';
import './styles.css';

const API = '/api';

// ---- date helpers -----------------------------------------------------
function fmtISO(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
const today = fmtISO(new Date());
function addDays(dayStr, n) { const d = new Date(dayStr + 'T12:00:00'); d.setDate(d.getDate() + n); return fmtISO(d); }
function num(v) { return v === '' ? null : Number(v); }
function formatDate(v) { return new Date(v + 'T12:00:00').toLocaleDateString('de-DE', {day: '2-digit', month: 'long', year: 'numeric'}); }
function formatShort(v) { return new Date(v + 'T12:00:00').toLocaleDateString('de-DE', {day: '2-digit', month: '2-digit'}); }

const moods = ['😞', '😕', '😐', '🙂', '😄', '🤩'];
const nav = [
  ['today', 'Heute', Home], ['journal', 'Journal', BookOpen], ['goals', 'Ziele', Target],
  ['projects', 'Projekte', ListTodo], ['vision', 'Vision', Compass], ['analytics', 'Auswertung', Activity],
  ['insights', 'Trends', TrendingUp], ['settings', 'Einstellungen', Sparkles]
];

async function api(path, opts = {}) {
  const r = await fetch(API + path, {headers: {'Content-Type': 'application/json', ...(opts.headers || {})}, ...opts});
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}

// ---- small building blocks --------------------------------------------
function Card({children, className = ''}) { return <section className={'card ' + className}>{children}</section>; }
function Field({label, children}) { return <label className="field"><span>{label}</span>{children}</label>; }
function Toggle({label, value, onChange}) {
  return <button type="button" className={'toggle ' + (value ? 'on' : '')} onClick={() => onChange(!value)}>
    <span>{value ? '✓' : '○'}</span>{label}
  </button>;
}

// =========================================================================
// App
// =========================================================================
function App() {
  const [page, setPage] = useState('today');
  const [entry, setEntry] = useState({day: today});
  const [yesterdayEntry, setYesterdayEntry] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loadingDashboard, setLoadingDashboard] = useState(true);
  const [saved, setSaved] = useState(false);
  const [insights, setInsights] = useState(null);
  const [toast, setToast] = useState('');
  const [editorDay, setEditorDay] = useState(null); // date string when the day-editor modal is open

  const loadDashboard = () => {
    setLoadingDashboard(true);
    return api('/dashboard?recent_days=7')
      .then(d => { setEntry(d.today); setYesterdayEntry(d.yesterday); setRecent(d.recent); })
      .catch(() => {})
      .finally(() => setLoadingDashboard(false));
  };

  useEffect(() => { loadDashboard(); }, []);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(''), 2500); return () => clearTimeout(t); } }, [toast]);
  useEffect(() => { if (page === 'insights') loadInsights(); }, [page]);

  const update = (k, v) => setEntry(e => ({...e, [k]: v}));

  const save = async () => {
    await api('/daily', {method: 'PUT', body: JSON.stringify(entry)});
    setSaved(true);
    setToast('Tag gespeichert');
    setTimeout(() => setSaved(false), 1500);
    loadDashboard();
  };

  const loadInsights = () => api('/insights?days=30').then(setInsights);

  const toggleTop3Done = async (n) => {
    if (!yesterdayEntry) return;
    const key = 'tomorrow_' + n + '_done';
    const previous = yesterdayEntry;
    const updated = {...yesterdayEntry, [key]: !yesterdayEntry[key]};
    setYesterdayEntry(updated);
    try {
      await api('/daily', {method: 'PUT', body: JSON.stringify(updated)});
    } catch (e) {
      setYesterdayEntry(previous);
      setToast('Konnte nicht gespeichert werden');
    }
  };

  const openEditor = (day) => setEditorDay(day);
  const closeEditor = () => setEditorDay(null);
  const onEditorSaved = () => { closeEditor(); setToast('Tag gespeichert'); loadDashboard(); };

  return <div className="app">
    <aside className="sidebar">
      <div className="brand"><div className="logo">BJ</div><div><b>BulletJournal</b><small>Life OS</small></div></div>
      {nav.map(([id, label, Icon]) => <button key={id} className={page === id ? 'nav active' : 'nav'} onClick={() => setPage(id)}><Icon size={19}/>{label}</button>)}
      <div className="sidebar-foot">lokal · privat · PWA</div>
    </aside>
    <main>
      <header>
        <div><span className="eyebrow">{new Date().toLocaleDateString('de-DE', {weekday: 'long'})}</span><h1>{pageTitle(page)}</h1></div>
        <div className="header-actions">
          <button className="primary newday-btn" onClick={() => openEditor(today)}><CirclePlus size={18}/> Neuer Tag</button>
          <button className="iconbtn" onClick={() => setPage('settings')}><Sparkles size={18}/></button>
        </div>
      </header>
      {page === 'today' && <Today entry={entry} update={update} save={save} saved={saved} setPage={setPage}
        yesterdayEntry={yesterdayEntry} onToggleTop3={toggleTop3Done} recent={recent}
        loading={loadingDashboard} onOpenEditor={openEditor}/>}
      {page === 'journal' && <Journal/>}
      {page === 'goals' && <Goals/>}
      {page === 'projects' && <Projects/>}
      {page === 'vision' && <Vision/>}
      {page === 'analytics' && <Analytics/>}
      {page === 'insights' && <Insights data={insights}/>}
      {page === 'settings' && <Settings/>}
    </main>
    <nav className="bottom-nav">{nav.slice(0, 5).map(([id, label, Icon]) => <button key={id} className={page === id ? 'active' : ''} onClick={() => setPage(id)}><Icon size={18}/><small>{label}</small></button>)}</nav>
    {toast && <div className="toast">{toast}</div>}
    {editorDay && <DayEditorModal initialDay={editorDay} onClose={closeEditor} onSaved={onEditorSaved}/>}
  </div>;
}

function pageTitle(page) {
  return ({today: 'Heute', journal: 'Journal', goals: 'Ziele', projects: 'Projekte', vision: 'Vision', analytics: 'Auswertung', insights: 'Trends', settings: 'Einstellungen'})[page];
}

// =========================================================================
// Today dashboard
// =========================================================================
function Today({entry, update, save, setPage, saved, yesterdayEntry, onToggleTop3, recent, loading, onOpenEditor}) {
  return <div className="content-grid">
    <div className="main-col">
      <DayStrip recent={recent} onPick={onOpenEditor}/>
      <TopPriorities yesterday={yesterdayEntry} onToggle={onToggleTop3} loading={loading}/>
      <YesterdayRecap yesterday={yesterdayEntry} loading={loading}/>

      <Card className="hero">
        <div className="hero-top"><div><span className="muted">{formatDate(entry.day || today)}</span><h2>Wie geht es dir?</h2></div><div className="hero-emoji">{moods[(entry.mood || 4) - 1] || '🙂'}</div></div>
        <div className="mood-row">{moods.map((m, i) => <button key={m} className={entry.mood === i + 1 ? 'mood selected' : 'mood'} onClick={() => update('mood', i + 1)}>{m}</button>)}</div>
        <div className="quick-stats">
          <Field label="Tagesrating"><input type="number" min="1" max="10" value={entry.day_rating || ''} onChange={e => update('day_rating', num(e.target.value))}/></Field>
          <Field label="Produktivität"><input type="number" min="1" max="10" value={entry.productivity || ''} onChange={e => update('productivity', num(e.target.value))}/></Field>
          <Field label="Schlaf (h)"><input type="number" step="0.1" value={entry.sleep_hours || ''} onChange={e => update('sleep_hours', num(e.target.value))}/></Field>
          <Field label="Wasser (L)"><input type="number" step="0.1" value={entry.water_liters || ''} onChange={e => update('water_liters', num(e.target.value))}/></Field>
        </div>
      </Card>

      <Card>
        <div className="card-head"><h3>Daily Check</h3><span className="muted">kleine Dinge, große Wirkung</span></div>
        <div className="checks">
          <Toggle label="🏃 Laufen" value={!!entry.running} onChange={v => update('running', v)}/>
          <Toggle label="🏋️ Krafttraining" value={!!entry.strength_training} onChange={v => update('strength_training', v)}/>
          <Toggle label="📖 30 min gelesen" value={!!entry.reading_30min} onChange={v => update('reading_30min', v)}/>
          <Toggle label="🍳 Selbst gekocht" value={!!entry.self_cooked} onChange={v => update('self_cooked', v)}/>
          <Toggle label="👤 Neues kennengelernt" value={!!entry.new_person} onChange={v => update('new_person', v)}/>
          <Toggle label="💼 Neuer Kunde" value={!!entry.new_customer} onChange={v => update('new_customer', v)}/>
        </div>
      </Card>

      <Card>
        <div className="card-head"><h3>Was ist heute passiert?</h3><span className="muted">kurz & ehrlich</span></div>
        <div className="text-grid">
          <Field label="🌟 Highlight"><textarea value={entry.highlight || ''} onChange={e => update('highlight', e.target.value)}/></Field>
          <Field label="🏆 Erfolg"><textarea value={entry.success || ''} onChange={e => update('success', e.target.value)}/></Field>
          <Field label="💼 Arbeit"><textarea value={entry.work_note || ''} onChange={e => update('work_note', e.target.value)}/></Field>
          <Field label="😂 Etwas Lustiges"><textarea value={entry.funny || ''} onChange={e => update('funny', e.target.value)}/></Field>
          <Field label="📚 Heute gelernt"><textarea value={entry.learned || ''} onChange={e => update('learned', e.target.value)}/></Field>
          <Field label="🙏 Dankbarkeit"><textarea value={entry.gratitude || ''} onChange={e => update('gratitude', e.target.value)}/></Field>
        </div>
      </Card>

      <Card>
        <div className="card-head"><h3>Für meine Zukunft</h3><span className="muted">Vision → heute</span></div>
        <Field label="Was habe ich heute für mein zukünftiges Leben getan?"><textarea value={entry.future_action || ''} onChange={e => update('future_action', e.target.value)} placeholder="Ein kleiner Schritt reicht …"/></Field>
        <Field label="🧠 Weisheit"><textarea value={entry.wisdom || ''} onChange={e => update('wisdom', e.target.value)}/></Field>
      </Card>

      <Card>
        <div className="card-head"><h3>Morgen · Top 3</h3><span className="muted">nur das, was wirklich zählt</span></div>
        <div className="top3">{[1, 2, 3].map(n => <Field key={n} label={'0' + n}><input value={entry['tomorrow_' + n] || ''} onChange={e => update('tomorrow_' + n, e.target.value)} placeholder="Wichtigste Aufgabe …"/></Field>)}</div>
      </Card>
    </div>

    <aside className="side-col">
      <Card className="focus">
        <div className="eyebrow">LANGFRISTIGER FOKUS</div>
        <h3>Was möchtest du in 10 Jahren über dein Leben sagen?</h3>
        <p className="muted">Deine Vision soll dich heute erreichen – nicht erst irgendwann.</p>
        <button className="primary ghost" onClick={() => setPage('vision')}>Vision ansehen <ChevronRight size={16}/></button>
      </Card>
      <Card>
        <div className="card-head"><h3>Heute für mich</h3><Sparkles size={18}/></div>
        <div className="mini-list">
          <div><Moon/> Schlaf <b>{entry.sleep_hours || '–'} h</b></div>
          <div><Droplets/> Wasser <b>{entry.water_liters || '–'} L</b></div>
          <div><Activity/> Energie <b>{entry.energy || '–'}/10</b></div>
          <div><Brain/> Stress <b>{entry.stress || '–'}/10</b></div>
        </div>
      </Card>
      <Card>
        <div className="card-head"><h3>KI Briefing</h3><Sparkles size={18}/></div>
        <p className="muted">Optionales lokales Ollama – Muster statt Diagnosen.</p>
        <button className="primary" onClick={() => setPage('settings')}>Ollama konfigurieren</button>
      </Card>
      <button className="save" onClick={save}><Save size={18}/>{saved ? 'Gespeichert' : 'Tag speichern'}</button>
    </aside>
  </div>;
}

// ---- Day strip: quick picker for the last 7 days -----------------------
function DayStrip({recent, onPick}) {
  const byDay = Object.fromEntries((recent || []).map(e => [e.day, e]));
  const days = [...Array(7)].map((_, i) => addDays(today, -6 + i));
  return <Card className="day-strip-card">
    <div className="card-head"><h3>Letzte 7 Tage</h3><span className="muted">antippen zum Bearbeiten</span></div>
    <div className="day-strip">
      {days.map(d => {
        const e = byDay[d];
        return <button key={d} className={'day-chip' + (d === today ? ' is-today' : '') + (e ? ' has-data' : '')} onClick={() => onPick(d)}>
          <small>{new Date(d + 'T12:00:00').toLocaleDateString('de-DE', {weekday: 'short'})}</small>
          <span className="chip-num">{formatShort(d)}</span>
          <span className="chip-mood">{e && e.mood ? moods[e.mood - 1] : '·'}</span>
        </button>;
      })}
    </div>
  </Card>;
}

// ---- Top 3 priorities: planned yesterday for today ----------------------
function TopPriorities({yesterday: y, onToggle, loading}) {
  const items = y ? [1, 2, 3].map(n => ({n, text: y['tomorrow_' + n], done: !!y['tomorrow_' + n + '_done']})).filter(it => (it.text || '').trim()) : [];
  const doneCount = items.filter(it => it.done).length;
  return <Card className="top-priorities">
    <div className="card-head">
      <h3>🎯 Deine Top 3 heute</h3>
      {items.length > 0 && <span className="muted">{doneCount}/{items.length} erledigt</span>}
    </div>
    {loading ? <div className="empty-inline">Lädt …</div>
      : items.length === 0
        ? <div className="empty-inline">Für heute wurden noch keine Top 3 geplant. Trage sie am Abend zuvor unter „Morgen · Top 3" ein.</div>
        : <div className="priority-list">
          {items.map(it => <button key={it.n} type="button" className={'priority-item' + (it.done ? ' done' : '')} onClick={() => onToggle(it.n)}>
            <span className="priority-check">{it.done ? <Check size={14}/> : null}</span>
            <span className="priority-text">{it.text}</span>
          </button>)}
        </div>}
  </Card>;
}

// ---- Yesterday recap: how the previous day went overall ------------------
function YesterdayRecap({yesterday: y, loading}) {
  if (loading) return <Card className="recap-card"><div className="card-head"><h3>📊 Gestern im Rückblick</h3></div><div className="empty-inline">Lädt …</div></Card>;
  if (!y) return <Card className="recap-card"><div className="card-head"><h3>📊 Gestern im Rückblick</h3></div><div className="empty-inline">Für gestern liegen noch keine Daten vor.</div></Card>;

  const metrics = [
    {l: 'Stimmung', v: y.mood, max: 6, c: '#f59e0b'},
    {l: 'Tagesrating', v: y.day_rating, max: 10, c: '#ec4899'},
    {l: 'Produktivität', v: y.productivity, max: 10, c: '#10b981'},
    {l: 'Energie', v: y.energy, max: 10, c: '#3b82f6'},
    {l: 'Stress', v: y.stress, max: 10, c: '#ef4444', invert: true},
    {l: 'Schlaf', v: y.sleep_hours, max: 9, c: '#8b5cf6', suffix: ' h'},
  ];
  const present = metrics.filter(m => m.v != null);
  const scored = present.map(m => m.invert ? (1 - m.v / m.max) : (m.v / m.max));
  const score = scored.length ? Math.round(scored.reduce((a, b) => a + b, 0) / scored.length * 100) : null;
  const scoreColor = score == null ? '#94a3b8' : score >= 70 ? '#10b981' : score >= 45 ? '#f59e0b' : '#ef4444';

  return <Card className="recap-card">
    <div className="card-head"><h3>📊 Gestern im Rückblick</h3><span className="muted">{formatDate(y.day)}</span></div>
    {present.length === 0
      ? <div className="empty-inline">Für gestern wurden keine Kennzahlen erfasst.</div>
      : <div className="recap-body">
        <div className="recap-score">
          <div className="score-ring" style={{background: `conic-gradient(${scoreColor} ${score}%, #eef0f3 0)`}}>
            <div className="score-inner"><b>{score}</b><small>%</small></div>
          </div>
          <span className="score-label">Gesamtprognose</span>
        </div>
        <div className="recap-bars">
          {present.map(m => <div className="recap-row" key={m.l}>
            <span className="row-lbl">{m.l}</span>
            <div className="track"><div className="fill" style={{width: Math.min(100, m.v / m.max * 100) + '%', background: m.c}}/></div>
            <span className="val">{m.v}{m.suffix || ''}</span>
          </div>)}
        </div>
      </div>}
    {y.highlight && <p className="recap-highlight">🌟 {y.highlight}</p>}
  </Card>;
}

// =========================================================================
// Day editor modal — create a new day or edit any existing day, with
// every field the data model supports.
// =========================================================================
function DayEditorModal({initialDay, onClose, onSaved}) {
  const [day, setDay] = useState(initialDay);
  const [draft, setDraft] = useState(null); // null while loading
  const [saving, setSaving] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setDraft(null);
    setError('');
    api('/daily/' + day).then(d => setDraft({...d, day})).catch(() => setDraft({day}));
  }, [day]);

  const upd = (k, v) => setDraft(d => ({...d, [k]: v}));

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      const savedEntry = await api('/daily', {method: 'PUT', body: JSON.stringify(draft)});
      onSaved(savedEntry);
    } catch (e) {
      setError('Speichern fehlgeschlagen. Bitte Eingaben prüfen.');
    } finally {
      setSaving(false);
    }
  };

  const isExisting = draft && draft.id;

  return <div className="modal-overlay" onClick={onClose}>
    <div className="modal" onClick={e => e.stopPropagation()}>
      <div className="modal-header">
        <div>
          <div className="eyebrow">{isExisting ? 'Tag bearbeiten' : 'Neuer Tag'}</div>
          <div className="modal-date"><Calendar size={16}/><input type="date" value={day} max={today} onChange={e => setDay(e.target.value)}/></div>
        </div>
        <button className="iconbtn" onClick={onClose}><X size={18}/></button>
      </div>

      {!draft ? <div className="modal-body"><div className="empty-inline">Lädt …</div></div> : <>
        <div className="modal-body">
          <section className="modal-section">
            <h4>Stimmung &amp; Werte</h4>
            <div className="mood-row">{moods.map((m, i) => <button key={m} type="button" className={draft.mood === i + 1 ? 'mood selected' : 'mood'} onClick={() => upd('mood', i + 1)}>{m}</button>)}</div>
            <div className="quick-stats modal-grid">
              <Field label="Tagesrating (1-10)"><input type="number" min="1" max="10" value={draft.day_rating || ''} onChange={e => upd('day_rating', num(e.target.value))}/></Field>
              <Field label="Produktivität (1-10)"><input type="number" min="1" max="10" value={draft.productivity || ''} onChange={e => upd('productivity', num(e.target.value))}/></Field>
              <Field label="Energie (1-10)"><input type="number" min="1" max="10" value={draft.energy || ''} onChange={e => upd('energy', num(e.target.value))}/></Field>
              <Field label="Stress (1-10)"><input type="number" min="1" max="10" value={draft.stress || ''} onChange={e => upd('stress', num(e.target.value))}/></Field>
              <Field label="Schlaf (h)"><input type="number" step="0.1" value={draft.sleep_hours || ''} onChange={e => upd('sleep_hours', num(e.target.value))}/></Field>
              <Field label="Wasser (L)"><input type="number" step="0.1" value={draft.water_liters || ''} onChange={e => upd('water_liters', num(e.target.value))}/></Field>
            </div>
          </section>

          <section className="modal-section">
            <h4>Daily Check</h4>
            <div className="checks">
              <Toggle label="🏃 Laufen" value={!!draft.running} onChange={v => upd('running', v)}/>
              <Toggle label="🏋️ Krafttraining" value={!!draft.strength_training} onChange={v => upd('strength_training', v)}/>
              <Toggle label="📖 30 min gelesen" value={!!draft.reading_30min} onChange={v => upd('reading_30min', v)}/>
              <Toggle label="🍳 Selbst gekocht" value={!!draft.self_cooked} onChange={v => upd('self_cooked', v)}/>
              <Toggle label="👤 Neues kennengelernt" value={!!draft.new_person} onChange={v => upd('new_person', v)}/>
              <Toggle label="💼 Neuer Kunde" value={!!draft.new_customer} onChange={v => upd('new_customer', v)}/>
            </div>
          </section>

          <section className="modal-section">
            <h4>Reflexion</h4>
            <div className="text-grid">
              <Field label="🌟 Highlight"><textarea value={draft.highlight || ''} onChange={e => upd('highlight', e.target.value)}/></Field>
              <Field label="🏆 Erfolg"><textarea value={draft.success || ''} onChange={e => upd('success', e.target.value)}/></Field>
              <Field label="💼 Arbeit"><textarea value={draft.work_note || ''} onChange={e => upd('work_note', e.target.value)}/></Field>
              <Field label="😂 Etwas Lustiges"><textarea value={draft.funny || ''} onChange={e => upd('funny', e.target.value)}/></Field>
              <Field label="📚 Gelernt"><textarea value={draft.learned || ''} onChange={e => upd('learned', e.target.value)}/></Field>
              <Field label="🙏 Dankbarkeit"><textarea value={draft.gratitude || ''} onChange={e => upd('gratitude', e.target.value)}/></Field>
              <Field label="🧠 Weisheit"><textarea value={draft.wisdom || ''} onChange={e => upd('wisdom', e.target.value)}/></Field>
              <Field label="🔮 Für meine Zukunft"><textarea value={draft.future_action || ''} onChange={e => upd('future_action', e.target.value)}/></Field>
            </div>
          </section>

          <section className="modal-section">
            <h4>Morgen · Top 3</h4>
            <div className="top3">{[1, 2, 3].map(n => <Field key={n} label={'0' + n}><input value={draft['tomorrow_' + n] || ''} onChange={e => upd('tomorrow_' + n, e.target.value)} placeholder="Wichtigste Aufgabe …"/></Field>)}</div>
          </section>

          <button type="button" className="advanced-toggle" onClick={() => setAdvanced(a => !a)}>
            <ChevronDown size={16} className={advanced ? 'rot' : ''}/> Weitere Felder (Ernährung, Finanzen, Notizen)
          </button>
          {advanced && <section className="modal-section">
            <div className="quick-stats modal-grid">
              <Field label="Protein (g)"><input type="number" value={draft.protein_grams || ''} onChange={e => upd('protein_grams', num(e.target.value))}/></Field>
              <Field label="Gespart (€)"><input type="number" step="0.01" value={draft.money_saved || ''} onChange={e => upd('money_saved', num(e.target.value))}/></Field>
              <Field label="Verdient (€)"><input type="number" step="0.01" value={draft.money_earned || ''} onChange={e => upd('money_earned', num(e.target.value))}/></Field>
              <Field label="Ausgaben (€)"><input type="number" step="0.01" value={draft.expenses || ''} onChange={e => upd('expenses', num(e.target.value))}/></Field>
            </div>
            <div className="text-grid">
              <Field label="🍽️ Essensnotiz"><textarea value={draft.food_note || ''} onChange={e => upd('food_note', e.target.value)}/></Field>
              <Field label="🎧 Album des Tages"><input value={draft.album || ''} onChange={e => upd('album', e.target.value)}/></Field>
              <Field label="🛠️ Tool des Tages"><input value={draft.tool_of_day || ''} onChange={e => upd('tool_of_day', e.target.value)}/></Field>
              <Field label="📈 Trading-Notiz"><textarea value={draft.trade_note || ''} onChange={e => upd('trade_note', e.target.value)}/></Field>
              <Field label="👁️ Watchlist"><textarea value={draft.watchlist || ''} onChange={e => upd('watchlist', e.target.value)}/></Field>
            </div>
          </section>}
        </div>

        <div className="modal-footer">
          {error && <span className="modal-error">{error}</span>}
          <button className="secondary" onClick={onClose}>Abbrechen</button>
          <button className="primary" onClick={submit} disabled={saving}><Save size={16}/>{saving ? 'Speichert …' : 'Tag speichern'}</button>
        </div>
      </>}
    </div>
  </div>;
}

// =========================================================================
// Other pages (Journal, Goals, Projects, Vision, Analytics, Insights, Settings)
// =========================================================================
function Journal() {
  const [items, setItems] = useState([]);
  const [content, setContent] = useState('');
  useEffect(() => { api('/journal').then(setItems); }, []);
  const add = async () => {
    if (!content.trim()) return;
    const x = await api('/journal', {method: 'POST', body: JSON.stringify({day: today, category: 'note', content})});
    setItems([x, ...items]);
    setContent('');
  };
  return <div className="single">
    <Card><div className="card-head"><h3>Schneller Eintrag</h3><CirclePlus/></div><textarea className="bigtext" value={content} onChange={e => setContent(e.target.value)} placeholder="Gedanke, Idee, Beobachtung …"/><button className="primary" onClick={add}>Eintrag speichern</button></Card>
    {items.map(x => <Card key={x.id}><div className="muted">{formatDate(x.day)} · {x.category}</div><p>{x.content}</p></Card>)}
  </div>;
}

function Goals() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState({title: '', horizon: '1y', area: 'meaning', progress: 0});
  useEffect(() => { api('/goals').then(setItems); }, []);
  const add = async () => {
    if (!form.title.trim()) return;
    const x = await api('/goals', {method: 'POST', body: JSON.stringify({...form, year: form.horizon === '1y' ? new Date().getFullYear() : null})});
    setItems([x, ...items]);
    setForm({...form, title: ''});
  };
  return <div className="content-grid">
    <div className="main-col">
      <Card><div className="card-head"><h3>Neues Ziel</h3><Target/></div>
        <div className="form-row">
          <input placeholder="Ziel" value={form.title} onChange={e => setForm({...form, title: e.target.value})}/>
          <select value={form.horizon} onChange={e => setForm({...form, horizon: e.target.value})}><option value="1y">1 Jahr</option><option value="5y">5 Jahre</option><option value="10y">10 Jahre</option></select>
          <button className="primary" onClick={add}>Hinzufügen</button>
        </div>
      </Card>
      {items.map(g => <Card key={g.id}><div className="item-title"><div><b>{g.title}</b><span className="pill">{g.horizon}</span></div><span>{g.progress}%</span></div><div className="progress"><i style={{width: g.progress + '%'}}/></div><p className="muted">{g.area}</p></Card>)}
    </div>
    <aside className="side-col"><Card><h3>Die Verbindung</h3><p>Vision → Jahresziel → Projekt → nächste Aktion → heute.</p><p className="muted">Ein Ziel ist erst hilfreich, wenn daraus ein nächster konkreter Schritt entsteht.</p></Card></aside>
  </div>;
}

function Projects() {
  const [items, setItems] = useState([]);
  const [title, setTitle] = useState('');
  const [next, setNext] = useState('');
  useEffect(() => { api('/projects').then(setItems); }, []);
  const add = async () => {
    if (!title.trim()) return;
    const x = await api('/projects', {method: 'POST', body: JSON.stringify({title, next_action: next, area: 'work', progress: 0})});
    setItems([x, ...items]);
    setTitle(''); setNext('');
  };
  return <div className="content-grid">
    <div className="main-col">
      <Card><div className="form-row">
        <input placeholder="Neues Projekt" value={title} onChange={e => setTitle(e.target.value)}/>
        <input placeholder="Nächste Aktion" value={next} onChange={e => setNext(e.target.value)}/>
        <button className="primary" onClick={add}>Projekt</button>
      </div></Card>
      {items.map(p => <Card key={p.id}><div className="item-title"><b>{p.title}</b><span>{p.progress}%</span></div><div className="progress"><i style={{width: p.progress + '%'}}/></div><p><b>Nächste Aktion:</b> {p.next_action || '–'}</p></Card>)}
    </div>
    <aside className="side-col"><Card><h3>Roadmap</h3><p>Jedes Projekt bekommt einen nächsten Schritt. Dieser kann direkt in deine Top 3 für morgen übernommen werden.</p></Card></aside>
  </div>;
}

function Vision() {
  const [items, setItems] = useState({});
  useEffect(() => { api('/visions').then(xs => setItems(Object.fromEntries(xs.map(x => [x.horizon, x.content])))); }, []);
  const save = async h => { await api('/visions', {method: 'PUT', body: JSON.stringify({horizon: h, content: items[h] || ''})}); };
  return <div className="vision-grid">
    {[['10y', '10 Jahre', 'Wie möchtest du leben?'], ['5y', '5 Jahre', 'Welche Richtung soll dein Leben haben?'], ['1y', 'Dieses Jahr', 'Was muss dieses Jahr konkret passieren?']].map(([h, t, p]) =>
      <Card key={h}><div className="eyebrow">{h}</div><h2>{t}</h2><p className="muted">{p}</p><textarea className="visiontext" value={items[h] || ''} onChange={e => setItems({...items, [h]: e.target.value})} placeholder="Schreibe deine Vision …"/><button className="primary" onClick={() => save(h)}>Speichern</button></Card>)}
  </div>;
}

function Insights({data}) {
  if (!data) return <div className="single"><Card><h3>Trends werden geladen …</h3></Card></div>;
  return <div className="content-grid">
    <div className="main-col">
      <Card><div className="card-head"><h3>30-Tage-Basislinie</h3><TrendingUp/></div>
        <div className="metric-grid">{[['Mood', data.mood_avg], ['Rating', data.rating_avg], ['Produktivität', data.productivity_avg], ['Schlaf', data.sleep_avg ? data.sleep_avg + ' h' : '–'], ['Wasser', data.water_avg ? data.water_avg + ' L' : '–'], ['Stress', data.stress_avg], ['Energie', data.energy_avg]].map(([k, v]) => <div className="metric" key={k}><span>{k}</span><b>{v ?? '–'}</b></div>)}</div>
      </Card>
      <Card><h3>Gewohnheiten</h3>
        <div className="metric-grid">{[['🏃 Laufen', data.running_days], ['🏋️ Kraft', data.strength_days], ['📖 Lesen', data.reading_days], ['💼 Kunden', data.customer_days], ['👥 Sozial', data.social_days]].map(([k, v]) => <div className="metric" key={k}><span>{k}</span><b>{v} Tage</b></div>)}</div>
      </Card>
    </div>
    <aside className="side-col"><Card className="focus"><div className="eyebrow">OLLAMA</div><h3>Erst Fakten. Dann Muster.</h3><p className="muted">Das System vergleicht dich mit deiner eigenen Basislinie und formuliert Hypothesen statt Diagnosen.</p></Card></aside>
  </div>;
}

function Settings() {
  const [s, setS] = useState({enabled: false, url: 'http://127.0.0.1:11434', model: 'llama3.2:3b', include_sensitive: false});
  const [result, setResult] = useState('');
  useEffect(() => { api('/ollama/settings').then(setS); }, []);
  const save = async () => { await api('/ollama/settings', {method: 'PUT', body: JSON.stringify(s)}); setResult('Einstellungen gespeichert'); };
  const briefing = async () => { try { const r = await api('/ollama/briefing/' + today, {method: 'POST'}); setResult(r.response); } catch (e) { setResult('Ollama Fehler: ' + e.message); } };
  return <div className="single">
    <Card><div className="card-head"><h3>Lokale KI · Ollama</h3><Sparkles/></div>
      <Toggle label="Ollama aktivieren" value={s.enabled} onChange={v => setS({...s, enabled: v})}/>
      <div className="form-row"><input value={s.url} onChange={e => setS({...s, url: e.target.value})}/><input value={s.model} onChange={e => setS({...s, model: e.target.value})}/></div>
      <Toggle label="Sensible Daten an KI senden" value={s.include_sensitive} onChange={v => setS({...s, include_sensitive: v})}/>
      <div className="button-row"><button className="primary" onClick={save}>Speichern</button><button className="secondary" onClick={briefing}>Tagesbriefing erzeugen</button></div>
      {result && <pre className="ai-result">{result}</pre>}
    </Card>
    <Card><div className="card-head"><h3>Daten</h3><Wallet/></div><p className="muted">Deine Daten bleiben lokal. Exportiere regelmäßig ein Backup.</p><a className="primary linkbtn" href={API + '/export'}>JSON Export</a></Card>
  </div>;
}

function Analytics() {
  const [period, setPeriod] = useState('month');
  const [metric, setMetric] = useState('mood');
  const [data, setData] = useState(null);
  useEffect(() => { Promise.all([api('/daily?days=730'), api('/journal?limit=500'), api('/goals'), api('/projects'), api('/trackers')]).then(([d, j, g, p, t]) => setData({d, j, g, p, t})).catch(() => setData({d: [], j: [], g: [], p: [], t: []})); }, []);
  if (!data) return <div className="single"><Card><h3>Auswertung wird geladen …</h3></Card></div>;
  const avr = a => a.length ? +(a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) : null;
  const hx = (hex, a) => { const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16); return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')'; };
  const monthNames = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];
  const group = () => {
    const g = {};
    for (const e of data.d) {
      const k = period === 'day' ? e.day : period === 'month' ? e.day.slice(0, 7) : e.day.slice(0, 4);
      const o = g[k] = g[k] || {sleep: [], mood: [], rating: [], prod: [], water: [], run: 0, read: 0, work: 0, write: 0};
      if (e.sleep_hours != null) o.sleep.push(e.sleep_hours);
      if (e.mood != null) o.mood.push(e.mood);
      if (e.day_rating != null) o.rating.push(e.day_rating);
      if (e.productivity != null) o.prod.push(e.productivity);
      if (e.water_liters != null) o.water.push(e.water_liters);
      if (e.running) o.run++;
      if (e.reading_30min) o.read++;
      if ((e.work_note || '').trim()) o.work++;
    }
    for (const en of data.j) {
      const k = period === 'day' ? en.day : period === 'month' ? en.day.slice(0, 7) : en.day.slice(0, 4);
      (g[k] = g[k] || {sleep: [], mood: [], rating: [], prod: [], water: [], run: 0, read: 0, work: 0, write: 0}).write++;
    }
    return g;
  };
  const g = group();
  const keys = Object.keys(g).sort();
  const last = keys.length ? keys[keys.length - 1] : null;
  const prev = keys.length > 1 ? keys[keys.length - 2] : null;
  const vl = (key, field) => { const o = g[key]; if (field === 'mood') return avr(o.mood); if (field === 'sleep') return avr(o.sleep); if (field === 'rating') return avr(o.rating); if (field === 'prod') return avr(o.prod); if (field === 'water') return avr(o.water); return o[field] || 0; };
  const dint = (c, p) => { if (c == null || p == null) return null; const D = +(c - p).toFixed(1); return D > 0 ? ['up', '▲ +' + D] : D < 0 ? ['down', '▼ ' + D] : ['flat', '—']; };
  const mk = (label, color, ic, cval, pval, suf = '') => { const x = dint(cval, pval); return <div className="kpi" style={{'--c': color}}><div className="ic">{ic}</div><b>{cval != null ? cval : '–'}{suf}</b><div className="lbl">{label}</div>{x ? <span className={'delta ' + x[0]}>{x[1]}</span> : <span className="delta flat">—</span>}</div>; };
  const moodC = last ? avr(g[last].mood) : null, moodP = prev ? avr(g[prev].mood) : null;
  const sleepC = last ? avr(g[last].sleep) : null, sleepP = prev ? avr(g[prev].sleep) : null;
  const runC = last ? g[last].run : 0, runP = prev ? g[prev].run : null;
  const readC = last ? g[last].read : 0, readP = prev ? g[prev].read : null;
  const writeC = last ? g[last].write || 0 : 0, writeP = prev ? g[prev].write || 0 : null;
  const activeProjects = data.p.filter(x => (x.status || 'active') === 'active');
  const plabel = k => period === 'day' ? k.slice(8, 10) + '.' + k.slice(5, 7) : period === 'month' ? monthNames[+k.slice(5, 7) - 1] + ' ' + k.slice(0, 4) : k;
  const cfg = {mood: {l: 'Stimmung', c: '#f59e0b'}, sleep: {l: 'Schlaf', c: '#8b5cf6'}, prod: {l: 'Produktivität', c: '#10b981'}, run: {l: 'Laufen', c: '#ef4444'}, read: {l: 'Lesen', c: '#3b82f6'}, write: {l: 'Schreiben', c: '#f97316'}};
  const chartMax = Math.max(...keys.map(k => vl(k, metric) || 0), 1);
  const cut = (() => { const d = new Date(); d.setDate(d.getDate() - 28); return fmtISO(d); })();
  const recent = data.d.filter(e => e.day >= cut);
  const habits = [{l: 'Laufen', have: recent.filter(e => e.running).length, need: 12, c: '#ef4444'}, {l: 'Lesen 30 min', have: recent.filter(e => e.reading_30min).length, need: 20, c: '#3b82f6'}, {l: 'Krafttraining', have: recent.filter(e => e.strength_training).length, need: 8, c: '#a855f7'}, {l: 'Stimmung ≥ 4', have: recent.filter(e => e.mood >= 4).length, need: 28, c: '#f59e0b'}, {l: 'Wasser ≥ 1,5 L', have: recent.filter(e => e.water_liters >= 1.5).length, need: 28, c: '#06b6d4'}];
  const actGoals = data.g.filter(x => x.active);
  const cell = (v, color, suf, max) => (v == null ? <td><span className="cellval">–</span></td> : <td><span className="cellval" style={{background: hx(color, max ? Math.min(.14 + v / max * .3, .42) : .14)}}>{v}{suf}</span></td>);
  if (keys.length === 0) return <div className="ana"><Card><div className="empty">Noch keine Daten – trage deinen ersten Tag unter „Heute" ein.</div></Card></div>;
  return <div className="ana">
    <div className="ana-top"><h2>Auswertung</h2><div className="seg">{['day', 'month', 'year'].map(p => <button key={p} className={period === p ? 'on' : ''} onClick={() => setPeriod(p)}>{p === 'day' ? 'Tag' : p === 'month' ? 'Monat' : 'Jahr'}</button>)}</div></div>
    <div className="ana-kpis">{mk('Stimmung', '#f59e0b', <Brain size={17}/>, moodC, moodP)}{mk('Schlaf', '#8b5cf6', <Moon size={17}/>, sleepC, sleepP, ' h')}{mk('Laufen', '#ef4444', <Dumbbell size={17}/>, runC, runP, ' Tage')}{mk('Lesen', '#3b82f6', <BookOpen size={17}/>, readC, readP, ' Tage')}{mk('Schreiben', '#f97316', <CirclePlus size={17}/>, writeC, writeP, ' Einträge')}{mk('Projekte aktiv', '#6366f1', <Target size={17}/>, activeProjects.length, null)}</div>
    <Card><div className="card-head"><h3>Trend · {period === 'day' ? 'Tage' : period === 'month' ? 'Monate' : 'Jahre'}</h3><div className="seg">{Object.keys(cfg).map(m => <button key={m} className={metric === m ? 'on' : ''} onClick={() => setMetric(m)}>{cfg[m].l}</button>)}</div></div><div className="bars">{keys.map(k => <div key={k} className="col"><span className="top">{vl(k, metric) != null ? vl(k, metric) : ''}</span><i style={{height: (Math.max(vl(k, metric) || 0, 0) / chartMax * 100) + '%', '--bc': cfg[metric].c}}/><small>{plabel(k)}</small></div>)}</div></Card>
    <Card className="ana-table"><div className="card-head"><h3>Übersicht</h3></div><table><thead><tr><th>Periode</th><th>Stimmung</th><th>Schlaf</th><th>Wasser</th><th>Laufen</th><th>Lesen</th><th>Arbeit</th><th>Schreiben</th><th>Rating</th><th>Produktivität</th></tr></thead><tbody>{keys.map(k => { const o = g[k]; return <tr key={k}><td><b>{plabel(k)}</b></td>{cell(avr(o.mood), '#f59e0b', '', 6)}{cell(avr(o.sleep), '#8b5cf6', 'h', 12)}{cell(avr(o.water), '#06b6d4', ' L', 5)}{cell(o.run ? o.run : null, '#ef4444', ' ×')}{cell(o.read ? o.read : null, '#3b82f6', ' ×')}{cell(o.work ? o.work : null, '#64748b', ' ×')}{cell(o.write || null, '#f97316', ' ×')}{cell(avr(o.rating), '#ec4899', '', 10)}{cell(avr(o.prod), '#10b981', '', 10)}</tr>; })}</tbody></table></Card>
    <Card><div className="card-head"><h3>Zieltreue · letzte 4 Wochen</h3><TrendingUp size={18}/></div>{habits.map(h => { const pct = Math.min(100, Math.round(h.have / h.need * 100)); const col = pct >= 70 ? '#10b981' : pct >= 40 ? '#f59e0b' : '#ef4444'; return <div className="habit-rate" key={h.l}><span className="row-lbl">{h.l}</span><div className="track"><div className="fill" style={{width: pct + '%', '--hbc': col}}/></div><span className="val">{h.have}/{h.need} · {pct}%</span></div>; })}</Card>
    <div className="ana-cols">
      <Card><div className="card-head"><h3>Ziele</h3><Target size={18}/></div>{actGoals.length ? actGoals.map(gl => <div className="goal-item" key={gl.id}><div className="gi-head"><b>{gl.title}</b><span>{gl.progress}%</span></div><div className="progress"><i style={{width: gl.progress + '%'}}/></div><p className="muted">{gl.horizon} · {gl.area}</p></div>) : <p className="muted">Noch keine Ziele angelegt.</p>}</Card>
      <Card><div className="card-head"><h3>Aktive Projekte</h3><ListTodo size={18}/></div>{activeProjects.length ? activeProjects.map(p => <div className="goal-item" key={p.id}><div className="gi-head"><b>{p.title}</b><span>{p.progress}%</span></div><div className="progress"><i style={{width: p.progress + '%'}}/></div><p className="muted">Nächster Schritt: {p.next_action || '–'}</p></div>) : <p className="muted">Noch keine Projekte angelegt.</p>}</Card>
    </div>
  </div>;
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
createRoot(document.getElementById('root')).render(<App/>);
