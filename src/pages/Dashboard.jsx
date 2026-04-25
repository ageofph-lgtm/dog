import React, { useState, useEffect, useCallback, useMemo } from "react";
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
import TimerButton, { useElapsedTimer, formatDuration, saveTimerLocal, clearTimerLocal } from "../components/dashboard/TimerButton";

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
  const hasHistory = machine.historicoCriacoes && machine.historicoCriacoes.length > 0;
  const hasExpress = machine.tarefas?.some(t => t.texto === 'EXPRESS');
  const otherTasks = machine.tarefas?.filter(t => t.texto !== 'EXPRESS') || [];
  const timerAtivo   = machine?.timer_ativo === true;
  const timerPausado = machine?.timer_pausado === true;

  const surface  = isDark ? '#111827' : '#FFFFFF';
  const border   = isSelected ? '#3B82F6' : isDark ? '#1F2937' : '#E5E7EB';
  const textMain = isDark ? '#F9FAFB' : '#111827';
  const textSub  = isDark ? '#6B7280' : '#6B7280';
  const divider  = isDark ? '#1F2937' : '#F3F4F6';

  const reconBadge = machine.recondicao?.bronze && machine.recondicao?.prata ? '#D4AF37'
    : machine.recondicao?.bronze ? '#CD7F32'
    : machine.recondicao?.prata ? '#9E9E9E' : null;

  return (
    <div
      style={{
        background: isSelected ? (isDark ? '#1E3A5F' : '#EFF6FF') : surface,
        border: `1px solid ${border}`,
        borderLeft: `3px solid ${machine.prioridade ? '#EF4444' : isDark ? '#374151' : '#D1D5DB'}`,
        borderRadius: '6px',
        boxShadow: isSelected ? '0 0 0 2px #3B82F6' : isDark ? '0 1px 3px rgba(0,0,0,0.4)' : '0 1px 2px rgba(0,0,0,0.06)',
        marginBottom: '6px',
        overflow: 'hidden',
      }}
    >
      <div
        style={{ display: 'flex', alignItems: 'stretch', cursor: 'pointer' }}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); if (e.ctrlKey || e.metaKey) { onSelect && onSelect(machine); } else { onClick(machine); } }}
      >
        {/* LEFT: main info */}
        <div style={{ flex: 1, minWidth: 0, padding: '10px 12px' }}>
          {/* Row 1: modelo + badges */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: '2px' }}>
            <span style={{ fontSize: '11px', color: textSub, fontWeight: 500, fontFamily: 'Inter, sans-serif' }}>{machine.modelo}</span>
            {machine.prioridade && (
              <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', background: 'rgba(239,68,68,0.12)', color: '#EF4444', fontFamily: 'monospace', letterSpacing: '0.05em' }}>PRIO</span>
            )}
            {hasExpress && (
              <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', background: 'rgba(245,158,11,0.12)', color: '#F59E0B', fontFamily: 'monospace' }}>EXPRESS</span>
            )}
            {reconBadge && (
              <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', background: `${reconBadge}20`, color: reconBadge, fontFamily: 'monospace' }}>
                {machine.recondicao?.bronze && machine.recondicao?.prata ? 'BRZ+PRT' : machine.recondicao?.bronze ? 'BRZ' : 'PRT'}
              </span>
            )}
            {hasHistory && <Repeat style={{ width: '10px', height: '10px', color: '#3B82F6', flexShrink: 0 }} />}
          </div>
          {/* Row 2: série */}
          <div style={{ fontFamily: 'monospace', fontSize: '13px', fontWeight: 700, color: textMain, letterSpacing: '0.04em', marginBottom: '4px' }}>{machine.serie}</div>
          {/* Row 3: tarefas */}
          {otherTasks.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '4px' }}>
              {otherTasks.map((t, i) => (
                <span key={i} style={{ fontSize: '9px', fontWeight: 600, padding: '1px 5px', borderRadius: '3px', background: isDark ? '#1F2937' : '#F3F4F6', color: textSub, fontFamily: 'monospace' }}>{t.texto}</span>
              ))}
            </div>
          )}
          {/* Row 4: timer */}
          {timerElapsed !== null && (timerAtivo || timerPausado) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: timerPausado ? '#F59E0B' : '#22C55E', display: 'inline-block', animation: timerAtivo && !timerPausado ? 'pulse 1s infinite' : 'none' }} />
              <span style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 700, color: timerPausado ? '#F59E0B' : '#22C55E', letterSpacing: '0.04em' }}>{formatDuration(timerElapsed)}</span>
              {timerPausado && <span style={{ fontSize: '9px', color: textSub }}>pausado</span>}
            </div>
          )}
          {!timerAtivo && !timerPausado && machine.timer_duracao_minutos != null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
              <Clock style={{ width: '10px', height: '10px', color: '#4ADE80' }} />
              <span style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 700, color: '#4ADE80' }}>{formatDuration(machine.timer_duracao_minutos * 60)}</span>
            </div>
          )}
        </div>

        {/* RIGHT: assign button */}
        {showAssignButton && onAssign && (
          <div style={{ display: 'flex', alignItems: 'center', padding: '8px 8px 8px 0' }}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAssign(machine); }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: '#EF4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background 0.15s' }}>
              <ChevronRight style={{ width: '18px', height: '18px', color: 'white' }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const MachineCardTechnician = ({ machine, onClick, techColor, isDark, isSelected, onSelect }) => {
  const hasHistory = machine.historicoCriacoes && machine.historicoCriacoes.length > 0;
  const hasExpress = machine.tarefas?.some(t => t.texto === 'EXPRESS');
  const otherTasks = machine.tarefas?.filter(t => t.texto !== 'EXPRESS') || [];
  const timerAtivo   = machine?.timer_ativo === true;
  const timerPausado = machine?.timer_pausado === true;
  const timerDone    = !timerAtivo && machine?.timer_fim;
  const timerElapsed = useElapsedTimer(machine);

  const surface  = isDark ? '#111827' : '#FFFFFF';
  const border   = isSelected ? '#3B82F6' : isDark ? '#1F2937' : '#E5E7EB';
  const textMain = isDark ? '#F9FAFB' : '#111827';
  const textSub  = isDark ? '#6B7280' : '#6B7280';

  return (
    <button
      onClick={(e) => { if (e.ctrlKey || e.metaKey) { onSelect && onSelect(machine); } else { onClick(machine); } }}
      style={{
        width: '100%',
        textAlign: 'left',
        background: isSelected ? (isDark ? '#1E3A5F' : '#EFF6FF') : surface,
        border: `1px solid ${border}`,
        borderLeft: `3px solid ${isSelected ? '#3B82F6' : techColor}`,
        borderRadius: '6px',
        padding: '9px 10px',
        marginBottom: '6px',
        cursor: 'pointer',
        boxShadow: isDark ? '0 1px 3px rgba(0,0,0,0.4)' : '0 1px 2px rgba(0,0,0,0.06)',
        transition: 'all 0.12s',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* modelo */}
      <div style={{ fontSize: '10px', color: textSub, fontWeight: 500, marginBottom: '1px', display: 'flex', alignItems: 'center', gap: '5px', flexWrap: 'wrap' }}>
        <span>{machine.modelo}</span>
        {hasExpress && <span style={{ fontSize: '9px', fontWeight: 700, padding: '0 4px', borderRadius: '3px', background: 'rgba(245,158,11,0.12)', color: '#F59E0B', fontFamily: 'monospace' }}>EXPRESS</span>}
        {machine.prioridade && <span style={{ fontSize: '9px', fontWeight: 700, padding: '0 4px', borderRadius: '3px', background: 'rgba(239,68,68,0.12)', color: '#EF4444', fontFamily: 'monospace' }}>PRIO</span>}
        {hasHistory && <Repeat style={{ width: '9px', height: '9px', color: '#3B82F6' }} />}
        {machine.aguardaPecas && <Clock style={{ width: '9px', height: '9px', color: '#F59E0B' }} />}
      </div>
      {/* série */}
      <div style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 700, color: textMain, letterSpacing: '0.04em', marginBottom: '3px' }}>{machine.serie}</div>
      {/* tarefas */}
      {otherTasks.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px', marginBottom: '3px' }}>
          {otherTasks.map((t, i) => (
            <span key={i} style={{ fontSize: '9px', fontWeight: 600, padding: '0 4px', borderRadius: '3px', background: isDark ? '#1F2937' : '#F3F4F6', color: textSub, fontFamily: 'monospace' }}>{t.texto}</span>
          ))}
        </div>
      )}
      {/* timer */}
      {(timerAtivo || timerPausado || timerDone) && timerElapsed !== null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '3px' }} onClick={e => e.stopPropagation()}>
          {timerAtivo && !timerPausado && (
            <>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22C55E', display: 'inline-block' }} />
              <span style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 700, color: '#22C55E', letterSpacing: '0.04em' }}>{formatDuration(timerElapsed)}</span>
              <span style={{ fontSize: '9px', color: textSub }}>em curso</span>
            </>
          )}
          {timerPausado && (
            <>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#F59E0B', display: 'inline-block' }} />
              <span style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 700, color: '#F59E0B' }}>{formatDuration(timerElapsed)}</span>
              <span style={{ fontSize: '9px', color: textSub }}>pausado</span>
            </>
          )}
          {timerDone && (
            <>
              <Clock style={{ width: '10px', height: '10px', color: '#4ADE80' }} />
              <span style={{ fontSize: '10px', fontFamily: 'monospace', fontWeight: 700, color: '#4ADE80' }}>{formatDuration(timerElapsed)}</span>
            </>
          )}
        </div>
      )}
    </button>
  );
};

const TechnicianCompletedSection = ({ machines, techId, onOpenMachine, isDark }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  return (
    <div className="mt-3">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`w-full flex items-center justify-between p-2 rounded border text-gray-700 hover:opacity-80 ${isDark ? 'bg-gray-800 border-gray-700' : 'bg-gray-50 border-gray-200'}`}
      >
        <span className={`text-xs font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>Concluídas: {machines.length}</span>
        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      <AnimatePresence>
        {isExpanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="mt-2 space-y-1 max-h-48 overflow-y-auto">
            {machines.map(machine => (
              <button key={machine.id} onClick={() => onOpenMachine(machine)} className={`w-full text-left p-2 rounded border ${isDark ? 'bg-gray-900 border-gray-700 hover:bg-gray-800' : 'bg-white border-gray-200 hover:bg-gray-50'}`}>
                <span className={`text-xs font-mono ${isDark ? 'text-white' : 'text-black'}`}>{machine.serie}</span>
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
  const [currentUser, setCurrentUser] = useState(null);
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [showObsModal, setShowObsModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [machineToAssign, setMachineToAssign] = useState(null);
  const [showBulkCreateModal, setShowBulkCreateModal] = useState(false);
  const [showBackupManager, setShowBackupManager] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [machineToEdit, setMachineToEdit] = useState(null);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    const saved = localStorage.getItem('dashboardDarkMode');
    return saved ? JSON.parse(saved) : false;
  });
  const [showAFazerFullscreen, setShowAFazerFullscreen] = useState(false);
  const [showConcluidaFullscreen, setShowConcluidaFullscreen] = useState(false);
  const [selectedMachines, setSelectedMachines] = useState([]);
  const [showMultiEditModal, setShowMultiEditModal] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  const userPermissions = usePermissions(currentUser?.perfil, currentUser?.nome_tecnico);

  useEffect(() => { localStorage.setItem('dashboardDarkMode', JSON.stringify(isDarkMode)); }, [isDarkMode]);

  const TIMER_FIELDS = ['timer_ativo','timer_pausado','timer_inicio','timer_fim','timer_duracao_minutos','timer_acumulado'];

  const loadMachines = useCallback(async () => {
    try {
      const data = await FrotaACP.list('-created_date');
      setMachines(prev => {
        if (!prev || prev.length === 0) return data;
        return data.map(fresh => {
          const local = prev.find(m => m.id === fresh.id);
          if (!local) return fresh;
          // Preservar campos de timer locais se:
          // 1. Local tem timer ativo E DB ainda não confirmou, OU
          // 2. DB tem timer ativo (normal merge, manter campos da DB)
          const localAtivo = local.timer_ativo === true;
          const freshAtivo = fresh.timer_ativo === true;
          if (localAtivo && !freshAtivo) {
            // Race condition: DB ainda não propagou — manter estado local
            return { ...fresh, ...Object.fromEntries(TIMER_FIELDS.map(f => [f, local[f]])) };
          }
          // DB confirmou — usar dados frescos (inclui timer da DB se ativo)
          return fresh;
        });
      });
    } catch (error) { console.error("Erro ao carregar máquinas:", error); }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    const loadUser = async () => {
      try { const user = await base44.auth.me(); setCurrentUser(user); }
      catch (e) { console.error("Erro ao carregar usuário", e); }
    };
    loadUser();
  }, []);

  useEffect(() => { loadMachines(); }, [loadMachines]);

  useEffect(() => {
    const interval = setInterval(() => { loadMachines(); }, 30000);
    return () => clearInterval(interval);
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
        await FrotaACP.update(machine.id, { estado: novoEstadoSelf, tecnico: currentUser.nome_tecnico, dataAtribuicao: new Date().toISOString() });
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
      await FrotaACP.update(machineToAssign.id, { estado: novoEstadoAdmin, tecnico: techId, dataAtribuicao: new Date().toISOString() });
      await base44.entities.Notificacao.create({ userId: techId, message: `Nova máquina atribuída: ${machineToAssign.serie}`, machineId: machineToAssign.id, machineSerie: machineToAssign.serie, technicianName: currentUser?.full_name || 'Admin', type: 'os_assignment', isRead: false });
      syncMachineToPortal(machineToAssign.serie, novoEstadoAdmin);
      await loadMachines();
      setShowAssignModal(false);
      setMachineToAssign(null);
    } catch (error) { console.error("Erro ao atribuir máquina:", error); alert("Erro ao atribuir máquina. Tente novamente."); }
  };

  const handleMarkComplete = async (machineId) => {
    const machine = machines.find(m => m.id === machineId);
    if (!machine || !machine.tecnico) return;
    try {
      const updateData = { estado: `concluida-${machine.tecnico}`, dataConclusao: new Date().toISOString() };
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


  // ── TIMER HANDLERS ──
  const handleTimerStart = async (machineId) => {
    try {
      const now = new Date().toISOString();
      const data = { timer_inicio: now, timer_ativo: true, timer_pausado: false, timer_fim: null, timer_duracao_minutos: null, timer_acumulado: 0 };
      // 1. Gravar no localStorage imediatamente (fallback contra reload/race)
      saveTimerLocal({ id: machineId, ...data });
      // 2. Optimistic update no state local
      setMachines(prev => prev.map(m => m.id === machineId ? { ...m, ...data } : m));
      // 3. Persistir na DB
      await FrotaACP.update(machineId, data);
      // 4. DB confirmou — limpar localStorage (já não precisamos de fallback)
      clearTimerLocal(machineId);
    } catch (e) {
      console.error("Erro ao iniciar timer:", e);
      await loadMachines();
    }
  };

  const handleTimerPause = async (machineId, acumuladoMinutos) => {
    try {
      const data = { timer_ativo: true, timer_pausado: true, timer_acumulado: acumuladoMinutos };
      saveTimerLocal({ id: machineId, ...data });
      setMachines(prev => prev.map(m => m.id === machineId ? { ...m, ...data } : m));
      await FrotaACP.update(machineId, data);
      clearTimerLocal(machineId);
    } catch (e) { console.error("Erro ao pausar timer:", e); await loadMachines(); }
  };

  const handleTimerResume = async (machineId) => {
    try {
      const now = new Date().toISOString();
      const machine = machines.find(m => m.id === machineId);
      const data = { timer_pausado: false, timer_ativo: true, timer_inicio: now, timer_acumulado: machine?.timer_acumulado || 0 };
      saveTimerLocal({ id: machineId, ...data });
      setMachines(prev => prev.map(m => m.id === machineId ? { ...m, ...data } : m));
      await FrotaACP.update(machineId, data);
      clearTimerLocal(machineId);
    } catch (e) { console.error("Erro ao retomar timer:", e); await loadMachines(); }
  };

  const handleTimerStop = async (machineId, duracaoTotal) => {
    try {
      const fim = new Date().toISOString();
      const data = { timer_ativo: false, timer_pausado: false, timer_fim: fim, timer_duracao_minutos: Math.round(duracaoTotal) };
      clearTimerLocal(machineId); // timer concluído — limpar localStorage
      setMachines(prev => prev.map(m => m.id === machineId ? { ...m, ...data } : m));
      await FrotaACP.update(machineId, data);
    } catch (e) { console.error("Erro ao parar timer:", e); await loadMachines(); }
  };

  const handleTimerReset = async (machineId) => {
    try {
      const data = { timer_ativo: false, timer_pausado: false, timer_inicio: null, timer_fim: null, timer_duracao_minutos: null, timer_acumulado: 0 };
      clearTimerLocal(machineId);
      setMachines(prev => prev.map(m => m.id === machineId ? { ...m, ...data } : m));
      await FrotaACP.update(machineId, data);
    } catch (e) { console.error("Erro ao resetar timer:", e); }
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
      const dateA = a.dataConclusao ? new Date(a.dataConclusao).getTime() : 0;
      const dateB = b.dataConclusao ? new Date(b.dataConclusao).getTime() : 0;
      return dateB - dateA;
    });
  }, [machines]);

  const patrickMachinesCount = useMemo(() => machines.filter(m => m.estado?.includes('patrick') && !m.arquivada).length, [machines]);
  const patrickConcluidaMachines = useMemo(() => machines.filter(m => m.estado?.startsWith('concluida-patrick')), [machines]);
  const [showPatrickLegacy, setShowPatrickLegacy] = useState(false);

  return (
    <div className="min-h-screen" style={{ background: isDarkMode ? 'linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%)' : '#ffffff' }}>
      {/* Dark mode scrollbar styles */}
      <style>{`
        ${isDarkMode ? `
          ::-webkit-scrollbar { width: 8px; height: 8px; }
          ::-webkit-scrollbar-track { background: #1a1a1a; }
          ::-webkit-scrollbar-thumb { background: #444; border-radius: 4px; }
          ::-webkit-scrollbar-thumb:hover { background: #666; }
          * { scrollbar-color: #444 #1a1a1a; scrollbar-width: thin; }
        ` : `
          ::-webkit-scrollbar { width: 8px; height: 8px; }
          ::-webkit-scrollbar-track { background: #f1f1f1; }
          ::-webkit-scrollbar-thumb { background: #c1c1c1; border-radius: 4px; }
          ::-webkit-scrollbar-thumb:hover { background: #a8a8a8; }
          * { scrollbar-color: #c1c1c1 #f1f1f1; scrollbar-width: thin; }
        `}
      `}</style>

      {/* Header Section */}
      <div className="mb-6">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <PedidosPanel userPermissions={userPermissions} isCompact={true} />
            {userPermissions?.canDeleteMachine && <OSNotificationsPanel userPermissions={userPermissions} />}
            <UnifiedNotifications currentUser={currentUser} userPermissions={userPermissions} />

            {selectedMachines.length > 0 && userPermissions?.canDeleteMachine && (
              <button onClick={handleOpenMultiEdit} className="px-4 py-2 bg-blue-600 text-white text-xs font-bold tracking-wider hover:bg-blue-700 active:scale-95 transition-all clip-corner">
                <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
                EDITAR {selectedMachines.length} SELECIONADAS
              </button>
            )}

            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`px-4 py-2 text-xs font-bold tracking-wider transition-all clip-corner ${isDarkMode ? 'bg-gray-800 text-yellow-400 hover:bg-gray-700' : 'bg-gray-200 text-gray-800 hover:bg-gray-300'}`}
            >
              {isDarkMode ? <Sun className="w-4 h-4 inline mr-2" /> : <Moon className="w-4 h-4 inline mr-2" />}
              {isDarkMode ? 'LIGHT' : 'DARK'}
            </button>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {userPermissions?.canDeleteMachine && (
              <>

                <button onClick={() => setShowBackupManager(true)} className="px-4 py-2 bg-gray-600 text-white text-xs font-bold tracking-wider hover:bg-gray-700 active:scale-95 transition-all clip-corner">
                  <HardDrive className="w-4 h-4 inline mr-2" />
                  BACKUP
                </button>
              </>
            )}
            {userPermissions?.canCreateMachine && (
              <>
                <button onClick={() => setShowBulkCreateModal(true)} className="px-4 py-2 bg-green-600 text-white text-xs font-bold tracking-wider hover:bg-green-700 active:scale-95 transition-all clip-corner">
                  <svg className="w-4 h-4 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  CRIAÇÃO MASSIVA IA
                </button>
                <button onClick={() => setShowImageModal(true)} className="px-4 py-2 bg-purple-600 text-white text-xs font-bold tracking-wider hover:bg-purple-700 active:scale-95 transition-all clip-corner">
                  <Camera className="w-4 h-4 inline mr-2" />
                  CRIAR COM IA
                </button>
                <button onClick={() => { setPrefillData(null); setShowCreateModal(true); }} className="px-4 py-2 bg-pink-600 text-white text-xs font-bold tracking-wider hover:bg-pink-700 active:scale-95 transition-all clip-corner">
                  <Plus className="w-4 h-4 inline mr-2" />
                  NOVA MÁQUINA
                </button>
              </>
            )}
          </div>
        </div>

        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="SISTEMA DE BUSCA"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className={`w-full pl-10 pr-4 py-2.5 text-sm border-2 outline-none clip-corner ${isDarkMode ? 'bg-gray-800 border-gray-600 text-white placeholder-gray-400 focus:border-red-500' : 'bg-white border-gray-300 text-gray-700 placeholder-gray-400 focus:border-black'}`}
          />
        </div>
      </div>

      {searchQuery ? (
        <div className="space-y-2">
          {filteredMachines.map(machine => (
            <MachineCardCompact key={machine.id} machine={machine} onClick={(m) => { setSelectedMachine(m); setShowObsModal(true); }} isDark={isDarkMode} />
          ))}
        </div>
      ) : (
        <>
          <DragDropContext onDragEnd={handleDragEnd}>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              {/* A FAZER */}
              <div style={{ background: isDarkMode ? '#0F172A' : '#FFFFFF', border: isDarkMode ? '1px solid #1E293B' : '1px solid #E2E8F0', borderTop: '2px solid #EF4444', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: isDarkMode ? '1px solid #1E293B' : '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Wrench style={{ width: '14px', height: '14px', color: '#EF4444', flexShrink: 0 }} />
                    <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: isDarkMode ? '#F1F5F9' : '#0F172A', fontFamily: 'Inter, sans-serif' }}>A FAZER</span>
                    <span style={{ fontSize: '11px', fontWeight: 700, fontFamily: 'monospace', padding: '1px 8px', borderRadius: '20px', background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>{aFazerMachines.length}</span>
                  </div>
                  <button onClick={() => setShowAFazerFullscreen(true)} style={{ padding: '4px', borderRadius: '4px', background: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', border: 'none', cursor: 'pointer' }}>
                    <Maximize2 style={{ width: '14px', height: '14px', color: isDarkMode ? '#94A3B8' : '#64748B' }} />
                  </button>
                </div>
                <Droppable droppableId="a-fazer">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="p-4 space-y-2 max-h-[400px] overflow-y-auto">
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
                    </div>
                  )}
                </Droppable>
              </div>

              {/* CONCLUÍDA */}
              <div style={{ background: isDarkMode ? '#0F172A' : '#FFFFFF', border: isDarkMode ? '1px solid #1E293B' : '1px solid #E2E8F0', borderTop: '2px solid #22C55E', borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: isDarkMode ? '1px solid #1E293B' : '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <CheckCircle2 style={{ width: '14px', height: '14px', color: '#22C55E', flexShrink: 0 }} />
                    <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: isDarkMode ? '#F1F5F9' : '#0F172A', fontFamily: 'Inter, sans-serif' }}>CONCLUÍDA</span>
                    <span style={{ fontSize: '11px', fontWeight: 700, fontFamily: 'monospace', padding: '1px 8px', borderRadius: '20px', background: 'rgba(34,197,94,0.1)', color: '#22C55E' }}>{allConcluidaMachines.length}</span>
                  </div>
                  <button onClick={() => setShowConcluidaFullscreen(true)} style={{ padding: '4px', borderRadius: '4px', background: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', border: 'none', cursor: 'pointer' }}>
                    <Maximize2 style={{ width: '14px', height: '14px', color: isDarkMode ? '#94A3B8' : '#64748B' }} />
                  </button>
                </div>
                <Droppable droppableId="concluida-geral">
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="p-4 space-y-2 min-h-[100px] max-h-[400px] overflow-y-auto">
                      {allConcluidaMachines.map((machine, index) => (
                        <Draggable key={machine.id} draggableId={`concluida-${machine.id}`} index={index} isDragDisabled={!userPermissions?.canMoveAnyMachine}>
                          {(provided) => (
                            <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} style={{ ...provided.draggableProps.style }}>
                              <button
                                onClick={() => { setSelectedMachine(machine); setShowObsModal(true); }}
                                style={{
                                  width: '100%', textAlign: 'left', cursor: 'pointer',
                                  background: isDarkMode ? '#111827' : '#FFFFFF',
                                  border: isDarkMode ? '1px solid #1F2937' : '1px solid #E5E7EB',
                                  borderLeft: `3px solid ${machine.tecnico ? TECHNICIANS.find(t => t.id === machine.tecnico)?.borderColor : '#22C55E'}`,
                                  borderRadius: '6px', padding: '8px 10px', marginBottom: '4px',
                                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px',
                                }}
                              >
                                <span style={{ fontFamily: 'monospace', fontSize: '12px', fontWeight: 700, color: isDarkMode ? '#F9FAFB' : '#111827', letterSpacing: '0.04em' }}>{machine.serie}</span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                                  <span style={{ fontSize: '9px', color: isDarkMode ? '#4B5563' : '#9CA3AF', fontFamily: 'monospace', textTransform: 'uppercase' }}>{machine.tecnico || ''}</span>
                                  <CheckCircle2 style={{ width: '12px', height: '12px', color: '#22C55E' }} />
                                </div>
                              </button>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            </div>

            <div className="mb-4">
              <h2 className={`text-lg font-bold tracking-wider mb-4 ${isDarkMode ? 'text-white' : 'text-black'}`}>STATUS DE OPERADORES</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {TECHNICIANS.map(tech => {
                const emPreparacao = machines.filter(m => !m.arquivada && m.estado === `em-preparacao-${tech.id}`);
                const concluidas = machines.filter(m => !m.arquivada && m.estado === `concluida-${tech.id}`);
                const statusLabel = emPreparacao.length === 0 ? 'EM ESPERA' : emPreparacao.some(m => m.estado.includes('em-preparacao')) ? 'PROCESSANDO' : 'ATIVO';
                const statusColor = emPreparacao.length === 0 ? 'text-gray-500' : emPreparacao.some(m => m.estado.includes('em-preparacao')) ? 'text-cyan-600' : 'text-yellow-600';

                return (
                  <div key={tech.id} style={{ background: isDarkMode ? '#0F172A' : '#FFFFFF', border: isDarkMode ? '1px solid #1E293B' : '1px solid #E2E8F0', borderTop: `2px solid ${tech.borderColor}`, borderRadius: '8px', overflow: 'hidden' }}>
                    <div style={{ padding: '10px 12px 8px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: isDarkMode ? '1px solid #1E293B' : '1px solid #F1F5F9' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: tech.borderColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: 'white', fontFamily: 'monospace' }}>{tech.name.charAt(0)}</span>
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', color: isDarkMode ? '#F1F5F9' : '#0F172A', fontFamily: 'Inter, sans-serif' }}>{tech.name}</div>
                        <div style={{ fontSize: '9px', color: isDarkMode ? '#475569' : '#94A3B8', fontFamily: 'monospace' }}>TÉCNICO</div>
                      </div>
                    </div>

                    <Droppable droppableId={`em-preparacao-${tech.id}`}>
                      {(provided) => (
                        <div ref={provided.innerRef} {...provided.droppableProps} className="px-4 pb-3 min-h-[120px] max-h-[280px] overflow-y-auto">
                          {emPreparacao.map((machine, index) => (
                            <Draggable key={machine.id} draggableId={machine.id} index={index}>
                              {(provided) => (
                                <div ref={provided.innerRef} {...provided.draggableProps} {...provided.dragHandleProps} style={{ ...provided.draggableProps.style }}>
                                  <MachineCardTechnician machine={machine} onClick={(m) => { setSelectedMachine(m); setShowObsModal(true); }} techColor={tech.borderColor} isDark={isDarkMode} isSelected={selectedMachines.some(sm => sm.id === machine.id)} onSelect={handleSelectMachine} />
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                          {emPreparacao.length === 0 && (
                            <div className={`flex items-center justify-center py-8 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}>
                              <svg className="w-16 h-16 opacity-30" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM7 9a1 1 0 100-2 1 1 0 000 2zm7-1a1 1 0 11-2 0 1 1 0 012 0zm-.464 5.535a1 1 0 10-1.415-1.414 3 3 0 01-4.242 0 1 1 0 00-1.415 1.414 5 5 0 007.072 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                          )}
                        </div>
                      )}
                    </Droppable>

                    <Droppable droppableId={`concluida-${tech.id}`}>
                      {(provided) => (
                        <div ref={provided.innerRef} {...provided.droppableProps} className="hidden">{provided.placeholder}</div>
                      )}
                    </Droppable>

                    <TechnicianCompletedSection machines={concluidas} techId={tech.id} onOpenMachine={(m) => { setSelectedMachine(m); setShowObsModal(true); }} isDark={isDarkMode} />

                    <div className={`p-3 border-t flex items-center justify-between ${isDarkMode ? 'border-gray-800 bg-gray-900/50' : 'border-gray-200 bg-gray-50'}`}>
                      <span className={`text-xs font-bold tracking-wider ${statusColor}`}>{statusLabel}</span>
                      <span className={`text-xs font-bold ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>{concluidas.length} DONE</span>
                    </div>

                    {emPreparacao.length > 0 && emPreparacao.some(m => m.estado.includes('em-preparacao')) && (
                      <div className="px-3 pb-3">
                        <button className="w-full py-2.5 text-white text-xs font-bold tracking-wide clip-corner" style={{ background: tech.borderColor }}>
                          EM EXECUÇÃO
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </DragDropContext>
        </>
      )}

      {/* Modals */}
      <CreateMachineModal isOpen={showCreateModal} onClose={() => { setShowCreateModal(false); setPrefillData(null); }} onSubmit={handleCreateMachine} prefillData={prefillData} />
      <ImageUploadModal isOpen={showImageModal} onClose={() => setShowImageModal(false)} onSuccess={handleImageUploadSuccess} purpose="create" />
      <BulkCreateModal isOpen={showBulkCreateModal} onClose={() => setShowBulkCreateModal(false)} onSuccess={async () => { await loadMachines(); setShowBulkCreateModal(false); }} />
      <ObservationsModal
        isOpen={showObsModal}
        onClose={() => { setShowObsModal(false); setSelectedMachine(null); }}
        machine={selectedMachine ? (machines.find(m => m.id === selectedMachine.id) || selectedMachine) : null}
        allMachines={machines}
        onAddObservation={handleAddObservation}
        onToggleTask={handleToggleTask}
        onTogglePriority={handleTogglePriority}
        onDelete={handleDeleteMachine}
        onMarkComplete={handleMarkComplete}
        onToggleAguardaPecas={handleToggleAguardaPecas}
        currentUser={currentUser}
        userPermissions={userPermissions}
        onOpenEdit={(machine) => { setMachineToEdit(machine); setShowEditModal(true); }}
        onTimerStart={handleTimerStart}
        onTimerPause={handleTimerPause}
        onTimerResume={handleTimerResume}
        onTimerStop={handleTimerStop}
        onTimerReset={handleTimerReset}
      />
      <EditMachineModal
        isOpen={showEditModal}
        onClose={() => { setShowEditModal(false); setMachineToEdit(null); }}
        machine={machineToEdit}
        onSave={async (updatedData) => {
          try {
            await FrotaACP.update(machineToEdit.id, updatedData);
            await loadMachines();
            setShowEditModal(false);
            setMachineToEdit(null);
            setShowObsModal(false);
            setSelectedMachine(null);
          } catch (error) { console.error("Erro ao atualizar máquina:", error); alert("Erro ao atualizar máquina. Tente novamente."); }
        }}
      />
      <AssignModal isOpen={showAssignModal} onClose={() => { setShowAssignModal(false); setMachineToAssign(null); }} machine={machineToAssign} onAssign={handleAssignToTechnician} />

      {duplicateWarning && (
        <>
          <div className="fixed inset-0 bg-black/70 z-[200]" onClick={() => setDuplicateWarning(null)} />
          <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rounded-xl shadow-2xl z-[201] w-[90%] max-w-lg p-6 bg-white">
            <div className="flex items-start gap-3 mb-4">
              <AlertTriangle className="w-6 h-6 text-orange-500 flex-shrink-0 mt-1" />
              <div>
                <h3 className="text-xl font-bold text-black mb-2">Máquina Duplicada Detectada</h3>
                <p className="text-sm text-gray-600">O número de série <strong className="font-mono">{duplicateWarning.machineData.serie}</strong> já foi registrado anteriormente.</p>
              </div>
            </div>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4 space-y-2">
              <p className="text-xs font-semibold text-orange-800 mb-2">Registros anteriores:</p>
              {duplicateWarning.duplicates.map((dup, idx) => (
                <div key={idx} className="text-xs text-orange-700 bg-white rounded p-2">
                  <p className="font-semibold">{dup.modelo}</p>
                  <p>📅 Criada: {new Date(dup.created_date).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                  {dup.dataConclusao && <p>✅ Concluída: {new Date(dup.dataConclusao).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>}
                  <p>Estado: <span className="font-semibold capitalize">{dup.estado.replace(/-/g, ' ')}</span></p>
                </div>
              ))}
            </div>
            <p className="text-sm text-gray-700 mb-4">Deseja criar uma nova entrada para esta máquina?</p>
            <div className="flex gap-3">
              <button onClick={() => setDuplicateWarning(null)} className="flex-1 px-4 py-2 rounded border-2 border-gray-300 text-gray-700 hover:bg-gray-50 font-semibold">Cancelar</button>
              <button onClick={() => handleCreateMachine({ ...duplicateWarning.machineData, confirmedDuplicate: true })} className="flex-1 px-4 py-2 text-white rounded bg-orange-600 hover:bg-orange-700 font-semibold">Sim, Criar Novamente</button>
            </div>
          </div>
        </>
      )}

      {/* Patrick Legacy Panel */}
      {userPermissions?.canDeleteMachine && patrickConcluidaMachines.length > 0 && (
        <div className={`mt-6 border-2 rounded-lg overflow-hidden ${isDarkMode ? 'border-gray-700 bg-gray-950' : 'border-gray-300 bg-white'}`}>
          <button
            onClick={() => setShowPatrickLegacy(!showPatrickLegacy)}
            className={`w-full flex items-center justify-between p-3 text-left transition-colors ${isDarkMode ? 'hover:bg-gray-900' : 'hover:bg-gray-50'}`}
          >
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className={`text-xs font-bold tracking-wider ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>HISTÓRICO PATRICK — {patrickConcluidaMachines.length} MÁQUINAS CONCLUÍDAS</span>
            </div>
            {showPatrickLegacy ? <ChevronUp className={`w-4 h-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} /> : <ChevronDown className={`w-4 h-4 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`} />}
          </button>
          <AnimatePresence>
            {showPatrickLegacy && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className={`p-3 pt-0 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-2`}>
                  {patrickConcluidaMachines.map(machine => (
                    <button
                      key={machine.id}
                      onClick={() => { setSelectedMachine(machine); setShowObsModal(true); }}
                      className={`p-2 rounded border text-left transition-colors ${isDarkMode ? 'bg-gray-900 border-gray-700 hover:bg-gray-800' : 'bg-gray-50 border-gray-200 hover:bg-gray-100'}`}
                    >
                      <p className={`text-[10px] font-medium truncate ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>{machine.modelo}</p>
                      <p className={`text-xs font-mono font-bold truncate ${isDarkMode ? 'text-white' : 'text-black'}`}>{machine.serie}</p>
                      {machine.dataConclusao && (
                        <p className={`text-[9px] mt-0.5 ${isDarkMode ? 'text-gray-600' : 'text-gray-400'}`}>{new Date(machine.dataConclusao).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit' })}</p>
                      )}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <BackupManager isOpen={showBackupManager} onClose={() => setShowBackupManager(false)} onSuccess={async () => { await loadMachines(); }} />

      {showMultiEditModal && selectedMachines.length > 0 && (
        <>
          <div className="fixed inset-0 bg-black/70 z-[150]" onClick={handleCloseMultiEdit} />
          <div className="fixed inset-4 z-[151] bg-white rounded-xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-4 border-b bg-gradient-to-r from-blue-600 to-purple-600 text-white flex-shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button onClick={handleCloseMultiEdit} className="p-2 hover:bg-white/20 rounded-full transition-colors" title="Voltar">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <h2 className="text-xl font-bold">Edição Massiva - {selectedMachines.length} Máquinas Selecionadas</h2>
                </div>
                <button onClick={handleCloseMultiEdit} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <p className="text-sm mt-1 text-white/90">Use Ctrl+Click para selecionar/desselecionar máquinas</p>
            </div>
            <div className="flex-1 overflow-auto p-4 bg-gray-50">
              <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(auto-fit, minmax(${selectedMachines.length === 1 ? '100%' : selectedMachines.length === 2 ? 'calc(50% - 8px)' : '340px'}, 1fr))` }}>
                {selectedMachines.map(machine => (
                  <MachineEditCard
                    key={machine.id}
                    machine={machine}
                    onUpdate={async (field, value) => {
                      try {
                        await FrotaACP.update(machine.id, { [field]: value });
                        setSelectedMachines(prev => prev.map(m => m.id === machine.id ? { ...m, [field]: value } : m));
                        await loadMachines();
                      } catch (error) { console.error("Erro ao atualizar máquina:", error); }
                    }}
                    onRemove={() => handleSelectMachine(machine)}
                    onViewDetails={() => { setSelectedMachine(machine); setShowObsModal(true); }}
                  />
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      <FullscreenSectionModal isOpen={showAFazerFullscreen} onClose={() => setShowAFazerFullscreen(false)} title="A Fazer" machines={aFazerMachines} icon={Wrench} onOpenMachine={(m) => { setSelectedMachine(m); setShowObsModal(true); }} onAssign={handleAssignMachine} userPermissions={userPermissions} currentUser={currentUser} isDark={isDarkMode} />
      <FullscreenSectionModal isOpen={showConcluidaFullscreen} onClose={() => setShowConcluidaFullscreen(false)} title="Concluída" machines={allConcluidaMachines} icon={CheckCircle2} onOpenMachine={(m) => { setSelectedMachine(m); setShowObsModal(true); }} userPermissions={userPermissions} currentUser={currentUser} isDark={isDarkMode} />
    </div>
  );
}