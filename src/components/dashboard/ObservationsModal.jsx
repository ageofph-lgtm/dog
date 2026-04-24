import TimerButton from "./TimerButton";
import React, { useState, useEffect } from "react";
import { FrotaACP } from "@/entities/all";
import { Clock, AlertTriangle, CheckCircle2, Repeat, Package, Sparkles } from "lucide-react";
import { base44 } from "@/api/base44Client";

const TAREFAS_PREDEFINIDAS = ['Preparação geral', 'Revisão 3000h', 'VPS', 'EXPRESS'];

const TIPO_ICONS = {
  nova: { icon: Sparkles },
  usada: { icon: Repeat },
  aluguer: { icon: Package }
};

export default function ObservationsModal({ isOpen, onClose, machine, onAddObservation, onToggleTask, onTogglePriority, onDelete, currentUser, userPermissions, onMarkComplete, onToggleAguardaPecas, allMachines, onOpenEdit, onTimerStart, onTimerPause, onTimerResume, onTimerStop, onTimerReset }) {
  const [newObs, setNewObs] = useState('');
  const [numeroPedido, setNumeroPedido] = useState('');
  const [showPedidoForm, setShowPedidoForm] = useState(false);
  const [isEditingTasks, setIsEditingTasks] = useState(false);
  const [editedTasks, setEditedTasks] = useState([]);
  const [newTaskText, setNewTaskText] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [machinePedidos, setMachinePedidos] = useState([]);
  const [localMachine, setLocalMachine] = useState(machine);

  const TIMER_FIELDS = ['timer_ativo','timer_pausado','timer_inicio','timer_fim','timer_duracao_minutos','timer_acumulado'];

  useEffect(() => {
    if (machine && allMachines) {
      const updated = allMachines.find(m => m.id === machine.id);
      const fresh = updated || machine;
      setLocalMachine(prev => {
        if (!prev) return fresh;
        // Se o timer está ativo localmente mas a DB ainda não confirmou, preservar
        const localTimerAtivo = prev.timer_ativo === true;
        const freshTimerAtivo = fresh.timer_ativo === true;
        if (localTimerAtivo && !freshTimerAtivo) {
          const merged = { ...fresh };
          TIMER_FIELDS.forEach(f => { merged[f] = prev[f]; });
          return merged;
        }
        return fresh;
      });
    } else {
      setLocalMachine(machine);
    }
  }, [machine, allMachines]);

  // Sync em tempo real dos campos de timer quando o Dashboard confirma updates
  useEffect(() => {
    if (machine) {
      setLocalMachine(prev => {
        if (!prev) return machine;
        // Só propagar se a DB tiver um estado MAIS RECENTE (timer_ativo true na DB)
        // ou se localmente o timer já não está ativo
        const localAtivo = prev.timer_ativo === true;
        const machineAtivo = machine.timer_ativo === true;
        if (localAtivo && !machineAtivo) return prev; // DB ainda não confirmou — manter local
        return { ...prev, ...Object.fromEntries(TIMER_FIELDS.map(f => [f, machine[f]])) };
      });
    }
  }, [
    machine?.timer_ativo,
    machine?.timer_pausado,
    machine?.timer_inicio,
    machine?.timer_acumulado,
    machine?.timer_fim,
    machine?.timer_duracao_minutos
  ]);

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape' && isOpen) onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (localMachine?.tarefas) {
      setEditedTasks([...localMachine.tarefas]);
    } else {
      setEditedTasks([]);
    }
    setIsEditingTasks(false);
    setNewTaskText('');
  }, [localMachine, isOpen]);

  useEffect(() => {
    const loadMachinePedidos = async () => {
      if (localMachine?.id) {
        try {
          const allPedidos = await base44.entities.Pedido.list();
          setMachinePedidos(allPedidos.filter(p => p.maquinaId === localMachine.id));
        } catch (error) {
          console.error('Erro ao carregar pedidos:', error);
        }
      }
    };
    if (isOpen) loadMachinePedidos();
  }, [localMachine, isOpen]);

  if (!isOpen || !localMachine) return null;

  const handleSubmit = () => {
    if (newObs.trim()) { onAddObservation(localMachine.id, newObs); setNewObs(''); }
  };

  const handleMarkComplete = async () => {
    if (window.confirm(`Tem certeza que deseja marcar a máquina ${localMachine.serie} como CONCLUÍDA?`)) {
      await onMarkComplete(localMachine.id);
    }
  };

  const handleSubmitPedido = async () => {
    if (!numeroPedido.trim()) { alert('Por favor, insira o número do pedido'); return; }
    try {
      await base44.entities.Pedido.create({
        numeroPedido: numeroPedido.trim(),
        maquinaId: localMachine.id,
        maquinaSerie: localMachine.serie,
        maquinaModelo: localMachine.modelo,
        tecnico: currentUser?.nome_tecnico || currentUser?.full_name,
        status: 'pendente'
      });
      await base44.entities.Notificacao.create({
        userId: 'admin',
        message: `Novo pedido de peças: ${numeroPedido.trim()}`,
        machineId: localMachine.id,
        machineSerie: localMachine.serie,
        technicianName: currentUser?.nome_tecnico || currentUser?.full_name,
        type: 'parts_requested',
        isRead: false
      });
      setNumeroPedido('');
      setShowPedidoForm(false);
      const allPedidos = await base44.entities.Pedido.list();
      setMachinePedidos(allPedidos.filter(p => p.maquinaId === localMachine.id));
      alert('Pedido enviado com sucesso!');
    } catch (error) {
      console.error('Erro ao criar pedido:', error);
      alert('Erro ao enviar pedido. Tente novamente.');
    }
  };

  const handleMoveToAFazer = async () => {
    if (!userPermissions?.canMoveAnyMachine) { alert("Você não tem permissão para mover esta máquina."); return; }
    if (window.confirm(`Deseja mover a máquina ${localMachine.serie} de volta para "A Fazer"?`)) {
      try {
        await FrotaACP.update(localMachine.id, { estado: 'a-fazer', tecnico: null, dataConclusao: null });
        // Sync Portal da Frota
        try {
          const portalResp = await fetch(`https://base44.app/api/apps/699ee6a6c0541069d0066cc1/entities/Equipment?serial_number=${encodeURIComponent(localMachine.serie)}&limit=50`, { headers: { "api_key": "f8517554492e492090b62dd501ad7e14" } });
          const portalRecs = await portalResp.json();
          if (Array.isArray(portalRecs)) {
            await Promise.all(portalRecs.map(r => fetch(`https://base44.app/api/apps/699ee6a6c0541069d0066cc1/entities/Equipment/${r.id}`, { method: "PUT", headers: { "api_key": "f8517554492e492090b62dd501ad7e14", "Content-Type": "application/json" }, body: JSON.stringify({ status: "A começar" }) })));
          }
        } catch(e) { console.warn("[Portal sync back]", e.message); }
        onClose();
      } catch (error) {
        console.error("Erro ao mover máquina:", error);
        alert("Erro ao mover máquina. Tente novamente.");
      }
    }
  };

  const handleSaveTasks = async () => {
    setIsUpdating(true);
    try {
      await FrotaACP.update(localMachine.id, { tarefas: editedTasks });
      setIsEditingTasks(false);
    } catch (error) {
      console.error("Erro ao salvar tarefas:", error);
      alert("Erro ao salvar tarefas. Tente novamente.");
    }
    setIsUpdating(false);
  };

  const handleAddNewTask = () => {
    if (newTaskText.trim()) {
      setEditedTasks([...editedTasks, { texto: newTaskText.trim(), concluida: false }]);
      setNewTaskText('');
    }
  };

  const handleRemoveTask = (index) => setEditedTasks(editedTasks.filter((_, i) => i !== index));

  const handleToggleEditedTask = (index) => {
    const updated = [...editedTasks];
    updated[index].concluida = !updated[index].concluida;
    setEditedTasks(updated);
  };

  const handleToggleTaskLocal = async (taskIndex) => {
    if (isUpdating) return;
    const isResponsibleTech = currentUser?.nome_tecnico && localMachine.tecnico === currentUser.nome_tecnico;
    const isAdmin = userPermissions?.canMoveAnyMachine;
    const canEdit = (isAdmin || isResponsibleTech) && localMachine.estado?.includes('em-preparacao');
    if (!canEdit) return;
    setIsUpdating(true);
    try {
      const updatedTasks = localMachine.tarefas.map((t, i) => i === taskIndex ? { ...t, concluida: !t.concluida } : { ...t });
      setLocalMachine({ ...localMachine, tarefas: updatedTasks });
      await onToggleTask(localMachine.id, taskIndex);
    } catch (error) {
      console.error("Erro ao atualizar tarefa:", error);
      alert("Erro ao atualizar tarefa. Tente novamente.");
      setLocalMachine(localMachine);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleAguardaPecasClick = async () => {
    const newValue = !localMachine.aguardaPecas;
    const confirmMessage = newValue
      ? `Marcar máquina ${localMachine.serie} como "AGUARDA PEÇAS"?`
      : `Confirmar que as peças da máquina ${localMachine.serie} CHEGARAM?`;
    if (window.confirm(confirmMessage)) {
      setLocalMachine({ ...localMachine, aguardaPecas: newValue });
      await onToggleAguardaPecas(localMachine.id, newValue);
    }
  };

  const tarefasConcluidas = localMachine.tarefas?.filter(t => t.concluida).length || 0;
  const totalTarefas = localMachine.tarefas?.length || 0;
  const TipoIcon = TIPO_ICONS[localMachine.tipo]?.icon || Package;
  const isResponsibleTech = currentUser?.nome_tecnico && localMachine.tecnico === currentUser.nome_tecnico;
  const isAdmin = userPermissions?.canMoveAnyMachine;
  const canEditThisMachine = isAdmin || isResponsibleTech;
  const canEditTasks = localMachine.estado?.includes('em-preparacao') && canEditThisMachine;
  const canAdminEditTasks = userPermissions?.canMoveAnyMachine;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[9998]" onClick={onClose} />
      <div className="fixed top-24 left-1/2 transform -translate-x-1/2 rounded-xl shadow-2xl z-[9999] w-[95%] sm:w-[90%] max-w-4xl flex flex-col bg-white" style={{ maxHeight: 'calc(100vh - 120px)', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}>
        <button onClick={onClose} className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 transition-colors">
          <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        <div className="p-5 flex-shrink-0 border-b border-gray-200">
          <div className="pr-8">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-2xl font-mono font-bold text-black">{localMachine.serie}</h2>
              {localMachine.prioridade && <AlertTriangle className="w-5 h-5 text-orange-500" />}
              {localMachine.aguardaPecas && <Clock className="w-5 h-5 text-yellow-500" />}
            </div>
            <p className="text-sm text-gray-600">{localMachine.modelo}</p>
            {localMachine.ano && <p className="text-sm text-gray-500">Ano: {localMachine.ano}</p>}
            {localMachine.tecnico && (
              <p className="text-sm text-gray-600 mt-1">Responsável: <span className="font-semibold capitalize">{localMachine.tecnico}</span></p>
            )}
            <div className="mt-3 space-y-1 text-xs text-gray-500">
              {localMachine.created_date && <p>📅 Criada: {new Date(localMachine.created_date).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>}
              {localMachine.dataAtribuicao && <p>👤 Atribuída: {new Date(localMachine.dataAtribuicao).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>}
              {localMachine.dataConclusao && <p>✅ Concluída: {new Date(localMachine.dataConclusao).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>}
            </div>
            {localMachine.historicoCriacoes && localMachine.historicoCriacoes.length > 0 && (
              <div className="mt-3 p-3 rounded bg-blue-50 border border-blue-200">
                <p className="text-xs font-semibold text-blue-800 mb-2 flex items-center gap-2">
                  <Repeat className="w-4 h-4" />
                  Esta máquina já foi registrada anteriormente:
                </p>
                <div className="space-y-1">
                  {localMachine.historicoCriacoes.map((hist, idx) => (
                    <div key={idx} className="text-xs text-blue-700">
                      <p>📅 Criada: {new Date(hist.dataCriacao).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        {hist.dataConclusao && <> • ✅ Concluída: {new Date(hist.dataConclusao).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })}</>}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="flex gap-2 flex-wrap">
            {userPermissions?.canMoveAnyMachine && localMachine.estado !== 'a-fazer' && (
              <button onClick={handleMoveToAFazer} className="px-3 py-1.5 text-white rounded font-semibold text-xs bg-gray-600 hover:bg-gray-700">Mover para A Fazer</button>
            )}
            {userPermissions?.canSetPriority && localMachine.estado === 'a-fazer' && (
              <button onClick={() => onTogglePriority(localMachine.id, !localMachine.prioridade)} className="px-3 py-1.5 rounded font-semibold text-xs text-white bg-orange-500 hover:bg-orange-600">
                {localMachine.prioridade ? 'Remover Prioridade' : 'Marcar Prioritária'}
              </button>
            )}
            {userPermissions?.canDeleteMachine && (
              <>
                <button onClick={() => onOpenEdit(localMachine)} className="px-3 py-1.5 text-white rounded font-semibold text-xs bg-blue-600 hover:bg-blue-700">Editar</button>
                <button onClick={() => { if (window.confirm(`Tem certeza que deseja apagar a máquina ${localMachine.serie}?`)) onDelete(localMachine.id); }} className="px-3 py-1.5 text-white rounded font-semibold text-xs bg-red-500 hover:bg-red-600">Apagar</button>
              </>
            )}
            {localMachine.estado?.includes('em-preparacao') && !localMachine.estado?.includes('concluida') && canEditThisMachine && (
              <button onClick={handleMarkComplete} className="px-3 py-1.5 text-white rounded font-semibold text-xs bg-green-600 hover:bg-green-700 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Marcar como Concluída
              </button>
            )}
            {localMachine.estado?.includes('em-preparacao') && canEditThisMachine && (
              <button onClick={handleAguardaPecasClick} disabled={isUpdating} className="px-3 py-1.5 text-white rounded font-semibold text-xs bg-yellow-500 hover:bg-yellow-600 flex items-center gap-1 disabled:opacity-50">
                <Clock className="w-3 h-3" />
                {localMachine.aguardaPecas ? 'Peças Chegaram' : 'Aguarda Peças'}
              </button>
            )}
          </div>

          {/* ── TIMER ── */}
          {(localMachine.estado?.includes("em-preparacao") || localMachine.estado?.includes("concluida") || localMachine.timer_inicio) && (
            <div className="p-3 rounded-xl border border-slate-200 bg-slate-50">
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">⏱ Timer de Trabalho</p>
              <TimerButton
                machine={localMachine}
                onStart={async (id) => { if (onTimerStart) { await onTimerStart(id); } }}
                onPause={async (id, acum) => { if (onTimerPause) { await onTimerPause(id, acum); } }}
                onResume={async (id) => { if (onTimerResume) { await onTimerResume(id); } }}
                onStop={async (id, dur) => { if (onTimerStop) { await onTimerStop(id, dur); } }}
                onReset={async (id) => { if (onTimerReset) { await onTimerReset(id); } }}
                isAdmin={!!userPermissions?.canMoveAnyMachine}
              />
            </div>
          )}

          {localMachine.estado?.includes('em-preparacao') && !canEditThisMachine && (
            <div className="p-2 rounded bg-red-50 border border-red-200">
              <p className="text-xs text-red-600">ⓘ Apenas visualização - Esta máquina está atribuída a outro técnico</p>
            </div>
          )}

          {localMachine.estado?.includes('em-preparacao') && canEditThisMachine && (
            <div className="p-3 rounded bg-gray-50 border border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-sm text-black">Pedidos</h4>
                <button onClick={() => setShowPedidoForm(!showPedidoForm)} className="px-3 py-1 text-white rounded text-xs font-semibold bg-black hover:bg-gray-800">
                  {showPedidoForm ? 'Cancelar' : '+ Novo'}
                </button>
              </div>
              {showPedidoForm && (
                <div className="flex gap-2 mb-3">
                  <input type="text" value={numeroPedido} onChange={(e) => setNumeroPedido(e.target.value)} placeholder="Número do pedido..." className="flex-1 px-3 py-2 text-sm rounded border border-gray-300 focus:border-black focus:outline-none" onKeyPress={(e) => e.key === 'Enter' && handleSubmitPedido()} />
                  <button onClick={handleSubmitPedido} className="px-4 py-2 text-white rounded text-sm font-semibold bg-black hover:bg-gray-800">Enviar</button>
                </div>
              )}
              {machinePedidos.length > 0 && (
                <div className="space-y-2">
                  {machinePedidos.map(pedido => (
                    <div key={pedido.id} className="flex items-center justify-between p-2 rounded bg-white border">
                      <span className="font-mono font-bold text-sm text-black">{pedido.numeroPedido}</span>
                      <span className="text-xs px-2 py-0.5 rounded font-semibold bg-gray-100 text-gray-700">{pedido.status === 'concluido' ? 'CONFIRMADO' : 'PENDENTE'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {((localMachine.tarefas && localMachine.tarefas.length > 0) || canAdminEditTasks) && (
            <div>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-base font-bold text-black">Tarefas</h3>
                <div className="flex items-center gap-2">
                  {!isEditingTasks && <span className="text-xs text-gray-600">{tarefasConcluidas}/{totalTarefas} concluídas</span>}
                  {canAdminEditTasks && (
                    <button onClick={() => { if (isEditingTasks) handleSaveTasks(); else setIsEditingTasks(true); }} className="px-3 py-1 rounded text-xs font-semibold text-white bg-black hover:bg-gray-800">
                      {isEditingTasks ? 'Guardar' : 'Editar'}
                    </button>
                  )}
                </div>
              </div>

              {isEditingTasks ? (
                <div className="space-y-3">
                  {editedTasks.map((tarefa, idx) => (
                    <div key={idx} className="flex items-start gap-2 p-2 rounded bg-gray-50 border border-gray-200">
                      <input type="checkbox" checked={tarefa.concluida} onChange={() => handleToggleEditedTask(idx)} className="mt-1 w-4 h-4 rounded" />
                      <span className={`flex-1 text-sm ${tarefa.concluida ? 'line-through text-gray-500' : 'text-black'}`}>{tarefa.texto}</span>
                      <button onClick={() => handleRemoveTask(idx)} className="p-1 text-red-600 hover:bg-red-50 rounded">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                  <div className="space-y-2 p-3 rounded bg-gray-50 border border-gray-200">
                    <p className="text-xs font-semibold text-gray-700">Tarefas Pré-definidas:</p>
                    {TAREFAS_PREDEFINIDAS.map((predefTarefa, idx) => {
                      const isChecked = editedTasks.some(t => t.texto === predefTarefa);
                      return (
                        <div key={`predef-${idx}`} className="flex items-center gap-2">
                          <input type="checkbox" checked={isChecked} onChange={() => { if (isChecked) setEditedTasks(prev => prev.filter(t => t.texto !== predefTarefa)); else setEditedTasks(prev => [...prev, { texto: predefTarefa, concluida: false }]); }} className="w-4 h-4 rounded" />
                          <label className="text-sm text-black">{predefTarefa}</label>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <input type="text" value={newTaskText} onChange={(e) => setNewTaskText(e.target.value)} placeholder="Nova tarefa..." className="flex-1 px-3 py-2 text-sm rounded border border-gray-300 focus:border-black focus:outline-none" onKeyPress={(e) => e.key === 'Enter' && handleAddNewTask()} />
                    <button onClick={handleAddNewTask} className="px-4 py-2 text-white rounded text-sm bg-black hover:bg-gray-800">+</button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {localMachine.tarefas && localMachine.tarefas.map((tarefa, idx) => {
                    const canToggleThisTask = (isAdmin || isResponsibleTech) && localMachine.estado?.includes('em-preparacao');
                    return (
                      <div key={idx} className="flex items-start gap-3 p-2 rounded bg-gray-50 border border-gray-200">
                        <input type="checkbox" checked={tarefa.concluida} onChange={() => canToggleThisTask && !isUpdating && handleToggleTaskLocal(idx)} disabled={!canToggleThisTask || isUpdating} className="mt-1 w-5 h-5 rounded cursor-pointer disabled:cursor-not-allowed" />
                        <span className={`flex-1 text-sm ${tarefa.concluida ? 'line-through text-gray-500' : 'text-black'}`}>{tarefa.texto}</span>
                        {isUpdating && <div className="animate-spin w-4 h-4 border-2 border-black border-t-transparent rounded-full"></div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div>
            <h3 className="text-base font-bold mb-3 text-black">Observações</h3>
            {localMachine.observacoes && localMachine.observacoes.length > 0 ? (
              <div className="space-y-2">
                {localMachine.observacoes.map((obs, idx) => (
                  <div key={idx} className="rounded p-3 bg-gray-50 border border-gray-200">
                    <div className="flex justify-between items-start mb-2 gap-2">
                      <span className="font-semibold text-sm text-black">{obs.autor}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 whitespace-nowrap">{new Date(obs.data).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                        {userPermissions?.canDeleteMachine && (
                          <button onClick={async () => { if (window.confirm('Deseja apagar esta observação?')) { const updatedObs = localMachine.observacoes.filter((_, i) => i !== idx); await FrotaACP.update(localMachine.id, { observacoes: updatedObs }); setLocalMachine({ ...localMachine, observacoes: updatedObs }); } }} className="p-1 hover:bg-red-100 rounded text-red-600" title="Apagar observação">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-gray-700">{obs.texto}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-sm text-gray-500">Nenhuma observação ainda</p>
            )}
          </div>
        </div>

        <div className="p-5 flex-shrink-0 border-t border-gray-200 bg-gray-50">
          <div className="flex gap-3">
            <input type="text" value={newObs} onChange={(e) => setNewObs(e.target.value)} placeholder="Adicionar observação..." className="flex-1 px-4 py-2 text-sm rounded border border-gray-300 focus:border-black focus:outline-none" onKeyPress={(e) => e.key === 'Enter' && handleSubmit()} />
            <button onClick={handleSubmit} className="px-6 py-2 text-white rounded font-semibold text-sm bg-black hover:bg-gray-800">Adicionar</button>
          </div>
        </div>
      </div>
    </>
  );
}