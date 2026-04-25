import React, { useState, useEffect } from "react";
import { LogOut, Sun, Moon, Download, X } from "lucide-react";
import { base44 } from "@/api/base44Client";
import ProfileSelector from "./components/auth/ProfileSelector";
import { useTheme } from "./ThemeContext";

const T = {
  pink:   '#FF2D78',
  blue:   '#4D9FFF',
  purple: '#9B5CF6',
  dark:  { bg: '#09090F', nav: 'rgba(9,9,15,0.97)', border: '#1A1A2E', text: '#F0F0FF', muted: '#6060A0' },
  light: { bg: '#F4F4FF', nav: 'rgba(255,255,255,0.97)', border: '#E0E0F0', text: '#0A0A1A', muted: '#8080A0' },
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

  const theme = isDark ? T.dark : T.light;

  // ── PWA ─────────────────────────────────────────────────────────────
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

  // ── Auth ─────────────────────────────────────────────────────────────
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
    setUser(u);
    setIsAuthenticated(true);
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

  // ── Loading ──────────────────────────────────────────────────────────
  if (isLoadingUser) return (
    <div style={{ minHeight: '100vh', background: T.dark.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
      <img src={LOGO_URL} alt="WATCHER" style={{ width: '100px', height: '100px', objectFit: 'contain', filter: 'drop-shadow(0 0 24px rgba(255,45,120,0.6))' }} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'monospace', fontSize: '22px', fontWeight: 900, letterSpacing: '0.2em', color: T.pink }}>WATCHER</div>
        <div style={{ fontFamily: 'monospace', fontSize: '10px', color: T.dark.muted, letterSpacing: '0.15em', marginTop: '4px' }}>INITIALIZING...</div>
      </div>
      <div style={{ width: '40px', height: '40px', border: '2px solid transparent', borderTopColor: T.pink, borderRightColor: T.blue, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!isAuthenticated) return <ProfileSelector onLogin={handleLogin} />;

  return (
    <LayoutUserContext.Provider value={{ user, setUser, handleLogout, handleLogin }}>
      <div style={{
        minHeight: '100vh',
        background: theme.bg,
        backgroundImage: isDark
          ? `radial-gradient(ellipse at 20% 0%, rgba(255,45,120,0.05) 0%, transparent 50%), radial-gradient(ellipse at 80% 0%, rgba(77,159,255,0.05) 0%, transparent 50%)`
          : `radial-gradient(ellipse at 20% 0%, rgba(255,45,120,0.02) 0%, transparent 50%), radial-gradient(ellipse at 80% 0%, rgba(77,159,255,0.02) 0%, transparent 50%)`,
      }}>

        {/* PWA Banner */}
        {isBannerActive && (
          <div style={{ background: `linear-gradient(135deg, ${T.pink}, ${T.purple})`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', height: '48px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Download size={16} color="white" />
              <span style={{ color: 'white', fontSize: '13px', fontWeight: 600 }}>Instalar WATCHER</span>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleInstallClick} style={{ padding: '4px 12px', background: 'white', color: T.pink, borderRadius: '4px', border: 'none', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}>INSTALAR</button>
              <button onClick={() => setShowInstallBanner(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'white' }}><X size={16} /></button>
            </div>
          </div>
        )}

        {/* CONTEÚDO PRINCIPAL */}
        <main style={{ minHeight: '100vh' }}>
          {children}
        </main>

        {/* FOOTER — não fixo, aparece naturalmente no fim da página */}
        <footer style={{
          borderTop: `1px solid ${theme.border}`,
          background: theme.nav,
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 20px',
          position: 'relative',
        }}>
          {/* Linha de acento no topo do footer */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '1px', background: `linear-gradient(90deg, transparent, ${T.pink} 30%, ${T.blue} 70%, transparent)` }} />

          {/* Toggle dark/light */}
          <button onClick={toggleTheme} style={{
            width: '38px', height: '38px', borderRadius: '8px',
            border: `1px solid ${isDark ? 'rgba(255,184,0,0.3)' : 'rgba(77,159,255,0.3)'}`,
            background: isDark ? 'rgba(255,184,0,0.08)' : 'rgba(77,159,255,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}>
            {isDark ? <Sun size={17} color="#FFB800" /> : <Moon size={17} color={T.blue} />}
          </button>

          {/* User chip */}
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: `linear-gradient(135deg, ${T.pink}, ${T.purple})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, fontSize: '14px', color: 'white', fontFamily: 'monospace' }}>
                {displayName().charAt(0)}
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: theme.text, fontFamily: 'monospace', letterSpacing: '0.06em' }}>{displayName()}</div>
                <div style={{ fontSize: '9px', color: T.pink, fontFamily: 'monospace', letterSpacing: '0.1em' }}>
                  {user.perfil === 'admin' ? '[ADMIN]' : '[TÉC]'}
                </div>
              </div>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#22C55E', boxShadow: '0 0 8px rgba(34,197,94,0.8)' }} />
              <button onClick={handleLogout} title="Sair / Trocar perfil" style={{ background: 'none', border: `1px solid ${theme.border}`, borderRadius: '6px', cursor: 'pointer', padding: '6px 10px', color: theme.muted, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <LogOut size={13} />
                <span style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 700 }}>SAIR</span>
              </button>
            </div>
          )}
        </footer>

      </div>
    </LayoutUserContext.Provider>
  );
}
