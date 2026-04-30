/**
 * Lógica de Efeito Dominó: Reagendamento automático de OS
 * 
 * Quando uma OS urgente é criada/editada e atribuída a um técnico,
 * todas as outras OS "A Fazer" desse técnico sofrem mutação de datas (+1 dia).
 */

/**
 * Calcula o próximo dia útil (ignorando fins de semana)
 * @param {Date} date - Data base
 * @param {number} daysToAdd - Número de dias a adicionar
 * @returns {Date} Nova data no próximo dia útil
 */
export function addBusinessDays(date, daysToAdd = 1) {
  const result = new Date(date);
  let daysAdded = 0;

  while (daysAdded < daysToAdd) {
    result.setDate(result.getDate() + 1);
    const dayOfWeek = result.getDay();
    // Ignorar sábado (6) e domingo (0)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      daysAdded++;
    }
  }

  return result;
}

/**
 * Aplica o Efeito Dominó: reagenda todas as OS "A Fazer" de um técnico
 * 
 * @param {string} technicianId - ID do técnico
 * @param {Array} allMachines - Lista de todas as máquinas
 * @param {Object} base44 - Cliente Base44
 * @returns {Promise<Array>} Array de máquinas que foram reagendadas
 */
export async function applyDominoCascade(technicianId, allMachines, base44) {
  try {
    // Filtrar todas as OS "A Fazer" do técnico (Express e NTS)
    const toReschedule = allMachines.filter(m => {
      const isToDoState = m.estado === 'a-fazer';
      const isExpress = m.tarefas?.some(t => t.texto === 'EXPRESS');
      const isNTS = m.tarefas?.some(t => t.texto === 'NTS');
      
      return isToDoState && (isExpress || isNTS);
    });

    if (toReschedule.length === 0) {
      console.log(`[Efeito Dominó] Nenhuma máquina para reagendar para ${technicianId}`);
      return [];
    }

    const rescheduled = [];

    // Reagendar cada máquina
    for (const machine of toReschedule) {
      try {
        const plannedStart = machine.plannedStartDate ? new Date(machine.plannedStartDate) : new Date();
        const plannedEnd = machine.plannedEndDate ? new Date(machine.plannedEndDate) : new Date();

        // Adicionar 1 dia útil
        const newStart = addBusinessDays(plannedStart, 1);
        const newEnd = addBusinessDays(plannedEnd, 1);

        // Atualizar máquina com novas datas e flag de reagendamento
        const updateData = {
          plannedStartDate: newStart.toISOString(),
          plannedEndDate: newEnd.toISOString(),
          wasRescheduled: true,
          lastRescheduleDate: new Date().toISOString(),
          lastRescheduleReason: `Efeito Dominó: OS urgente atribuída a ${technicianId}`
        };

        await base44.entities.FrotaACP.update(machine.id, updateData);
        rescheduled.push({
          id: machine.id,
          serie: machine.serie,
          oldStart: plannedStart.toISOString(),
          newStart: newStart.toISOString(),
          oldEnd: plannedEnd.toISOString(),
          newEnd: newEnd.toISOString()
        });

        console.log(`[Efeito Dominó] Reagendada: ${machine.serie} (${plannedStart.toLocaleDateString('pt-PT')} → ${newStart.toLocaleDateString('pt-PT')})`);
      } catch (err) {
        console.error(`[Efeito Dominó] Erro ao reagendar ${machine.serie}:`, err);
      }
    }

    return rescheduled;
  } catch (error) {
    console.error('[Efeito Dominó] Erro geral:', error);
    return [];
  }
}

/**
 * Verifica se uma máquina é urgente e aplica o Efeito Dominó se necessário
 * 
 * @param {Object} machine - Dados da máquina
 * @param {Array} allMachines - Lista de todas as máquinas
 * @param {Object} base44 - Cliente Base44
 * @returns {Promise<Array>} Array de máquinas reagendadas
 */
export async function handleUrgentMachineCreation(machine, allMachines, base44) {
  // Verificar se é urgente e tem técnico atribuído
  if (!machine.prioridade && machine.estado !== 'urgente') {
    return [];
  }

  // Extrair técnico do estado (ex: em-preparacao-raphael)
  let technicianId = machine.tecnico;
  if (!technicianId && machine.estado?.includes('-')) {
    const parts = machine.estado.split('-');
    technicianId = parts[parts.length - 1];
  }

  if (!technicianId) {
    console.log('[Efeito Dominó] Máquina urgente sem técnico atribuído');
    return [];
  }

  console.log(`[Efeito Dominó] Máquina urgente detectada: ${machine.serie} → Técnico: ${technicianId}`);

  // Aplicar cascata de reagendamento
  return await applyDominoCascade(technicianId, allMachines, base44);
}

/**
 * Formata informação de reagendamento para exibição
 * 
 * @param {Object} machine - Máquina com wasRescheduled flag
 * @returns {string|null} Mensagem formatada ou null
 */
export function getRescheduleMessage(machine) {
  if (!machine.wasRescheduled) return null;

  const reason = machine.lastRescheduleReason || 'Reagendada automaticamente';
  const date = machine.lastRescheduleDate 
    ? new Date(machine.lastRescheduleDate).toLocaleDateString('pt-PT')
    : 'data desconhecida';

  return `⏰ ${reason} em ${date}`;
}
