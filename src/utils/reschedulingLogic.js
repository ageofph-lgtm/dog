/**
 * Lógica de Efeito Dominó: Reagendamento automático em cascata
 *
 * Quando uma OS urgente é submetida, esta lógica:
 *   1. Busca apenas as OS "A Fazer" (Express ou NTS) do técnico afetado
 *      via query filtrada no Base44 (não traz a base inteira).
 *   2. Adiciona +1 dia útil às datas plannedStartDate e plannedEndDate.
 *   3. Marca cada OS afetada com wasRescheduled: true.
 *   4. Persiste as alterações em batch (Promise.all com concorrência controlada).
 */

import { base44 } from "@/api/base44Client";

/**
 * Calcula o próximo dia útil (ignorando sábados e domingos).
 * @param {Date} date     Data base
 * @param {number} days   Número de dias úteis a adicionar (default 1)
 * @returns {Date}        Nova data
 */
export function addBusinessDays(date, days = 1) {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return result;
}

/**
 * Verifica se uma máquina/OS tem flag Express ou NTS nas suas tarefas.
 * @param {Object} m - Máquina/OS
 * @returns {boolean}
 */
function isExpressOrNTS(m) {
  if (!m?.tarefas || !Array.isArray(m.tarefas)) return false;
  return m.tarefas.some(t => {
    const txt = String(t?.texto || "").trim().toUpperCase();
    return txt === "EXPRESS" || txt === "NTS";
  });
}

/**
 * Lógica principal: aplica o Efeito Dominó.
 *
 * @param {string} technicianId   ID/nome do técnico afetado pela urgência
 * @param {Date|string} dataBase  Data base a partir da qual o atraso começa
 * @returns {Promise<{rescheduled: Array, errors: Array}>}
 */
export async function applyDominoEffect(technicianId, dataBase = new Date()) {
  if (!technicianId) {
    console.warn("[EfeitoDominó] technicianId em falta — abortando");
    return { rescheduled: [], errors: [] };
  }

  console.log(`[EfeitoDominó] Iniciando cascata para técnico=${technicianId}, dataBase=${dataBase}`);

  // ── 1. Query filtrada ao Base44 ─────────────────────────────────────────
  // Filtramos por tecnico + estado === "a-fazer". O filtro de Express/NTS
  // é feito client-side porque tarefas é um array embebido e o Base44 não
  // suporta filtros aninhados em arrays.
  let candidates = [];
  try {
    candidates = await base44.entities.FrotaACP.filter({
      tecnico: technicianId,
      estado: "a-fazer",
    });
  } catch (err) {
    // Fallback: alguns ambientes não suportam .filter() — usar list e filtrar
    console.warn("[EfeitoDominó] .filter() falhou, fallback para .list():", err?.message);
    try {
      const all = await base44.entities.FrotaACP.list();
      candidates = all.filter(m => m.tecnico === technicianId && m.estado === "a-fazer");
    } catch (err2) {
      console.error("[EfeitoDominó] Falha ao buscar máquinas:", err2);
      return { rescheduled: [], errors: [{ message: err2?.message }] };
    }
  }

  // ── 2. Filtrar apenas Express/NTS ───────────────────────────────────────
  const targets = candidates.filter(isExpressOrNTS);

  if (targets.length === 0) {
    console.log(`[EfeitoDominó] Nenhuma OS Express/NTS A Fazer encontrada para ${technicianId}`);
    return { rescheduled: [], errors: [] };
  }

  console.log(`[EfeitoDominó] ${targets.length} OS encontradas para reagendar`);

  // ── 3. Batch update com concorrência controlada ─────────────────────────
  const baseDate = dataBase instanceof Date ? dataBase : new Date(dataBase);
  const nowIso = new Date().toISOString();

  const updates = targets.map(machine => {
    const oldStart = machine.plannedStartDate ? new Date(machine.plannedStartDate) : new Date(baseDate);
    const oldEnd   = machine.plannedEndDate   ? new Date(machine.plannedEndDate)   : new Date(baseDate);

    const newStart = addBusinessDays(oldStart, 1);
    const newEnd   = addBusinessDays(oldEnd,   1);

    return {
      machine,
      payload: {
        plannedStartDate:    newStart.toISOString(),
        plannedEndDate:      newEnd.toISOString(),
        wasRescheduled:      true,
        lastRescheduleDate:  nowIso,
        lastRescheduleReason: `Efeito Dominó: urgência criada por ${technicianId}`,
      },
    };
  });

  // Promise.allSettled para não falhar a cascata inteira se uma OS falhar
  const results = await Promise.allSettled(
    updates.map(({ machine, payload }) =>
      base44.entities.FrotaACP.update(machine.id, payload)
        .then(() => ({ id: machine.id, serie: machine.serie, payload }))
    )
  );

  const rescheduled = [];
  const errors = [];

  results.forEach((r, i) => {
    if (r.status === "fulfilled") {
      rescheduled.push(r.value);
      console.log(`[EfeitoDominó] ✓ ${updates[i].machine.serie} reagendada`);
    } else {
      errors.push({
        machineId: updates[i].machine.id,
        serie:     updates[i].machine.serie,
        error:     r.reason?.message,
      });
      console.error(`[EfeitoDominó] ✗ Erro em ${updates[i].machine.serie}:`, r.reason);
    }
  });

  return { rescheduled, errors };
}

/**
 * Wrapper conveniente para chamar a partir de modais de criação/edição.
 * Detecta se a máquina/OS é urgente e dispara a cascata.
 *
 * @param {Object} machine  Máquina/OS recém-criada ou editada
 * @returns {Promise<{rescheduled: Array, errors: Array}>}
 */
export async function triggerDominoIfUrgent(machine) {
  if (!machine) return { rescheduled: [], errors: [] };

  // Considerar urgente se prioridade=true OU campo urgencia=true
  const isUrgent = machine.prioridade === true || machine.urgencia === true;
  if (!isUrgent) return { rescheduled: [], errors: [] };

  // Extrair técnico
  let technicianId = machine.tecnico;
  if (!technicianId && machine.estado?.includes("-")) {
    const parts = machine.estado.split("-");
    technicianId = parts[parts.length - 1];
  }

  if (!technicianId) {
    console.log("[EfeitoDominó] OS urgente sem técnico atribuído — cascata não disparada");
    return { rescheduled: [], errors: [] };
  }

  return applyDominoEffect(technicianId, new Date());
}

// ─── Compatibilidade retroativa ──────────────────────────────────────────
export const applyDominoCascade = async (technicianId, _allMachines, _base44) =>
  applyDominoEffect(technicianId, new Date());

export const handleUrgentMachineCreation = triggerDominoIfUrgent;

/**
 * Mensagem formatada para exibição em UI (cards/tooltips).
 */
export function getRescheduleMessage(machine) {
  if (!machine?.wasRescheduled) return null;
  const reason = machine.lastRescheduleReason || "Reagendada automaticamente";
  const date = machine.lastRescheduleDate
    ? new Date(machine.lastRescheduleDate).toLocaleDateString("pt-PT")
    : "data desconhecida";
  return `⏰ ${reason} em ${date}`;
}
