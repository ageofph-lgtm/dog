import React, { useState, useEffect } from "react";
import { LogOut, Menu, X, Download, Sun, Moon, Zap } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { usePermissions } from "@/components/hooks/usePermissions";
import ProfileSelector from "./components/auth/ProfileSelector";
import { useTheme } from "./ThemeContext";

const LOGO_URL = "https://media.base44.com/images/public/69c166ad19149fb0c07883cb/0063feaf2_Gemini_Generated_Image_scmohbscmohbscmo.png";

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  pink:   '#FF2D78',
  blue:   '#4D9FFF',
  purple: '#9B5CF6',
  dark: {
    bg:       '#09090F',
    nav:      'rgba(9,9,15,0.97)',
    border:   '#1A1A2E',
    text:     '#F0F0FF',
    muted:    '#4A4A6A',
  },
  light: {
    bg:       '#F4F4FF',
    nav:      'rgba(255,255,255,0.97)',
    border:   '#E0E0F0',
    text:     '#0A0A1A',
    muted:    '#8080A0',
  },
};

export default function Layout({ children, currentPageName }) {
  const { isDark, toggleTheme } = useTheme();
  const [user, setUser]                       = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingUser, setIsLoadingUser]     = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [deferredPrompt, setDeferredPrompt]   = useState(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  const theme = isDark ? T.dark : T.light;
  const navH  = 52;
  const bannerH = 48;

  // ── PWA ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('/service-worker.js').catch(() => {});
    const onPrompt = (e) => {
      e.preventDefault();
      if (!(window.matchMedia('(display-mode: standalone)').matches || navigator.standalone)) {
        setDeferredPrompt(e);
        setTimeout(() => setShowInstallBanner(true), 2000);
      }
    };
    const onInstalled = () => { setShowInstallBanner(false); setDeferredPrompt(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => { window.removeEventListener('beforeinstallprompt', onPrompt); window.removeEventListener('appinstalled', onInstalled); };
  }, []);

  const isBannerActive = showInstallBanner && deferredPrompt && !window.matchMedia('(display-mode: standalone)').matches;

  useEffect(() => {
    const bH = isBannerActive ? bannerH : 0;
    document.documentElement.style.setProperty('--pwa-banner-height-var', `${bH}px`);
    document.documentElement.style.setProperty('--nav-total-height', `${navH + bH}px`);
  }, [isBannerActive]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null); setShowInstallBanner(false);
  };

  // ── Auth ────────────────────────────────────────────────────────────────────
  useEffect(() => { loadUser(); }, []);

  const loadUser = async () => {
    try {
      const u = await base44.auth.me();
      if (u && u.perfil && u.ativo !== false) { setUser(u); setIsAuthenticated(true); }
      else setIsAuthenticated(false);
    } catch { setIsAuthenticated(false); }
    finally { setIsLoadingUser(false); }
  };

  const handleLogin  = (u) => { setUser(u); setIsAuthenticated(true); };
  const handleLogout = async () => {
    try { await base44.auth.updateMe({ perfil: null, nome_tecnico: null, ativo: false }); } catch {}
    setUser(null); setIsAuthenticated(false);
  };

  const displayName = () => {
    if (user?.perfil === 'admin') return 'Admin';
    if (user?.perfil === 'tecnico' && user?.nome_tecnico)
      return user.nome_tecnico.charAt(0).toUpperCase() + user.nome_tecnico.slice(1);
    return user?.full_name || 'User';
  };

  useEffect(() => { document.body.style.overflow = isMobileMenuOpen ? 'hidden' : ''; }, [isMobileMenuOpen]);

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (isLoadingUser) return (
    <div style={{ minHeight: '100vh', background: T.dark.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px' }}>
      <img src={LOGO_URL} alt="WATCHER" style={{ width: '120px', height: '120px', objectFit: 'contain', filter: 'drop-shadow(0 0 24px rgba(255,45,120,0.6))' }} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: 'monospace', fontSize: '24px', fontWeight: 900, letterSpacing: '0.2em', color: T.pink, textShadow: `0 0 20px ${T.pink}` }}>WATCHER</div>
        <div style={{ fontFamily: 'monospace', fontSize: '10px', color: T.dark.muted, letterSpacing: '0.15em', marginTop: '4px' }}>[UNIT-PINK-01] INITIALIZING...</div>
      </div>
      <div style={{ width: '48px', height: '48px', border: `2px solid transparent`, borderTopColor: T.pink, borderRightColor: T.blue, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  if (!isAuthenticated) return <ProfileSelector onLogin={handleLogin} />;

  return (
    <div style={{ minHeight: '100vh', background: theme.bg, backgroundImage: isDark
      ? `radial-gradient(ellipse at 20% 0%, rgba(255,45,120,0.06) 0%, transparent 50%), radial-gradient(ellipse at 80% 0%, rgba(77,159,255,0.06) 0%, transparent 50%)`
      : `radial-gradient(ellipse at 20% 0%, rgba(255,45,120,0.03) 0%, transparent 50%), radial-gradient(ellipse at 80% 0%, rgba(77,159,255,0.03) 0%, transparent 50%)` }}>

      {/* ── PWA Banner ──────────────────────────────────────────────────────── */}
      {isBannerActive && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200, height: `${bannerH}px`, background: `linear-gradient(135deg, ${T.pink}, ${T.purple})`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', boxShadow: `0 4px 20px rgba(255,45,120,0.4)` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Download size={16} color="white" />
            <span style={{ color: 'white', fontSize: '13px', fontWeight: 600, letterSpacing: '0.05em' }}>Instalar WATCHER</span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={handleInstallClick} style={{ padding: '4px 12px', background: 'white', color: T.pink, borderRadius: '4px', border: 'none', fontWeight: 700, fontSize: '12px', cursor: 'pointer' }}>INSTALAR</button>
            <button onClick={() => setShowInstallBanner(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'white' }}><X size={16} /></button>
          </div>
        </div>
      )}

      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <nav style={{
        position: 'fixed', top: isBannerActive ? `${bannerH}px` : 0, left: 0, right: 0, zIndex: 100,
        height: `${navH}px`,
        background: theme.nav,
        backdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${theme.border}`,
        boxShadow: isDark ? `0 1px 0 rgba(255,45,120,0.2), 0 4px 30px rgba(0,0,0,0.5)` : `0 1px 0 rgba(255,45,120,0.15), 0 4px 20px rgba(0,0,0,0.06)`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px',
      }}>

        {/* Pink+Blue gradient top line */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, transparent, ${T.pink} 30%, ${T.blue} 70%, transparent)` }} />

        {/* ── Nav controls only — logo está no hero do dashboard ─────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {/* mini logo apenas para identificação da aba/PWA */}
          <img src={LOGO_URL} alt="W" style={{ width: '30px', height: '30px', objectFit: 'contain', opacity: 0.7, filter: 'drop-shadow(0 0 6px rgba(255,45,120,0.4))' }} />
          <span style={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: 700, letterSpacing: '0.12em', color: T.pink, opacity: 0.7 }}>WATCHER</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>

          {/* Theme toggle — ONE button, global */}
          <button onClick={toggleTheme} style={{
            width: '36px', height: '36px', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(255,45,120,0.3)' : 'rgba(77,159,255,0.3)'}`,
            background: isDark ? 'rgba(255,45,120,0.08)' : 'rgba(77,159,255,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.2s',
          }}>
            {isDark ? <Sun size={16} color="#FFB800" /> : <Moon size={16} color={T.blue} />}
          </button>

          {/* User chip — desktop */}
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', borderRadius: '8px', border: `1px solid rgba(255,45,120,0.2)`, background: isDark ? 'rgba(255,45,120,0.06)' : 'rgba(255,45,120,0.04)', }} className="hidden-mobile">
              <div style={{ width: '30px', height: '30px', borderRadius: '6px', background: `linear-gradient(135deg, ${T.pink}, ${T.purple})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '13px', color: 'white', fontFamily: 'monospace' }}>
                {displayName().charAt(0).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: theme.text, fontFamily: 'monospace', letterSpacing: '0.05em' }}>{displayName()}</div>
                <div style={{ fontSize: '9px', color: T.pink, fontFamily: 'monospace', letterSpacing: '0.08em' }}>{user.perfil === 'admin' ? '[ADMIN]' : '[TÉC]'}</div>
              </div>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22C55E', boxShadow: '0 0 8px rgba(34,197,94,0.8)', marginLeft: '2px' }} />
              <button onClick={handleLogout} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: theme.muted, marginLeft: '4px' }}>
                <LogOut size={14} />
              </button>
            </div>
          )}

          {/* Mobile hamburger */}
          <button onClick={() => setIsMobileMenuOpen(true)} className="show-mobile" style={{ width: '36px', height: '36px', borderRadius: '8px', border: `1px solid rgba(255,45,120,0.3)`, background: 'rgba(255,45,120,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <Menu size={18} color={T.pink} />
          </button>
        </div>
      </nav>

      {/* ── Mobile drawer ───────────────────────────────────────────────────── */}
      {isMobileMenuOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 150 }}>
          <div onClick={() => setIsMobileMenuOpen(false)} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'absolute', top: 0, right: 0, width: '280px', height: '100%', background: isDark ? '#0F0F1A' : '#FFFFFF', borderLeft: `1px solid rgba(255,45,120,0.2)`, display: 'flex', flexDirection: 'column' }}>
            <div style={{ height: '2px', background: `linear-gradient(90deg, ${T.pink}, ${T.blue})` }} />
            <div style={{ padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <img src={LOGO_URL} alt="W" style={{ width: '36px', height: '36px', objectFit: 'contain' }} />
                  <span style={{ fontFamily: 'monospace', fontWeight: 900, fontSize: '16px', letterSpacing: '0.15em', color: theme.text }}>WATCHER</span>
                </div>
                <button onClick={() => setIsMobileMenuOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.pink }}><X size={20} /></button>
              </div>
              {user && (
                <div style={{ padding: '14px', borderRadius: '10px', border: `1px solid rgba(255,45,120,0.2)`, background: isDark ? 'rgba(255,45,120,0.06)' : 'rgba(255,45,120,0.04)', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <div style={{ width: '40px', height: '40px', borderRadius: '8px', background: `linear-gradient(135deg, ${T.pink}, ${T.purple})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '16px', color: 'white' }}>
                      {displayName().charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '14px', color: theme.text, fontFamily: 'monospace' }}>{displayName()}</div>
                      <div style={{ fontSize: '10px', color: T.pink, fontFamily: 'monospace' }}>{user.perfil === 'admin' ? '[ADMIN]' : '[TÉCNICO]'}</div>
                    </div>
                    <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22C55E', boxShadow: '0 0 8px rgba(34,197,94,0.8)', marginLeft: 'auto' }} />
                  </div>
                  <button onClick={handleLogout} style={{ width: '100%', padding: '10px', borderRadius: '6px', background: `linear-gradient(135deg, ${T.pink}, ${T.purple})`, color: 'white', border: 'none', fontFamily: 'monospace', fontWeight: 700, fontSize: '12px', letterSpacing: '0.1em', cursor: 'pointer' }}>
                    TERMINAR SESSÃO
                  </button>
                </div>
              )}
              <button onClick={toggleTheme} style={{ width: '100%', padding: '12px', borderRadius: '8px', border: `1px solid ${isDark ? 'rgba(255,184,0,0.2)' : 'rgba(77,159,255,0.2)'}`, background: isDark ? 'rgba(255,184,0,0.06)' : 'rgba(77,159,255,0.06)', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                {isDark ? <Sun size={16} color="#FFB800" /> : <Moon size={16} color={T.blue} />}
                <span style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 700, color: theme.text, letterSpacing: '0.08em' }}>{isDark ? 'MODO CLARO' : 'MODO ESCURO'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Page content ────────────────────────────────────────────────────── */}
      <main style={{ paddingTop: `${navH + (isBannerActive ? bannerH : 0)}px`, minHeight: '100vh' }}>
        {children}
      </main>

      <style>{`
        @media (max-width: 768px) { .hidden-mobile { display: none !important; } }
        @media (min-width: 769px) { .show-mobile { display: none !important; } }
      `}</style>
    </div>
  );
}
