import TimerButton from "./TimerButton";
import React, { useState, useEffect } from "react";
import { FrotaACP } from "@/entities/all";
import { Clock, AlertTriangle, CheckCircle2, Repeat, Package, Sparkles } from "lucide-react";
import { base44 } from "@/api/base44Client";

const TAREFAS_PREDEFINIDAS = ['Preparação geral', 'Revisão 3000h', 'VPS', 'EXPRESS'];
const TIPO_ICONS = { nova: Sparkles, usada: Repeat, aluguer: Package };
const TIMER_FIELDS = ['timer_ativo','timer_pausado','timer_inicio','timer_fim','timer_duracao_minutos','timer_acumulado'];

export default function ObservationsModal({
  isOpen, onClose, machine, onAddObservation, onToggleTask, onTogglePriority,
  onDelete, currentUser, userPermissions, onMarkComplete, onToggleAguardaPecas,
  allMachines, onOpenEdit, isDark,
  onTimerStart, onTimerPause, onTimerResume, onTimerStop, onTimerReset
}) {
  const [newObs, setNewObs] = useState('');
  const [numeroPedido, setNumeroPedido] = useState('');
  const [showPedidoForm, setShowPedidoForm] = useState(false);
  const [isEditingTasks, setIsEditingTasks] = useState(false);
  const [editedTasks, setEditedTasks] = useState([]);
  const [newTaskText, setNewTaskText] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [machinePedidos, setMachinePedidos] = useState([]);
  const [localMachine, setLocalMachine] = useState(machine);

  // ── cores ──────────────────────────────────────────────────────────────
  const C = {
    bg:       isDark ? '#0D0D1A' : '#FFFFFF',
    surface:  isDark ? '#161630' : '#F8F8FF',
    border:   isDark ? '#2A2A50' : '#E0E0F0',
    text:     isDark ? '#E8E8FF' : '#080818',
    muted:    isDark ? '#9090C8' : '#8888AA',
    label:    isDark ? '#B0B0E0' : '#4040A0',
    blue:     '#4D9FFF',
    pink:     '#FF2D78',
    green:    '#22C55E',
    yellow:   '#EAB308',
    orange:   '#F97316',
    red:      '#EF4444',
  };

  const s = {
    pill: (bg, color, border) => ({
      padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700,
      fontFamily: 'monospace', background: `${bg}22`, color: bg,
      border: `1px solid ${bg}44`, display: 'inline-flex', alignItems: 'center', gap: '4px'
    }),
    btn: (bg) => ({
      padding: '6px 12px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
      fontFamily: 'monospace', color: '#fff', background: bg,
      border: 'none', cursor: 'pointer'
    }),
    section: {
      padding: '12px', borderRadius: '8px',
      border: isDark ? '1px solid rgba(255,45,120,0.12)' : `1px solid #E2E2F0`,
      background: isDark ? 'linear-gradient(135deg, #0E0E1E 0%, #121228 100%)' : '#F8F8FF',
      marginBottom: '12px',
      boxShadow: isDark ? 'inset 0 0 0 1px rgba(255,255,255,0.02)' : 'none',
    },
    label: {
      fontSize: '10px', fontWeight: 700, fontFamily: 'monospace',
      color: C.label, textTransform: 'uppercase', letterSpacing: '0.08em',
      marginBottom: '8px', display: 'block'
    },
    input: {
      width: '100%', padding: '8px 10px', borderRadius: '6px',
      border: `1px solid ${C.border}`, fontSize: '13px',
      background: isDark ? '#12122A' : '#FFFFFF',
      color: C.text, outline: 'none', boxSizing: 'border-box'
    },
  };

  // ── sync allMachines ───────────────────────────────────────────────────
  // Sincroniza o estado local com a DB, mas apenas sobrescreve timer se a DB
  // ainda não confirmou a mudança (race condition). Se a DB tem timer_fim
  // definido, significa que o timer foi finalizado — aceitar a DB.
  useEffect(() => {
    if (machine && allMachines) {
      const updated = allMachines.find(m => m.id === machine.id) || machine;
      setLocalMachine(updated);
    } else { setLocalMachine(machine); }
  }, [machine, allMachines]);

  useEffect(() => {
    const handleEsc = (e) => { if (e.key === 'Escape' && isOpen) onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  useEffect(() => {
    setEditedTasks(localMachine?.tarefas ? [...localMachine.tarefas] : []);
    setIsEditingTasks(false);
    setNewTaskText('');
  }, [localMachine?.id, isOpen]);

  useEffect(() => {
    const load = async () => {
      if (!localMachine?.id) return;
      try {
        const all = await base44.entities.Pedido.list();
        setMachinePedidos(all.filter(p => p.maquinaId === localMachine.id));
      } catch(e) {}
    };
    if (isOpen) load();
  }, [localMachine?.id, isOpen]);

  if (!isOpen || !localMachine) return null;

  // ── handlers ──────────────────────────────────────────────────────────
  const handleSubmit = () => { if (newObs.trim()) { onAddObservation(localMachine.id, newObs); setNewObs(''); } };

  const handleMarkComplete = async () => {
    if (window.confirm(`Marcar ${localMachine.serie} como CONCLUÍDA?`)) await onMarkComplete(localMachine.id);
  };

  const handleSubmitPedido = async () => {
    if (!numeroPedido.trim()) return;
    try {
      await base44.entities.Pedido.create({ numeroPedido: numeroPedido.trim(), maquinaId: localMachine.id, maquinaSerie: localMachine.serie, maquinaModelo: localMachine.modelo, tecnico: currentUser?.nome_tecnico || currentUser?.full_name, status: 'pendente' });
      await base44.entities.Notificacao.create({ userId: 'admin', message: `Novo pedido de peças: ${numeroPedido.trim()}`, machineId: localMachine.id, machineSerie: localMachine.serie, technicianName: currentUser?.nome_tecnico || currentUser?.full_name, type: 'parts_requested', isRead: false });
      setNumeroPedido(''); setShowPedidoForm(false);
      const all = await base44.entities.Pedido.list();
      setMachinePedidos(all.filter(p => p.maquinaId === localMachine.id));
    } catch(e) { alert('Erro ao enviar pedido.'); }
  };

  const handleMoveToAFazer = async () => {
    if (!userPermissions?.canMoveAnyMachine) { alert("Sem permissão."); return; }
    if (window.confirm(`Mover ${localMachine.serie} para "A Fazer"?`)) {
      try {
        await FrotaACP.update(localMachine.id, { estado: 'a-fazer', tecnico: null, dataConclusao: null });
        onClose();
      } catch(e) { alert('Erro ao mover máquina.'); }
    }
  };

  const handleToggleEditedTask = (idx) => {
    setEditedTasks(editedTasks.map((t, i) => i === idx ? { ...t, concluida: !t.concluida } : t));
  };

  const handleAddNewTask = () => {
    if (newTaskText.trim()) {
      setEditedTasks([...editedTasks, { texto: newTaskText.trim(), concluida: false }]);
      setNewTaskText('');
    }
  };

  const handleSaveTasks = async () => {
    setIsUpdating(true);
    try { await FrotaACP.update(localMachine.id, { tarefas: editedTasks }); setIsEditingTasks(false); }
    catch(e) { alert('Erro ao salvar tarefas.'); }
    setIsUpdating(false);
  };

  const handleToggleTaskLocal = async (taskIndex) => {
    if (isUpdating) return;
    const canEdit = (userPermissions?.canMoveAnyMachine || (currentUser?.nome_tecnico && localMachine.tecnico === currentUser.nome_tecnico)) && localMachine.estado?.includes('em-preparacao');
    if (!canEdit) return;
    setIsUpdating(true);
    try {
      const updated = localMachine.tarefas.map((t, i) => i === taskIndex ? { ...t, concluida: !t.concluida } : { ...t });
      setLocalMachine({ ...localMachine, tarefas: updated });
      await onToggleTask(localMachine.id, taskIndex);
    } catch(e) { setLocalMachine(localMachine); }
    setIsUpdating(false);
  };

  const handleAguardaPecasClick = async () => {
    const nv = !localMachine.aguardaPecas;
    if (window.confirm(nv ? `Marcar ${localMachine.serie} como "AGUARDA PEÇAS"?` : `Confirmar peças chegaram?`)) {
      setLocalMachine({ ...localMachine, aguardaPecas: nv });
      await onToggleAguardaPecas(localMachine.id, nv);
    }
  };

  const tarefasConcluidas = localMachine.tarefas?.filter(t => t.concluida).length || 0;
  const totalTarefas = localMachine.tarefas?.length || 0;
  const TipoIcon = TIPO_ICONS[localMachine.tipo] || Package;
  const isAdmin = userPermissions?.canMoveAnyMachine;
  const isMyMachine = currentUser?.nome_tecnico && localMachine.tecnico === currentUser.nome_tecnico;
  const canEditThisMachine = isAdmin || isMyMachine;
  const canEditTasks = localMachine.estado?.includes('em-preparacao') && canEditThisMachine;

  return (
    <>
      {/* OVERLAY */}
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 9998, backdropFilter: 'blur(4px)' }} />

      {/* MODAL */}
      <div style={{ position: 'fixed', top: 'clamp(0px, 5vh, 60px)', left: '50%', transform: 'translateX(-50%)', width: 'min(95vw, 860px)', maxHeight: 'calc(100dvh - clamp(0px, 10vh, 80px))', display: 'flex', flexDirection: 'column', borderRadius: 'clamp(0px, 3vw, 14px)', zIndex: 9999, background: isDark ? 'linear-gradient(160deg, #09090F 0%, #0D0D1E 100%)' : C.bg, border: isDark ? '1px solid rgba(255,45,120,0.2)' : `1px solid ${C.border}`, boxShadow: isDark ? '0 24px 80px rgba(0,0,0,0.95), 0 0 60px rgba(255,45,120,0.12), inset 0 0 0 1px rgba(255,255,255,0.025)' : '0 24px 60px rgba(0,0,0,0.18)', overflow: 'hidden' }}>

        {/* CLOSE */}
        <button onClick={onClose} style={{ position: 'absolute', top: '12px', right: '12px', zIndex: 10, width: '28px', height: '28px', borderRadius: '50%', background: isDark ? '#1C1C35' : '#F0F0F8', border: `1px solid ${C.border}`, cursor: 'pointer', color: C.muted, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px' }}>✕</button>

        {/* HEADER */}
        <div style={{ padding: '16px 20px 12px', borderBottom: isDark ? '1px solid rgba(255,45,120,0.15)' : `1px solid ${C.border}`, flexShrink: 0, background: isDark ? 'linear-gradient(90deg, rgba(255,45,120,0.06) 0%, transparent 60%)' : 'transparent', position: 'relative' }}>
          {isDark && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, #FF2D78 0%, #4D9FFF 100%)', opacity: 0.8 }} />}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <span style={{ fontFamily: 'monospace', fontSize: '22px', fontWeight: 900, color: C.text }}>{localMachine.serie}</span>
            {localMachine.prioridade && <AlertTriangle size={16} color={C.orange} />}
            {localMachine.aguardaPecas && <Clock size={16} color={C.yellow} />}
            <TipoIcon size={16} color={C.muted} />
            {totalTarefas > 0 && (
              <span style={s.pill(tarefasConcluidas === totalTarefas ? C.green : C.blue, '#fff')}>
                {tarefasConcluidas}/{totalTarefas}
              </span>
            )}
          </div>
          <div style={{ fontSize: '13px', color: C.muted, marginBottom: '4px' }}>{localMachine.modelo} {localMachine.ano && `· ${localMachine.ano}`} {localMachine.tecnico && `· ${localMachine.tecnico}`}</div>
          <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: C.muted }}>
            {localMachine.created_date && <span>📅 {new Date(localMachine.created_date).toLocaleDateString('pt-PT')}</span>}
            {localMachine.dataAtribuicao && <span>👤 {new Date(localMachine.dataAtribuicao).toLocaleDateString('pt-PT')}</span>}
            {localMachine.dataConclusao && <span>✅ {new Date(localMachine.dataConclusao).toLocaleDateString('pt-PT')}</span>}
          </div>

          {/* Histórico */}
          {localMachine.historicoCriacoes?.length > 0 && (
            <div style={{ marginTop: '8px', padding: '8px 12px', borderRadius: '8px', background: `${C.blue}11`, border: `1px solid ${C.blue}33`, fontSize: '11px', color: C.blue }}>
              🔁 Esta máquina já foi registada {localMachine.historicoCriacoes.length}x anteriormente
            </div>
          )}

          {/* BOTÕES DE AÇÃO */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '12px' }}>
            {isAdmin && localMachine.estado !== 'a-fazer' && (
              <button onClick={handleMoveToAFazer} style={s.btn('#555577')}>⬅ A Fazer</button>
            )}
            {userPermissions?.canSetPriority && localMachine.estado === 'a-fazer' && (
              <button onClick={() => onTogglePriority(localMachine.id, !localMachine.prioridade)} style={s.btn(C.orange)}>
                {localMachine.prioridade ? '⭐ Remover Prioridade' : '⭐ Prioritária'}
              </button>
            )}
            {isAdmin && (
              <>
                {onOpenEdit && <button onClick={() => onOpenEdit(localMachine)} style={s.btn(C.blue)}>✏️ Editar</button>}
                <button onClick={() => { if (window.confirm(`Apagar ${localMachine.serie}?`)) onDelete(localMachine.id); }} style={s.btn(C.red)}>🗑 Apagar</button>
              </>
            )}
            {localMachine.estado?.includes('em-preparacao') && !localMachine.estado?.includes('concluida') && canEditThisMachine && (
              <button onClick={handleMarkComplete} style={s.btn(C.green)}>✅ Concluída</button>
            )}
            {localMachine.estado?.includes('em-preparacao') && canEditThisMachine && (
              <button onClick={handleAguardaPecasClick} disabled={isUpdating} style={{ ...s.btn(C.yellow), color: '#000', opacity: isUpdating ? 0.5 : 1 }}>
                <Clock size={12} style={{ display: 'inline', marginRight: '4px' }} />
                {localMachine.aguardaPecas ? 'Peças Chegaram' : 'Aguarda Peças'}
              </button>
            )}
          </div>
        </div>

        {/* BODY SCROLL */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>

          {/* TIMER — sempre visível se houver dados de timer ou se máquina está em preparação */}
          {(localMachine.estado?.includes('em-preparacao') || localMachine.timer_inicio) && (
            <div style={{ ...s.section, marginBottom: '14px' }}>
              <span style={s.label}>⏱ Timer de Trabalho</span>
              <TimerButton
                machine={localMachine}
                currentUser={currentUser}
                userPermissions={userPermissions}
                isDark={isDark}
                onStart={onTimerStart}
                onPause={onTimerPause}
                onResume={onTimerResume}
                onStop={onTimerStop}
                onReset={onTimerReset}
                isAdmin={userPermissions?.canMoveAnyMachine}
              />
            </div>
          )}

          {/* TAREFAS */}
          {(localMachine.tarefas?.length > 0 || canEditTasks) && (
            <div style={s.section}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={s.label}>📋 Tarefas</span>
                {canEditTasks && (
                  <button onClick={() => isEditingTasks ? handleSaveTasks() : setIsEditingTasks(true)} style={s.btn(isEditingTasks ? C.green : C.blue)}>
                    {isEditingTasks ? '💾 Guardar' : '✏️ Editar'}
                  </button>
                )}
              </div>

              {isEditingTasks ? (
                <div>
                  {/* Predefinidas */}
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '8px' }}>
                    {TAREFAS_PREDEFINIDAS.map(t => (
                      <button key={t} onClick={() => { if (!editedTasks.find(e => e.texto === t)) setEditedTasks([...editedTasks, { texto: t, concluida: false }]); }}
                        style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 700, fontFamily: 'monospace', border: `1px solid ${C.border}`, background: C.surface, color: C.muted, cursor: 'pointer' }}>
                        + {t}
                      </button>
                    ))}
                  </div>
                  {editedTasks.map((task, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '6px', background: C.surface, border: `1px solid ${C.border}`, marginBottom: '4px' }}>
                      <input type="checkbox" checked={task.concluida} onChange={() => handleToggleEditedTask(idx)} />
                      <span style={{ flex: 1, fontSize: '12px', color: task.concluida ? C.muted : C.text, textDecoration: task.concluida ? 'line-through' : 'none' }}>{task.texto}</span>
                      <button onClick={() => setEditedTasks(editedTasks.filter((_,i) => i !== idx))} style={{ background: 'none', border: 'none', color: C.red, cursor: 'pointer', fontSize: '14px' }}>✕</button>
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
                    <input value={newTaskText} onChange={e => setNewTaskText(e.target.value)} placeholder="Nova tarefa..." style={s.input} onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddNewTask())} />
                    <button onClick={() => { if (newTaskText.trim()) { setEditedTasks([...editedTasks, { texto: newTaskText.trim(), concluida: false }]); setNewTaskText(''); }}} style={s.btn(C.blue)}>+</button>
                  </div>
                </div>
              ) : (
                localMachine.tarefas?.map((task, idx) => (
                  <div key={idx} onClick={() => handleToggleTaskLocal(idx)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 10px', borderRadius: '6px', marginBottom: '4px', cursor: canEditTasks ? 'pointer' : 'default', background: task.concluida ? `${C.green}10` : C.surface, border: `1px solid ${task.concluida ? C.green + '33' : C.border}`, transition: 'all 0.15s' }}>
                    <span style={{ fontSize: '15px' }}>{task.concluida ? '✅' : '⬜'}</span>
                    <span style={{ flex: 1, fontSize: '12px', fontWeight: 600, color: task.concluida ? C.muted : C.text, textDecoration: task.concluida ? 'line-through' : 'none' }}>{task.texto}</span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* PEDIDOS DE PEÇAS */}
          <div style={s.section}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={s.label}>🔧 Pedidos de Peças</span>
              <button onClick={() => setShowPedidoForm(!showPedidoForm)} style={s.btn(isDark ? '#333360' : '#111827')}>
                {showPedidoForm ? '✕ Fechar' : '+ Pedido'}
              </button>
            </div>
            {showPedidoForm && (
              <div style={{ display: 'flex', gap: '6px', marginBottom: '10px' }}>
                <input value={numeroPedido} onChange={e => setNumeroPedido(e.target.value)} placeholder="Nº do pedido..." style={s.input} onKeyDown={e => e.key === 'Enter' && handleSubmitPedido()} />
                <button onClick={handleSubmitPedido} style={s.btn(C.pink)}>Enviar</button>
              </div>
            )}
            {machinePedidos.length === 0 ? (
              <p style={{ fontSize: '12px', color: C.muted }}>Sem pedidos de peças.</p>
            ) : machinePedidos.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderRadius: '6px', background: C.surface, border: `1px solid ${C.border}`, marginBottom: '4px' }}>
                <span style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 700, color: C.text }}>{p.numeroPedido}</span>
                <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '10px', background: p.status === 'concluido' ? `${C.green}22` : `${C.yellow}22`, color: p.status === 'concluido' ? C.green : C.yellow, fontWeight: 700 }}>
                  {p.status === 'concluido' ? 'CONFIRMADO' : 'PENDENTE'}
                </span>
              </div>
            ))}
          </div>

          {/* OBSERVAÇÕES */}
          <div style={s.section}>
            <span style={s.label}>💬 Observações</span>
            {!localMachine.observacoes?.length && <p style={{ fontSize: '12px', color: C.muted, marginBottom: '8px' }}>Sem observações.</p>}
            {localMachine.observacoes?.map((obs, idx) => (
              <div key={idx} style={{ padding: '10px', borderRadius: '8px', background: C.surface, border: `1px solid ${C.border}`, marginBottom: '6px' }}>
                <p style={{ fontSize: '13px', color: C.text, lineHeight: 1.5, marginBottom: '4px' }}>{obs.texto}</p>
                <p style={{ fontSize: '10px', color: C.muted }}>{obs.autor} · {obs.data && new Date(obs.data).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</p>
              </div>
            ))}
          </div>

        </div>

        {/* FOOTER — adicionar obs */}
        <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.border}`, background: isDark ? '#0A0A14' : '#F8F8FF', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <textarea value={newObs} onChange={e => setNewObs(e.target.value)} rows={2} placeholder="Adicionar observação..." style={{ ...s.input, resize: 'none' }} onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey) handleSubmit(); }} />
            <button onClick={handleSubmit} style={{ ...s.btn(isDark ? C.pink : '#111827'), alignSelf: 'flex-end', padding: '10px 18px', whiteSpace: 'nowrap' }}>Adicionar</button>
          </div>
          <p style={{ fontSize: '10px', color: C.muted, marginTop: '4px' }}>Ctrl+Enter para enviar</p>
        </div>

      </div>
    </>
  );
}