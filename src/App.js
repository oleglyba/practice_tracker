import { useState, useRef, useEffect, useMemo } from 'react';
import './App.css';

// ─── Students ─────────────────────────────────────────────
const STUDENTS = [
  { id: 1, name: 'Alexia',    initials: 'AL' },
  { id: 2, name: 'Benjamin',  initials: 'BN' },
  { id: 3, name: 'Charlotte', initials: 'CH' },
  { id: 4, name: 'David',     initials: 'DV' },
  { id: 5, name: 'Emma',      initials: 'EM' },
  { id: 6, name: 'Felix',     initials: 'FX' },
];

const SESSIONS = [
  { key: 'day',   label: 'Day',   icon: '☀️' },
  { key: 'night', label: 'Night', icon: '🌙' },
];

const AVATAR_BG = ['#e8f0fe','#fce8e6','#e6f4ea','#fef7e0','#f3e8fd','#e8f5e9'];
const AVATAR_FG = ['#1a73e8','#d93025','#1e8e3e','#f9ab00','#9334e6','#137333'];

const REEL_VARIANTS = {
  today:     { label: 'Today'     },
  yesterday: { label: 'Yesterday' },
};

const STUDENT_VIDEOS = {
  1: { today: 'alexia/girl2.mp4',     yesterday: 'alexia/girl.mp4'      }, // Alexia
  2: { today: 'benjamin/man2.mp4',    yesterday: 'benjamin/man.mp4'     }, // Benjamin
  3: { today: 'charlotte/Charlotte2.mp4', yesterday: 'charlotte/Charlotte1.mp4' }, // Charlotte
  4: { today: 'david/David2.mp4',     yesterday: 'david/David1.mp4'     }, // David
  5: { today: 'emma/Emma2.mp4',       yesterday: 'emma/Emma1.mp4'       }, // Emma
  6: { today: 'felix/felix2.mp4',     yesterday: 'felix/felix1.mp4'     }, // Felix
};
const DEFAULT_VIDEOS = { today: 'alexia/girl2.mp4', yesterday: 'alexia/girl.mp4' };

// ─── Week helpers ──────────────────────────────────────────
function getWeekDays() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dow = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));

  const SHORT = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const fmt = (d) =>
    new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d);

  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return {
      short: SHORT[i],
      date: fmt(d),
      isToday:  d.getTime() === today.getTime(),
      isPast:   d.getTime() <  today.getTime(),
      isFuture: d.getTime() >  today.getTime(),
    };
  });
}

function getWeekLabel(days) {
  if (!days.length) return '';
  const year  = new Date().getFullYear();
  const first = days[0].date;
  const lastDay = days[days.length - 1].date.split(' ')[1];
  return `${first} – ${lastDay}, ${year}`;
}

const WEEK_DAYS   = getWeekDays();
const WEEK_LABEL  = getWeekLabel(WEEK_DAYS);
const STORAGE_KEY = `bmt_practice_${WEEK_DAYS[0]?.date.replace(/\s/g, '_') ?? 'week'}`;

// ─── Persistence ───────────────────────────────────────────
function buildKey(studentId, dayIdx, session) {
  return `${studentId}-${dayIdx}-${session}`;
}

// Per-student slots: dayIdx 0=Mon 1=Tue 2=Wed 3=Thu 4=Fri 5=Sat
const STUDENT_SLOTS = {
  1: [{ dayIdx: 1, session: 'day'   }, { dayIdx: 2, session: 'night' }], // Alexia:   Tue☀️  Wed🌙
  2: [{ dayIdx: 1, session: 'night' }, { dayIdx: 2, session: 'day'   }], // Benjamin: Tue🌙  Wed☀️
  3: [{ dayIdx: 1, session: 'day'   }, { dayIdx: 2, session: 'day'   }], // Charlotte: Tue☀️ Wed☀️
  4: [{ dayIdx: 1, session: 'night' }, { dayIdx: 2, session: 'night' }], // David:    Tue🌙  Wed🌙
  5: [{ dayIdx: 2, session: 'day'   }, { dayIdx: 1, session: 'night' }], // Emma:     Wed☀️  Tue🌙
  6: [{ dayIdx: 2, session: 'night' }, { dayIdx: 1, session: 'day'   }], // Felix:    Wed🌙  Tue☀️
};

function buildPrefill() {
  const map = {};
  STUDENTS.forEach(student => {
    (STUDENT_SLOTS[student.id] ?? []).forEach(({ dayIdx, session }) => {
      map[buildKey(student.id, dayIdx, session)] = true;
    });
  });
  return map;
}

function loadChecked() {
  const prefill = buildPrefill();
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(prefill)); } catch {}
  return prefill;
}

function formatRelativeDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(d);
}

// ─── Reel Modal ────────────────────────────────────────────
function ReelModal({ student, rowIdx, activeVideo, onChangeVideo, onClose }) {
  const videoRef              = useRef(null);
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [muted, setMuted]     = useState(false);
  const [liked, setLiked]     = useState(false);

  const meta     = REEL_VARIANTS[activeVideo] ?? REEL_VARIANTS.today;
  const videos   = STUDENT_VIDEOS[student.id] ?? DEFAULT_VIDEOS;
  const videoSrc = videos[activeVideo] ?? videos.today;

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    videoRef.current?.play().catch(() => {});
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  useEffect(() => {
    setProgress(0);
    setPlaying(true);
    const vid = videoRef.current;
    if (!vid) return;
    vid.currentTime = 0;
    vid.play().catch(() => {});
  }, [activeVideo]);

  const togglePlay = () => {
    const vid = videoRef.current;
    if (!vid) return;
    if (vid.paused) { vid.play(); setPlaying(true); }
    else            { vid.pause(); setPlaying(false); }
  };

  const onTimeUpdate = () => {
    const vid = videoRef.current;
    if (vid?.duration) setProgress(vid.currentTime / vid.duration);
  };

  const seekTo = (e) => {
    const vid = videoRef.current;
    if (!vid) return;
    const rect = e.currentTarget.getBoundingClientRect();
    vid.currentTime = ((e.clientX - rect.left) / rect.width) * vid.duration;
  };

  return (
    <div className="reel-backdrop" onClick={onClose}>
      <div className="reel-container" onClick={e => e.stopPropagation()}>

        <video
          ref={videoRef}
          className="reel-video"
          src={`/${videoSrc}`}
          loop playsInline muted={muted}
          onTimeUpdate={onTimeUpdate}
          onClick={togglePlay}
        />

        {/* Top bar */}
        <div className="reel-top">
          <div className="reel-progress-bar" onClick={seekTo}>
            <div className="reel-progress-fill" style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="reel-switcher" role="tablist">
            {Object.entries(REEL_VARIANTS).map(([key, item]) => (
              <button
                key={key}
                type="button"
                className={`reel-switch-btn ${activeVideo === key ? 'active' : ''}`}
                onClick={() => onChangeVideo(key)}
              >
                <span>{item.label}</span>
                <small>{formatRelativeDate(key === 'today' ? 0 : -1)}</small>
              </button>
            ))}
          </div>
        </div>

        <button className="reel-close" onClick={onClose} aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M3 3l12 12M15 3L3 15" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>

        {/* Pause overlay */}
        {!playing && (
          <div className="reel-pause-overlay" onClick={togglePlay}>
            <div className="reel-pause-icon">
              <svg width="32" height="32" viewBox="0 0 36 36" fill="none">
                <polygon points="10,5 30,18 10,31" fill="white"/>
              </svg>
            </div>
          </div>
        )}

        {/* Right actions */}
        <div className="reel-actions">
          <button
            className={`reel-action-btn ${liked ? 'liked' : ''}`}
            onClick={() => setLiked(v => !v)}
            aria-label="Like"
          >
            <svg width="26" height="26" viewBox="0 0 24 24"
              fill={liked ? '#ff3b30' : 'none'}
              stroke={liked ? '#ff3b30' : 'white'}
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
            </svg>
            <span className="reel-action-label">{liked ? 'Liked' : 'Like'}</span>
          </button>

          <button className="reel-action-btn" onClick={() => setMuted(v => !v)} aria-label="Sound">
            {muted ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/>
              </svg>
            )}
            <span className="reel-action-label">{muted ? 'Unmute' : 'Sound'}</span>
          </button>
        </div>

        {/* Bottom info */}
        <div className="reel-bottom">
          <span
            className="reel-avatar"
            style={{
              background: AVATAR_BG[rowIdx % AVATAR_BG.length],
              color: AVATAR_FG[rowIdx % AVATAR_FG.length],
            }}
          >
            {student.initials}
          </span>
          <div className="reel-info">
            <p className="reel-name">{student.name}</p>
            <p className="reel-caption">
              {meta.label} · {formatRelativeDate(activeVideo === 'today' ? 0 : -1)}
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────
export default function App() {
  const [checked] = useState(loadChecked);
  const [reel, setReel]       = useState(null);

  const handleCellClick = (student, rowIdx, key, dayIdx) => {
    if (WEEK_DAYS[dayIdx]?.isFuture) return;
    if (!checked[key]) return;
    // Tue (dayIdx=1) → yesterday's video, Wed (dayIdx=2) → today's video
    const activeVideo = dayIdx === 2 ? 'today' : 'yesterday';
    setReel({ student, rowIdx, activeVideo });
  };

  const availableDays = useMemo(
    () => WEEK_DAYS.filter(d => !d.isFuture).length,
    []
  );
  const grandMax = STUDENTS.length * availableDays * SESSIONS.length;

  const totalDone = useMemo(
    () => Object.values(checked).filter(Boolean).length,
    [checked]
  );

  const overallPct = grandMax > 0 ? Math.round((totalDone / grandMax) * 100) : 0;

  const getStudentStats = (studentId) => {
    const maxForStudent = availableDays * SESSIONS.length;
    const done = WEEK_DAYS.reduce((sum, _, dayIdx) =>
      sum + SESSIONS.filter(s => checked[buildKey(studentId, dayIdx, s.key)]).length
    , 0);
    const pct = maxForStudent > 0 ? Math.round((done / maxForStudent) * 100) : 0;
    return { done, pct };
  };

  return (
    <div className="app">
      {reel && (
        <ReelModal
          student={reel.student}
          rowIdx={reel.rowIdx}
          activeVideo={reel.activeVideo}
          onChangeVideo={(activeVideo) => setReel(prev => ({ ...prev, activeVideo }))}
          onClose={() => setReel(null)}
        />
      )}

      <header className="app-header">
        <div className="header-content">
          <div className="header-left">
            <span className="header-logo">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="3"/>
                <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
                <line x1="3" y1="10" x2="21" y2="10"/>
                <circle cx="8" cy="15" r="1.2" fill="currentColor"/>
                <circle cx="12" cy="15" r="1.2" fill="currentColor"/>
              </svg>
            </span>
            <h1 className="header-title">Practice Tracker</h1>
            <span className="header-sep">·</span>
            <span className="header-subtitle">BMT · {WEEK_LABEL}</span>
          </div>
          <div className="header-stats">
            <div className="stat-chip">
              <span className="stat-num">{STUDENTS.length}</span>
              <span className="stat-label">Students</span>
            </div>
            <div className="stat-chip">
              <span className="stat-num">{totalDone}</span>
              <span className="stat-label">Done</span>
            </div>
            <div className="stat-chip stat-chip-accent">
              <span className="stat-num">{overallPct}%</span>
              <span className="stat-label">Overall</span>
            </div>
          </div>
        </div>
      </header>

      <main className="app-main">
        <div className="table-wrapper">
          <div className="table-scroll">
            <table className="tracker-table">
              <thead>
                <tr className="header-row-days">
                  <th className="th-num">#</th>
                  <th className="th-student">Student</th>
                  <th className="th-total">Progress</th>
                  {WEEK_DAYS.map((day, i) => (
                    <th
                      key={i}
                      colSpan={2}
                      className={[
                        'th-day',
                        day.isToday  ? 'th-day-today'  : '',
                        day.isFuture ? 'th-day-future' : '',
                      ].join(' ')}
                    >
                      <span className="day-name">{day.short}</span>
                      <span className="day-date">{day.date}</span>
                      {day.isToday && <span className="today-badge">Today</span>}
                    </th>
                  ))}
                </tr>
                <tr className="header-row-sessions">
                  <th className="th-session-spacer" colSpan={3} />
                  {WEEK_DAYS.map((day, dayIdx) =>
                    SESSIONS.map(session => (
                      <th
                        key={`${dayIdx}-${session.key}`}
                        className={[
                          'th-session',
                          `th-session-${session.key}`,
                          day.isToday  ? 'th-session-today'  : '',
                          day.isFuture ? 'th-session-future' : '',
                        ].join(' ')}
                      >
                        {session.icon}
                      </th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody>
                {STUDENTS.map((student, rowIdx) => {
                  const { pct } = getStudentStats(student.id);
                  const fillClass = pct >= 70 ? 'progress-high' : pct >= 35 ? 'progress-mid' : 'progress-low';
                  return (
                    <tr key={student.id} className="student-row">
                      <td className="td-num">{rowIdx + 1}</td>
                      <td className="td-student">
                        <div className="student-cell">
                          <span
                            className="avatar"
                            style={{
                              background: AVATAR_BG[rowIdx % AVATAR_BG.length],
                              color: AVATAR_FG[rowIdx % AVATAR_FG.length],
                            }}
                          >
                            {student.initials}
                          </span>
                          <span className="student-name">{student.name}</span>
                        </div>
                      </td>
                      <td className="td-total">
                        <div className="progress-wrap">
                          <div className="progress-track">
                            <div className={`progress-fill ${fillClass}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="progress-pct">{pct}%</span>
                        </div>
                      </td>
                      {WEEK_DAYS.map((day, dayIdx) =>
                        SESSIONS.map(session => {
                          const key = buildKey(student.id, dayIdx, session.key);
                          const on  = !!checked[key];
                          return (
                            <td
                              key={key}
                              className={[
                                'td-cell',
                                `td-cell-${session.key}`,
                                on           ? 'is-on'          : '',
                                day.isToday  ? 'td-cell-today'  : '',
                                day.isFuture ? 'td-cell-future' : '',
                              ].join(' ')}
                              onClick={() => handleCellClick(student, rowIdx, key, dayIdx)}
                              title={
                                day.isFuture ? `${day.short} is in the future`
                                : on         ? `▶ Watch ${student.name}'s video`
                                :              `${student.name} · ${day.short} · ${session.label}`
                              }
                            >
                              <span className="cell-dot" />
                            </td>
                          );
                        })
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <footer className="table-footer">
          <span className="legend-item">
            <span className="legend-dot legend-day" />
            Day session
          </span>
          <span className="legend-item">
            <span className="legend-dot legend-night" />
            Night session
          </span>
          <span className="legend-note">
            Tap a filled cell to watch the video
          </span>
        </footer>
      </main>
    </div>
  );
}
