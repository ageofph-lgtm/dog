import { FrotaACP } from "@/entities/all";
import { base44 } from "@/api/base44Client";
import {
  withTimerStateMarker,
  stripTimerStateMarkers,
  readTimerTotals,
} from "@/lib/timerHistorico";

function normalizeTimerTimestampMs(value) {
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

const getTimerAccumulatedMs = (machine) => readTimerTotals(machine).accumulatedMs;

const getTimerStartMs = (machine) => {
  const totals = readTimerTotals(machine);
  if (totals.runningSinceMs !== null) return totals.runningSinceMs;
  return normalizeTimerTimestampMs(machine?.actualStartTime)
    ?? normalizeTimerTimestampMs(machine?.timer_inicio);
};

// Hook que devolve os 5 handlers do timer da frota. Recebe dependências do
// Dashboard como config para se manter desacoplado do componente.
export function useFrotaTimer({
  machines,
  setMachines,
  setSelectedMachine,
  loadMachines,
  currentUser,
  userPermissions,
  syncMachineToPortal,
}) {
  const isTimerAdmin = Boolean(
    userPermissions?.canMoveAnyMachine || currentUser?.perfil === 'admin'
  );

  const canControlMachineTimer = (machine) => {
    if (!machine) return false;
    if (isTimerAdmin) return true;
    const technicianName = userPermissions?.technicianName || currentUser?.nome_tecnico;
    return Boolean(technicianName && machine?.tecnico === technicianName);
  };

  const ensureTimerPermission = (machine) => {
    if (canControlMachineTimer(machine)) return true;
    alert('Você só pode controlar o timer das suas próprias máquinas.');
    return false;
  };

  const getCanonicalMachine = async (machineId) => {
    const data = await FrotaACP.list('-created_date');
    const canonical = data.find(m => m.id === machineId);
    if (canonical) return canonical;
    return machines.find(m => m.id === machineId) || null;
  };

  const mergeTimerMachine = (machineId, updateData) => {
    setMachines(prev => prev.map(m => (m.id === machineId ? { ...m, ...updateData } : m)));
    setSelectedMachine(prev => (prev?.id === machineId ? { ...prev, ...updateData } : prev));
  };

  const persistTimerToDatabase = async (machineId, data) => {
    mergeTimerMachine(machineId, data);
    await FrotaACP.update(machineId, data);
    await loadMachines();
  };

  const buildTimerHistorico = (machine, marker) => withTimerStateMarker(machine?.historico, marker);
  const clearTimerHistorico = (machine) => stripTimerStateMarkers(machine?.historico);
  const timerAuthor = () => (
    currentUser?.nome_tecnico
    || currentUser?.perfil
    || (isTimerAdmin ? 'admin' : 'sistema')
  );

  const handleTimerStart = async (machineId) => {
    try {
      const machine = await getCanonicalMachine(machineId);
      if (!machine) { console.warn('Máquina não encontrada:', machineId); return; }
      if (!ensureTimerPermission(machine)) return;

      const now = new Date().toISOString();
      const accumulatedMs = getTimerAccumulatedMs(machine);
      const updateData = {
        historico: buildTimerHistorico(machine, {
          state: 'running', startTime: now, accumulatedMs,
          updatedAt: now, by: timerAuthor(),
        }),
        actualStartTime: now,
        actualTimeSpent: accumulatedMs,
        actualEndDate: null,
        actualEndTime: null,
        status: 'Em Progresso',
        timer_inicio: now,
        timer_ativo: true,
        timer_pausado: false,
        timer_fim: null,
        timer_duracao_minutos: null,
        timer_acumulado: Math.round(accumulatedMs / 60000),
        ...(machine.estado === 'a-fazer' && currentUser?.nome_tecnico ? {
          estado: `em-preparacao-${currentUser.nome_tecnico}`,
          tecnico: currentUser.nome_tecnico,
          dataAtribuicao: now
        } : {})
      };

      await persistTimerToDatabase(machineId, updateData);

      if (updateData.estado && typeof syncMachineToPortal === 'function') {
        syncMachineToPortal(machine.serie, updateData.estado);
      }
    } catch (e) {
      console.error('Erro ao iniciar timer:', e);
      await loadMachines();
    }
  };

  const handleTimerPause = async (machineId) => {
    try {
      const machine = await getCanonicalMachine(machineId);
      if (!machine) { console.warn('Máquina não encontrada:', machineId); return; }
      if (!ensureTimerPermission(machine)) return;

      const now = Date.now();
      const startMs = getTimerStartMs(machine);
      const sessionMs = startMs !== null ? Math.max(0, now - startMs) : 0;
      const totalMs = getTimerAccumulatedMs(machine) + sessionMs;
      const nowIso = new Date(now).toISOString();
      const updateData = {
        historico: buildTimerHistorico(machine, {
          state: 'paused', startTime: null, accumulatedMs: totalMs,
          updatedAt: nowIso, by: timerAuthor(),
        }),
        actualStartTime: null,
        actualTimeSpent: totalMs,
        status: 'Pausado',
        timer_inicio: null,
        timer_ativo: false,
        timer_pausado: true,
        timer_acumulado: Math.round(totalMs / 60000)
      };

      await persistTimerToDatabase(machineId, updateData);
    } catch (e) {
      console.error('Erro ao pausar timer:', e);
      await loadMachines();
    }
  };

  const handleTimerResume = async (machineId) => {
    try {
      const machine = await getCanonicalMachine(machineId);
      if (!machine) { console.warn('Máquina não encontrada:', machineId); return; }
      if (!ensureTimerPermission(machine)) return;

      const now = new Date().toISOString();
      const accumulatedMs = getTimerAccumulatedMs(machine);
      const updateData = {
        historico: buildTimerHistorico(machine, {
          state: 'running', startTime: now, accumulatedMs,
          updatedAt: now, by: timerAuthor(),
        }),
        actualStartTime: now,
        actualTimeSpent: accumulatedMs,
        actualEndDate: null,
        actualEndTime: null,
        status: 'Em Progresso',
        timer_inicio: now,
        timer_ativo: true,
        timer_pausado: false,
        timer_fim: null,
        timer_duracao_minutos: null,
        timer_acumulado: Math.round(accumulatedMs / 60000)
      };

      await persistTimerToDatabase(machineId, updateData);
    } catch (e) {
      console.error('Erro ao retomar timer:', e);
      await loadMachines();
    }
  };

  const handleTimerStop = async (machineId) => {
    try {
      const machine = await getCanonicalMachine(machineId);
      if (!machine) { console.warn('Máquina não encontrada:', machineId); return; }
      if (!ensureTimerPermission(machine)) return;

      const nowMs = Date.now();
      const fim = new Date(nowMs).toISOString();
      const startMs = getTimerStartMs(machine);
      const sessionMs = startMs !== null ? Math.max(0, nowMs - startMs) : 0;
      const totalMs = getTimerAccumulatedMs(machine) + sessionMs;
      const duracaoMinutos = Math.round(totalMs / 60000);
      const updateData = {
        historico: buildTimerHistorico(machine, {
          state: 'done', startTime: null, accumulatedMs: totalMs,
          updatedAt: fim, by: timerAuthor(),
        }),
        actualStartTime: null,
        actualTimeSpent: totalMs,
        actualEndDate: fim,
        actualEndTime: fim,
        status: 'Concluída',
        timer_inicio: null,
        timer_ativo: false,
        timer_pausado: false,
        timer_fim: fim,
        timer_duracao_minutos: duracaoMinutos,
        timer_acumulado: duracaoMinutos,
        estado: `concluida-${machine.tecnico || currentUser?.nome_tecnico || 'geral'}`,
        dataConclusao: fim
      };

      await persistTimerToDatabase(machineId, updateData);
      if (typeof syncMachineToPortal === 'function') {
        syncMachineToPortal(machine.serie, updateData.estado);
      }

      if (machine?.serie && machine?.tecnico) {
        try {
          await base44.entities.TimeLog.create({
            machineId: machine.id,
            machineSerie: machine.serie,
            technician: machine.tecnico,
            startTime: machine.actualStartTime || machine.timer_inicio,
            endTime: fim,
            durationMinutes: duracaoMinutos,
            durationMs: totalMs,
            type: 'frota_acp'
          });
        } catch (logErr) { console.warn('Erro ao arquivar log de tempo:', logErr); }
      }
    } catch (e) {
      console.error('Erro ao parar timer:', e);
      await loadMachines();
    }
  };

  const handleTimerReset = async (machineId) => {
    try {
      const machine = await getCanonicalMachine(machineId);
      if (!machine) return;
      if (!isTimerAdmin) {
        alert('Apenas administradores podem resetar o timer.');
        return;
      }

      const updateData = {
        historico: clearTimerHistorico(machine),
        actualStartTime: null,
        actualTimeSpent: 0,
        actualEndDate: null,
        actualEndTime: null,
        status: 'A Fazer',
        timer_ativo: false,
        timer_pausado: false,
        timer_inicio: null,
        timer_fim: null,
        timer_duracao_minutos: null,
        timer_acumulado: 0
      };
      await persistTimerToDatabase(machineId, updateData);
    } catch (e) {
      console.error('Erro ao resetar timer:', e);
      await loadMachines();
    }
  };

  return {
    isTimerAdmin,
    canControlMachineTimer,
    handleTimerStart,
    handleTimerPause,
    handleTimerResume,
    handleTimerStop,
    handleTimerReset,
  };
}
