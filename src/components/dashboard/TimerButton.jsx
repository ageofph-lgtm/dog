import React, { useState, useEffect, useRef } from "react";
import { Play, Pause, Square, Clock, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

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

export function formatDateTime(value) {
  if (!value) return null;
  return new Date(normalizeTimestampMs(value) ?? value).toLocaleString("pt-PT", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit"
  });
}

// ─── Persistência local (no-op, DB é a fonte de verdade) ────────────────────
export function saveTimerLocal(machine) {}
export function clearTimerLocal(machineId) {}
export function resolveTimerFields(machine) { return machine; }

// ─── Helpers de persistência real ────────────────────────────────────────────

const STATUS = {
  TODO: "A Fazer",
  RUNNING: "Em Progresso",
  PAUSED: "Pausado",
  DONE: "Concluída",
};

function hasOwn(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj || {}, key);
}

function normalizeTimestampMs(value) {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && value.trim() !== "") return numeric;
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function getActualStartMs(record) {
  return normalizeTimestampMs(record?.actualStartTime);
}

function getActualEndMs(record) {
  return normalizeTimestampMs(record?.actualEndDate ?? record?.actualEndTime ?? record?.timer_fim);
}

function getAccumulatedMs(record) {
  if (!record) return 0;

  const candidates = [];

  const actual = Number(record.actualTimeSpent);
  if (Number.isFinite(actual) && actual >= 0) candidates.push(actual);

  const legacyAccumulatedMinutes = Number(record.timer_acumulado);
  if (Number.isFinite(legacyAccumulatedMinutes) && legacyAccumulatedMinutes > 0) {
    candidates.push(legacyAccumulatedMinutes * 60 * 1000);
  }

  const legacyDurationMinutes = Number(record.timer_duracao_minutos);
  if (Number.isFinite(legacyDurationMinutes) && legacyDurationMinutes > 0) {
    candidates.push(legacyDurationMinutes * 60 * 1000);
  }

  return candidates.length ? Math.max(...candidates) : 0;
}

function isTimerRunning(record) {
  return getActualStartMs(record) !== null || (record?.timer_ativo === true && record?.timer_pausado !== true);
}

function getEntityForRecord(record) {
  const explicitEntity = record?.entityName || record?._entityName;
  if (explicitEntity && base44.entities?.[explicitEntity]) return base44.entities[explicitEntity];

  if (hasOwn(record, "status") && base44.entities?.OrdemServico) return base44.entities.OrdemServico;
  if (base44.entities?.FrotaACP) return base44.entities.FrotaACP;
  if (base44.entities?.OrdemServico) return base44.entities.OrdemServico;

  throw new Error("Não foi possível determinar a entidade para persistir o timer.");
}

function shouldWriteStatus(record) {
  return hasOwn(record, "status") || !hasOwn(record, "estado");
}

function buildStatusPayload(record, status) {
  return shouldWriteStatus(record) ? { status } : {};
}

function computeElapsed(m) {
  if (!m) return null;

  const actualStart = getActualStartMs(m);
  const accumulatedMs = getAccumulatedMs(m);

  // Fonte de verdade nova: ao montar/renderizar, se actualStartTime existir, o
  // cronómetro retoma em (Date.now() - actualStartTime) + actualTimeSpent.
  if (actualStart !== null) {
    return (accumulatedMs + Math.max(0, Date.now() - actualStart)) / 1000;
  }

  if (accumulatedMs > 0) return accumulatedMs / 1000;

  // Compatibilidade com dados legados ainda existentes no backend.
  const ativo   = m.timer_ativo   === true;
  const pausado = m.timer_pausado === true;
  const acumSec = (m.timer_acumulado || 0) * 60;

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

// ─── Hook de elapsed em tempo real ───────────────────────────────────────────
export function useElapsedTimer(machine) {
  const timerRef   = useRef(null);
  const machineRef = useRef(machine);
  const [elapsed, setElapsed] = useState(() => computeElapsed(machine));

  useEffect(() => { machineRef.current = machine; });

  useEffect(() => {
    clearInterval(timerRef.current);
    timerRef.current = null;

    const ativo = isTimerRunning(machine);

    if (ativo) {
      const tick = () => setElapsed(computeElapsed(machineRef.current));
      tick();
      timerRef.current = setInterval(tick, 1000);
    } else {
      setElapsed(computeElapsed(machine));
    }

    return () => { clearInterval(timerRef.current); timerRef.current = null; };
  }, [
    machine?.actualStartTime,
    machine?.actualTimeSpent,
    machine?.actualEndDate,
    machine?.actualEndTime,
    machine?.status,
    machine?.timer_ativo,
    machine?.timer_pausado,
    machine?.timer_inicio,
    machine?.timer_acumulado,
    machine?.timer_duracao_minutos,
  ]);

  return elapsed;
}

// ─── Componente principal ────────────────────────────────────────────────────

export default function TimerButton({
  machine, currentUser, userPermissions, onStart, onPause, onResume, onStop, onReset, onPersist, isAdmin
}) {
  const [loading,      setLoading]      = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmStop,  setConfirmStop]  = useState(false);
  const [localMachine, setLocalMachine] = useState(machine);

  useEffect(() => {
    setLocalMachine(prev => {
      if (prev?.id === machine?.id && isTimerRunning(prev) && !isTimerRunning(machine) && !getActualEndMs(prev)) {
        return prev;
      }
      return machine;
    });
  }, [machine]);

  const elapsed = useElapsedTimer(localMachine);

  const isAdminUser = isAdmin || userPermissions?.canMoveAnyMachine === true;
  const currentTechnician = currentUser?.nome_tecnico || userPermissions?.technicianName;
  const ownsMachine = Boolean(currentTechnician && localMachine?.tecnico === currentTechnician);
  const canControlTimer = isAdminUser || ownsMachine;

  const actualStart = getActualStartMs(localMachine);
  const accumulatedMs = getAccumulatedMs(localMachine);
  const status = localMachine?.status;
  const isLegacyActive = localMachine?.timer_ativo === true && localMachine?.timer_pausado !== true;
  const isLegacyPaused = localMachine?.timer_pausado === true;

  const ativo = isTimerRunning(localMachine);
  const pausado = !ativo && (status === STATUS.PAUSED || isLegacyPaused);
  const done = !ativo && (status === STATUS.DONE || getActualEndMs(localMachine) !== null || localMachine?.timer_fim);
  const idle = !ativo && !pausado && !done;

  const loadCanonicalRecord = async () => {
    if (!localMachine?.id) throw new Error("Registo sem id para persistir timer.");
    const entity = getEntityForRecord(localMachine);

    try {
      const records = await entity.list('-updated_date');
      const canonical = records?.find(record => record.id === localMachine.id);
      if (canonical) return { entity, record: canonical };
    } catch (err) {
      console.warn("[TimerButton] Não foi possível reler o timer antes da ação; usando estado atual.", err);
    }

    return { entity, record: localMachine };
  };

  const publishPersistedRecord = (record) => {
    setLocalMachine(record);
    if (typeof onPersist === "function") {
      onPersist(record);
    }
  };

  const persistTimerUpdate = async (entity, baseRecord, payload) => {
    if (!baseRecord?.id) throw new Error("Registo sem id para persistir timer.");
    const optimisticRecord = { ...baseRecord, ...payload };

    // A gravação no banco é a fonte de verdade. Só depois de persistir propagamos
    // a máquina atualizada para o card, para a listagem e para os outros ambientes.
    const updateResult = await entity.update(baseRecord.id, payload);
    const persistedRecord = updateResult && typeof updateResult === "object"
      ? { ...optimisticRecord, ...updateResult }
      : optimisticRecord;

    publishPersistedRecord(persistedRecord);
  };

  const ensureCanControlTimer = () => {
    if (canControlTimer) return true;
    alert("Sem permissão para controlar o timer desta máquina. Técnicos só podem iniciar/pausar/concluir as próprias máquinas.");
    return false;
  };

  const handlePlay = async () => {
    if (!ensureCanControlTimer()) return;

    const { entity, record } = await loadCanonicalRecord();
    if (isTimerRunning(record)) {
      publishPersistedRecord(record);
      return;
    }

    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const accumulated = getAccumulatedMs(record);
    const payload = {
      actualStartTime: nowIso,
      actualTimeSpent: accumulated,
      actualEndDate: null,
      actualEndTime: null,
      ...buildStatusPayload(record, STATUS.RUNNING),
      // Campos legados mantidos apenas para compatibilidade visual existente.
      timer_inicio: nowIso,
      timer_ativo: true,
      timer_pausado: false,
      timer_fim: null,
      timer_duracao_minutos: null,
      timer_acumulado: Math.round(accumulated / 60000),
    };
    await persistTimerUpdate(entity, record, payload);
  };

  const handlePause = async () => {
    if (!ensureCanControlTimer()) return;

    const { entity, record } = await loadCanonicalRecord();
    const now = Date.now();
    const start = getActualStartMs(record) ?? normalizeTimestampMs(record?.timer_inicio);
    const sessionMs = start !== null ? Math.max(0, now - start) : 0;
    const totalMs = getAccumulatedMs(record) + sessionMs;
    const payload = {
      actualTimeSpent: totalMs,
      actualStartTime: null,
      ...buildStatusPayload(record, STATUS.PAUSED),
      timer_ativo: false,
      timer_pausado: true,
      timer_acumulado: Math.round(totalMs / 60000),
    };
    await persistTimerUpdate(entity, record, payload);
  };

  const handleStop = async () => {
    if (!ensureCanControlTimer()) return;

    const { entity, record } = await loadCanonicalRecord();
    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const start = getActualStartMs(record) ?? normalizeTimestampMs(record?.timer_inicio);
    const sessionMs = start !== null ? Math.max(0, now - start) : 0;
    const totalMs = getAccumulatedMs(record) + (isTimerRunning(record) ? sessionMs : 0);
    const totalMinutes = Math.round(totalMs / 60000);
    const payload = {
      actualTimeSpent: totalMs,
      actualStartTime: null,
      actualEndDate: nowIso,
      actualEndTime: nowIso,
      ...buildStatusPayload(record, STATUS.DONE),
      timer_ativo: false,
      timer_pausado: false,
      timer_fim: nowIso,
      timer_duracao_minutos: totalMinutes,
      timer_acumulado: totalMinutes,
      dataConclusao: nowIso,
    };
    await persistTimerUpdate(entity, record, payload);
  };

  const handleReset = async () => {
    if (!isAdminUser) {
      alert("Apenas administradores podem resetar o timer.");
      return;
    }

    const { entity, record } = await loadCanonicalRecord();
    const payload = {
      actualStartTime: null,
      actualTimeSpent: 0,
      actualEndDate: null,
      actualEndTime: null,
      ...buildStatusPayload(record, STATUS.TODO),
      timer_ativo: false,
      timer_pausado: false,
      timer_inicio: null,
      timer_fim: null,
      timer_duracao_minutos: null,
      timer_acumulado: 0,
    };
    await persistTimerUpdate(entity, record, payload);
  };

  // Handler universal: usa onPointerDown para garantir que o evento é capturado
  // antes de qualquer outro listener (especialmente em containers com onClick global).
  const handleAction = async (action) => {
    if (loading) return;
    if (typeof action !== "function") {
      console.error("[TimerButton] Handler não é uma função:", action);
      return;
    }
    setLoading(true);
    try {
      await action();
    } catch (err) {
      console.error("[TimerButton] Erro na ação:", err);
    } finally {
      setLoading(false);
    }
  };

  // Wrapper para botão genérico
  const TimerActionButton = ({ onAction, disabled, className, children }) => (
    <button
      type="button"
      onPointerDown={(e) => { e.stopPropagation(); }}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onAction();
      }}
      disabled={disabled || loading}
      className={className}
    >
      {children}
    </button>
  );

  return (
    <div
      className="flex flex-col gap-1.5 w-full"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 flex-wrap">

        {/* INICIAR */}
        {idle && (
          <TimerActionButton
            onAction={() => handleAction(handlePlay)}
            disabled={loading || !canControlTimer}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold transition-all disabled:opacity-50 shadow cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" />
            Iniciar
          </TimerActionButton>
        )}

        {/* EM CURSO → PAUSAR + CONCLUIR */}
        {ativo && !pausado && (
          <>
            <TimerActionButton
              onAction={() => handleAction(handlePause)}
              disabled={loading || !canControlTimer}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-yellow-500 hover:bg-yellow-400 active:scale-95 text-white text-xs font-bold transition-all disabled:opacity-50 shadow cursor-pointer"
            >
              <Pause className="w-3.5 h-3.5" />
              Pausar
            </TimerActionButton>
            <TimerActionButton
              onAction={() => {
                if (!confirmStop) {
                  setConfirmStop(true);
                  setTimeout(() => setConfirmStop(false), 3000);
                  return;
                }
                setConfirmStop(false);
                handleAction(handleStop);
              }}
              disabled={loading || !canControlTimer}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-bold transition-all disabled:opacity-50 shadow cursor-pointer ${confirmStop ? "bg-red-700 animate-pulse" : "bg-red-600 hover:bg-red-500"}`}
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              {confirmStop ? "Confirmar?" : "Concluir"}
            </TimerActionButton>
          </>
        )}

        {/* PAUSADO → RETOMAR + CONCLUIR */}
        {pausado && (
          <>
            <TimerActionButton
              onAction={() => handleAction(handlePlay)}
              disabled={loading || !canControlTimer}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white text-xs font-bold transition-all disabled:opacity-50 shadow cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              Retomar
            </TimerActionButton>
            <TimerActionButton
              onAction={() => {
                if (!confirmStop) {
                  setConfirmStop(true);
                  setTimeout(() => setConfirmStop(false), 3000);
                  return;
                }
                setConfirmStop(false);
                handleAction(handleStop);
              }}
              disabled={loading || !canControlTimer}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white text-xs font-bold transition-all disabled:opacity-50 shadow cursor-pointer ${confirmStop ? "bg-red-700 animate-pulse" : "bg-red-600 hover:bg-red-500"}`}
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              {confirmStop ? "Confirmar?" : "Concluir"}
            </TimerActionButton>
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
        {isAdminUser && (localMachine?.actualStartTime || localMachine?.actualTimeSpent || localMachine?.timer_inicio) && (
          <TimerActionButton
            onAction={() => {
              if (!confirmReset) {
                setConfirmReset(true);
                setTimeout(() => setConfirmReset(false), 3000);
                return;
              }
              setConfirmReset(false);
              handleAction(handleReset);
            }}
            disabled={loading}
            className={`flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50 ml-auto cursor-pointer ${
              confirmReset
                ? "bg-orange-600 text-white animate-pulse"
                : "bg-slate-200 hover:bg-slate-300 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
            }`}
          >
            <Trash2 className="w-3 h-3" />
            {confirmReset ? "Confirmar?" : "Reset"}
          </TimerActionButton>
        )}
      </div>

      {/* Cronómetro ao vivo */}
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

      {/* Pausado */}
      {pausado && elapsed !== null && (
        <div className="flex items-center gap-2 font-mono">
          <Pause className="w-3 h-3 text-yellow-500" />
          <span className="text-sm font-black text-yellow-500 tabular-nums">
            {formatDuration(elapsed)}
          </span>
          <span className="text-[10px] text-slate-400">pausado</span>
        </div>
      )}

      {/* Metadados */}
      {(localMachine?.actualStartTime || localMachine?.timer_inicio) && (
        <div className="text-[10px] text-slate-400 leading-tight space-y-0.5 mt-0.5">
          <p>▶ Início: {formatDateTime(localMachine.actualStartTime || localMachine.timer_inicio)}</p>
          {(localMachine?.actualEndDate || localMachine?.actualEndTime || localMachine?.timer_fim) && (
            <p>⏹ Fim: {formatDateTime(localMachine.actualEndDate || localMachine.actualEndTime || localMachine.timer_fim)}</p>
          )}
        </div>
      )}
    </div>
  );
}
