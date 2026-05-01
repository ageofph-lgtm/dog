import React, { useState, useEffect, useRef } from "react";
import { Play, Pause, Square, Clock, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import {
  deriveTimerState,
  readTimerStateFromMachine,
  readTimerTotals,
  withTimerStateMarker,
  stripTimerStateMarkers,
} from "@/lib/timerHistorico";

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
  const ms = normalizeTimestampMs(value);
  return new Date(ms ?? value).toLocaleString("pt-PT", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit"
  });
}

// ─── Persistência local (no-op, DB é a fonte de verdade) ────────────────────
export function saveTimerLocal(machine) {}
export function clearTimerLocal(machineId) {}
export function resolveTimerFields(machine) { return machine; }

// ─── Helpers internos ────────────────────────────────────────────────────────

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

function computeElapsedSeconds(machine) {
  if (!machine) return null;
  const totals = readTimerTotals(machine);
  if (totals.runningSinceMs !== null) {
    return (totals.accumulatedMs + Math.max(0, Date.now() - totals.runningSinceMs)) / 1000;
  }
  if (totals.accumulatedMs > 0) return totals.accumulatedMs / 1000;
  // Compatibilidade com dados antigos sem marker mas com timer_duracao_minutos.
  const legacyDur = Number(machine.timer_duracao_minutos);
  if (Number.isFinite(legacyDur) && legacyDur > 0) return legacyDur * 60;
  return null;
}

// ─── Hook de elapsed em tempo real ───────────────────────────────────────────
export function useElapsedTimer(machine) {
  const timerRef   = useRef(null);
  const machineRef = useRef(machine);
  const [elapsed, setElapsed] = useState(() => computeElapsedSeconds(machine));

  useEffect(() => { machineRef.current = machine; });

  const marker = readTimerStateFromMachine(machine);

  useEffect(() => {
    clearInterval(timerRef.current);
    timerRef.current = null;

    const running = deriveTimerState(machine) === 'running';

    if (running) {
      const tick = () => setElapsed(computeElapsedSeconds(machineRef.current));
      tick();
      timerRef.current = setInterval(tick, 1000);
    } else {
      setElapsed(computeElapsedSeconds(machine));
    }

    return () => { clearInterval(timerRef.current); timerRef.current = null; };
  }, [
    marker?.state,
    marker?.startTime,
    marker?.accumulatedMs,
    marker?.updatedAt,
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

// ─── Componente principal (utilizado em fluxos legados; o Dashboard tem UI inline) ─

export default function TimerButton({
  machine, currentUser, userPermissions, onPersist, isAdmin
}) {
  const [loading,      setLoading]      = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmStop,  setConfirmStop]  = useState(false);
  const [localMachine, setLocalMachine] = useState(machine);

  useEffect(() => {
    setLocalMachine(prev => {
      if (
        prev?.id === machine?.id
        && deriveTimerState(prev) === 'running'
        && deriveTimerState(machine) !== 'running'
        && !machine?.actualEndDate
        && !machine?.actualEndTime
        && !machine?.timer_fim
      ) {
        return prev;
      }
      return machine;
    });
  }, [machine]);

  const elapsed = useElapsedTimer(localMachine);
  const state = deriveTimerState(localMachine);
  const totals = readTimerTotals(localMachine);

  const isAdminUser = isAdmin || userPermissions?.canMoveAnyMachine === true;
  const currentTechnician = currentUser?.nome_tecnico || userPermissions?.technicianName;
  const ownsMachine = Boolean(currentTechnician && localMachine?.tecnico === currentTechnician);
  const canControlTimer = isAdminUser || ownsMachine;

  const ativo = state === 'running';
  const pausado = state === 'paused';
  const done = state === 'done';
  const idle = state === 'idle';

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

    let updateResult;
    try {
      updateResult = await entity.update(baseRecord.id, payload);
    } catch (err) {
      console.error("[TimerButton] Falha ao persistir timer:", err);
      throw err;
    }
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

  const buildMarkerPayload = (record, nextMarker) => ({
    historico: withTimerStateMarker(record?.historico, nextMarker),
  });

  const author = () => currentUser?.nome_tecnico || currentUser?.perfil || (isAdminUser ? 'admin' : 'sistema');

  const handlePlay = async () => {
    if (!ensureCanControlTimer()) return;

    const { entity, record } = await loadCanonicalRecord();
    if (deriveTimerState(record) === 'running') {
      publishPersistedRecord(record);
      return;
    }

    const now = Date.now();
    const nowIso = new Date(now).toISOString();
    const accumulated = readTimerTotals(record).accumulatedMs;
    const payload = {
      ...buildMarkerPayload(record, {
        state: 'running',
        startTime: nowIso,
        accumulatedMs: accumulated,
        updatedAt: nowIso,
        by: author(),
      }),
      actualStartTime: nowIso,
      actualTimeSpent: accumulated,
      actualEndDate: null,
      actualEndTime: null,
      ...buildStatusPayload(record, STATUS.RUNNING),
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
    const totals = readTimerTotals(record);
    const sessionMs = totals.runningSinceMs !== null ? Math.max(0, now - totals.runningSinceMs) : 0;
    const totalMs = totals.accumulatedMs + sessionMs;
    const nowIso = new Date(now).toISOString();
    const payload = {
      ...buildMarkerPayload(record, {
        state: 'paused',
        startTime: null,
        accumulatedMs: totalMs,
        updatedAt: nowIso,
        by: author(),
      }),
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
    const totals = readTimerTotals(record);
    const sessionMs = totals.runningSinceMs !== null ? Math.max(0, now - totals.runningSinceMs) : 0;
    const totalMs = totals.accumulatedMs + sessionMs;
    const totalMinutes = Math.round(totalMs / 60000);
    const payload = {
      ...buildMarkerPayload(record, {
        state: 'done',
        startTime: null,
        accumulatedMs: totalMs,
        updatedAt: nowIso,
        by: author(),
      }),
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
      historico: stripTimerStateMarkers(record?.historico),
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

  const hasAnyTimerData = totals.accumulatedMs > 0 || totals.runningSinceMs !== null
    || localMachine?.actualStartTime || localMachine?.actualTimeSpent || localMachine?.timer_inicio;

  return (
    <div
      className="flex flex-col gap-1.5 w-full"
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-2 flex-wrap">

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

        {done && (
          <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-500">
            <Clock className="w-3.5 h-3.5" />
            {formatDuration(elapsed)}
          </span>
        )}

        {isAdminUser && hasAnyTimerData && (
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

      {pausado && elapsed !== null && (
        <div className="flex items-center gap-2 font-mono">
          <Pause className="w-3 h-3 text-yellow-500" />
          <span className="text-sm font-black text-yellow-500 tabular-nums">
            {formatDuration(elapsed)}
          </span>
          <span className="text-[10px] text-slate-400">pausado</span>
        </div>
      )}

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
