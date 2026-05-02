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

export function formatDurationMin(minutes) {
  if (minutes === null || minutes === undefined) return null;
  return formatDuration(Math.round(minutes) * 60 * 1000);
}

export function formatDateTime(value) {
  if (!value) return null;
  const date = typeof value === 'string' ? new Date(value) : new Date(value);
  return date.toLocaleString("pt-PT", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit"
  });
}

// ─── Persistência local (Stubs para compatibilidade) ─────────────────────────
export function saveTimerLocal(machine) {}
export function clearTimerLocal(machineId) {}
export function resolveTimerFields(machine) { return machine; }
export function useElapsedTimer(machine) { return 0; }

// ─── Componente principal ────────────────────────────────────────────────────

export default function TimerButton({
  osId,
  initialStartTime, // ISO string ou timestamp de quando o play foi dado
  accumulatedTime,  // tempo guardado em milissegundos
  updateTimerDB,    // função updateTimerDB(osId, isRunning, startTime, newAccumulated)
  isDark = false
}) {
  const [elapsedTime, setElapsedTime] = useState(accumulatedTime || 0);
  const isRunning = !!initialStartTime;

  useEffect(() => {
    let intervalId;
    
    const calculateTime = () => {
      if (isRunning && initialStartTime) {
        const startTime = typeof initialStartTime === 'string' 
          ? new Date(initialStartTime).getTime() 
          : initialStartTime;
        const now = Date.now();
        const currentElapsed = (accumulatedTime || 0) + (now - startTime);
        setElapsedTime(currentElapsed);
      } else {
        setElapsedTime(accumulatedTime || 0);
      }
    };

    // Calcular imediatamente para evitar delay de 1s
    calculateTime();

    if (isRunning) {
      intervalId = setInterval(calculateTime, 1000);
    }

    return () => clearInterval(intervalId);
  }, [isRunning, initialStartTime, accumulatedTime]);

  const handleToggle = async () => {
    const now = Date.now();
    if (!isRunning) {
      // Se vai dar Play: Passamos o tempo atual como base para o novo acumulado
      if (typeof updateTimerDB === "function") {
        await updateTimerDB(osId, true, now, elapsedTime);
      }
    } else {
      // Se vai dar Pause: O novo acumulado é o tempo decorrido até agora
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
          transition: 'all 0.2s'
        }}
      >
        {isRunning ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" style={{ marginLeft: '2px' }} />}
      </button>
    </div>
  );
}
