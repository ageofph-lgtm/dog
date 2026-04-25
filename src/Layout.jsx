import React, { useState, useEffect } from "react";
import { LogOut, Sun, Moon, Download, X, Zap } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ProfileSelector from "./components/auth/ProfileSelector";
import { useTheme } from "./ThemeContext";

const T = {
  pink:   '#FF2D78',
  blue:   '#4D9FFF',
  purple: '#9B5CF6',
  green:  '#22C55E',
  dark:  { bg: '#06060D', nav: 'rgba(6,6,13,0.98)', border: '#1A1A2F', text: '#E4E6FF', muted: '#5A5A8A' },
  light: { bg: '#E4E6EE', nav: 'rgba(232,234,245,0.97)', border: '#BFC3D8', text: '#0B0C18', muted: '#626480' },
};

const LOGO_URL = "https://media.base44.com/images/public/69c166ad19149fb0c07883cb/0063feaf2_Gemini_Generated_Image_scmohbscmohbscmo.png";

export const LayoutUserContext = React.createContext(null);

export default function Layout({ children }) {
  const { isDark, toggleTheme } = useTheme();
  const [user, setUser]               = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingUser, setIsLoadingUser]     = useState(true);
  const [deferredPrompt, setDeferredPrompt]   = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [tick, setTick] = useState(0); // clock

  const theme = isDark ? T.dark : T.light;

  // Clock
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  const now = new Date();
  const timeStr = now.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  // PWA
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/service-worker.js').catch(() => {});
    const onPrompt = (e) => {
      e.preventDefault();
      if (!window.matchMedia('(display-mode: standalone)').matches && !navigator.standalone) {
        setDeferredPrompt(e);
        setTimeout(() => setShowInstallBanner(true), 2000);
      }
    };
    const onInstalled = () => { setShowInstallBanner(false); setDeferredPrompt(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const isBannerActive = showInstallBanner && !!deferredPrompt &&
    !window.matchMedia('(display-mode: standalone)').matches;

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null); setShowInstallBanner(false);
  };

  // Auth
  useEffect(() => { loadUser(); }, []);

  const loadUser = async () => {
    try {
      const saved = localStorage.getItem('watcher_profile');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.perfil) {
          setUser(parsed); setIsAuthenticated(true);
          setIsLoadingUser(false); return;
        }
      }
      const u = await base44.auth.me();
      if (u?.perfil) { setUser(u); setIsAuthenticated(true); }
      else setIsAuthenticated(false);
    } catch { setIsAuthenticated(false); }
    finally { setIsLoadingUser(false); }
  };

  const handleLogin = (u) => {
    setUser(u); setIsAuthenticated(true);
    localStorage.setItem('watcher_profile', JSON.stringify(u));
  };

  const handleLogout = async () => {
    try { await base44.auth.updateMe({ perfil: null, nome_tecnico: null, ativo: false }); } catch {}
    localStorage.removeItem('watcher_profile');
    setUser(null); setIsAuthenticated(false);
  };

  const displayName = () => {
    if (user?.perfil === 'admin') return 'ADMIN';
    if (user?.nome_tecnico) return user.nome_tecnico.toUpperCase();
    return 'USER';
  };

  const roleLabel = user?.perfil === 'admin' ? 'SYS_ADMIN' : 'TEC_01';

  // Loading screen
  if (isLoadingUser) return (
    <div style={{
      minHeight: '100vh',
      background: '#06060D',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: '24px',
      backgroundImage: `
        linear-gradient(rgba(255,45,120,0.05) 1px, transparent 1px),
        linear-gradient(90deg, rgba(77,159,255,0.03) 1px, transparent 1px)
      `,
      backgroundSize: '40px 40px',
    }}>
      {/* Glow orb */}
      <div style={{ position: 'absolute', top: '30%', left: '50%', transform: 'translate(-50%,-50%)', width: '300px', height: '300px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,45,120,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <img src={LOGO_URL} alt="WATCHER" style={{ width: '88px', height: '88px', objectFit: 'contain', filter: 'drop-shadow(0 0 28px rgba(255,45,120,0.7)) drop-shadow(0 0 8px rgba(255,45,120,0.4))' }} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: "'Orbitron', monospace", fontSize: '26px', fontWeight: 900, letterSpacing: '0.28em', color: '#FF2D78', textShadow: '0 0 20px rgba(255,45,120,0.8), 0 0 40px rgba(255,45,120,0.4)' }}>WATCHER</div>
        <div style={{ fontFamily: 'monospace', fontSize: '9px', color: '#5A5A8A', letterSpacing: '0.2em', marginTop: '6px', textTransform: 'uppercase' }}>SYSTEM BOOT</div>
      </div>

      {/* Barra de loading */}
      <div style={{ width: '180px', height: '2px', background: 'rgba(255,45,120,0.15)', borderRadius: '1px', overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', background: 'linear-gradient(90deg, #FF2D78, #4D9FFF)', borderRadius: '1px', animation: 'loadbar 1.2s ease-in-out infinite' }} />
      </div>
      <div style={{ fontFamily: 'monospace', fontSize: '9px', color: '#5A5A8A', letterSpacing: '0.15em' }}>INITIALIZING...</div>
      <style>{`
        @keyframes loadbar {
          0%   { width: 0%;    left: 0; }
          50%  { width: 80%;   left: 0; }
          100% { width: 0%;    left: 100%; }
        }
      `}</style>
    </div>
  );

  if (!isAuthenticated) return <ProfileSelector onLogin={handleLogin} />;

  return (
    <LayoutUserContext.Provider value={{ user, setUser, handleLogout, handleLogin }}>
      <div style={{
        minHeight: '100vh',
        background: theme.bg,
        backgroundImage: isDark
          ? `
            radial-gradient(ellipse at 15% 0%, rgba(255,45,120,0.07) 0%, transparent 45%),
            radial-gradient(ellipse at 85% 0%, rgba(77,159,255,0.07) 0%, transparent 45%),
            radial-gradient(ellipse at 50% 100%, rgba(155,92,246,0.04) 0%, transparent 50%),
            linear-gradient(rgba(255,45,120,0.04) 1px, transparent 1px),
            linear-gradient(90deg, rgba(77,159,255,0.025) 1px, transparent 1px)
          `
          : `
            radial-gradient(ellipse at 15% 0%, rgba(255,45,120,0.04) 0%, transparent 45%),
            radial-gradient(ellipse at 85% 0%, rgba(77,159,255,0.04) 0%, transparent 45%),
            linear-gradient(rgba(255,45,120,0.025) 1px, transparent 1px),
            linear-gradient(90deg, rgba(77,159,255,0.018) 1px, transparent 1px)
          `,
        backgroundSize: 'auto, auto, auto, 40px 40px, 40px 40px',
        display: 'flex', flexDirection: 'column',
      }}>

        {/* PWA Banner */}
        {isBannerActive && (
          <div className="install-banner" style={{ background: `linear-gradient(135deg, ${T.pink}, ${T.purple})`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', height: '44px', borderBottom: '1px solid rgba(255,255,255,0.15)', flexShrink: 0, zIndex: 9999 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Download size={15} color="white" />
              <span style={{ color: 'white', fontSize: '12px', fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.06em' }}>INSTALAR WATCHER</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleInstallClick} style={{ padding: '4px 14px', background: 'white', color: T.pink, borderRadius: '3px', border: 'none', fontWeight: 800, fontSize: '11px', cursor: 'pointer', letterSpacing: '0.08em', fontFamily: 'monospace' }}>INSTALL</button>
              <button onClick={() => setShowInstallBanner(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(255,255,255,0.8)' }}><X size={16} /></button>
            </div>
          </div>
        )}

        {/* CONTEÚDO PRINCIPAL */}
        <main style={{ flex: 1, minHeight: 0, overflowX: 'hidden' }}>
          {children}
        </main>

        {/* FOOTER CYBER */}
        <footer style={{
          borderTop: `1px solid ${theme.border}`,
          background: isDark
            ? 'linear-gradient(180deg, rgba(6,6,13,0.98) 0%, rgba(9,9,16,1) 100%)'
            : theme.nav,
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px',
          position: 'relative',
          flexShrink: 0,
          gap: '8px',
          flexWrap: 'wrap',
        }}>
          {/* Linha topo gradiente */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: `linear-gradient(90deg, transparent 0%, ${T.pink} 25%, ${T.blue} 75%, transparent 100%)`, opacity: isDark ? 0.9 : 0.5 }} />

          {/* Left: Toggle + clock */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button onClick={toggleTheme} style={{
              width: '36px', height: '36px', borderRadius: '6px',
              border: `1px solid ${isDark ? 'rgba(255,184,0,0.35)' : 'rgba(77,159,255,0.35)'}`,
              background: isDark ? 'rgba(255,184,0,0.07)' : 'rgba(77,159,255,0.07)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              flexShrink: 0,
              transition: 'all 0.15s',
            }}>
              {isDark
                ? <Sun size={15} color="#FFB800" style={{ filter: 'drop-shadow(0 0 4px rgba(255,184,0,0.7))' }} />
                : <Moon size={15} color={T.blue} />
              }
            </button>

            {/* Clock — hide on very small */}
            <div style={{ fontFamily: 'monospace', fontSize: '10px', color: isDark ? '#5A5A8A' : '#8080A0', letterSpacing: '0.08em', display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Zap size={9} color={T.pink} style={{ opacity: 0.7 }} />
              <span style={{ color: isDark ? '#4D9FFF' : T.blue, fontWeight: 700 }}>{timeStr}</span>
            </div>
          </div>

          {/* Right: user chip */}
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {/* Avatar */}
              <div style={{
                width: '30px', height: '30px', borderRadius: '6px',
                background: `linear-gradient(135deg, ${T.pink}, ${T.purple})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 900, fontSize: '13px', color: 'white', fontFamily: 'monospace',
                boxShadow: isDark ? '0 0 12px rgba(255,45,120,0.5)' : 'none',
                flexShrink: 0,
              }}>
                {displayName().charAt(0)}
              </div>

              <div style={{ lineHeight: 1.2 }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: theme.text, fontFamily: 'monospace', letterSpacing: '0.07em' }}>{displayName()}</div>
                <div style={{ fontSize: '8px', color: T.pink, fontFamily: 'monospace', letterSpacing: '0.1em', textShadow: isDark ? '0 0 6px rgba(255,45,120,0.6)' : 'none' }}>[{roleLabel}]</div>
              </div>

              {/* Online dot */}
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22C55E', boxShadow: '0 0 8px rgba(34,197,94,0.9)', flexShrink: 0 }} className="animate-dot-blink" />

              <button onClick={handleLogout} title="Sair / Trocar perfil" style={{
                background: 'none',
                border: `1px solid ${isDark ? 'rgba(255,45,120,0.25)' : theme.border}`,
                borderRadius: '5px', cursor: 'pointer',
                padding: '5px 9px', color: theme.muted,
                display: 'flex', alignItems: 'center', gap: '4px',
                transition: 'all 0.15s', fontFamily: 'monospace',
              }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,45,120,0.6)'; e.currentTarget.style.color = T.pink; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = isDark ? 'rgba(255,45,120,0.25)' : theme.border; e.currentTarget.style.color = theme.muted; }}
              >
                <LogOut size={12} />
                <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.1em' }}>SAIR</span>
              </button>
            </div>
          )}
        </footer>

      </div>
    </LayoutUserContext.Provider>
  );
}
