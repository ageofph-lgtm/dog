import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { FrotaACP, Pedido } from "@/entities/all";
import { Plus, Camera, Search, Wrench, User as UserIcon, Package, Sparkles, Repeat, CheckCircle2, ChevronDown, ChevronUp, Clock, Maximize2, Minimize2, HardDrive, AlertTriangle, ChevronRight, Sun, Moon } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { base44 } from "@/api/base44Client";
import { usePermissions } from "@/components/hooks/usePermissions";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

import ImageUploadModal from "../components/dashboard/ImageUploadModal";
import PedidosPanel from "../components/dashboard/PedidosPanel";
import BulkCreateModal from "../components/dashboard/BulkCreateModal";
import BackupManager from "../components/dashboard/BackupManager";
import EditMachineModal from "../components/dashboard/EditMachineModal";
import UnifiedNotifications from "../components/dashboard/UnifiedNotifications";
import OSNotificationsPanel from "../components/dashboard/OSNotificationsPanel";
import ObservationsModal from "../components/dashboard/ObservationsModal";
import CreateMachineModal from "../components/dashboard/CreateMachineModal";
import MachineEditCard from "../components/dashboard/MachineEditCard";
import { useElapsedTimer, formatDuration, saveTimerLocal, clearTimerLocal } from "../components/dashboard/TimerButton";
import { useTheme } from "../ThemeContext";
import ProfileSelector from "../components/auth/ProfileSelector";
import { LayoutUserContext } from "../Layout";
import { triggerDominoIfUrgent } from "../utils/reschedulingLogic";

const TECHNICIANS = [
  { id: 'raphael', name: 'RAPHAEL', color: 'bg-red-500', borderColor: '#ef4444', lightBg: '#fee2e2' },
  { id: 'nuno', name: 'NUNO', color: 'bg-yellow-500', borderColor: '#eab308', lightBg: '#fef3c7' },
  { id: 'rogerio', name: 'ROGÉRIO', color: 'bg-cyan-500', borderColor: '#06b6d4', lightBg: '#cffafe' },
  { id: 'yano', name: 'YANO', color: 'bg-green-500', borderColor: '#10b981', lightBg: '#d1fae5' }
];

const TIPO_ICONS = {
  nova: { icon: Sparkles, color: 'text-blue-600', bg: 'bg-blue-100' },
  usada: { icon: Repeat, color: 'text-orange-600', bg: 'bg-orange-100' },
  aluguer: { icon: Package, color: 'text-purple-600', bg: 'bg-purple-100' }
};


// ── Sync Watcher → Portal da Frota ACP ──────────────────────────────────────
// Mapeia o estado do Watcher para o status do Portal e actualiza TODOS os
// registos do Portal que tenham o mesmo serial_number da máquina.
const PORTAL_API = "https://base44.app/api/apps/699ee6a6c0541069d0066cc1/entities/Equipment";
const PORTAL_KEY = "f8517554492e492090b62dd501ad7e14";

function watcherEstadoToPortalStatus(estado) {
  if (!estado) return null;
  if (estado.startsWith("em-preparacao")) return "Em progresso";
  if (estado.startsWith("concluida"))     return "Pronta";
  if (estado === "a-fazer")               return "A começar";
  return null;
}

async function syncMachineToPortal(serie, novoEstado, forceStatus) {
  const novoStatus = forceStatus || watcherEstadoToPortalStatus(novoEstado);
  if (!novoStatus || !serie) return;
  try {
    // 1. Buscar todos os registos do Portal com este serial_number
    const resp = await fetch(`${PORTAL_API}?serial_number=${encodeURIComponent(serie)}&limit=50`, {
      headers: { "api_key": PORTAL_KEY }
    });
    const records = await resp.json();
    if (!Array.isArray(records) || records.length === 0) return;
    // 2. Actualizar cada registo encontrado
    await Promise.all(records.map(r =>
      fetch(`${PORTAL_API}/${r.id}`, {
        method: "PUT",
        headers: { "api_key": PORTAL_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ status: novoStatus })
      })
    ));
    console.log(`[Portal sync] ${serie} → ${novoStatus} (${records.length} registo(s))`);
  } catch (e) {
    console.warn("[Portal sync] Falhou:", e.message);
  }
}
// ─────────────────────────────────────────────────────────────────────────────

const MachineCardCompact = ({ machine, onClick, isDark, onAssign, showAssignButton, isSelected, onSelect }) => {
  const timerElapsed = useElapsedTimer(machine);
  const hasHistory   = machine.historicoCriacoes?.length > 0;
  const hasExpress   = machine.tarefas?.some(t => t.texto === 'EXPRESS');
  const otherTasks   = machine.tarefas?.filter(t => t.texto !== 'EXPRESS') || [];
  const timerAtivo   = machine?.timer_ativo === true;
  const timerPausado = machine?.timer_pausado === true;
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
  const timerAtivo   = Boolean(machine?.actualStartTime) || (machine?.timer_ativo === true && machine?.timer_pausado !== true);
  const timerPausado = !timerAtivo && (machine?.status === 'Pausado' || machine?.timer_pausado === true);
  const timerDone    = !timerAtivo && (machine?.status === 'Concluída' || machine?.actualEndDate || machine?.actualEndTime || machine?.timer_fim);
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

export default function Dashboard() {
  const [machines, setMachines] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImageModal, setShowImageModal] = useState(false);
  const [prefillData, setPrefillData] = useState(null);
  // Auth: lê do localStorage directamente — não depende do contexto para renderizar
  const [showProfileSelector, setShowProfileSelector] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('watcher_profile');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.perfil) return parsed;
      }
    } catch (error) {
      console.warn('Erro ao ler perfil local:', error);
    }
    return null;
  });

  // Sync bidirecional com LayoutUserContext (opcional, para logout centralizado)
  const layoutUser = React.useContext(LayoutUserContext);
  useEffect(() => {
    if (layoutUser?.user && layoutUser.user !== currentUser) {
      setCurrentUser(layoutUser.user);
    }
  }, [layoutUser?.user]);
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [showObsModal, setShowObsModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [machineToAssign, setMachineToAssign] = useState(null);
  const [showBulkCreateModal, setShowBulkCreateModal] = useState(false);
  const [showBackupManager, setShowBackupManager] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [machineToEdit, setMachineToEdit] = useState(null);
  const { isDark: isDarkMode } = useTheme();
  const [showAFazerFullscreen, setShowAFazerFullscreen] = useState(false);
  const [showConcluidaFullscreen, setShowConcluidaFullscreen] = useState(false);
  const [selectedMachines, setSelectedMachines] = useState([]);
  const [showMultiEditModal, setShowMultiEditModal] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(null);
  const [showPatrickLegacy, setShowPatrickLegacy] = useState(false);

  const userPermissions = usePermissions(currentUser?.perfil, currentUser?.nome_tecnico);
  const heroRef = useRef(null);

  // Medir altura real do hero e ajustar spacer dinamicamente
  useEffect(() => {
    const updateHeroHeight = () => {
      if (heroRef.current) {
        const h = heroRef.current.offsetHeight;
        document.documentElement.style.setProperty('--hero-height', h + 'px');
      }
    };
    updateHeroHeight();
    window.addEventListener('resize', updateHeroHeight);
    return () => window.removeEventListener('resize', updateHeroHeight);
  }, []);



  const TIMER_FIELDS = [
    'actualStartTime','actualTimeSpent','actualEndDate','actualEndTime','status',
    'timer_ativo','timer_pausado','timer_inicio','timer_fim','timer_duracao_minutos','timer_acumulado'
  ];

  const loadMachines = useCallback(async () => {
    try {
      const data = await FrotaACP.list('-created_date');
      setMachines(data);
    } catch (error) { console.error("Erro ao carregar máquinas:", error); }
    setIsLoading(false);
  }, []);

  // loadUser removido — auth gerida pelo Layout via LayoutUserContext

  useEffect(() => { loadMachines(); }, [loadMachines]);

  useEffect(() => {
    const interval = setInterval(() => { loadMachines(); }, 30000);
    return () => clearInterval(interval);
  }, [loadMachines]);

  // Subscrição em tempo real para mudanças de máquinas (Timer Sync)
  useEffect(() => {
    let unsubscribe = null;
    const subscribe = async () => {
      try {
        unsubscribe = await base44.entities.FrotaACP.subscribe((event) => {
          if (event.type === 'update' || event.type === 'create' || event.type === 'delete') {
            loadMachines();
          }
        });
      } catch (e) {
        console.warn('Subscrição em tempo real indisponível:', e.message);
      }
    };
    subscribe();
    return () => { if (unsubscribe) unsubscribe(); };
  }, [loadMachines]);

  const handleCreateMachine = async (machineData) => {
    try {
      const existingMachines = await FrotaACP.list();
      const duplicates = existingMachines.filter(m => m.serie === machineData.serie);
      if (duplicates.length > 0 && !machineData.confirmedDuplicate) {
        setDuplicateWarning({ machineData, duplicates });
        return;
      }
      const newMachine = { ...machineData, ano: machineData.ano ? parseInt(machineData.ano) : null, estado: 'a-fazer' };
      if (duplicates.length > 0) {
        newMachine.historicoCriacoes = duplicates.map(d => ({ dataCriacao: d.created_date, dataConclusao: d.dataConclusao, estado: d.estado }));
      }
      await FrotaACP.create(newMachine);

      // ── Sync automático → Portal da Frota ACP2 ──────────────────────────
      try {
        // Determinar action baseado no recondicionamento
        let portalAction = "";
        if (newMachine.recondicao?.bronze && newMachine.recondicao?.prata) portalAction = "Recon Bronze + Prata";
        else if (newMachine.recondicao?.bronze) portalAction = "Recon Bronze";
        else if (newMachine.recondicao?.prata)  portalAction = "Recon Prata";
        // Verificar se já existe no Portal (evitar duplicado)
        // Verificar APENAS no ACP2 — pode existir no ACP1 com tarefa diferente
        const chkResp = await fetch(`${PORTAL_API}?serial_number=${encodeURIComponent(newMachine.serie)}&frota=acp2&limit=10`, {
          headers: { "api_key": PORTAL_KEY }
        });
        const existing = await chkResp.json();
        if (!Array.isArray(existing) || existing.length === 0) {
          await fetch(PORTAL_API, {
            method: "POST",
            headers: { "api_key": PORTAL_KEY, "Content-Type": "application/json" },
            body: JSON.stringify({
              equipment:     newMachine.modelo,
              serial_number: newMachine.serie,
              status:        "A começar",
              action:        portalAction,
              frota:         "acp2"
            })
          });
          console.log(`[Portal sync] Criada no ACP2: ${newMachine.serie}`);
        }
      } catch(e) { console.warn("[Portal sync create]", e.message); }
      // ─────────────────────────────────────────────────────────────────────

      // ── Aplicar Efeito Dominó se máquina é prioritária ──────────────────
      if (newMachine.prioridade) {
        try {
          const result = await triggerDominoIfUrgent(newMachine);
          if (result.rescheduled.length > 0) {
            console.log(`[Efeito Dominó] ${result.rescheduled.length} OS reagendadas com sucesso`);
            await loadMachines();
          }
        } catch (e) { console.warn("[Efeito Dominó] Erro ao aplicar cascata:", e.message); }
      }
      // ─────────────────────────────────────────────────────────────────────

      await loadMachines();
      setShowCreateModal(false);
      setPrefillData(null);
      setDuplicateWarning(null);
    } catch (error) { console.error("Erro ao criar máquina:", error); }
  };

  const handleImageUploadSuccess = (extractedData) => {
    setShowImageModal(false);
    setPrefillData(extractedData);
    setShowCreateModal(true);
  };

  const handleAddObservation = async (machineId, texto) => {
    try {
      const machine = machines.find(m => m.id === machineId);
      const newObs = { texto, autor: currentUser?.full_name || 'Utilizador', data: new Date().toISOString() };
      setMachines(prevMachines => prevMachines.map(m => m.id === machineId ? { ...m, observacoes: [...(m.observacoes || []), newObs] } : m));
      await FrotaACP.update(machineId, { observacoes: [...(machine.observacoes || []), newObs] });
    } catch (error) { console.error("Erro ao adicionar observação:", error); await loadMachines(); }
  };

  const handleToggleTask = useCallback(async (machineId, taskIndex) => {
    try {
      const machine = machines.find(m => m.id === machineId);
      if (!machine || !machine.tarefas || !machine.tarefas[taskIndex]) throw new Error("Tarefa não encontrada");
      const updatedTarefas = machine.tarefas.map((t, i) => i === taskIndex ? { ...t, concluida: !t.concluida } : { ...t });
      await FrotaACP.update(machineId, { tarefas: updatedTarefas });
      setMachines(prevMachines => prevMachines.map(m => m.id === machineId ? { ...m, tarefas: updatedTarefas } : m));
    } catch (error) { console.error("Erro ao atualizar tarefa:", error); throw error; }
  }, [machines]);

  const handleTogglePriority = async (machineId, newPriorityValue) => {
    try {
      setMachines(prevMachines => prevMachines.map(m => m.id === machineId ? { ...m, prioridade: newPriorityValue } : m));
      await FrotaACP.update(machineId, { prioridade: newPriorityValue });

      // Disparar Efeito Dominó se a máquina foi marcada como urgente
      if (newPriorityValue === true) {
        const machine = machines.find(m => m.id === machineId);
        if (machine) {
          try {
            const result = await triggerDominoIfUrgent({ ...machine, prioridade: true });
            if (result.rescheduled.length > 0) {
              console.log(`[Efeito Dominó] ${result.rescheduled.length} OS reagendadas via toggle`);
              await loadMachines();
            }
          } catch (e) { console.warn("[Efeito Dominó] Erro:", e.message); }
        }
      }
    } catch (error) { console.error("Erro ao atualizar prioridade:", error); await loadMachines(); }
  };

  const handleDeleteMachine = async (machineId) => {
    if (!userPermissions?.canDeleteMachine) { alert("Você não tem permissão para apagar máquinas."); return; }
    try {
      await FrotaACP.delete(machineId);
      setShowObsModal(false);
      setSelectedMachine(null);
      await loadMachines();
    } catch (error) { console.error("Erro ao apagar máquina:", error); alert("Erro ao apagar máquina. Tente novamente."); }
  };

  const handleAssignMachine = async (machine) => {
    if (!currentUser) return;
    if (userPermissions?.canMoveAnyMachine) {
      setMachineToAssign(machine);
      setShowAssignModal(true);
      } else if (userPermissions?.canMoveMachineToOwnColumn && currentUser?.nome_tecnico) {
      try {
        const novoEstadoSelf = `em-preparacao-${currentUser.nome_tecnico}`;
        await FrotaACP.update(machine.id, { 
          estado: novoEstadoSelf, 
          tecnico: currentUser.nome_tecnico, 
          dataAtribuicao: new Date().toISOString(),
          dataConclusao: null
        });
        await base44.entities.Notificacao.create({ userId: 'admin', message: `${currentUser.nome_tecnico.charAt(0).toUpperCase() + currentUser.nome_tecnico.slice(1)} atribuiu máquina ${machine.serie} - Abrir OS!`, machineId: machine.id, machineSerie: machine.serie, technicianName: currentUser.nome_tecnico, type: 'self_assigned', isRead: false });
        syncMachineToPortal(machine.serie, novoEstadoSelf);
        await loadMachines();
      } catch (error) { console.error("Erro ao atribuir máquina:", error); alert("Erro ao atribuir máquina. Tente novamente."); }
    }
  };

  const handleAssignToTechnician = async (techId) => {
    if (!machineToAssign) return;
    try {
      const novoEstadoAdmin = `em-preparacao-${techId}`;
      await FrotaACP.update(machineToAssign.id, { 
        estado: novoEstadoAdmin, 
        tecnico: techId, 
        dataAtribuicao: new Date().toISOString(),
        dataConclusao: null // Resetar data de conclusão para máquinas que voltam à preparação
      });
      await base44.entities.Notificacao.create({ userId: techId, message: `Nova máquina atribuída: ${machineToAssign.serie}`, machineId: machineToAssign.id, machineSerie: machineToAssign.serie, technicianName: currentUser?.full_name || 'Admin', type: 'os_assignment', isRead: false });
      syncMachineToPortal(machineToAssign.serie, novoEstadoAdmin);
      await loadMachines();
      setShowAssignModal(false);
      setMachineToAssign(null);
    } catch (error) { console.error("Erro ao atribuir máquina:", error); alert("Erro ao atribuir máquina. Tente novamente."); }
  };

  const handleMarkComplete = async (machineId) => {
    const machine = machines.find(m => m.id === machineId);
    if (!machine) return;
    
    // Se não houver técnico, tentar derivar do estado (ex: em-preparacao-yano)
    let tech = machine.tecnico;
    if (!tech && machine.estado && machine.estado.includes('preparacao-')) {
      tech = machine.estado.split('-').pop();
    }
    
    if (!tech) return;

    try {
      const updateData = { 
        estado: `concluida-${tech}`, 
        tecnico: tech,
        dataConclusao: new Date().toISOString(),
        timer_ativo: false,
        timer_pausado: false
      };
      setMachines(prevMachines => prevMachines.map(m => m.id === machineId ? { ...m, ...updateData } : m));
      await FrotaACP.update(machineId, updateData);
      syncMachineToPortal(machine.serie, updateData.estado);
      await base44.entities.Notificacao.create({ userId: 'admin', message: `Máquina ${machine.serie} concluída`, machineId: machine.id, machineSerie: machine.serie, technicianName: machine.tecnico, type: 'machine_completed', isRead: false });
    } catch (error) { console.error("Erro ao marcar como concluída:", error); alert("Erro ao marcar como concluída. Tente novamente."); await loadMachines(); }
  };

  const handleToggleAguardaPecas = async (machineId, newValue) => {
    try {
      setMachines(prevMachines => prevMachines.map(m => m.id === machineId ? { ...m, aguardaPecas: newValue } : m));
      await FrotaACP.update(machineId, { aguardaPecas: newValue });
      // Sync Portal da Frota — "Aguarda material" quando ativo, "Em progresso" quando resolvido
      const machine = machines.find(m => m.id === machineId);
      if (machine?.serie) {
        const portalStatus = newValue ? "Aguarda material" : watcherEstadoToPortalStatus(machine.estado) || "Em progresso";
        syncMachineToPortal(machine.serie, null, portalStatus);
      }
    } catch (error) { console.error("Erro ao atualizar status de aguarda peças:", error); alert("Erro ao atualizar status. Tente novamente."); await loadMachines(); }
  };

  const handleArchivePatrickMachines = async () => {
    const patrickMachines = machines.filter(m => m.estado?.includes('patrick') && !m.arquivada);
    if (patrickMachines.length === 0) { alert('Não há máquinas do Patrick para arquivar.'); return; }
    if (!window.confirm(`Arquivar ${patrickMachines.length} máquina(s) do Patrick? Esta ação irá removê-las do painel principal.`)) return;
    try {
      await Promise.all(patrickMachines.map(m => FrotaACP.update(m.id, { arquivada: true })));
      await loadMachines();
      alert(`${patrickMachines.length} máquina(s) arquivada(s) com sucesso.`);
    } catch (error) { console.error('Erro ao arquivar máquinas:', error); alert('Erro ao arquivar máquinas. Tente novamente.'); }
  };


  const handleSelectMachine = (machine) => {
    if (!userPermissions?.canDeleteMachine) return;
    setSelectedMachines(prev => {
      const isAlreadySelected = prev.some(m => m.id === machine.id);
      return isAlreadySelected ? prev.filter(m => m.id !== machine.id) : [...prev, machine];
    });
  };

  const handleOpenMultiEdit = () => { if (selectedMachines.length > 0) setShowMultiEditModal(true); };
  const handleCloseMultiEdit = () => { setShowMultiEditModal(false); setSelectedMachines([]); };

  const handleMachineUpdate = async (machineId, updateData) => {
    try {
      setMachines(prev => prev.map(m => m.id === machineId ? { ...m, ...updateData } : m));
      await FrotaACP.update(machineId, updateData);
      if (updateData.estado && selectedMachine?.serie) {
        syncMachineToPortal(selectedMachine.serie, updateData.estado);
      }
    } catch (error) { console.error("Erro ao atualizar máquina:", error); await loadMachines(); }
  };

  const handleTimerPersist = useCallback((updatedMachine) => {
    if (!updatedMachine?.id) return;
    setMachines(prev => prev.map(m => m.id === updatedMachine.id ? { ...m, ...updatedMachine } : m));
    setSelectedMachine(prev => prev?.id === updatedMachine.id ? { ...prev, ...updatedMachine } : prev);
    loadMachines();
  }, [loadMachines]);

  const handleBulkCreate = async (machinesData) => {
    try {
      await Promise.all(machinesData.map(m => FrotaACP.create({ ...m, estado: 'a-fazer' })));
      await loadMachines();
      setShowBulkCreateModal(false);
    } catch (error) { console.error("Erro ao criar máquinas em massa:", error); }
  };

  const handleEditSave = async (machineId, updateData) => {
    try {
      await FrotaACP.update(machineId, updateData);

      // Disparar Efeito Dominó se a edição marcou como urgente
      if (updateData.prioridade === true) {
        try {
          const merged = { ...machineToEdit, ...updateData };
          const result = await triggerDominoIfUrgent(merged);
          if (result.rescheduled.length > 0) {
            console.log(`[Efeito Dominó] ${result.rescheduled.length} OS reagendadas via edição`);
          }
        } catch (e) { console.warn("[Efeito Dominó] Erro:", e.message); }
      }

      await loadMachines();
      setShowEditModal(false);
      setMachineToEdit(null);
    } catch (error) { console.error("Erro ao salvar edição:", error); }
  };


  // ── TIMER HANDLERS ──
  const normalizeTimerTimestampMs = (value) => {
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
  };

  const getTimerAccumulatedMs = (machine) => {
    if (!machine) return 0;

    const actual = Number(machine.actualTimeSpent);
    const legacyAccumulated = Number(machine.timer_acumulado);
    const legacyDuration = Number(machine.timer_duracao_minutos);

    const candidates = [];
    if (Number.isFinite(actual) && actual >= 0) candidates.push(actual);
    if (Number.isFinite(legacyAccumulated) && legacyAccumulated > 0) candidates.push(legacyAccumulated * 60 * 1000);
    if (Number.isFinite(legacyDuration) && legacyDuration > 0) candidates.push(legacyDuration * 60 * 1000);

    return candidates.length ? Math.max(...candidates) : 0;
  };

  const getTimerStartMs = (machine) => (
    normalizeTimerTimestampMs(machine?.actualStartTime) ?? normalizeTimerTimestampMs(machine?.timer_inicio)
  );

  const getCanonicalMachine = async (machineId) => {
    const data = await FrotaACP.list('-created_date');
    const canonical = data.find(m => m.id === machineId);
    if (canonical) return canonical;

    return machines.find(m => m.id === machineId) || null;
  };

  const isTimerAdmin = Boolean(userPermissions?.canMoveAnyMachine || currentUser?.perfil === 'admin');

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

  const mergeTimerMachine = (machineId, updateData) => {
    setMachines(prevMachines => prevMachines.map(m => (m.id === machineId ? { ...m, ...updateData } : m)));
    setSelectedMachine(prev => (prev?.id === machineId ? { ...prev, ...updateData } : prev));
  };

  const persistTimerToDatabase = async (machineId, data) => {
    mergeTimerMachine(machineId, data);
    await FrotaACP.update(machineId, data);
    await loadMachines();
  };

  const handleTimerStart = async (machineId) => {
    try {
      const machine = await getCanonicalMachine(machineId);
      if (!machine) { console.warn('Máquina não encontrada:', machineId); return; }
      if (!ensureTimerPermission(machine)) return;

      const now = new Date().toISOString();
      const accumulatedMs = getTimerAccumulatedMs(machine);
      const updateData = {
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

      if (updateData.estado) {
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
      const updateData = {
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
      syncMachineToPortal(machine.serie, updateData.estado);

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
      clearTimerLocal(machineId);
      await persistTimerToDatabase(machineId, updateData);
    } catch (e) {
      console.error('Erro ao resetar timer:', e);
      await loadMachines();
    }
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;
    const { draggableId, destination } = result;
    let machineId = draggableId;
    let targetState = destination.droppableId;
    if (draggableId.startsWith('concluida-')) machineId = draggableId.replace('concluida-', '');
    const machineBeingMoved = machines.find(m => m.id === machineId);
    if (!machineBeingMoved) return;

    let updateData = {};
    let newTechnician = null;
    let newEstado = targetState;
    let newConclusaoDate = null;
    let newAtribuicaoDate = null;

    if (targetState === 'a-fazer') { newTechnician = null; newEstado = 'a-fazer'; newConclusaoDate = null; }
    else if (targetState === 'concluida-geral') { newTechnician = null; newEstado = `concluida-geral`; newConclusaoDate = new Date().toISOString(); }
    else if (targetState.startsWith('em-preparacao-')) {
      newTechnician = targetState.replace('em-preparacao-', '');
      newEstado = `em-preparacao-${newTechnician}`;
      newConclusaoDate = null;
      if (!machineBeingMoved.dataAtribuicao) newAtribuicaoDate = new Date().toISOString();
    } else if (targetState.startsWith('concluida-')) {
      newTechnician = targetState.replace('concluida-', '');
      newEstado = `concluida-${newTechnician}`;
      newConclusaoDate = new Date().toISOString();
    } else return;

    if (userPermissions?.canMoveAnyMachine) {
      try {
        updateData = { estado: newEstado, tecnico: newTechnician, dataConclusao: newConclusaoDate };
        if (newAtribuicaoDate) updateData.dataAtribuicao = newAtribuicaoDate;
        await FrotaACP.update(machineId, updateData);
        await loadMachines();
      } catch (error) { console.error("Erro ao mover máquina:", error); alert("Erro ao mover máquina. Tente novamente."); }
      return;
    }

    if (targetState === 'a-fazer') {
      if (!(machineBeingMoved.tecnico === currentUser?.nome_tecnico && machineBeingMoved.estado?.startsWith('em-preparacao-'))) { alert("Você não tem permissão para mover esta máquina para 'A Fazer'."); return; }
    } else if (targetState.startsWith('em-preparacao-')) {
      const destTechId = targetState.replace('em-preparacao-', '');
      if (!userPermissions.canMoveMachineTo(destTechId, targetState)) { alert("Você não tem permissão para mover esta máquina."); return; }
    } else if (targetState.startsWith('concluida-')) {
      const destTechId = targetState.replace('concluida-', '');
      if (!userPermissions.canMoveMachineTo(destTechId, targetState)) { alert("Você não tem permissão para mover esta máquina."); return; }
    } else if (targetState === 'concluida-geral') { alert("Você não tem permissão para mover máquinas para a área geral de concluídas."); return; }

    try {
      updateData = { estado: newEstado, tecnico: newTechnician, dataConclusao: newConclusaoDate };
      if (newAtribuicaoDate) updateData.dataAtribuicao = newAtribuicaoDate;
      await FrotaACP.update(machineId, updateData);
      await loadMachines();
    } catch (error) { console.error("Erro ao mover máquina:", error); alert("Erro ao mover máquina. Tente novamente."); }
  };

  const filteredMachines = useMemo(() => {
    if (!searchQuery) return [];
    return machines.filter(m =>
      !m.arquivada &&
      (m.modelo?.toLowerCase().includes(searchQuery.toLowerCase()) ||
       m.serie?.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [machines, searchQuery]);

  const aFazerMachines = useMemo(() => {
    const filtered = machines.filter(m => !m.arquivada && m.estado === 'a-fazer');
    return filtered.sort((a, b) => {
      if (a.prioridade && !b.prioridade) return -1;
      if (!a.prioridade && b.prioridade) return 1;
      return 0;
    });
  }, [machines]);

  const allConcluidaMachines = useMemo(() => {
    const concluidas = machines.filter(m => !m.arquivada && m.estado?.includes('concluida'));
    return concluidas.sort((a, b) => {
      const dateA = a.dataConclusao ? new Date(a.dataConclusao).getTime() : (a.updated_date ? new Date(a.updated_date).getTime() : 0);
      const dateB = b.dataConclusao ? new Date(b.dataConclusao).getTime() : (b.updated_date ? new Date(b.updated_date).getTime() : 0);
      return dateB - dateA;
    });
  }, [machines]);

  const patrickMachinesCount = useMemo(() => machines.filter(m => m.estado?.includes('patrick') && !m.arquivada).length, [machines]);
  const patrickConcluidaMachines = useMemo(() => machines.filter(m => m.estado?.startsWith('concluida-patrick')), [machines]);

  // ── Derived per-user ──────────────────────────────────────────────────────
  const myTechId   = currentUser?.nome_tecnico || null;
  const myTech     = TECHNICIANS.find(t => t.id === myTechId);
  const otherTechs = TECHNICIANS.filter(t => t.id !== myTechId);
  const isAdmin    = currentUser?.perfil === 'admin';

  // Máquinas por técnico - Filtragem resiliente (usa estado OU campo técnico)
  const myMachines = useMemo(() => machines.filter(m => 
    !m.arquivada && 
    (m.estado === `em-preparacao-${myTechId}` || (m.estado?.startsWith('em-preparacao') && m.tecnico === myTechId))
  ), [machines, myTechId]);

  const myConc = useMemo(() => machines.filter(m => 
    !m.arquivada && 
    (m.estado === `concluida-${myTechId}` || (m.estado === 'concluida' && m.tecnico === myTechId))
  ), [machines, myTechId]);

  // ── Helpers de UI ─────────────────────────────────────────────────────────
  const D = {
    panel:  isDarkMode ? '#08080F' : '#F2F3F8',
    panel2: isDarkMode ? '#0D0D1C' : '#EAECF4',
    border: isDarkMode ? '#16162A' : '#C8CADC',
    borderHi: isDarkMode ? 'rgba(255,45,120,0.45)' : 'rgba(255,45,120,0.3)',
    text:   isDarkMode ? '#E4E6FF' : '#0B0C18',
    muted:  isDarkMode ? '#4A4A80' : '#666888',
    pink:   '#FF2D78',
    blue:   '#4D9FFF',
    purple: '#9B5CF6',
    green:  '#22C55E',
    amber:  '#F59E0B',
    navBg:  isDarkMode ? 'rgba(6,6,13,0.98)' : 'rgba(232,234,245,0.97)',
  };

  const panel = (accent, glow = false) => ({
    background: isDarkMode
      ? `linear-gradient(160deg, #09091500 0%, #0D0D1E 100%)`
      : D.panel,
    border: `1px solid ${isDarkMode ? accent + '28' : D.border}`,
    borderTop: `2px solid ${accent}`,
    borderRadius: '8px',
    overflow: 'hidden',
    position: 'relative',
    boxShadow: isDarkMode
      ? `0 0 ${glow ? '40px' : '18px'} ${accent}${glow ? '28' : '12'}, 0 4px 32px rgba(0,0,0,0.7), inset 0 0 0 1px rgba(255,255,255,0.02)`
      : `0 2px 16px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)`,
  });

  const hdr = (accent) => ({
    padding: '10px 14px',
    borderBottom: `1px solid ${isDarkMode ? accent + '20' : D.border}`,
    background: isDarkMode
      ? `linear-gradient(90deg, ${accent}14 0%, transparent 80%)`
      : `linear-gradient(90deg, ${accent}08 0%, transparent 80%)`,
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    position: 'relative',
  });

  const badge = (color, val) => (
    <span style={{ fontSize: '10px', fontWeight: 700, fontFamily: 'monospace', padding: '1px 8px', borderRadius: '20px', background: `${color}18`, color, border: `1px solid ${color}35` }}>{val}</span>
  );

  const scroll = (maxH) => ({ padding: '6px 8px', overflowY: 'auto', maxHeight: maxH, minHeight: '40px' });

  return (
    <div style={{ minHeight: '100vh', padding: '0 0 60px', overflowX: 'hidden', maxWidth: '100vw', boxSizing: 'border-box' }}>
      <style>{`
        ::-webkit-scrollbar { width: 3px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,45,120,0.5); border-radius: 2px; }
        .mini-scroll::-webkit-scrollbar { width: 2px; }
        .mini-scroll::-webkit-scrollbar-thumb { background: rgba(74,74,130,0.5); }
        @media (max-width: 600px) {
          .kanban-grid { grid-template-columns: 1fr !important; }
          .kanban-row { flex-direction: column !important; }
        }
      `}</style>

      {/* ══ HERO — fixo no topo, centralizado ════════════════════════ */}
      <div ref={heroRef} style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 90,
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '18px 16px 14px',
        background: isDarkMode
          ? 'linear-gradient(180deg, rgba(6,6,13,0.99) 0%, rgba(8,8,15,0.96) 100%)'
          : 'linear-gradient(180deg, rgba(228,230,240,0.99) 0%, rgba(232,234,245,0.96) 100%)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        borderBottom: `1px solid ${isDarkMode ? 'rgba(255,45,120,0.2)' : 'rgba(255,45,120,0.15)'}`,
      }}>
        {/* Top accent linha */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: `linear-gradient(90deg, transparent 0%, ${D.pink} 25%, ${D.blue} 75%, transparent 100%)`, opacity: isDarkMode ? 1 : 0.6 }} />

        {/* Logo */}
        <div style={{ position: 'relative' }}>
          <img
            src="https://media.base44.com/images/public/69c166ad19149fb0c07883cb/a35751fd9_Gemini_Generated_Image_scmohbscmohbscmo1.png"
            alt="WATCHER"
            style={{ width: '80px', height: '80px', objectFit: 'contain',
              filter: isDarkMode
                ? 'drop-shadow(0 0 18px rgba(255,45,120,0.8)) drop-shadow(0 0 32px rgba(77,159,255,0.3))'
                : 'drop-shadow(0 0 8px rgba(255,45,120,0.5))' }}
          />
          {isDarkMode && (
            <div style={{ position: 'absolute', inset: '-6px', borderRadius: '50%', border: '1px solid rgba(255,45,120,0.25)', animation: 'cyber-pulse 2s ease-in-out infinite', pointerEvents: 'none' }} />
          )}
        </div>

        {/* Título */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px' }}>
          <span style={{ fontFamily: "'Orbitron', monospace", fontSize: '20px', fontWeight: 900, color: D.pink, textShadow: isDarkMode ? `0 0 16px rgba(255,45,120,0.9), 0 0 32px rgba(255,45,120,0.4)` : 'none' }}>[</span>
          <span style={{ fontFamily: "'Orbitron', monospace", fontSize: '20px', fontWeight: 900, letterSpacing: '0.2em', color: D.text, textShadow: isDarkMode ? `0 0 20px rgba(228,230,255,0.15)` : 'none' }}>WATCHER</span>
          <span style={{ fontFamily: "'Orbitron', monospace", fontSize: '20px', fontWeight: 900, color: D.pink, textShadow: isDarkMode ? `0 0 16px rgba(255,45,120,0.9), 0 0 32px rgba(255,45,120,0.4)` : 'none' }}>]</span>
        </div>

        {/* Linha divisória decorativa */}
        <div style={{ marginTop: '10px', width: '200px', height: '1px', background: `linear-gradient(90deg, transparent, ${D.pink} 30%, ${D.blue} 70%, transparent)`, opacity: isDarkMode ? 0.7 : 0.4 }} />
      </div>

      {/* Spacer para compensar o hero fixed — altura calculada pelo ref */}
      <div id="hero-spacer" style={{ height: 'var(--hero-height, 165px)', flexShrink: 0 }} />

      {/* ══ TOOLBAR ADMIN — separada do logo, rola com a página ════════ */}
      {(userPermissions?.canCreateMachine || userPermissions?.canDeleteMachine) && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap',
          justifyContent: 'center', padding: '10px 16px',
          borderBottom: `1px solid ${D.border}`,
          background: isDarkMode ? 'rgba(8,8,14,0.8)' : 'rgba(230,232,242,0.8)',
          backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        }}>
          {userPermissions?.canDeleteMachine && (
            <button
              onPointerDown={(e) => { e.stopPropagation(); setShowBackupManager(true); }}
              style={{ padding: '6px 14px', background: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)', color: D.muted, border: `1px solid ${D.border}`, borderRadius: '5px', fontFamily: 'monospace', fontSize: '10px', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.08em', position: 'relative', zIndex: 50 }}>
              ◈ BACKUP
            </button>
          )}

          {userPermissions?.canCreateMachine && (<>
            <button
              onPointerDown={(e) => { e.stopPropagation(); setShowBulkCreateModal(true); }}
              style={{ padding: '6px 14px', background: isDarkMode ? 'rgba(77,159,255,0.08)' : 'rgba(77,159,255,0.1)', color: D.blue, border: `1px solid rgba(77,159,255,0.35)`, borderRadius: '5px', fontFamily: 'monospace', fontSize: '10px', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.08em', position: 'relative', zIndex: 50 }}>
              ▦ MASSIVA
            </button>
            <button
              onPointerDown={(e) => { e.stopPropagation(); setShowImageModal(true); }}
              style={{ padding: '6px 14px', background: isDarkMode ? 'rgba(155,92,246,0.08)' : 'rgba(155,92,246,0.1)', color: D.purple, border: `1px solid rgba(155,92,246,0.35)`, borderRadius: '5px', fontFamily: 'monospace', fontSize: '10px', fontWeight: 700, cursor: 'pointer', letterSpacing: '0.08em', position: 'relative', zIndex: 50 }}>
              ◎ IA FOTO
            </button>
            <button
              onPointerDown={(e) => { e.stopPropagation(); setPrefillData(null); setShowCreateModal(true); }}
              style={{
                padding: '6px 18px',
                background: `linear-gradient(135deg, ${D.pink} 0%, #9B1FE8 100%)`,
                color: '#fff', border: `1px solid rgba(255,45,120,0.6)`,
                borderRadius: '5px', fontFamily: 'monospace', fontSize: '10px', fontWeight: 700,
                cursor: 'pointer', letterSpacing: '0.1em',
                boxShadow: isDarkMode ? `0 0 18px rgba(255,45,120,0.5), 0 0 6px rgba(255,45,120,0.3)` : `0 2px 8px rgba(255,45,120,0.3)`,
                position: 'relative', zIndex: 50,
              }}>
              ＋ NOVA
            </button>
          </>)}
        </div>
      )}

            {/* ══ TOOLBAR SECUNDÁRIA — notificações e multi-select ═══════════ */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', marginBottom: '6px', position: 'relative', zIndex: 10, padding: '8px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <PedidosPanel userPermissions={userPermissions} isCompact={true} />
          {userPermissions?.canDeleteMachine && <OSNotificationsPanel userPermissions={userPermissions} />}
          <UnifiedNotifications currentUser={currentUser} userPermissions={userPermissions} />
          {selectedMachines.length > 0 && userPermissions?.canDeleteMachine && (
            <button onClick={handleOpenMultiEdit} style={{ padding: '6px 12px', background: D.blue, color: '#fff', border: 'none', borderRadius: '6px', fontFamily: 'monospace', fontSize: '10px', fontWeight: 700, cursor: 'pointer' }}>EDITAR {selectedMachines.length}</button>
          )}
        </div>
      </div>

      {/* Search */}
      <div style={{ padding: '10px 16px 4px', maxWidth: '480px' }}>
        <div style={{ position: 'relative' }}>
          <Search style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', width: '12px', height: '12px', color: D.muted, pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="BUSCAR SÉRIE / MODELO..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%', padding: '9px 12px 9px 32px',
              background: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)',
              border: `1px solid ${searchQuery ? 'rgba(255,45,120,0.6)' : D.border}`,
              borderRadius: '6px',
              fontFamily: 'monospace', fontSize: '11px', color: D.text,
              outline: 'none', boxSizing: 'border-box',
              letterSpacing: '0.06em',
              transition: 'border-color 0.15s',
              boxShadow: searchQuery && isDarkMode ? '0 0 12px rgba(255,45,120,0.2)' : 'none',
            }}
          />
          {searchQuery && (
            <button onPointerDown={() => setSearchQuery('')} style={{ position: 'absolute', right: '8px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: D.muted, fontSize: '14px', padding: '2px', lineHeight: 1 }}>×</button>
          )}
        </div>
      </div>

      {/* ══ SEARCH ══════════════════════════════════════════════════════════ */}
      {searchQuery ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {filteredMachines.map(m => <MachineCardCompact key={m.id} machine={m} onClick={(m) => { setSelectedMachine(m); setShowObsModal(true); }} isDark={isDarkMode} />)}
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>

          {/* ══════════════════════════════════════════════════════════════
               VISÃO TÉCNICO
          ══════════════════════════════════════════════════════════════ */}
          {!isAdmin && myTech && (<>

            {/* ROW 1 — MEU QUADRO + A FAZER dominam, lado a lado */}
            <div className="kanban-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px', padding: '0 16px' }}>

              {/* MEU QUADRO */}
              <div style={{ ...panel(myTech.borderColor, true) }}>
                <div style={{ ...hdr(myTech.borderColor) }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: myTech.borderColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 0 12px ${myTech.borderColor}80` }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 900, color: '#fff' }}>{myTech.name.charAt(0)}</span>
                    </div>
                    <div>
                      <div style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', color: D.text }}>{myTech.name}</div>
                      <div style={{ fontFamily: 'monospace', fontSize: '8px', color: myTech.borderColor, letterSpacing: '0.08em' }}>MEU QUADRO</div>
                    </div>
                    {badge(myTech.borderColor, myMachines.length)}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: D.green, boxShadow: `0 0 6px ${D.green}` }} />
                    <span style={{ fontSize: '8px', fontFamily: 'monospace', color: D.green }}>ONLINE</span>
                  </div>
                </div>
                <Droppable droppableId={`em-preparacao-${myTechId}`}>
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} style={{ ...scroll('55vh') }}>
                      {myMachines.map((machine, index) => (
                        <Draggable key={machine.id} draggableId={machine.id} index={index}>
                          {(provided) => (
                            <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} style={{ ...provided.draggableProps.style }}>
                              <MachineCardTechnician machine={machine} onClick={(m) => { setSelectedMachine(m); setShowObsModal(true); }} techColor={myTech.borderColor} isDark={isDarkMode} isSelected={selectedMachines.some(sm => sm.id === machine.id)} onSelect={handleSelectMachine} onTimerStart={handleTimerStart} onTimerPause={handleTimerPause} onTimerResume={handleTimerResume} />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      {myMachines.length === 0 && <div style={{ padding: '40px', textAlign: 'center', color: D.muted, fontFamily: 'monospace', fontSize: '11px', opacity: 0.5 }}><div style={{ fontSize: '28px', marginBottom: '8px' }}>⚙</div>SEM MÁQUINAS</div>}
                    </div>
                  )}
                </Droppable>
                <Droppable droppableId={`concluida-${myTechId}`}>
                  {(provided) => <div ref={provided.innerRef} {...provided.droppableProps} style={{ display: 'none' }}>{provided.placeholder}</div>}
                </Droppable>
                <TechnicianCompletedSection machines={myConc} techId={myTechId} onOpenMachine={(m) => { setSelectedMachine(m); setShowObsModal(true); }} isDark={isDarkMode} />
              </div>

              {/* A FAZER */}
              <div style={{ ...panel(D.pink) }}>
                <div style={{ ...hdr(D.pink) }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Wrench style={{ width: '13px', height: '13px', color: D.pink }} />
                    <span style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', color: D.text }}>A FAZER</span>
                    {badge(D.pink, aFazerMachines.length)}
                  </div>
                  <button onClick={() => setShowAFazerFullscreen(true)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><Maximize2 style={{ width: '13px', height: '13px', color: D.muted }} /></button>
                </div>
                <Droppable droppableId="a-fazer">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} style={{ ...scroll('55vh') }}>
                      {aFazerMachines.map((machine, index) => (
                        <Draggable key={machine.id} draggableId={machine.id} index={index}>
                          {(provided) => (
                            <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} style={{ ...provided.draggableProps.style }}>
                              <MachineCardCompact machine={machine} onClick={(m) => { setSelectedMachine(m); setShowObsModal(true); }} isDark={isDarkMode} onAssign={handleAssignMachine} showAssignButton={userPermissions?.canMoveAnyMachine || userPermissions?.canMoveMachineToOwnColumn} isSelected={selectedMachines.some(sm => sm.id === machine.id)} onSelect={handleSelectMachine} />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      {aFazerMachines.length === 0 && <div style={{ padding: '32px', textAlign: 'center', color: D.muted, fontFamily: 'monospace', fontSize: '11px', opacity: 0.5 }}>FILA VAZIA</div>}
                    </div>
                  )}
                </Droppable>
              </div>
            </div>

            {/* ROW 2 — CONCLUÍDA */}
            <div style={{ ...panel(D.green), marginBottom: '10px', marginLeft: '16px', marginRight: '16px' }}>
              <div style={{ ...hdr(D.green) }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle2 style={{ width: '13px', height: '13px', color: D.green }} />
                  <span style={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: D.text }}>CONCLUÍDA</span>
                  {badge(D.green, allConcluidaMachines.length)}
                </div>
                <button onClick={() => setShowConcluidaFullscreen(true)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><Maximize2 style={{ width: '13px', height: '13px', color: D.muted }} /></button>
              </div>
              <Droppable droppableId="concluida-geral">
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.droppableProps}
                    style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '6px', padding: '8px', maxHeight: '220px', overflowY: 'auto' }}>
                    {allConcluidaMachines.map((machine, index) => {
                      const tc = TECHNICIANS.find(t => t.id === machine.tecnico);
                      return (
                        <Draggable key={machine.id} draggableId={`concluida-${machine.id}`} index={index} isDragDisabled={!userPermissions?.canMoveAnyMachine}>
                          {(provided) => (
                            <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} style={{ ...provided.draggableProps.style }}>
                              <button onClick={() => { setSelectedMachine(machine); setShowObsModal(true); }}
                                style={{ width: '100%', textAlign: 'left', cursor: 'pointer', background: isDarkMode ? '#0B0B16' : '#F8F8FF', border: `1px solid ${D.border}`, borderLeft: `4px solid ${tc?.borderColor || D.green}`, borderRadius: '8px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.4)' : '0 1px 4px rgba(0,0,0,0.06)' }}>
                                {tc && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: tc.borderColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: '11px', fontFamily: 'monospace' }}>
                                      {tc.name.charAt(0)}
                                    </div>
                                    <span style={{ fontSize: '11px', color: tc.borderColor, fontFamily: 'monospace', fontWeight: 700, textTransform: 'uppercase', flex: 1 }}>{tc.name}</span>
                                    <CheckCircle2 style={{ width: '14px', height: '14px', color: D.green, flexShrink: 0 }} />
                                  </div>
                                )}
                                <div>
                                  <div style={{ fontFamily: 'monospace', fontSize: '9px', color: D.muted, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>{machine.modelo}</div>
                                  <div style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 900, color: D.text, letterSpacing: '0.06em' }}>{machine.serie}</div>
                                </div>
                                {machine.dataConclusao && (
                                  <div style={{ fontSize: '8px', color: D.muted, fontFamily: 'monospace', marginTop: '2px' }}>
                                    {new Date(machine.dataConclusao).toLocaleDateString('pt-PT')}
                                  </div>
                                )}
                              </button>
                            </div>
                          )}
                        </Draggable>
                      );
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>

            {/* ROW 3 — OUTROS TÉCNICOS (fill restante da largura) */}
            <div className="kanban-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px', padding: '0 16px' }}>
              {otherTechs.map(tech => {
                const emPrep = machines.filter(m => !m.arquivada && (m.estado === `em-preparacao-${tech.id}` || (m.estado?.startsWith('em-preparacao') && m.tecnico === tech.id)));
                const concl  = machines.filter(m => !m.arquivada && (m.estado === `concluida-${tech.id}` || (m.estado === 'concluida' && m.tecnico === tech.id)));
                return (
                  <div key={tech.id} style={{ background: isDarkMode ? '#0C0C18' : '#FAFAFA', border: `1px solid ${D.border}`, borderTop: `2px solid ${tech.borderColor}`, borderRadius: '8px', overflow: 'hidden' }}>
                    <div style={{ padding: '7px 10px', display: 'flex', alignItems: 'center', gap: '7px', borderBottom: `1px solid ${D.border}`, background: isDarkMode ? `${tech.borderColor}06` : `${tech.borderColor}03` }}>
                      <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: tech.borderColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 0 7px ${tech.borderColor}50` }}>
                        <span style={{ fontFamily: 'monospace', fontSize: '10px', fontWeight: 900, color: '#fff' }}>{tech.name.charAt(0)}</span>
                      </div>
                      <span style={{ fontFamily: 'monospace', fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', color: D.text, flex: 1 }}>{tech.name}</span>
                      {badge(tech.borderColor, emPrep.length)}
                      {concl.length > 0 && <span style={{ fontSize: '9px', color: D.muted, fontFamily: 'monospace' }}>✓{concl.length}</span>}
                    </div>
                    <Droppable droppableId={`em-preparacao-${tech.id}`}>
                      {(provided) => (
                        <div ref={provided.innerRef} {...provided.droppableProps} className="mini-scroll"
                          style={{ padding: '5px', maxHeight: '150px', overflowY: 'auto', minHeight: '32px' }}>
                          {emPrep.map((machine, index) => (
                            <Draggable key={machine.id} draggableId={machine.id} index={index}>
                              {(provided) => (
                                <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} style={{ ...provided.draggableProps.style }}>
                                  <MachineCardTechnician machine={machine} onClick={(m) => { setSelectedMachine(m); setShowObsModal(true); }} techColor={tech.borderColor} isDark={isDarkMode} isSelected={selectedMachines.some(sm => sm.id === machine.id)} onSelect={handleSelectMachine} onTimerStart={handleTimerStart} onTimerPause={handleTimerPause} onTimerResume={handleTimerResume} />
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                          {emPrep.length === 0 && <div style={{ padding: '8px', textAlign: 'center', color: D.muted, fontFamily: 'monospace', fontSize: '9px', opacity: 0.5 }}>em espera</div>}
                        </div>
                      )}
                    </Droppable>
                    <Droppable droppableId={`concluida-${tech.id}`}>
                      {(provided) => <div ref={provided.innerRef} {...provided.droppableProps} style={{ display: 'none' }}>{provided.placeholder}</div>}
                    </Droppable>
                    <TechnicianCompletedSection machines={concl} techId={tech.id} onOpenMachine={(m) => { setSelectedMachine(m); setShowObsModal(true); }} isDark={isDarkMode} />
                  </div>
                );
              })}
            </div>
          </>)}

          {/* ══════════════════════════════════════════════════════════════
               VISÃO ADMIN
          ══════════════════════════════════════════════════════════════ */}
          {isAdmin && (<>

            {/* ROW 1 — A FAZER + CONCLUÍDA em destaque */}
            <div className="kanban-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px', padding: '0 16px' }}>

              <div style={{ ...panel(D.pink, true) }}>
                <div style={{ ...hdr(D.pink) }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Wrench style={{ width: '13px', height: '13px', color: D.pink }} />
                    <span style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', color: D.text }}>A FAZER</span>
                    {badge(D.pink, aFazerMachines.length)}
                  </div>
                  <button onClick={() => setShowAFazerFullscreen(true)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><Maximize2 style={{ width: '13px', height: '13px', color: D.muted }} /></button>
                </div>
                <Droppable droppableId="a-fazer">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} style={{ ...scroll('42vh') }}>
                      {aFazerMachines.map((machine, index) => (
                        <Draggable key={machine.id} draggableId={machine.id} index={index}>
                          {(provided) => (
                            <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} style={{ ...provided.draggableProps.style }}>
                              <MachineCardCompact machine={machine} onClick={(m) => { setSelectedMachine(m); setShowObsModal(true); }} isDark={isDarkMode} onAssign={handleAssignMachine} showAssignButton={true} isSelected={selectedMachines.some(sm => sm.id === machine.id)} onSelect={handleSelectMachine} />
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>

              <div style={{ ...panel(D.green) }}>
                <div style={{ ...hdr(D.green) }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle2 style={{ width: '13px', height: '13px', color: D.green }} />
                    <span style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 700, letterSpacing: '0.1em', color: D.text }}>CONCLUÍDA</span>
                    {badge(D.green, allConcluidaMachines.length)}
                  </div>
                  <button onClick={() => setShowConcluidaFullscreen(true)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><Maximize2 style={{ width: '13px', height: '13px', color: D.muted }} /></button>
                </div>
                <Droppable droppableId="concluida-geral">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} style={{ ...scroll('42vh') }}>
                      {allConcluidaMachines.map((machine, index) => {
                        const tc = TECHNICIANS.find(t => t.id === machine.tecnico);
                        return (
                        <Draggable key={machine.id} draggableId={`concluida-${machine.id}`} index={index} isDragDisabled={!userPermissions?.canMoveAnyMachine}>
                          {(provided) => (
                            <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} style={{ ...provided.draggableProps.style }}>
                              <button onClick={() => { setSelectedMachine(machine); setShowObsModal(true); }} style={{ width: '100%', textAlign: 'left', cursor: 'pointer', background: isDarkMode ? '#0B0B16' : '#F8F8FF', border: `1px solid ${D.border}`, borderLeft: `4px solid ${tc?.borderColor || D.green}`, borderRadius: '8px', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '8px', boxShadow: isDarkMode ? '0 2px 8px rgba(0,0,0,0.4)' : '0 1px 4px rgba(0,0,0,0.06)' }}>
                                {tc && (<div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}><div style={{ width: '24px', height: '24px', borderRadius: '50%', background: tc.borderColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 900, fontSize: '11px', fontFamily: 'monospace' }}>{tc.name.charAt(0)}</div><span style={{ fontSize: '11px', color: tc.borderColor, fontFamily: 'monospace', fontWeight: 700, textTransform: 'uppercase', flex: 1 }}>{tc.name}</span><CheckCircle2 style={{ width: '14px', height: '14px', color: D.green, flexShrink: 0 }} /></div>)}
                                <div><div style={{ fontFamily: 'monospace', fontSize: '9px', color: D.muted, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '2px' }}>{machine.modelo}</div><div style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 900, color: D.text, letterSpacing: '0.06em' }}>{machine.serie}</div></div>
                                {machine.dataConclusao && (<div style={{ fontSize: '8px', color: D.muted, fontFamily: 'monospace', marginTop: '2px' }}>{new Date(machine.dataConclusao).toLocaleDateString('pt-PT')}</div>)}
                              </button>
                            </div>
                          )}
                        </Draggable>
                        );
                      })}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            </div>

            {/* ROW 2 — 4 Técnicos em 2x2 */}
            <div className="kanban-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', padding: '0 16px' }}>
              {TECHNICIANS.map(tech => {
                const emPrep = machines.filter(m => !m.arquivada && m.estado === `em-preparacao-${tech.id}`);
                const concl  = machines.filter(m => !m.arquivada && m.estado === `concluida-${tech.id}`);
                return (
                  <div key={tech.id} style={{ ...panel(tech.borderColor) }}>
                    <div style={{ ...hdr(tech.borderColor) }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: tech.borderColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: `0 0 10px ${tech.borderColor}60` }}>
                          <span style={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: 900, color: '#fff' }}>{tech.name.charAt(0)}</span>
                        </div>
                        <span style={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: D.text }}>{tech.name}</span>
                        {badge(tech.borderColor, emPrep.length)}
                        {concl.length > 0 && <span style={{ fontSize: '9px', color: D.muted, fontFamily: 'monospace', marginLeft: 'auto' }}>✓{concl.length}</span>}
                      </div>
                    </div>
                    <Droppable droppableId={`em-preparacao-${tech.id}`}>
                      {(provided) => (
                        <div ref={provided.innerRef} {...provided.droppableProps} style={{ ...scroll('30vh') }}>
                          {emPrep.map((machine, index) => (
                            <Draggable key={machine.id} draggableId={machine.id} index={index}>
                              {(provided) => (
                                <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} style={{ ...provided.draggableProps.style }}>
                                  <MachineCardTechnician machine={machine} onClick={(m) => { setSelectedMachine(m); setShowObsModal(true); }} techColor={tech.borderColor} isDark={isDarkMode} isSelected={selectedMachines.some(sm => sm.id === machine.id)} onSelect={handleSelectMachine} onTimerStart={handleTimerStart} onTimerPause={handleTimerPause} onTimerResume={handleTimerResume} />
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                          {emPrep.length === 0 && <div style={{ padding: '20px', textAlign: 'center', color: D.muted, fontFamily: 'monospace', fontSize: '10px', opacity: 0.5 }}>em espera</div>}
                        </div>
                      )}
                    </Droppable>
                    <Droppable droppableId={`concluida-${tech.id}`}>
                      {(provided) => <div ref={provided.innerRef} {...provided.droppableProps} style={{ display: 'none' }}>{provided.placeholder}</div>}
                    </Droppable>
                    <TechnicianCompletedSection machines={concl} techId={tech.id} onOpenMachine={(m) => { setSelectedMachine(m); setShowObsModal(true); }} isDark={isDarkMode} />
                  </div>
                );
              })}
            </div>
          </>)}

          {showMultiEditModal && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)', zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
              <div style={{ background: D.panel, border: `1px solid ${D.border}`, borderTop: `2px solid ${D.blue}`, borderRadius: '12px', padding: '20px', width: '100%', maxWidth: '700px', maxHeight: '80vh', overflowY: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <h3 style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '13px', color: D.text, letterSpacing: '0.08em', margin: 0 }}>EDITAR {selectedMachines.length} MÁQUINAS</h3>
                  <button onClick={() => setShowMultiEditModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: D.muted, fontSize: '16px' }}>✕</button>
                </div>
                {selectedMachines.map(machine => (
                  <MachineEditCard key={machine.id} machine={machine} isDark={isDarkMode}
                    onUpdate={async (field, value) => {
                      try {
                        const updateData = { [field]: value };
                        // Se o estado mudar, derivar o técnico para garantir consistência na DB
                        if (field === 'estado') {
                          let tecnico = null;
                          if (value.includes('preparacao-') || value.includes('concluida-')) {
                            const parts = value.split('-');
                            tecnico = parts[parts.length - 1];
                          }
                          updateData.tecnico = tecnico;
                        }
                        await FrotaACP.update(machine.id, updateData);
                        setSelectedMachines(prev => prev.map(m => m.id === machine.id ? { ...m, ...updateData } : m));
                        await loadMachines();
                      } catch (e) { console.error(e); }
                    }}
                    onRemove={() => handleSelectMachine(machine)}
                    onViewDetails={() => { setSelectedMachine(machine); setShowObsModal(true); }}
                  />
                ))}
              </div>
            </div>
          )}

        </DragDropContext>
      )}

      <FullscreenSectionModal isOpen={showAFazerFullscreen} onClose={() => setShowAFazerFullscreen(false)} title="A Fazer" machines={aFazerMachines} icon={Wrench} onOpenMachine={(m) => { setSelectedMachine(m); setShowObsModal(true); }} onAssign={handleAssignMachine} userPermissions={userPermissions} currentUser={currentUser} isDark={isDarkMode} />
      <FullscreenSectionModal isOpen={showConcluidaFullscreen} onClose={() => setShowConcluidaFullscreen(false)} title="Concluída" machines={allConcluidaMachines} icon={CheckCircle2} onOpenMachine={(m) => { setSelectedMachine(m); setShowObsModal(true); }} userPermissions={userPermissions} currentUser={currentUser} isDark={isDarkMode} />
      {showObsModal && selectedMachine && (
        <ObservationsModal
          isOpen={true}
          machine={selectedMachine}
          allMachines={machines}
          onClose={() => { setShowObsModal(false); setSelectedMachine(null); }}
          onTimerStart={handleTimerStart}
          onTimerPause={handleTimerPause}
          onTimerResume={handleTimerResume}
          onTimerStop={handleTimerStop}
          onTimerReset={handleTimerReset}
          onTimerPersist={handleTimerPersist}
          onAddObservation={handleAddObservation}
          onToggleTask={async (taskIdx) => {
            const updated = [...(selectedMachine.tarefas || [])];
            updated[taskIdx] = { ...updated[taskIdx], concluida: !updated[taskIdx].concluida };
            await FrotaACP.update(selectedMachine.id, { tarefas: updated });
            await loadMachines();
          }}
          onTogglePriority={async () => {
            const newValue = !selectedMachine.prioridade;
            await FrotaACP.update(selectedMachine.id, { prioridade: newValue });
            // Disparar cascata se passou a urgente
            if (newValue === true) {
              try {
                const result = await triggerDominoIfUrgent({ ...selectedMachine, prioridade: true });
                if (result.rescheduled.length > 0) {
                  console.log(`[Efeito Dominó] ${result.rescheduled.length} OS reagendadas via modal`);
                }
              } catch (e) { console.warn("[Efeito Dominó] Erro:", e.message); }
            }
            await loadMachines();
          }}
          onToggleAguardaPecas={async () => {
            await FrotaACP.update(selectedMachine.id, { aguardaPecas: !selectedMachine.aguardaPecas });
            await loadMachines();
          }}
          onMarkComplete={async () => {
            await FrotaACP.update(selectedMachine.id, { estado: 'concluida' });
            syncMachineToPortal(selectedMachine.serie, 'concluida');
            setShowObsModal(false);
            setSelectedMachine(null);
            await loadMachines();
          }}
          onDelete={async () => {
            if (window.confirm('Apagar esta máquina?')) {
              await FrotaACP.delete(selectedMachine.id);
              setShowObsModal(false);
              setSelectedMachine(null);
              await loadMachines();
            }
          }}
          currentUser={currentUser}
          userPermissions={userPermissions}
          isDark={isDarkMode}
        />
      )}
      {/* ProfileSelector removido — auth gerida pelo Layout */}
      <AssignModal isOpen={showAssignModal} onClose={() => { setShowAssignModal(false); setMachineToAssign(null); }} machine={machineToAssign} onAssign={handleAssignToTechnician} />
      {showCreateModal && <CreateMachineModal onClose={() => { setShowCreateModal(false); setPrefillData(null); }} onSubmit={handleCreateMachine} prefillData={prefillData} isDark={isDarkMode} />}
      {showImageModal && <ImageUploadModal isOpen={showImageModal} onClose={() => setShowImageModal(false)} onMachineDetected={(data) => { setPrefillData(data); setShowImageModal(false); setShowCreateModal(true); }} isDark={isDarkMode} />}
      {showBulkCreateModal && <BulkCreateModal isOpen={showBulkCreateModal} onClose={() => setShowBulkCreateModal(false)} onSuccess={() => { loadMachines(); setShowBulkCreateModal(false); }} isDark={isDarkMode} />}
      {showEditModal && machineToEdit && <EditMachineModal machine={machineToEdit} onClose={() => { setShowEditModal(false); setMachineToEdit(null); }} onUpdate={handleEditSave} isDark={isDarkMode} />}
      {showBackupManager && <BackupManager isOpen={showBackupManager} onClose={() => setShowBackupManager(false)} isDark={isDarkMode} />}
    </div>
  );
}