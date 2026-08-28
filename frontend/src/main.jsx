import React, {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';
import {
  Activity, BookOpen, Brain, Calendar, Check, ChevronDown, ChevronRight, CirclePlus, Columns3,
  Compass, Dumbbell, Droplets, Home, LayoutGrid, ListTodo, LogOut, Moon, MoreHorizontal, RefreshCw,
  Save, Sparkles, Target, TrendingUp, Wallet, X
} from 'lucide-react';
import './styles.css';

const API = '/api';

// ---- date helpers -----------------------------------------------------
function fmtISO(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
const today = fmtISO(new Date());
function addDays(dayStr, n) { const d = new Date(dayStr + 'T12:00:00'); d.setDate(d.getDate() + n); return fmtISO(d); }
// Akzeptiert both 7.5 and 7,5 (deutsche Schreibweise)
function num(v) { if (v == null) return null; const s = String(v).trim().replace(',', '.'); if (s === '') return null; const n = Number(s); return Number.isFinite(n) ? n : null; }
function formatDate(v) { return new Date(v + 'T12:00:00').toLocaleDateString('de-DE', {day: '2-digit', month: 'long', year: 'numeric'}); }
function formatShort(v) { return new Date(v + 'T12:00:00').toLocaleDateString('de-DE', {day: '2-digit', month: '2-digit'}); }

const moods = ['😞', '😕', '😐', '🙂', '😄', '🤩'];
const nav = [
  ['today', 'Heute', Home], ['overview', 'Übersicht', Calendar], ['journal', 'Journal', BookOpen],
  ['goals', 'Ziele', Target], ['projects', 'Projekte', ListTodo], ['board', 'Board', Columns3],
  ['matrix', 'Matrix', LayoutGrid], ['vision', 'Vision', Compass], ['analytics', 'Auswertung', Activity],
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
  const [moreOpen, setMoreOpen] = useState(false);
  const [authOn, setAuthOn] = useState(false);

  useEffect(() => { fetch('/api/health').then(r => r.json()).then(d => setAuthOn(!!d.auth)).catch(() => {}); }, []);

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
      <div className="sidebar-foot">{authOn ? <a className="slogout" href="/logout"><LogOut size={13}/> Abmelden</a> : 'lokal · privat · PWA'}</div>
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
      {page === 'overview' && <Overview/>}
      {page === 'journal' && <Journal/>}
      {page === 'goals' && <Goals/>}
      {page === 'projects' && <Projects/>}
      {page === 'board' && <Board/>}
      {page === 'matrix' && <Matrix/>}
      {page === 'vision' && <Vision/>}
      {page === 'analytics' && <Analytics/>}
      {page === 'insights' && <Insights data={insights}/>}
      {page === 'settings' && <Settings/>}
    </main>
    <nav className="bottom-nav">
      {nav.slice(0, 5).map(([id, label, Icon]) => <button key={id} className={page === id ? 'active' : ''} onClick={() => setPage(id)}><Icon size={18}/><small>{label}</small></button>)}
      <button className={nav.slice(5).some(([id]) => id === page) ? 'active' : ''} onClick={() => setMoreOpen(true)}><MoreHorizontal size={18}/><small>Mehr</small></button>
    </nav>
    {moreOpen && <div className="sheet-overlay" onClick={() => setMoreOpen(false)}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <div className="shead">Weitere Bereiche</div>
        {nav.slice(5).map(([id, label, Icon]) => <button key={id} className={page === id ? 'active' : ''} onClick={() => { setPage(id); setMoreOpen(false); }}><Icon size={19}/>{label}</button>)}
        {authOn && <a className="sheet-logout" href="/logout"><LogOut size={19}/>Abmelden</a>}
      </div>
    </div>}
    {toast && <div className="toast">{toast}</div>}
    {editorDay && <DayEditorModal initialDay={editorDay} onClose={closeEditor} onSaved={onEditorSaved}/>}
  </div>;
}

function pageTitle(page) {
  return ({today: 'Heute', overview: 'Übersicht', journal: 'Journal', goals: 'Ziele', projects: 'Projekte', board: 'Board', matrix: 'Eisenhower-Matrix', vision: 'Vision', analytics: 'Auswertung', insights: 'Trends', settings: 'Einstellungen'})[page];
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
          <Field label="Schlaf (h)"><input type="text" inputMode="decimal" placeholder="z.B. 7,5" value={entry.sleep_hours ?? ''} onChange={e => update('sleep_hours', num(e.target.value))}/></Field>
          <Field label="Wasser (L)"><input type="text" inputMode="decimal" placeholder="z.B. 1,5" value={entry.water_liters ?? ''} onChange={e => update('water_liters', num(e.target.value))}/></Field>
        </div>
      </Card>

      <DailyCheckCard entry={entry} update={update}/>

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

// ---- Daily Check inkl. eigener Check-Punkte -----------------------------
function DailyCheckCard({entry, update}) {
  const [custom, setCustom] = useState([]);
  const [done, setDone] = useState([]);
  const [name, setName] = useState('');
  useEffect(() => {
    api('/checks').then(setCustom).catch(() => {});
    api('/checks/' + today).then(d => setDone(d.done)).catch(() => {});
  }, []);
  const toggleCustom = c => {
    const nd = done.includes(c.id) ? done.filter(x => x !== c.id) : [...done, c.id];
    setDone(nd);
    api('/checks/' + today, {method: 'PUT', body: JSON.stringify({check_id: c.id, done: nd.includes(c.id)})}).catch(() => {});
  };
  const add = async () => {
    if (!name.trim()) return;
    try {
      const x = await api('/checks', {method: 'POST', body: JSON.stringify({name})});
      setCustom(cs => [...cs, x]);
      setName('');
    } catch (e) {}
  };
  const del = async c => {
    setCustom(cs => cs.filter(x => x.id !== c.id));
    await api('/checks/' + c.id, {method: 'DELETE'}).catch(() => {});
  };
  return <Card>
    <div className="card-head"><h3>Daily Check</h3><span className="muted">kleine Dinge, große Wirkung</span></div>
    <div className="checks">
      <Toggle label="🏃 Laufen" value={!!entry.running} onChange={v => update('running', v)}/>
      <Toggle label="🏋️ Krafttraining" value={!!entry.strength_training} onChange={v => update('strength_training', v)}/>
      <Toggle label="📖 30 min gelesen" value={!!entry.reading_30min} onChange={v => update('reading_30min', v)}/>
      <Toggle label="🍳 Selbst gekocht" value={!!entry.self_cooked} onChange={v => update('self_cooked', v)}/>
      <Toggle label="👤 Neues kennengelernt" value={!!entry.new_person} onChange={v => update('new_person', v)}/>
      <Toggle label="💼 Neuer Kunde" value={!!entry.new_customer} onChange={v => update('new_customer', v)}/>
      {custom.map(c => <div key={c.id} className={'toggle custom' + (done.includes(c.id) ? ' on' : '')}>
        <button type="button" className="cbtn" onClick={() => toggleCustom(c)}>
          <span>{done.includes(c.id) ? '✓' : '○'}</span>{c.icon} {c.name}
        </button>
        <button type="button" className="cdel" title="Check-Punkt entfernen" onClick={() => del(c)}><X size={12}/></button>
      </div>)}
    </div>
    <div className="addcheck">
      <input placeholder="Eigener Punkt, z.B. 🧘 Meditiert" value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') add(); }}/>
      <button className="secondary" onClick={add}><CirclePlus size={15}/> Hinzufügen</button>
    </div>
  </Card>;
}

// ---- Uebersicht: alles fuer den Tag auf einer Seite ---------------------
function Overview() {
  const [draft, setDraft] = useState(null);
  const [flash, setFlash] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    api('/daily/' + today).then(d => setDraft({...d, day: today})).catch(() => setDraft({day: today}));
  }, []);
  const upd = (k, v) => setDraft(d => ({...d, [k]: v}));
  const save = async () => {
    setSaving(true);
    try {
      const x = await api('/daily', {method: 'PUT', body: JSON.stringify(draft)});
      setDraft({...x});
      setFlash('Gespeichert ✓');
      setTimeout(() => setFlash(''), 2000);
    } catch (e) { setFlash('Fehler beim Speichern'); }
    setSaving(false);
  };
  if (!draft) return <div className="single"><Card><div className="empty-inline">Lädt …</div></Card></div>;
  return <div className="single">
    <Card>
      <div className="card-head"><h3>Alles für {formatDate(today)}</h3><Calendar/></div>
      <DayFormBody draft={draft} upd={upd}/>
      <div className="button-row overview-save">
        <button className="primary" onClick={save} disabled={saving}><Save size={16}/>{flash || (saving ? 'Speichert …' : 'Alles speichern')}</button>
      </div>
    </Card>
  </div>;
}

// ---- Day strip: quick picker for the last 7 days -----------------------
function DayStrip({recent, onPick}) {  const byDay = Object.fromEntries((recent || []).map(e => [e.day, e]));
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
  const checksDone = [y.running, y.strength_training, y.reading_30min, y.self_cooked, y.new_person, y.new_customer].filter(Boolean).length;
  const moodEmoji = y.mood ? moods[y.mood - 1] : '·';

  return <Card className="recap-card">
    <div className="card-head"><h3>📊 Gestern im Rückblick</h3><span className="muted">{formatDate(y.day)}</span></div>
    {present.length === 0
      ? <div className="empty-inline">Für gestern wurden keine Kennzahlen erfasst.</div>
      : <div className="recap-body v2">
        <div className="recap-left">
          <div className="score-ring" style={{background: `conic-gradient(${scoreColor} ${score}%, #eef0f3 0)`}}>
            <div className="score-inner"><span className="recap-emoji">{moodEmoji}</span><b>{score}<small>%</small></b></div>
          </div>
          <span className="score-label">Gesamtbilanz</span>
          <span className="chip-checks"><Check size={13}/> {checksDone}/6 Checks</span>
        </div>
        <div className="recap-bars">
          {present.map(m => <div className="recap-row" key={m.l}>
            <span className="row-lbl">{m.l}</span>
            <div className="track"><div className="fill" style={{width: Math.min(100, m.v / m.max * 100) + '%', background: `linear-gradient(90deg, ${m.c}88, ${m.c})`}}/></div>
            <span className="val">{m.v}{m.suffix || ''}</span>
          </div>)}
        </div>
      </div>}
    {y.highlight && <div className="recap-highlight"><span>🌟</span><p>{y.highlight}</p></div>}
  </Card>;
}

// ---- Gemeinsames Formular: alle Felder eines Tages (Modal + Uebersicht) --
function DayFormBody({draft, upd}) {
  const [advanced, setAdvanced] = useState(false);
  return <>
    <section className="modal-section">
      <h4>Stimmung &amp; Werte</h4>
      <div className="mood-row">{moods.map((m, i) => <button key={m} type="button" className={draft.mood === i + 1 ? 'mood selected' : 'mood'} onClick={() => upd('mood', i + 1)}>{m}</button>)}</div>
      <div className="quick-stats modal-grid">
        <Field label="Tagesrating (1-10)"><input type="number" min="1" max="10" value={draft.day_rating || ''} onChange={e => upd('day_rating', num(e.target.value))}/></Field>
        <Field label="Produktivität (1-10)"><input type="number" min="1" max="10" value={draft.productivity || ''} onChange={e => upd('productivity', num(e.target.value))}/></Field>
        <Field label="Energie (1-10)"><input type="number" min="1" max="10" value={draft.energy || ''} onChange={e => upd('energy', num(e.target.value))}/></Field>
        <Field label="Stress (1-10)"><input type="number" min="1" max="10" value={draft.stress || ''} onChange={e => upd('stress', num(e.target.value))}/></Field>
        <Field label="Schlaf (h)"><input type="text" inputMode="decimal" placeholder="7,5" value={draft.sleep_hours ?? ''} onChange={e => upd('sleep_hours', num(e.target.value))}/></Field>
        <Field label="Wasser (L)"><input type="text" inputMode="decimal" placeholder="1,5" value={draft.water_liters ?? ''} onChange={e => upd('water_liters', num(e.target.value))}/></Field>
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
        <Field label="Protein (g)"><input type="text" inputMode="decimal" value={draft.protein_grams ?? ''} onChange={e => upd('protein_grams', num(e.target.value))}/></Field>
        <Field label="Gespart (€)"><input type="text" inputMode="decimal" value={draft.money_saved ?? ''} onChange={e => upd('money_saved', num(e.target.value))}/></Field>
        <Field label="Verdient (€)"><input type="text" inputMode="decimal" value={draft.money_earned ?? ''} onChange={e => upd('money_earned', num(e.target.value))}/></Field>
        <Field label="Ausgaben (€)"><input type="text" inputMode="decimal" value={draft.expenses ?? ''} onChange={e => upd('expenses', num(e.target.value))}/></Field>
      </div>
      <div className="text-grid">
        <Field label="🍽️ Essensnotiz"><textarea value={draft.food_note || ''} onChange={e => upd('food_note', e.target.value)}/></Field>
        <Field label="🎧 Album des Tages"><input value={draft.album || ''} onChange={e => upd('album', e.target.value)}/></Field>
        <Field label="🛠️ Tool des Tages"><input value={draft.tool_of_day || ''} onChange={e => upd('tool_of_day', e.target.value)}/></Field>
        <Field label="📈 Trading-Notiz"><textarea value={draft.trade_note || ''} onChange={e => upd('trade_note', e.target.value)}/></Field>
        <Field label="👁️ Watchlist"><textarea value={draft.watchlist || ''} onChange={e => upd('watchlist', e.target.value)}/></Field>
      </div>
    </section>}
  </>;
}

// =========================================================================
// Day editor modal — create a new day or edit any existing day
// =========================================================================
function DayEditorModal({initialDay, onClose, onSaved}) {
  const [day, setDay] = useState(initialDay);
  const [draft, setDraft] = useState(null); // null while loading
  const [saving, setSaving] = useState(false);
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
          <DayFormBody draft={draft} upd={upd}/>
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
  const [busy, setBusy] = useState(false);
  useEffect(() => { api('/goals').then(setItems); }, []);
  const add = async () => {
    if (!form.title.trim()) return;
    const x = await api('/goals', {method: 'POST', body: JSON.stringify({...form, year: form.horizon === '1y' ? new Date().getFullYear() : null})});
    setItems([x, ...items]);
    setForm({...form, title: ''});
  };
  const patch = async (g, pu) => {
    setItems(xs => xs.map(x => x.id === g.id ? {...x, ...pu} : x));
    try { await api('/goals/' + g.id, {method: 'PUT', body: JSON.stringify(pu)}); }
    catch (e) { api('/goals').then(setItems); }
  };
  const step = (g, d) => patch(g, {progress: Math.max(0, Math.min(100, (g.progress || 0) + d))});
  const aktive = items.filter(g => g.active !== false && (g.progress || 0) < 100);
  const fertig = items.filter(g => g.active === false || (g.progress || 0) >= 100);
  return <div className="content-grid">
    <div className="main-col">
      <Card><div className="card-head"><h3>Neues Ziel</h3><Target/></div>
        <div className="form-row">
          <input placeholder="Ziel" value={form.title} onChange={e => setForm({...form, title: e.target.value})}/>
          <select value={form.horizon} onChange={e => setForm({...form, horizon: e.target.value})}><option value="1y">1 Jahr</option><option value="5y">5 Jahre</option><option value="10y">10 Jahre</option></select>
          <button className="primary" onClick={add}>Hinzufügen</button>
        </div>
      </Card>
      {aktive.map(g => <Card key={g.id} className={busy ? '' : ''}><div className="item-title"><div><b>{g.title}</b><span className="pill">{g.horizon}</span></div><span>{g.progress || 0}%</span></div>
        <div className="progress"><i style={{width: (g.progress || 0) + '%'}}/></div>
        <div className="goalctl">
          <button onClick={() => step(g, -10)} disabled={busy}>−10</button>
          <button onClick={() => step(g, -1)} disabled={busy}>−1</button>
          <input type="number" min="0" max="100" value={g.progress || 0} onChange={e => patch(g, {progress: Math.max(0, Math.min(100, num(e.target.value) || 0))})}/>
          <button onClick={() => step(g, +1)} disabled={busy}>+1</button>
          <button onClick={() => step(g, +10)} disabled={busy}>+10</button>
          <button className="donebtn" onClick={() => patch(g, {active: false, progress: 100})}>✓ Abschließen</button>
        </div>
        <p className="muted">{g.area}</p></Card>)}
      {fertig.length > 0 && <Card><div className="card-head"><h3>Abgeschlossene Ziele</h3><Check/></div>
        {fertig.map(g => <div className="goal-item done-item" key={g.id}><div className="gi-head"><b>{g.title}</b><button className="mini" onClick={() => patch(g, {active: true, progress: g.progress >= 100 ? 90 : g.progress})}>Wieder öffnen</button></div><p className="muted">{g.progress || 100}% · {g.horizon}</p></div>)}
      </Card>}
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
    const x = await api('/projects', {method: 'POST', body: JSON.stringify({title, next_action: next, area: 'work', progress: 0, status: 'active'})});
    setItems([x, ...items]);
    setTitle(''); setNext('');
  };
  const patch = async (p, pu) => {
    setItems(xs => xs.map(x => x.id === p.id ? {...x, ...pu} : x));
    try { await api('/projects/' + p.id, {method: 'PUT', body: JSON.stringify(pu)}); }
    catch (e) { api('/projects').then(setItems); }
  };
  const step = (p, d) => patch(p, {progress: Math.max(0, Math.min(100, (p.progress || 0) + d))});
  const aktive = items.filter(p => (p.status || 'active') !== 'done');
  const fertig = items.filter(p => p.status === 'done');
  return <div className="content-grid">
    <div className="main-col">
      <Card><div className="form-row">
        <input placeholder="Neues Projekt" value={title} onChange={e => setTitle(e.target.value)}/>
        <input placeholder="Nächste Aktion" value={next} onChange={e => setNext(e.target.value)}/>
        <button className="primary" onClick={add}>Projekt</button>
      </div></Card>
      {aktive.map(p => <Card key={p.id}><div className="item-title"><div><b>{p.title}</b>{p.status === 'planned' && <span className="pill">geplant</span>}</div><span>{p.progress || 0}%</span></div>
        <div className="progress"><i style={{width: (p.progress || 0) + '%'}}/></div>
        <div className="goalctl">
          <button onClick={() => step(p, -10)}>−10</button>
          <input type="number" min="0" max="100" value={p.progress || 0} onChange={e => patch(p, {progress: Math.max(0, Math.min(100, num(e.target.value) || 0))})}/>
          <button onClick={() => step(p, +10)}>+10</button>
          <button className="donebtn" onClick={() => patch(p, {status: 'done', progress: 100})}>✓ Abschließen</button>
        </div>
        <p><b>Nächste Aktion:</b> {p.next_action || '–'}</p></Card>)}
      {fertig.length > 0 && <Card><div className="card-head"><h3>Abgeschlossene Projekte</h3><Check/></div>
        {fertig.map(p => <div className="goal-item done-item" key={p.id}><div className="gi-head"><b>{p.title}</b><button className="mini" onClick={() => patch(p, {status: 'active', progress: 90})}>Wieder öffnen</button></div><p className="muted">100%</p></div>)}
      </Card>}
    </div>
    <aside className="side-col"><Card><h3>Roadmap</h3><p>Jedes Projekt bekommt einen nächsten Schritt. Dieser kann direkt in deine Top 3 für morgen übernommen werden.</p><p className="muted">Fortschritt und Status kannst du auch im Board verschieben.</p></Card></aside>
  </div>;
}

// =========================================================================
// Kanban-Board: Projekte & Ziele per Drag & Drop (oder Pfeile) verschieben
// =========================================================================
const BOARD_COLS = {
  projects: [['planned', 'Geplant'], ['active', 'In Arbeit'], ['done', 'Erledigt']],
  goals: [['open', 'Offen'], ['done', 'Erledigt']]
};

function Board() {
  const [lane, setLane] = useState('projects');
  const [items, setItems] = useState(null);
  const [title, setTitle] = useState('');
  const [dragId, setDragId] = useState(null);
  const isProj = lane === 'projects';
  const endpoint = isProj ? '/projects' : '/goals';

  const load = () => { api(endpoint).then(setItems).catch(() => setItems([])); };
  useEffect(() => { setItems(null); setTitle(''); load(); }, [lane]);

  const colOf = it => isProj
    ? (it.status || 'active')
    : ((it.active === false || (it.progress || 0) >= 100) ? 'done' : 'open');

  const patch = async (it, pu) => {
    setItems(xs => xs.map(x => x.id === it.id ? {...x, ...pu} : x));
    try { await api(endpoint + '/' + it.id, {method: 'PUT', body: JSON.stringify(pu)}); }
    catch (e) { load(); }
  };

  const moveTo = (it, col) => {
    if (colOf(it) === col) return;
    if (isProj) patch(it, {status: col, progress: col === 'done' ? 100 : (col === 'active' && (it.progress || 0) >= 100 ? 90 : it.progress)});
    else patch(it, {active: col === 'open', progress: col === 'done' ? 100 : (it.progress || 0) >= 100 ? 90 : it.progress});
  };

  const shift = it => {
    const cols = BOARD_COLS[lane].map(c => c[0]);
    const i = cols.indexOf(colOf(it));
    if (i < cols.length - 1) moveTo(it, cols[i + 1]);
  };

  const add = async () => {
    if (!title.trim()) return;
    const firstCol = BOARD_COLS[lane][0][0];
    const body = isProj
      ? {title, status: firstCol, progress: 0, area: 'work'}
      : {title, progress: 0};
    const x = await api(endpoint, {method: 'POST', body: JSON.stringify(body)});
    setItems(xs => [x, ...(xs || [])]);
    setTitle('');
  };

  const cols = BOARD_COLS[lane];
  return <div className="single">
    <div className="ana-top">
      <div className="seg">
        <button className={isProj ? 'on' : ''} onClick={() => setLane('projects')}>Projekte</button>
        <button className={!isProj ? 'on' : ''} onClick={() => setLane('goals')}>Ziele</button>
      </div>
      <div className="form-row board-add">
        <input placeholder={isProj ? 'Neues Projekt …' : 'Neues Ziel …'} value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add(); }}/>
        <button className="primary" onClick={add}><CirclePlus size={16}/> Hinzufügen</button>
      </div>
    </div>
    <div className="kanban">
      {cols.map(([col, label]) => {
        const inCol = (items || []).filter(it => colOf(it) === col);
        return <div key={col} className="kcol"
          onDragOver={e => e.preventDefault()}
          onDrop={e => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); const it = (items || []).find(x => x.id === +id); if (it) moveTo(it, col); setDragId(null); }}>
          <div className="kcol-head"><b>{label}</b><span className="pill">{inCol.length}</span></div>
          {items === null && <div className="empty-inline">Lädt …</div>}
          {items !== null && inCol.map(it => <div key={it.id} className={'kcard' + (dragId === it.id ? ' drag' : '')}
              draggable onDragStart={e => { e.dataTransfer.setData('text/plain', it.id); setDragId(it.id); }} onDragEnd={() => setDragId(null)}>
            <b>{it.title}</b>
            <div className="progress"><i style={{width: (it.progress || 0) + '%'}}/></div>
            {isProj && it.next_action && <p className="muted small">▸ {it.next_action}</p>}
            <div className="kctl">
              <span className="muted small">{it.progress || 0}%</span>
              <span className="kctl-btns">
                <button title="Zurück" onClick={() => { const c = cols.map(x => x[0]); const i = c.indexOf(colOf(it)); if (i > 0) moveTo(it, c[i - 1]); }}>‹</button>
                <button title="Weiter" onClick={() => shift(it)}>›</button>
              </span>
            </div>
          </div>)}
          {items !== null && inCol.length === 0 && <div className="empty-inline">Karte hierher ziehen</div>}
        </div>;
      })}
    </div>
    <p className="muted small center">Karten mit der Maus ziehen – auf dem Handy die ‹ › Pfeile nutzen.</p>
  </div>;
}

// =========================================================================
// Eisenhower-Matrix: Ziele/Projekte/To-dos nach wichtig & dringend sortieren
// =========================================================================
const QUADS = [
  [1, 'Erledigen', 'wichtig & dringend', '#ef4444'],
  [2, 'Planen', 'wichtig, nicht dringend', '#3b82f6'],
  [3, 'Delegieren', 'nicht wichtig, dringend', '#f59e0b'],
  [4, 'Streichen', 'weder noch', '#94a3b8']
];

function Matrix() {
  const [items, setItems] = useState(null);
  const [title, setTitle] = useState('');
  const [quad, setQuad] = useState(2);
  const [info, setInfo] = useState('');
  const load = () => { api('/matrix').then(setItems).catch(() => setItems([])); };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!title.trim()) return;
    const x = await api('/matrix', {method: 'POST', body: JSON.stringify({title, quadrant: quad, kind: 'todo'})});
    setItems(xs => [...(xs || []), x]);
    setTitle('');
  };
  const patch = async (it, pu) => {
    setItems(xs => xs.map(x => x.id === it.id ? {...x, ...pu} : x));
    try { await api('/matrix/' + it.id, {method: 'PUT', body: JSON.stringify(pu)}); }
    catch (e) { load(); }
  };
  const del = async it => {
    setItems(xs => xs.filter(x => x.id !== it.id));
    await api('/matrix/' + it.id, {method: 'DELETE'});
  };
  const importFrom = async kind => {
    setInfo('Importiere …');
    try {
      const src = kind === 'goals' ? await api('/goals') : await api('/projects');
      const offen = src.filter(s => kind === 'goals' ? s.active !== false && (s.progress || 0) < 100 : (s.status || 'active') !== 'done');
      for (const s of offen) {
        await api('/matrix', {method: 'POST', body: JSON.stringify({title: (kind === 'goals' ? '🎯 ' : '📦 ') + s.title, kind, quadrant: 2})});
      }
      setInfo(offen.length + ' übernommen');
      load();
    } catch (e) { setInfo('Import fehlgeschlagen'); }
    setTimeout(() => setInfo(''), 2500);
  };

  return <div className="single">
    <Card><div className="card-head"><h3>Neu einsortieren</h3><LayoutGrid/></div>
      <div className="form-row matrix-add">
        <input placeholder="Aufgabe, Ziel oder Projekt …" value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') add(); }}/>
        <select value={quad} onChange={e => setQuad(+e.target.value)}>
          {QUADS.map(([q, l, d]) => <option key={q} value={q}>Q{q} · {l}</option>)}
        </select>
        <button className="primary" onClick={add}>Hinzufügen</button>
      </div>
      <div className="button-row">
        <button className="secondary" onClick={() => importFrom('goals')}>Ziele importieren</button>
        <button className="secondary" onClick={() => importFrom('projects')}>Projekte importieren</button>
        {info && <span className="muted small">{info}</span>}
      </div>
    </Card>
    <div className="quads">
      {QUADS.map(([q, label, desc, color]) => {
        const inQ = (items || []).filter(it => it.quadrant === q);
        return <Card key={q} className="quad" style={{'--qc': color}}>
          <div className="quad-head">
            <span className="quad-badge" style={{background: color}}>Q{q}</span>
            <div><b>{label}</b><small className="muted">{desc}</small></div>
          </div>
          {items === null && <div className="empty-inline">Lädt …</div>}
          {items !== null && inQ.length === 0 && <div className="empty-inline">leer</div>}
          {inQ.map(it => <div key={it.id} className={'mitem' + (it.done ? ' done' : '')}>
            <button className="mcheck" onClick={() => patch(it, {done: !it.done})}>{it.done ? '✓' : ''}</button>
            <span className="mtitle" onClick={() => patch(it, {done: !it.done})}>{it.title}</span>
            <select value={it.quadrant} onChange={e => patch(it, {quadrant: +e.target.value})} title="Verschieben">
              {QUADS.map(([q2, l2]) => <option key={q2} value={q2}>Q{q2}</option>)}
            </select>
            <button className="mdel" onClick={() => del(it)}><X size={14}/></button>
          </div>)}
        </Card>;
      })}
    </div>
    <p className="muted small center">Q1 sofort erledigen · Q2 mit Termin planen · Q3 abgeben · Q4 weglassen</p>
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

// ---- SVG-Liniendiagramm ohne externe Abhängigkeit ----------------------
function LineChart({points, color}) {
  const W = 640, H = 200, P = 10;
  if (!points || points.length === 0) return <div className="empty-inline">Keine Daten in diesem Zeitraum.</div>;
  const vs = points.map(p => p.v);
  const min = Math.min(...vs), max = Math.max(...vs);
  const span = (max - min) || 1;
  const x = i => P + i * (W - 2 * P) / Math.max(points.length - 1, 1);
  const y = v => H - P - ((v - min) / span) * (H - 2 * P - 4) - 2;
  const pts = points.map((p, i) => x(i) + ',' + y(p.v)).join(' ');
  const avg = vs.reduce((a, b) => a + b, 0) / vs.length;
  const avgY = y(avg);
  return <div className="linechart">
    <svg viewBox={'0 0 ' + W + ' ' + H} preserveAspectRatio="none" className="lc-svg">
      <line x1={P} x2={W - P} y1={avgY} y2={avgY} stroke="#94a3b8" strokeDasharray="6 6" strokeWidth="1.5" opacity="0.7"/>
      <polygon points={P + ',' + (H - P) + ' ' + pts + ' ' + (W - P) + ',' + (H - P)} fill={color} opacity="0.12"/>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>
      {points.length <= 45 && points.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.v)} r="3" fill={color}/>)}
    </svg>
    <div className="lc-meta">
      <span>min <b>{min.toLocaleString('de-DE')}</b></span>
      <span>Ø <b>{avg.toLocaleString('de-DE', {maximumFractionDigits: 1})}</b></span>
      <span>max <b>{max.toLocaleString('de-DE')}</b></span>
      <span className="muted">{points.length} Einträge · {points[0].d} → {points[points.length - 1].d}</span>
    </div>
  </div>;
}

function Insights({data}) {
  const [range, setRange] = useState(90);
  const [metric, setMetric] = useState('mood');
  const [rows, setRows] = useState(null);
  useEffect(() => { setRows(null); api('/daily?days=' + range).then(setRows).catch(() => setRows([])); }, [range]);
  const METRICS = [
    ['mood', 'Stimmung', '#f59e0b'], ['day_rating', 'Tagesrating', '#ec4899'],
    ['productivity', 'Produktivität', '#10b981'], ['energy', 'Energie', '#3b82f6'],
    ['stress', 'Stress', '#ef4444'], ['sleep_hours', 'Schlaf (h)', '#8b5cf6'],
    ['water_liters', 'Wasser (L)', '#06b6d4']
  ];
  const cur = METRICS.find(m => m[0] === metric) || METRICS[0];
  const points = (rows || []).filter(r => r[metric] != null).map(r => ({d: r.day, v: r[metric]}));
  return <div className="single">
    <Card>
      <div className="card-head"><h3>Langfristiger Trend</h3><TrendingUp/></div>
      <div className="trend-controls">
        <div className="seg">
          {[['mood', 'Stimmung'], ['day_rating', 'Rating'], ['productivity', 'Produktivität'], ['energy', 'Energie'], ['stress', 'Stress'], ['sleep_hours', 'Schlaf'], ['water_liters', 'Wasser']].map(([m, l]) =>
            <button key={m} className={metric === m ? 'on' : ''} onClick={() => setMetric(m)}>{l}</button>)}
        </div>
        <div className="seg">
          {[30, 90, 180, 365].map(r => <button key={r} className={range === r ? 'on' : ''} onClick={() => setRange(r)}>{r} Tage</button>)}
        </div>
      </div>
      <LineChart points={points} color={cur[2]}/>
    </Card>
    {!data
      ? <Card><div className="empty-inline">Basislinie wird geladen …</div></Card>
      : <>
      <Card><div className="card-head"><h3>30-Tage-Basislinie</h3><TrendingUp/></div>
        <div className="metric-grid">{[['Mood', data.mood_avg], ['Rating', data.rating_avg], ['Produktivität', data.productivity_avg], ['Schlaf', data.sleep_avg ? data.sleep_avg + ' h' : '–'], ['Wasser', data.water_avg ? data.water_avg + ' L' : '–'], ['Stress', data.stress_avg], ['Energie', data.energy_avg]].map(([k, v]) => <div className="metric" key={k}><span>{k}</span><b>{v ?? '–'}</b></div>)}</div>
      </Card>
      <Card><h3>Gewohnheiten</h3>
        <div className="metric-grid">{[['🏃 Laufen', data.running_days], ['🏋️ Kraft', data.strength_days], ['📖 Lesen', data.reading_days], ['💼 Kunden', data.customer_days], ['👥 Sozial', data.social_days]].map(([k, v]) => <div className="metric" key={k}><span>{k}</span><b>{v} Tage</b></div>)}</div>
      </Card>
      <aside/><aside/></>}
  </div>;
}

function Settings() {
  const [s, setS] = useState({enabled: false, url: 'http://127.0.0.1:11434', model: 'llama3.2:3b', include_sensitive: false});
  const [result, setResult] = useState('');
  const [models, setModels] = useState(undefined); // undefined = noch nicht geladen, [] = Fehler/leer
  const [busy, setBusy] = useState(false);
  const [test, setTest] = useState('');
  useEffect(() => { api('/ollama/settings').then(setS); loadModels(); }, []);
  const loadModels = () => {
    setBusy(true);
    api('/ollama/models').then(d => setModels(d.models)).catch(() => setModels([])).finally(() => setBusy(false));
  };
  const save = async () => { await api('/ollama/settings', {method: 'PUT', body: JSON.stringify(s)}); setResult('Einstellungen gespeichert'); loadModels(); };
  const testModel = async () => {
    setTest('Teste "' + s.model + '" …');
    try {
      const r = await api('/ollama/check-model', {method: 'POST', body: JSON.stringify({model: s.model})});
      if (r.ok) setTest('✓ Modell "' + r.model + '" antwortet.');
      else {
        const hint = (r.status === 404 || r.status === 410) ? ' → Modell ist veraltet oder nicht geladen, bitte ein anderes wählen.' : '';
        setTest('✗ Nicht nutzbar' + (r.status ? ' (HTTP ' + r.status + ')' : '') + ': ' + (r.detail || 'unbekannt') + hint);
      }
    } catch (e) { setTest('✗ Ollama nicht erreichbar'); }
  };
  const briefing = async () => {
    try {
      const r = await api('/ollama/briefing/' + today, {method: 'POST'});
      setResult(r.response);
    } catch (e) {
      let msg = e.message;
      try { msg = JSON.parse(e.message).detail || msg; } catch (_) {}
      setResult('Ollama Fehler: ' + msg);
    }
  };
  return <div className="single">
    <Card><div className="card-head"><h3>Lokale KI · Ollama</h3><Sparkles/></div>
      <Toggle label="Ollama aktivieren" value={s.enabled} onChange={v => setS({...s, enabled: v})}/>
      <div className="form-row"><input value={s.url} onChange={e => setS({...s, url: e.target.value})} placeholder="Ollama-URL"/></div>
      {models && models.length > 0
        ? <div className="form-row model-row">
            <select value={models.includes(s.model) ? s.model : ''} onChange={e => setS({...s, model: e.target.value})}>
              {!models.includes(s.model) && <option value="">Modell wählen …</option>}
              {models.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <button className="secondary" onClick={loadModels} disabled={busy}><RefreshCw size={15}/> Neu laden</button>
          </div>
        : <div className="form-row model-row">
            <input value={s.model} onChange={e => setS({...s, model: e.target.value})} placeholder="Modellname, z.B. llama3.2:3b"/>
            <button className="secondary" onClick={loadModels} disabled={busy}><RefreshCw size={15}/> Modelle laden</button>
          </div>}
      {models && models.length === 0 && <p className="warnline">Ollama nicht erreichbar oder keine Modelle geladen. URL prüfen, dann: <code>ollama pull llama3.2:3b</code></p>}
      {models && models.length > 0 && !models.includes(s.model) && <p className="warnline">Aktuell gewähltes Modell „{s.model}" ist auf dem Ollama-Server nicht geladen – bitte oben wählen.</p>}
      <Toggle label="Sensible Daten an KI senden" value={s.include_sensitive} onChange={v => setS({...s, include_sensitive: v})}/>
      <div className="button-row">
        <button className="primary" onClick={save}>Speichern</button>
        <button className="secondary" onClick={testModel}>Modell testen</button>
        <button className="secondary" onClick={briefing}>Tagesbriefing erzeugen</button>
      </div>
      {test && <pre className={'ai-result' + (test.startsWith('✓') ? ' okline' : '')}>{test}</pre>}
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
