import React, { useState, useEffect } from "react";
import { Play, Pause, Clock } from "lucide-react";

// ─── Formatadores ────────────────────────────────────────────────────────────

export function formatDuration(ms) {
  if (ms === null || ms === undefined || isNaN(ms)) return "00:00";
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = n => String(n).padStart(2, "0");
  if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`;
  return `${pad(m)}:${pad(sec)}`;
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function TimerButton({
  osId,
  initialStartTime, // timestamp de quando o play foi dado
  accumulatedTime,  // tempo guardado em milissegundos
  updateTimerDB,    // função updateTimerDB(osId, isRunning, startTime, newAccumulated)
  isDark = false
}) {
  const [isRunning, setIsRunning] = useState(!!initialStartTime);
  const [elapsedTime, setElapsedTime] = useState(accumulatedTime || 0);

  useEffect(() => {
    let intervalId;
    if (isRunning && initialStartTime) {
      intervalId = setInterval(() => {
        const now = Date.now();
        // O tempo atual é o acumulado + a diferença desde o último Play
        const startTime = typeof initialStartTime === 'string' 
          ? new Date(initialStartTime).getTime() 
          : initialStartTime;
        setElapsedTime((accumulatedTime || 0) + (now - startTime));
      }, 1000);
    } else {
      setElapsedTime(accumulatedTime || 0);
    }
    return () => clearInterval(intervalId);
  }, [isRunning, initialStartTime, accumulatedTime]);

  const handleToggle = async () => {
    const now = Date.now();
    if (!isRunning) {
      // Se vai dar Play
      setIsRunning(true);
      if (typeof updateTimerDB === "function") {
        await updateTimerDB(osId, true, now, elapsedTime);
      }
    } else {
      // Se vai dar Pause
      setIsRunning(false);
      if (typeof updateTimerDB === "function") {
        await updateTimerDB(osId, false, null, elapsedTime);
      }
    }
  };

  const C = {
    text: isDark ? '#E8E8FF' : '#080818',
    muted: isDark ? '#9090C8' : '#8888AA',
    border: isDark ? '#2A2A50' : '#E0E0F0',
    bg: isDark ? '#161630' : '#F8F8FF',
    green: '#22C55E',
    yellow: '#EAB308',
  };

  return (
    <div style={{ 
      display: 'flex', 
      alignItems: 'center', 
      gap: '12px',
      padding: '8px 12px',
      borderRadius: '8px',
      background: C.bg,
      border: `1px solid ${C.border}`
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
        <Clock size={16} color={isRunning ? C.green : C.muted} />
        <span style={{ 
          fontFamily: 'monospace', 
          fontSize: '16px', 
          fontWeight: 700, 
          color: isRunning ? C.green : C.text 
        }}>
          {formatDuration(elapsedTime)}
        </span>
      </div>

      <button
        onClick={handleToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          border: 'none',
          cursor: 'pointer',
          background: isRunning ? C.yellow : C.green,
          color: '#fff',
          transition: 'transform 0.1s active'
        }}
      >
        {isRunning ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" style={{ marginLeft: '2px' }} />}
      </button>
    </div>
  );
}
