import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Repeat, Package, CheckCircle2, Clock, Wrench, HardDrive,
  ChevronUp, ChevronDown, ChevronRight, User as UserIcon
} from "lucide-react";
import { useElapsedTimer, formatDuration } from "./TimerButton";
import { deriveTimerState } from "@/lib/timerHistorico";
import { TECHNICIANS } from "./technicians";

const MachineCardCompact = ({ machine, onClick, isDark, onAssign, showAssignButton, isSelected, onSelect }) => {
  const timerElapsed = useElapsedTimer(machine);
  const hasHistory   = machine.historicoCriacoes?.length > 0;
  const hasExpress   = machine.tarefas?.some(t => t.texto === 'EXPRESS');
  const otherTasks   = machine.tarefas?.filter(t => t.texto !== 'EXPRESS') || [];
  const timerState   = deriveTimerState(machine);
  const timerAtivo   = timerState === 'running';
  const timerPausado = timerState === 'paused';
  const isPrio       = !!machine.prioridade;
  const reconColor   = machine.recondicao?.bronze && machine.recondicao?.prata ? '#D4AF37'
    : machine.recondicao?.bronze ? '#CD7F32'
    : machine.recondicao?.prata  ? '#C0C0C0' : null;
  
  // Indicador de estado
  const getStateIndicator = () => {
    if (machine.estado?.startsWith("concluida")) return { icon: CheckCircle2, label: "Concluída", color: "#10b981" };
    if (machine.estado?.startsWith("em-preparacao")) return { icon: Clock, label: "Em Preparação", color: "#f59e0b" };
    if (machine.estado === "a-fazer") return { icon: Wrench, label: "A Fazer", color: "#ef4444" };
    return { icon: HardDrive, label: "Indefinido", color: "#6b7280" };
  };
  const stateInfo = getStateIndicator();
  const StateIcon = stateInfo.icon;

  const BG     = isDark ? (isPrio ? '#17060E' : '#0B0B16') : (isPrio ? '#FFF2F7' : '#FFFFFF');
  const TEXT   = isDark ? '#E8E8FF' : '#080818';
  const SUB    = isDark ? '#505080' : '#8888AA';
  const BORDER = isPrio ? 'rgba(255,45,120,0.55)' : isDark ? '#1C1C35' : '#DDDDF0';
  const LEFT   = isPrio ? '#FF2D78' : isDark ? '#2A2A50' : '#C8C8E8';

  return (
    <button
      onClick={(e) => { if (e.ctrlKey||e.metaKey) { onSelect?.(machine); } else { onClick(machine); } }}
      style={{
        width: '100%', textAlign: 'left',
        background: isSelected ? (isDark ? '#1A1A3A' : '#EEF0FF') : BG,
        border: `1px solid ${isSelected ? '#4D9FFF' : BORDER}`,
        borderLeft: `4px solid ${isSelected ? '#4D9FFF' : LEFT}`,
        borderRadius: '8px',
        marginBottom: '8px',
        cursor: 'pointer',
        transition: 'transform 0.1s, box-shadow 0.1s',
        overflow: 'hidden',
        position: 'relative',
        boxShadow: isPrio
          ? (isDark ? '0 0 20px rgba(255,45,120,0.22), 0 4px 16px rgba(0,0,0,0.6)' : '0 0 14px rgba(255,45,120,0.14), 0 2px 8px rgba(0,0,0,0.08)')
          : (isDark ? '0 2px 10px rgba(0,0,0,0.5)' : '0 1px 4px rgba(0,0,0,0.07)'),
        padding: 0,
      }}
    >
      {/* Topo neon prio */}
      {isPrio && <div style={{ height: '2px', background: 'linear-gradient(90deg, #FF2D78 0%, #FF80AA 60%, transparent 100%)' }} />}

      <div style={{ display: 'flex', alignItems: 'stretch', padding: '11px 13px 11px 11px', gap: '10px' }}>
        {/* Ícones de status à esquerda */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px', width: '18px', flexShrink: 0 }}>
          {isPrio && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="#FF2D78" style={{ filter: 'drop-shadow(0 0 4px #FF2D78)' }}>
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
          )}
          {hasExpress && (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="#F59E0B" style={{ filter: 'drop-shadow(0 0 4px #F59E0B)' }}>
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
          )}
          {hasHistory && <Repeat style={{ width: '10px', height: '10px', color: '#4D9FFF' }} />}
          {machine.aguardaPecas && <Package style={{ width: '10px', height: '10px', color: '#F59E0B' }} />}
          {machine.wasRescheduled && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#EC4899" strokeWidth="2" style={{ filter: 'drop-shadow(0 0 3px #EC4899)' }}>
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
              <path d="M8 8 Q 6 6 4 8" />
            </svg>
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Modelo + ano */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '10px', fontFamily: 'monospace', color: SUB, letterSpacing: '0.05em', textTransform: 'uppercase' }}>{machine.modelo}</span>
            {machine.ano && <span style={{ fontSize: '9px', fontFamily: 'monospace', color: SUB, opacity: 0.5 }}>{machine.ano}</span>}
            {reconColor && (
              <span style={{ fontSize: '8px', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', background: `${reconColor}22`, color: reconColor, fontFamily: 'monospace', border: `1px solid ${reconColor}50` }}>
                {machine.recondicao?.bronze && machine.recondicao?.prata ? 'BRZ+PRT' : machine.recondicao?.bronze ? 'BRZ' : 'PRT'}
              </span>
            )}
          </div>

          {/* Série — HERO */}
          <div style={{
            fontFamily: 'monospace', fontSize: '16px', fontWeight: 900,
            color: isPrio ? '#FF2D78' : TEXT,
            letterSpacing: '0.08em', lineHeight: 1.1, marginBottom: '5px',
            textShadow: isPrio && isDark ? '0 0 16px rgba(255,45,120,0.5)' : 'none',
          }}>
            {machine.serie}
          </div>

          {/* Badges de tarefa */}
          {otherTasks.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginBottom: '5px' }}>
              {otherTasks.map((t, i) => (
                <span key={i} style={{
                  fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '3px',
                  background: isDark ? 'rgba(77,159,255,0.12)' : 'rgba(77,159,255,0.09)',
                  color: '#4D9FFF', fontFamily: 'monospace', border: '1px solid rgba(77,159,255,0.25)',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                }}>{t.texto}</span>
              ))}
            </div>
          )}

          {/* Timer */}
          {timerElapsed !== null && (timerAtivo || timerPausado) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: timerPausado ? '#F59E0B' : '#22C55E', boxShadow: !timerPausado ? '0 0 7px #22C55E' : 'none' }} />
              <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 700, color: timerPausado ? '#F59E0B' : '#22C55E', letterSpacing: '0.06em' }}>{formatDuration(timerElapsed)}</span>
              {timerPausado && <span style={{ fontSize: '9px', color: SUB, fontFamily: 'monospace' }}>pausado</span>}
            </div>
          )}
          {!timerAtivo && !timerPausado && machine.timer_duracao_minutos != null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Clock style={{ width: '9px', height: '9px', color: '#4ADE80' }} />
              <span style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 700, color: '#4ADE80' }}>{formatDuration(machine.timer_duracao_minutos * 60)}</span>
            </div>
          )}
        </div>

        {/* Indicador de estado */}
        {machine.estado !== "a-fazer" && (
          <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0, padding: "4px 8px", borderRadius: "4px", background: `${stateInfo.color}15`, border: `1px solid ${stateInfo.color}40` }}>
            <StateIcon style={{ width: "10px", height: "10px", color: stateInfo.color }} />
            <span style={{ fontSize: "8px", fontFamily: "monospace", fontWeight: 700, color: stateInfo.color, textTransform: "uppercase", letterSpacing: "0.04em" }}>{stateInfo.label}</span>
          </div>
        )}

        {/* Botão atribuir */}
        {showAssignButton && onAssign && (
          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAssign(machine); }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: 'linear-gradient(135deg, #FF2D78, #9B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', boxShadow: '0 0 10px rgba(255,45,120,0.4)', border: '1px solid rgba(255,255,255,0.1)' }}>
              <ChevronRight style={{ width: '16px', height: '16px', color: 'white' }} />
            </div>
          </div>
        )}
      </div>

      {/* Linha escanline decorativa cyberpunk (fundo) */}
      {isDark && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '1px', background: isPrio ? 'rgba(255,45,120,0.12)' : 'rgba(77,159,255,0.05)' }} />
      )}
    </button>
  );
};

const MachineCardTechnician = ({ machine, onClick, techColor, isDark, isSelected, onSelect, onTimerStart, onTimerPause, onTimerResume }) => {
  const hasHistory   = machine.historicoCriacoes?.length > 0;
  const hasExpress   = machine.tarefas?.some(t => t.texto === 'EXPRESS');
  const otherTasks   = machine.tarefas?.filter(t => t.texto !== 'EXPRESS') || [];
  const timerState   = deriveTimerState(machine);
  const timerAtivo   = timerState === 'running';
  const timerPausado = timerState === 'paused';
  const timerDone    = timerState === 'done';
  const timerElapsed = useElapsedTimer(machine);
  const isPrio       = !!machine.prioridade;

  const BG   = isDark ? (isPrio ? '#17060E' : '#0B0B16') : (isPrio ? '#FFF2F7' : '#FFFFFF');
  const TEXT = isDark ? '#E8E8FF' : '#080818';
  const SUB  = isDark ? '#505080' : '#8888AA';

  return (
    <button
      onClick={(e) => { if (e.ctrlKey||e.metaKey) { onSelect?.(machine); } else { onClick(machine); } }}
      style={{
        width: '100%', textAlign: 'left', cursor: 'pointer',
        background: isSelected ? (isDark ? '#1A1A3A' : '#EEF0FF') : BG,
        border: `1px solid ${isSelected ? '#4D9FFF' : isPrio ? 'rgba(255,45,120,0.55)' : isDark ? '#1C1C35' : '#DDDDF0'}`,
        borderLeft: `4px solid ${isSelected ? '#4D9FFF' : isPrio ? '#FF2D78' : techColor}`,
        borderRadius: '8px',
        padding: '11px 12px',
        marginBottom: '8px',
        boxShadow: isPrio
          ? (isDark ? '0 0 20px rgba(255,45,120,0.22), 0 4px 16px rgba(0,0,0,0.6)' : '0 0 14px rgba(255,45,120,0.14)')
          : (isDark ? '0 2px 10px rgba(0,0,0,0.5)' : '0 1px 4px rgba(0,0,0,0.07)'),
        transition: 'all 0.12s',
        position: 'relative', overflow: 'hidden',
        display: 'flex', flexDirection: 'column', gap: '4px',
      }}
    >
      {isPrio && <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: 'linear-gradient(90deg, #FF2D78 0%, #FF80AA 60%, transparent 100%)' }} />}

      {/* Linha 1: modelo + ícones */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '10px', fontFamily: 'monospace', color: SUB, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{machine.modelo}</span>
        {machine.ano && <span style={{ fontSize: '9px', fontFamily: 'monospace', color: SUB, opacity: 0.5 }}>{machine.ano}</span>}
        {isPrio && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="#FF2D78" style={{ filter: 'drop-shadow(0 0 4px #FF2D78)', flexShrink: 0 }}>
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
          </svg>
        )}
        {hasExpress && (
          <svg width="11" height="11" viewBox="0 0 24 24" fill="#F59E0B" style={{ filter: 'drop-shadow(0 0 3px #F59E0B)', flexShrink: 0 }}>
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
          </svg>
        )}
        {hasHistory && <Repeat style={{ width: '9px', height: '9px', color: '#4D9FFF' }} />}
        {machine.aguardaPecas && <Package style={{ width: '9px', height: '9px', color: '#F59E0B' }} />}
      </div>

      {/* Série */}
      <div style={{
        fontFamily: 'monospace', fontSize: '16px', fontWeight: 900,
        color: isPrio ? '#FF2D78' : TEXT,
        letterSpacing: '0.07em', lineHeight: 1.1,
        textShadow: isPrio && isDark ? '0 0 16px rgba(255,45,120,0.5)' : 'none',
      }}>{machine.serie}</div>

      {/* Tarefas */}
      {otherTasks.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
          {otherTasks.map((t, i) => (
            <span key={i} style={{ fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '3px', background: isDark ? 'rgba(77,159,255,0.12)' : 'rgba(77,159,255,0.09)', color: '#4D9FFF', fontFamily: 'monospace', border: '1px solid rgba(77,159,255,0.25)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{t.texto}</span>
          ))}
        </div>
      )}

      {/* Timer inline no card */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>

        {/* Botão INICIAR — só se sem timer */}
        {!timerAtivo && !timerPausado && !timerDone && onTimerStart && (
          <button
            onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); onTimerStart(machine.id); }}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '6px', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)', color: '#22C55E', fontFamily: 'monospace', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}>
            ▶ INICIAR
          </button>
        )}

        {/* Timer ativo */}
        {timerAtivo && !timerPausado && timerElapsed !== null && (<>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#22C55E', boxShadow: '0 0 7px #22C55E', flexShrink: 0 }} />
          <span style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 900, color: '#22C55E', letterSpacing: '0.05em' }}>{formatDuration(timerElapsed)}</span>
          {onTimerPause && (
            <button
              onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); onTimerPause(machine.id, timerElapsed / 60); }}
              style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '3px 8px', borderRadius: '5px', background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.4)', color: '#F59E0B', fontFamily: 'monospace', fontSize: '9px', fontWeight: 700, cursor: 'pointer' }}>
              ⏸ PAUSAR
            </button>
          )}
        </>)}

        {/* Timer pausado */}
        {timerPausado && timerElapsed !== null && (<>
          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#F59E0B', flexShrink: 0 }} />
          <span style={{ fontSize: '12px', fontFamily: 'monospace', fontWeight: 900, color: '#F59E0B', letterSpacing: '0.05em' }}>{formatDuration(timerElapsed)}</span>
          <span style={{ fontSize: '9px', color: SUB, fontFamily: 'monospace' }}>pausado</span>
          {onTimerResume && (
            <button
              onPointerDown={(e) => { e.stopPropagation(); e.preventDefault(); onTimerResume(machine.id); }}
              style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '3px 8px', borderRadius: '5px', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.4)', color: '#22C55E', fontFamily: 'monospace', fontSize: '9px', fontWeight: 700, cursor: 'pointer' }}>
              ▶ RETOMAR
            </button>
          )}
        </>)}

        {/* Concluído */}
        {timerDone && timerElapsed !== null && (<>
          <Clock style={{ width: '10px', height: '10px', color: '#4ADE80' }} />
          <span style={{ fontSize: '11px', fontFamily: 'monospace', fontWeight: 700, color: '#4ADE80' }}>{formatDuration(timerElapsed)}</span>
        </>)}
      </div>
    </button>
  );
};

const TechnicianCompletedSection = ({ machines, techId, onOpenMachine, isDark }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  // Ordenar máquinas concluídas pela data de conclusão (mais recentes no topo)
  const sortedMachines = [...machines].sort((a, b) => {
    const dateA = a.dataConclusao ? new Date(a.dataConclusao).getTime() : 0;
    const dateB = b.dataConclusao ? new Date(b.dataConclusao).getTime() : 0;
    return dateB - dateA;
  });
  
  const bgColor = isDark ? '#161630' : '#F8F8FF';
  const borderColor = isDark ? '#2A2A50' : '#E0E0F0';
  const textColor = isDark ? '#E8E8FF' : '#080818';
  const mutedColor = isDark ? '#9090C8' : '#8888AA';
  
  return (
    <div style={{ marginTop: '12px' }}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 12px', borderRadius: '8px', border: `1px solid ${borderColor}`,
          background: bgColor, cursor: 'pointer', transition: 'all 0.2s'
        }}
      >
        <span style={{ fontSize: '11px', fontWeight: 700, fontFamily: 'monospace', color: textColor, textTransform: 'uppercase', letterSpacing: '0.08em' }}>✓ Concluídas: {machines.length}</span>
        {isExpanded ? <ChevronUp className="w-4 h-4" style={{ color: mutedColor }} /> : <ChevronDown className="w-4 h-4" style={{ color: mutedColor }} />}
      </button>
      <AnimatePresence>
        {isExpanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ marginTop: '8px', maxHeight: '200px', overflowY: 'auto' }}>
            {sortedMachines.map(machine => (
              <button key={machine.id} onClick={() => onOpenMachine(machine)} style={{
                width: '100%', textAlign: 'left', padding: '10px 12px', marginBottom: '6px', borderRadius: '8px',
                border: `1px solid ${borderColor}`, background: bgColor, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', gap: '4px', transition: 'all 0.2s'
              }}>
                <span style={{ fontSize: '12px', fontWeight: 900, fontFamily: 'monospace', color: textColor, letterSpacing: '0.06em' }}>{machine.serie}</span>
                <span style={{ fontSize: '9px', fontFamily: 'monospace', color: mutedColor }}>{machine.modelo}</span>
                {machine.dataConclusao && (
                  <span style={{ fontSize: '8px', fontFamily: 'monospace', color: mutedColor }}>✅ {new Date(machine.dataConclusao).toLocaleDateString('pt-PT')}</span>
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const AssignModal = ({ isOpen, onClose, machine, onAssign }) => {
  if (!isOpen || !machine) return null;
  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[60]" onClick={onClose} />
      <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rounded-xl shadow-2xl z-[70] w-[90%] max-w-md p-6 bg-white">
        <h3 className="text-xl font-bold mb-4 text-black">Atribuir Máquina {machine.serie}</h3>
        <p className="text-sm mb-6 text-gray-600">Selecione o técnico:</p>
        <div className="grid grid-cols-2 gap-4">
          {TECHNICIANS.map(tech => (
            <button key={tech.id} onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAssign(tech.id); onClose(); }}
              className="p-6 rounded-lg border-3 transition-all hover:shadow-lg bg-white text-black font-bold active:scale-95"
              style={{ borderColor: tech.borderColor, borderWidth: '3px' }}>
              <UserIcon className="w-8 h-8 mx-auto mb-3" style={{ color: tech.borderColor }} />
              <div className="text-base">{tech.name}</div>
            </button>
          ))}
        </div>
        <button onClick={onClose} className="mt-6 w-full px-4 py-3 rounded-lg border-2 border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold">Cancelar</button>
      </div>
    </>
  );
};

const FullscreenSectionModal = ({ isOpen, onClose, title, machines, icon: Icon, onOpenMachine, userPermissions, currentUser, onAssign, isDark }) => {
  if (!isOpen) return null;
  return (
    <>
      <div className="fixed inset-0 bg-black/80 z-[120]" onClick={onClose} />
      <div className={`fixed z-[130] flex flex-col ${isDark ? 'bg-gray-900' : 'bg-white'}`} style={{ top: 0, left: 0, right: 0, bottom: 0 }}>
        <div className={`p-6 border-b flex-shrink-0 mt-20 ${isDark ? 'border-gray-700' : 'border-gray-200'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Icon className={`w-8 h-8 ${isDark ? 'text-white' : 'text-black'}`} />
              <h2 className={`text-3xl font-bold ${isDark ? 'text-white' : 'text-black'}`}>{title}</h2>
              <span className={`px-4 py-1 rounded-full text-sm font-bold ${isDark ? 'bg-white text-black' : 'bg-black text-white'}`}>{machines.length}</span>
            </div>
            <button onClick={onClose} className={`p-2 rounded-full ${isDark ? 'bg-gray-800 hover:bg-gray-700' : 'bg-gray-100 hover:bg-gray-200'}`}>
              <svg className={`w-6 h-6 ${isDark ? 'text-white' : 'text-black'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 min-h-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {machines.map(machine => (
              <MachineCardCompact key={machine.id} machine={machine} onClick={onOpenMachine} isDark={isDark} onAssign={onAssign} showAssignButton={userPermissions?.canMoveAnyMachine || userPermissions?.canMoveMachineToOwnColumn} />
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

export {
  MachineCardCompact,
  MachineCardTechnician,
  TechnicianCompletedSection,
  AssignModal,
  FullscreenSectionModal,
};
