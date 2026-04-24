import React, { useState, useEffect, useRef } from "react";
import { Play, Square, Clock, Trash2 } from "lucide-react";

/**
 * TimerButton — botão de timer para máquinas no Watcher
 * 
 * Props:
 *   machine      — objeto FrotaACP completo
 *   onStart      — async (machineId) => void
 *   onStop       — async (machineId) => void
 *   onReset      — async (machineId) => void  [só admin]
 *   isAdmin      — boolean
 */

function formatDuration(minutes) {
  if (!minutes && minutes !== 0) return null;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}min`;
  return `${h}h${m > 0 ? ` ${m}min` : ""}`;
}

function formatDateTime(isoString) {
  if (!isoString) return null;
  const d = new Date(isoString);
  return d.toLocaleString("pt-PT", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit"
  });
}

export function useElapsedTimer(timerInicio, timerAtivo) {
  const [elapsed, setElapsed] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    if (timerAtivo && timerInicio) {
      const update = () => {
        const diff = (Date.now() - new Date(timerInicio).getTime()) / 1000 / 60;
        setElapsed(diff);
      };
      update();
      ref.current = setInterval(update, 10000); // atualiza cada 10s
    } else {
      clearInterval(ref.current);
      setElapsed(null);
    }
    return () => clearInterval(ref.current);
  }, [timerAtivo, timerInicio]);

  return elapsed;
}

export default function TimerButton({ machine, onStart, onStop, onReset, isAdmin }) {
  const [loading, setLoading] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const timerAtivo = machine.timer_ativo === true;
  const timerInicio = machine.timer_inicio || null;
  const timerFim = machine.timer_fim || null;
  const timerDuracao = machine.timer_duracao_minutos || null;

  const elapsed = useElapsedTimer(timerInicio, timerAtivo);

  const handleStart = async (e) => {
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    try { await onStart(machine.id); } finally { setLoading(false); }
  };

  const handleStop = async (e) => {
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    try { await onStop(machine.id); } finally { setLoading(false); }
  };

  const handleReset = async (e) => {
    e.stopPropagation();
    if (!confirmReset) { setConfirmReset(true); setTimeout(() => setConfirmReset(false), 3000); return; }
    setLoading(true);
    try { await onReset(machine.id); } finally { setLoading(false); setConfirmReset(false); }
  };

  // Estado: concluído com duração registada
  const isDone = !timerAtivo && timerFim && timerDuracao !== null;
  // Estado: em curso
  const isRunning = timerAtivo && timerInicio;
  // Estado: sem timer
  const isIdle = !timerAtivo && !timerFim;

  return (
    <div className="flex flex-col gap-1 w-full" onClick={e => e.stopPropagation()}>
      {/* Linha principal: botão + tempo */}
      <div className="flex items-center gap-2">
        {isIdle && (
          <button
            onClick={handleStart}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold transition-all disabled:opacity-50 shadow-md"
            title="Iniciar timer"
          >
            <Play className="w-3.5 h-3.5" />
            <span>Iniciar</span>
          </button>
        )}

        {isRunning && (
          <>
            <button
              onClick={handleStop}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 active:scale-95 text-white text-xs font-bold transition-all disabled:opacity-50 shadow-md"
              title="Parar timer"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Parar</span>
            </button>
            {elapsed !== null && (
              <span className="flex items-center gap-1 text-xs font-mono text-emerald-400 animate-pulse">
                <Clock className="w-3 h-3" />
                {formatDuration(elapsed)}
              </span>
            )}
          </>
        )}

        {isDone && (
          <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-400">
            <Clock className="w-3.5 h-3.5" />
            {formatDuration(timerDuracao)}
          </span>
        )}

        {/* Botão reset — só admin */}
        {isAdmin && (timerInicio || timerFim) && (
          <button
            onClick={handleReset}
            disabled={loading}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50 ml-auto ${
              confirmReset
                ? "bg-orange-600 hover:bg-orange-500 text-white animate-pulse"
                : "bg-slate-700 hover:bg-slate-600 text-slate-300"
            }`}
            title={confirmReset ? "Clique de novo para confirmar" : "Remover timer (admin)"}
          >
            <Trash2 className="w-3 h-3" />
            {confirmReset ? "Confirmar?" : "Reset"}
          </button>
        )}
      </div>

      {/* Metadados: quando iniciou / terminou */}
      {timerInicio && (
        <div className="text-[10px] text-slate-400 leading-tight">
          {isRunning
            ? `▶ Iniciado: ${formatDateTime(timerInicio)}`
            : `▶ ${formatDateTime(timerInicio)}`}
          {timerFim && ` → ${formatDateTime(timerFim)}`}
        </div>
      )}
    </div>
  );
}
