// Helpers para o timer das máquinas FrotaACP.
//
// O schema da entidade FrotaACP no Base44 não tem (todos) os campos
// `actualStartTime`, `timer_*`, etc., portanto qualquer write directo é
// silenciosamente descartado. Em vez disso, o estado canónico do timer fica
// dentro do array `historico` (campo que sabemos persistir), como uma única
// entrada-marcador `tipo: 'timer_state'` que substitui a anterior a cada acção.
//
// Os campos `timer_*`/`actualStartTime` continuam a ser escritos em paralelo
// para o caso de o schema os incluir; mas a fonte de verdade para leitura
// passa a ser este marker.

export const TIMER_STATE_TIPO = 'timer_state';

const VALID_STATES = new Set(['idle', 'running', 'paused', 'done']);

function toFiniteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toMs(value) {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const numeric = Number(value);
    if (Number.isFinite(numeric) && value.trim() !== '') return numeric;
    const parsed = new Date(value).getTime();
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

export function findTimerStateMarker(historico) {
  if (!Array.isArray(historico)) return null;
  for (let i = historico.length - 1; i >= 0; i--) {
    const entry = historico[i];
    if (entry && entry.tipo === TIMER_STATE_TIPO) return entry;
  }
  return null;
}

export function readTimerStateFromMachine(machine) {
  const marker = findTimerStateMarker(machine?.historico);
  if (!marker) return null;
  const state = VALID_STATES.has(marker.state) ? marker.state : 'idle';
  return {
    state,
    startTime: marker.startTime || null,
    accumulatedMs: Math.max(0, toFiniteNumber(marker.accumulatedMs, 0)),
    updatedAt: marker.updatedAt || null,
    by: marker.by || null,
    restoredFromBackup: !!marker.restoredFromBackup,
  };
}

export function stripTimerStateMarkers(historico) {
  if (!Array.isArray(historico)) return [];
  return historico.filter((entry) => !entry || entry.tipo !== TIMER_STATE_TIPO);
}

export function withTimerStateMarker(historico, marker) {
  const cleaned = stripTimerStateMarkers(historico);
  const entry = {
    tipo: TIMER_STATE_TIPO,
    state: VALID_STATES.has(marker?.state) ? marker.state : 'idle',
    startTime: marker?.startTime || null,
    accumulatedMs: Math.max(0, toFiniteNumber(marker?.accumulatedMs, 0)),
    updatedAt: marker?.updatedAt || new Date().toISOString(),
    by: marker?.by || null,
  };
  if (marker?.restoredFromBackup) entry.restoredFromBackup = true;
  return [...cleaned, entry];
}

// Estado derivado da máquina, consultando primeiro o marker no historico e
// caindo de seguida nos campos legados/novos do schema.
export function deriveTimerState(machine) {
  const marker = readTimerStateFromMachine(machine);
  if (marker) return marker.state;

  if (machine?.actualStartTime) return 'running';
  if (machine?.timer_ativo === true && machine?.timer_pausado !== true) return 'running';
  if (machine?.status === 'Pausado' || machine?.timer_pausado === true) return 'paused';
  if (
    machine?.status === 'Concluída'
    || machine?.actualEndDate
    || machine?.actualEndTime
    || machine?.timer_fim
  ) return 'done';
  return 'idle';
}

// Decompõe o tempo em (accumulatedMs, runningSinceMs|null) para evitar duplicação
// de lógica entre o cronómetro vivo e os totais no card.
export function readTimerTotals(machine) {
  const marker = readTimerStateFromMachine(machine);
  if (marker) {
    const startMs = marker.state === 'running' ? toMs(marker.startTime) : null;
    return {
      accumulatedMs: marker.accumulatedMs,
      runningSinceMs: startMs,
      source: 'marker',
    };
  }

  const actualStartMs = toMs(machine?.actualStartTime);
  const actualSpent = toFiniteNumber(machine?.actualTimeSpent, NaN);
  const legacyAcum = toFiniteNumber(machine?.timer_acumulado, NaN);
  const legacyDur = toFiniteNumber(machine?.timer_duracao_minutos, NaN);

  let accumulatedMs = 0;
  if (Number.isFinite(actualSpent) && actualSpent >= 0) accumulatedMs = Math.max(accumulatedMs, actualSpent);
  if (Number.isFinite(legacyAcum) && legacyAcum > 0) accumulatedMs = Math.max(accumulatedMs, legacyAcum * 60 * 1000);
  if (Number.isFinite(legacyDur) && legacyDur > 0) accumulatedMs = Math.max(accumulatedMs, legacyDur * 60 * 1000);

  if (actualStartMs !== null) {
    return { accumulatedMs, runningSinceMs: actualStartMs, source: 'actual' };
  }
  if (machine?.timer_ativo === true && machine?.timer_pausado !== true) {
    const legacyStartMs = toMs(machine?.timer_inicio);
    return { accumulatedMs, runningSinceMs: legacyStartMs, source: 'legacy' };
  }
  return { accumulatedMs, runningSinceMs: null, source: 'fallback' };
}

// Defesa contra restauros: qualquer marker em estado `running` é convertido
// para `paused`, capando o tempo decorrido em `backupTimestamp`. Preserva o
// tempo acumulado até ao momento do backup; descarta o tempo "fantasma" entre
// o backup e o restauro. Marca `restoredFromBackup` para auditoria.
export function freezeRunningTimersInHistorico(historico, backupTimestamp) {
  if (!Array.isArray(historico)) return historico;
  const cutoffMs = toMs(backupTimestamp) ?? Date.now();
  let mutated = false;
  const out = historico.map((entry) => {
    if (!entry || entry.tipo !== TIMER_STATE_TIPO) return entry;
    if (entry.state !== 'running') return entry;
    const startMs = toMs(entry.startTime);
    const sessionMs = startMs !== null ? Math.max(0, cutoffMs - startMs) : 0;
    const totalMs = Math.max(0, toFiniteNumber(entry.accumulatedMs, 0)) + sessionMs;
    mutated = true;
    return {
      ...entry,
      state: 'paused',
      startTime: null,
      accumulatedMs: totalMs,
      updatedAt: new Date(cutoffMs).toISOString(),
      restoredFromBackup: true,
    };
  });
  return mutated ? out : historico;
}

export function countRunningTimerMarkers(historico) {
  if (!Array.isArray(historico)) return 0;
  let n = 0;
  for (const entry of historico) {
    if (entry && entry.tipo === TIMER_STATE_TIPO && entry.state === 'running') n++;
  }
  return n;
}
