import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { createRoot } from 'react-dom/client';

const PASSCODE = '123456';

// Fond d'écran local (fichier dans ton projet) + lien de secours
const WALLPAPER_LOCAL = './wallpaper.jpg';
const WALLPAPER_ONLINE =
  'https://www.iclarified.com/files/ios/iClarified-iPhone-Duo-Wallpaper/iClarified-iPhone-Duo-Wallpaper-Outer-Light.jpg';

const BOOT_KEY = 'ios27_booted';

const APPLE_PATH =
  'M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701';

/* ---------- Boot : une seule fois ---------- */
let bootedInMemory = false;

function hasBooted() {
  if (bootedInMemory) return true;
  try {
    return localStorage.getItem(BOOT_KEY) === '1';
  } catch (e) {
    return false;
  }
}

function markBooted() {
  bootedInMemory = true;
  try {
    localStorage.setItem(BOOT_KEY, '1');
  } catch (e) {
    // stockage indisponible : on garde seulement la mémoire
  }
}

function formatTime(date) {
  return date
    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
    .replace(/\s?[AP]M/, '');
}

function formatDate(date) {
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function Boot({ ready, onDone }) {
  const [progress, setProgress] = useState(0);
  
  useEffect(() => {
    const id = setInterval(() => {
      setProgress((prev) => {
        const target = ready ? 100 : 85;
        const next = prev + (target - prev) * 0.08 + 0.3;
        return Math.min(next, target);
      });
    }, 50);
    return () => clearInterval(id);
  }, [ready]);
  
  useEffect(() => {
    if (progress >= 99.9) onDone();
  }, [progress]);
  
  return (
    <div className="boot">
      <svg className="apple-logo" viewBox="0 0 24 24">
        <path d={APPLE_PATH} />
      </svg>
      <div className="boot-track">
        <div className="boot-fill" style={{ width: progress + '%' }}></div>
      </div>
    </div>
  );
}

function Clock() {
  const [now, setNow] = useState(new Date());
  
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  
  return (
    <>
      <div className="lock-date">{formatDate(now)}</div>
      <div className="lock-time">{formatTime(now)}</div>
    </>
  );
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

const Keypad = memo(function Keypad({ onDigit, onAction }) {
  return (
    <div className="keypad">
      {KEYS.map((k) => (
        <button key={k} className="key" onPointerDown={() => onDigit(k)}>
          {k}
        </button>
      ))}
      <div className="key-empty"></div>
      <button className="key" onPointerDown={() => onDigit('0')}>
        0
      </button>
      <ActionButton onAction={onAction} />
    </div>
  );
});

function ActionButton({ onAction }) {
  const [label, setLabel] = useState('Cancel');
  useEffect(() => {
    onAction.setLabel = setLabel;
    return () => {
      onAction.setLabel = null;
    };
  }, [onAction]);
  return (
    <button className="key-text" onPointerDown={() => onAction()}>
      {label}
    </button>
  );
}

function Passcode({ onSuccess, onCancel }) {
  const [length, setLength] = useState(0);
  const [shake, setShake] = useState(false);
  const code = useRef('');
  const busy = useRef(false);
  
  const sync = () => {
    setLength(code.current.length);
  };
  
  const onDigit = useCallback((digit) => {
    if (busy.current || code.current.length >= 6) return;
    code.current += digit;
    sync();
    onAction.setLabel && onAction.setLabel('Delete');
    
    if (code.current.length === 6) {
      busy.current = true;
      if (code.current === PASSCODE) {
        setTimeout(onSuccess, 120);
      } else {
        setShake(true);
        setTimeout(() => {
          setShake(false);
          code.current = '';
          busy.current = false;
          sync();
          onAction.setLabel && onAction.setLabel('Cancel');
        }, 450);
      }
    }
  }, []);
  
  const onAction = useCallback(() => {
    if (busy.current) return;
    if (code.current.length > 0) {
      code.current = code.current.slice(0, -1);
      sync();
      onAction.setLabel && onAction.setLabel(code.current.length > 0 ? 'Delete' : 'Cancel');
    } else {
      onCancel();
    }
  }, []);
  
  return (
    <div className="passcode">
      <div className="passcode-title">Enter Passcode</div>

      <div className={'dots' + (shake ? ' shake' : '')}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className={'dot' + (i < length ? ' filled' : '')}></div>
        ))}
      </div>

      <Keypad onDigit={onDigit} onAction={onAction} />
    </div>
  );
}

function App() {
  // Si l'iPhone a déjà démarré une fois, on saute le logo Apple
  const [screen, setScreen] = useState(hasBooted() ? 'lock' : 'boot'); // boot | lock | passcode | home
  const [src, setSrc] = useState(WALLPAPER_LOCAL);
  const [loaded, setLoaded] = useState(false);
  const startY = useRef(null);
  
  // Précharge et décode le fond d'écran (local d'abord, en ligne en secours)
  useEffect(() => {
    let cancelled = false;
    let triedOnline = false;
    
    const finish = () => {
      if (!cancelled) setLoaded(true);
    };
    
    const load = (url) => {
      const img = new Image();
      img.onload = () => {
        if (cancelled) return;
        setSrc(url);
        if (img.decode) {
          img.decode().then(finish, finish);
        } else {
          finish();
        }
      };
      img.onerror = () => {
        if (!triedOnline) {
          triedOnline = true;
          load(WALLPAPER_ONLINE);
        } else {
          finish();
        }
      };
      img.src = url;
    };
    
    load(WALLPAPER_LOCAL);
    
    const timeout = setTimeout(finish, 10000);
    
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, []);
  
  const onPointerDown = (e) => {
    startY.current = e.clientY;
  };
  
  const onPointerUp = (e) => {
    if (startY.current === null) return;
    const diff = startY.current - e.clientY;
    startY.current = null;
    if (diff > 50 && screen === 'lock') {
      setScreen('passcode');
    }
  };
  
  const bootDone = useCallback(() => {
    markBooted();
    setScreen('lock');
  }, []);
  
  return (
    <div className="iphone">
      <div
        className="screen"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        <img
          className={'wallpaper' + (loaded ? ' ready' : '')}
          src={src}
          alt=""
          draggable="false"
        />

        {screen === 'passcode' && <div className="tint"></div>}

        <div className="dynamic-island"></div>

        {screen === 'boot' && <Boot ready={loaded} onDone={bootDone} />}

        {screen === 'lock' && (
          <>
            <Clock />
            <div className="swipe-bar"></div>
          </>
        )}

        {screen === 'passcode' && (
          <Passcode
            onSuccess={() => setScreen('home')}
            onCancel={() => setScreen('lock')}
          />
        )}
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById('root'));
root.render(<App />);