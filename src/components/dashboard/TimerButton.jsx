import React, { useState, useEffect, useRef } from "react";
import { Play, Pause, Square, Clock, Trash2 } from "lucide-react";

// ─── Formatadores ────────────────────────────────────────────────────────────

export function formatDuration(seconds) {
  if (seconds === null || seconds === undefined || isNaN(seconds)) return null;
  const s = Math.max(0, Math.floor(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = n => String(n).padStart(2, "0");
  if (h > 0) return `${h}:${pad(m)}:${pad(sec)}`;
  return `${pad(m)}:${pad(sec)}`;
}

export function formatDurationMin(minutes) {
  if (minutes === null || minutes === undefined) return null;
  return formatDuration(Math.round(minutes) * 60);
}

export function formatDateTime(isoString) {
  if (!isoString) return null;
  return new Date(isoString).toLocaleString("pt-PT", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit"
  });
}

// ─── Persistência local do timer ─────────────────────────────────────────────
// (Removida para garantir que o estado da DB seja a única fonte de verdade)
export function saveTimerLocal(machine) {}
export function clearTimerLocal(machineId) {}
export function resolveTimerFields(machine) { return machine; }

// ─── Hook de elapsed ────────────────────────────────────────────────────────
// Retorna segundos decorridos em tempo real.
// Usa machineRef para evitar stale closures no setInterval.

export function useElapsedTimer(machine) {
  const timerRef   = useRef(null);
  const machineRef = useRef(machine);
  const [elapsed, setElapsed] = useState(() => computeElapsed(machine));

  // Sincronizar o ref sempre que a prop muda (sem criar dependência no effect)
  useEffect(() => { machineRef.current = machine; });

  useEffect(() => {
    clearInterval(timerRef.current);
    timerRef.current = null;

    const ativo   = machine?.timer_ativo   === true;
    const pausado = machine?.timer_pausado === true;

    if (ativo && !pausado) {
      const tick = () => setElapsed(computeElapsed(machineRef.current));
      tick();
      timerRef.current = setInterval(tick, 1000);
    } else {
      setElapsed(computeElapsed(machine));
    }

    return () => { clearInterval(timerRef.current); timerRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    machine?.timer_ativo,
    machine?.timer_pausado,
    machine?.timer_inicio,
    machine?.timer_acumulado,
    machine?.timer_duracao_minutos,
  ]);

  return elapsed; // segundos
}

// Calcula segundos decorridos a partir dos campos da máquina
function computeElapsed(m) {
  if (!m) return null;
  const ativo   = m.timer_ativo   === true;
  const pausado = m.timer_pausado === true;
  const acumSec = (m.timer_acumulado || 0) * 60; // acumulado está em minutos na DB

  if (ativo && !pausado && m.timer_inicio) {
    const diff = (Date.now() - new Date(m.timer_inicio).getTime()) / 1000;
    return acumSec + diff;
  }
  if (pausado) return acumSec;
  if (!ativo && m.timer_duracao_minutos != null) {
    return m.timer_duracao_minutos * 60;
  }
  return null;
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function TimerButton({
  machine, onStart, onPause, onResume, onStop, onReset, isAdmin
}) {
  const [loading,      setLoading]      = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmStop,  setConfirmStop]  = useState(false);

  const elapsed = useElapsedTimer(machine); // segundos

  const ativo   = machine?.timer_ativo   === true;
  const pausado = machine?.timer_pausado === true;
  const done    = !ativo && machine?.timer_fim;
  const idle    = !ativo && !machine?.timer_inicio;

  // Persistência robusta: salvar tempo acumulado no unmount se estiver ativo
  const elapsedRef = useRef(elapsed);
  useEffect(() => {
    elapsedRef.current = elapsed;
  }, [elapsed]);

  useEffect(() => {
    return () => {
      // Se o componente for desmontado e o timer estiver ativo, 
      // poderíamos tentar salvar, mas como o Dashboard já lida com o estado global,
      // e o timer_inicio + timer_acumulado na DB já permitem reconstruir o tempo,
      // não precisamos de um save forçado aqui que poderia causar race conditions.
    };
  }, []);

  const wrap = (fn) => async (e) => {
    e.stopPropagation();
    if (loading) return;
    setLoading(true);
    try { await fn(); } finally { setLoading(false); }
  };

  // elapsed em minutos para passar aos handlers (DB guarda em minutos)
  const elapsedMin = elapsed !== null ? elapsed / 60 : 0;

  return (
    <div className="flex flex-col gap-1.5 w-full" onClick={e => e.stopPropagation()}>

      {/* ── Botões ── */}
      <div className="flex items-center gap-2 flex-wrap">

        {/* INICIAR */}
        {idle && (
          <button
            onClick={wrap(() => onStart(machine.id))}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold transition-all disabled:opacity-50 shadow"
          >
            <Play className="w-3.5 h-3.5" />
            Iniciar
          </button>
        )}

        {/* EM CURSO → PAUSAR + CONCLUIR */}
        {ativo && !pausado && (
          <>
            <button
              onClick={wrap(() => onPause(machine.id, elapsedMin))}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-500 hover:bg-yellow-400 active:scale-95 text-white text-xs font-bold transition-all disabled:opacity-50 shadow"
            >
              <Pause className="w-3.5 h-3.5" />
              Pausar
            </button>
            <button
              onClick={wrap(async () => {
                if (!confirmStop) {
                  setConfirmStop(true);
                  setTimeout(() => setConfirmStop(false), 3000);
                  return;
                }
                setConfirmStop(false);
                await onStop(machine.id, elapsedMin);
              })}
              disabled={loading}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-bold transition-all disabled:opacity-50 shadow ${confirmStop ? "bg-red-700 animate-pulse" : "bg-red-600 hover:bg-red-500"}`}
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              {confirmStop ? "Confirmar?" : "Concluir"}
            </button>
          </>
        )}

        {/* PAUSADO → RETOMAR + CONCLUIR */}
        {pausado && (
          <>
            <button
              onClick={wrap(() => onResume(machine.id))}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold transition-all disabled:opacity-50 shadow"
            >
              <Play className="w-3.5 h-3.5" />
              Retomar
            </button>
            <button
              onClick={wrap(async () => {
                if (!confirmStop) {
                  setConfirmStop(true);
                  setTimeout(() => setConfirmStop(false), 3000);
                  return;
                }
                setConfirmStop(false);
                await onStop(machine.id, elapsedMin);
              })}
              disabled={loading}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-bold transition-all disabled:opacity-50 shadow ${confirmStop ? "bg-red-700 animate-pulse" : "bg-red-600 hover:bg-red-500"}`}
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              {confirmStop ? "Confirmar?" : "Concluir"}
            </button>
          </>
        )}

        {/* CONCLUÍDO */}
        {done && (
          <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-500">
            <Clock className="w-3.5 h-3.5" />
            {formatDuration(elapsed)}
          </span>
        )}

        {/* RESET — só admin */}
        {isAdmin && machine?.timer_inicio && (
          <button
            onClick={wrap(async () => {
              if (!confirmReset) {
                setConfirmReset(true);
                setTimeout(() => setConfirmReset(false), 3000);
                return;
              }
              setConfirmReset(false);
              await onReset(machine.id);
            })}
            disabled={loading}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50 ml-auto ${
              confirmReset
                ? "bg-orange-600 text-white animate-pulse"
                : "bg-slate-200 hover:bg-slate-300 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
            }`}
          >
            <Trash2 className="w-3 h-3" />
            {confirmReset ? "Confirmar?" : "Reset"}
          </button>
        )}
      </div>

      {/* ── Cronómetro ao vivo ── */}
      {ativo && !pausado && elapsed !== null && (
        <div className="flex items-center gap-2 font-mono">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-sm font-black text-emerald-500 tabular-nums tracking-wide">
            {formatDuration(elapsed)}
          </span>
          <span className="text-[10px] text-slate-400">em curso</span>
        </div>
      )}

      {/* ── Pausado ── */}
      {pausado && elapsed !== null && (
        <div className="flex items-center gap-2 font-mono">
          <Pause className="w-3 h-3 text-yellow-500" />
          <span className="text-sm font-black text-yellow-500 tabular-nums">
            {formatDuration(elapsed)}
          </span>
          <span className="text-[10px] text-slate-400">pausado</span>
        </div>
      )}

      {/* ── Metadados ── */}
      {machine?.timer_inicio && (
        <div className="text-[10px] text-slate-400 leading-tight space-y-0.5 mt-0.5">
          <p>▶ Início: {formatDateTime(machine.timer_inicio)}</p>
          {machine?.timer_fim && <p>⏹ Fim: {formatDateTime(machine.timer_fim)}</p>}
        </div>
      )}
    </div>
  );
}
