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
import TimerButton from "../components/dashboard/TimerButton";

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

const MachineCardCompact = ({ machine, onClick, isDark, onAssign, showAssignButton, isSelected, onSelect }) => {
  const hasHistory = machine.historicoCriacoes && machine.historicoCriacoes.length > 0;
  const hasExpress = machine.tarefas?.some(t => t.texto === 'EXPRESS');
  const otherTasks = machine.tarefas?.filter(t => t.texto !== 'EXPRESS') || [];

  let bgColor = isDark ? 'bg-gray-900' : 'bg-white';
  let borderColor = isDark ? 'border-gray-700' : 'border-black';

  if (machine.recondicao?.bronze && machine.recondicao?.prata) {
    bgColor = 'bg-gradient-to-br from-amber-600 to-gray-400';
  } else if (machine.recondicao?.bronze) {
    bgColor = 'bg-gradient-to-br from-amber-600 to-amber-400';
  } else if (machine.recondicao?.prata) {
    bgColor = 'bg-gradient-to-br from-gray-400 to-gray-300';
  }

  return (
    <div className={`w-full p-3 sm:p-4 border-2 transition-all clip-corner-all relative overflow-hidden ${isSelected ? 'border-blue-500 bg-blue-100 ring-4 ring-blue-300' : `${bgColor} ${borderColor}`}`}>
      {machine.prioridade && (
        <div className="absolute top-0 right-16 sm:right-20 w-6 h-full bg-red-600 flex items-center justify-center">
          <span className="text-white text-[10px] font-bold" style={{ writingMode: 'vertical-rl' }}>PRIO</span>
        </div>
      )}
      {hasExpress && (
        <div className="absolute top-1/2 right-24 sm:right-28 transform -translate-y-1/2 opacity-20 pointer-events-none">
          <svg className="w-8 h-8 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
          </svg>
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <button
          onClick={(e) => {
            e.preventDefault(); e.stopPropagation();
            if (e.ctrlKey || e.metaKey) { onSelect && onSelect(machine); }
            else { onClick(machine); }
          }}
          className="flex flex-col gap-1 flex-1 min-w-0 group"
        >
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0"></div>
            <span className={`text-xs font-medium truncate ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{machine.modelo}</span>
          </div>
          <span className={`text-sm font-mono font-bold truncate ${isDark ? 'text-white' : 'text-black'}`}>{machine.serie}</span>
          <div className="flex flex-wrap gap-1 mt-1">
            {machine.recondicao?.bronze && <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-700 text-white font-bold">BRZ</span>}
            {machine.recondicao?.prata && <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-500 text-white font-bold">PRT</span>}
          </div>
          {otherTasks.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-1">
              {otherTasks.map((tarefa, idx) => (
                <span key={idx} className="text-[9px] px-1.5 py-0.5 rounded bg-gray-700 text-white font-medium">{tarefa.texto}</span>
              ))}
            </div>
          )}
          <div className="flex items-center gap-2 mt-1 flex-shrink-0">
            {hasHistory && <Repeat className="w-3 h-3 text-blue-500" title="Máquina já foi registrada anteriormente" />}
            {machine.aguardaPecas && <Clock className="w-3 h-3 text-yellow-500" />}
          </div>
        </button>
        {showAssignButton && onAssign && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onAssign(machine); }}
            className="flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-red-600 hover:bg-red-700 active:scale-95 transition-all flex items-center justify-center z-10"
          >
            <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
          </button>
        )}
      </div>
    </div>
  );
};

const MachineCardTechnician = ({ machine, onClick, techColor, isDark, isSelected, onSelect }) => {
  const hasHistory = machine.historicoCriacoes && machine.historicoCriacoes.length > 0;
  const hasExpress = machine.tarefas?.some(t => t.texto === 'EXPRESS');
  const otherTasks = machine.tarefas?.filter(t => t.texto !== 'EXPRESS') || [];

  let bgColor = isDark ? 'bg-gray-900 hover:bg-gray-800' : 'bg-white hover:bg-gray-50';
  if (machine.recondicao?.bronze && machine.recondicao?.prata) bgColor = 'bg-gradient-to-br from-amber-600 to-gray-400 hover:opacity-90';
  else if (machine.recondicao?.bronze) bgColor = 'bg-gradient-to-br from-amber-600 to-amber-400 hover:opacity-90';
  else if (machine.recondicao?.prata) bgColor = 'bg-gradient-to-br from-gray-400 to-gray-300 hover:opacity-90';

  return (
    <button
      onClick={(e) => { if (e.ctrlKey || e.metaKey) { onSelect && onSelect(machine); } else { onClick(machine); } }}
      className={`w-full text-left p-3 border-l-4 transition-all mb-2 clip-corner relative overflow-hidden ${isSelected ? 'bg-blue-100 ring-4 ring-blue-300' : bgColor}`}
      style={{ borderLeftColor: isSelected ? '#3b82f6' : techColor }}
    >
      {machine.prioridade && (
        <div className="absolute top-0 right-2 w-5 h-full bg-red-600 flex items-center justify-center">
          <span className="text-white text-[9px] font-bold" style={{ writingMode: 'vertical-rl' }}>PRIO</span>
        </div>
      )}
      {hasExpress && (
        <div className="absolute top-1/2 right-10 transform -translate-y-1/2 opacity-20 pointer-events-none">
          <svg className="w-8 h-8 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
          </svg>
        </div>
      )}
      <div className="flex flex-col gap-1">
        <span className={`text-xs font-medium ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>{machine.modelo}</span>
        <span className={`text-sm font-mono font-bold ${isDark ? 'text-white' : 'text-black'}`}>{machine.serie}</span>
        <div className="flex flex-wrap gap-1 mt-1">
          {machine.recondicao?.bronze && <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-700 text-white font-bold">BRZ</span>}
          {machine.recondicao?.prata && <span className="text-[9px] px-1.5 py-0.5 rounded bg-gray-500 text-white font-bold">PRT</span>}
        </div>
        {otherTasks.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {otherTasks.map((tarefa, idx) => (
              <span key={idx} className="text-[9px] px-1.5 py-0.5 rounded bg-gray-700 text-white font-medium">{tarefa.texto}</span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2 mt-1">
          {hasHistory && <Repeat className="w-3 h-3 text-blue-500" title="Máquina já foi registrada anteriormente" />}
          {machine.aguardaPecas && <Clock className="w-3 h-3 text-yellow-500" />}
        </div>
      </div>
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

  const loadMachines = useCallback(async () => {
    try {
      const data = await FrotaACP.list('-created_date');
      setMachines(data);
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
    const interval = setInterval(() => { loadMachines(); }, 10000);
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
        await FrotaACP.update(machine.id, { estado: `em-preparacao-${currentUser.nome_tecnico}`, tecnico: currentUser.nome_tecnico, dataAtribuicao: new Date().toISOString() });
        await base44.entities.Notificacao.create({ userId: 'admin', message: `${currentUser.nome_tecnico.charAt(0).toUpperCase() + currentUser.nome_tecnico.slice(1)} atribuiu máquina ${machine.serie} - Abrir OS!`, machineId: machine.id, machineSerie: machine.serie, technicianName: currentUser.nome_tecnico, type: 'self_assigned', isRead: false });
        await loadMachines();
      } catch (error) { console.error("Erro ao atribuir máquina:", error); alert("Erro ao atribuir máquina. Tente novamente."); }
    }
  };

  const handleAssignToTechnician = async (techId) => {
    if (!machineToAssign) return;
    try {
      await FrotaACP.update(machineToAssign.id, { estado: `em-preparacao-${techId}`, tecnico: techId, dataAtribuicao: new Date().toISOString() });
      await base44.entities.Notificacao.create({ userId: techId, message: `Nova máquina atribuída: ${machineToAssign.serie}`, machineId: machineToAssign.id, machineSerie: machineToAssign.serie, technicianName: currentUser?.full_name || 'Admin', type: 'os_assignment', isRead: false });
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
      await base44.entities.Notificacao.create({ userId: 'admin', message: `Máquina ${machine.serie} concluída`, machineId: machine.id, machineSerie: machine.serie, technicianName: machine.tecnico, type: 'machine_completed', isRead: false });
    } catch (error) { console.error("Erro ao marcar como concluída:", error); alert("Erro ao marcar como concluída. Tente novamente."); await loadMachines(); }
  };

  const handleToggleAguardaPecas = async (machineId, newValue) => {
    try {
      setMachines(prevMachines => prevMachines.map(m => m.id === machineId ? { ...m, aguardaPecas: newValue } : m));
      await FrotaACP.update(machineId, { aguardaPecas: newValue });
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
      await FrotaACP.update(machineId, { timer_inicio: now, timer_ativo: true, timer_fim: null, timer_duracao_minutos: null });
      setMachines(prev => prev.map(m => m.id === machineId ? { ...m, timer_inicio: now, timer_ativo: true, timer_fim: null, timer_duracao_minutos: null } : m));
    } catch (e) { console.error("Erro ao iniciar timer:", e); }
  };

  const handleTimerStop = async (machineId) => {
    const machine = machines.find(m => m.id === machineId);
    if (!machine?.timer_inicio) return;
    try {
      const fim = new Date();
      const inicio = new Date(machine.timer_inicio);
      const duracaoMinutos = Math.round((fim - inicio) / 1000 / 60);
      const updateData = { timer_ativo: false, timer_fim: fim.toISOString(), timer_duracao_minutos: duracaoMinutos };
      await FrotaACP.update(machineId, updateData);
      setMachines(prev => prev.map(m => m.id === machineId ? { ...m, ...updateData } : m));
    } catch (e) { console.error("Erro ao parar timer:", e); }
  };

  const handleTimerReset = async (machineId) => {
    try {
      const resetData = { timer_ativo: false, timer_inicio: null, timer_fim: null, timer_duracao_minutos: null };
      await FrotaACP.update(machineId, resetData);
      setMachines(prev => prev.map(m => m.id === machineId ? { ...m, ...resetData } : m));
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
              <div className={`overflow-hidden clip-corner-top border-2 ${isDarkMode ? 'bg-gray-950 border-red-600' : 'bg-white border-red-600'}`}>
                <div className={`p-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Wrench className={`w-5 h-5 ${isDarkMode ? 'text-white' : 'text-red-600'}`} />
                      <h3 className={`text-base font-bold tracking-wide ${isDarkMode ? 'text-white' : 'text-black'}`}>A FAZER</h3>
                      <span className={`px-2.5 py-0.5 text-xs font-bold clip-corner ${isDarkMode ? 'bg-white text-black' : 'bg-black text-white'}`}>{aFazerMachines.length} ATIVOS</span>
                    </div>
                    <button onClick={() => setShowAFazerFullscreen(true)} className={`p-1.5 clip-corner ${isDarkMode ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-200 hover:bg-gray-300'}`}>
                      <Maximize2 className={`w-4 h-4 ${isDarkMode ? 'text-white' : 'text-black'}`} />
                    </button>
                  </div>
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
              <div className={`overflow-hidden clip-corner-top border-2 ${isDarkMode ? 'bg-gray-950 border-green-600' : 'bg-white border-green-600'}`}>
                <div className={`p-4 border-b ${isDarkMode ? 'border-gray-700' : 'border-gray-200'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-400" />
                      <h3 className={`text-base font-bold tracking-wide ${isDarkMode ? 'text-white' : 'text-black'}`}>CONCLUÍDA</h3>
                      <span className={`px-2.5 py-0.5 text-xs font-bold clip-corner ${isDarkMode ? 'bg-white text-black' : 'bg-black text-white'}`}>TOTAL: {allConcluidaMachines.length}</span>
                    </div>
                    <button onClick={() => setShowConcluidaFullscreen(true)} className={`p-1.5 clip-corner ${isDarkMode ? 'bg-white/10 hover:bg-white/20' : 'bg-gray-200 hover:bg-gray-300'}`}>
                      <Maximize2 className={`w-4 h-4 ${isDarkMode ? 'text-white' : 'text-black'}`} />
                    </button>
                  </div>
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
                                className={`w-full text-left p-3 rounded border-l-4 transition-all ${isDarkMode ? 'bg-gray-900 hover:bg-gray-800' : 'bg-white hover:bg-gray-50 border-gray-200'}`}
                                style={{ borderLeftColor: machine.tecnico ? TECHNICIANS.find(t => t.id === machine.tecnico)?.borderColor : '#10b981' }}
                              >
                                <div className="flex items-center justify-between">
                                  <span className={`text-sm font-mono font-bold ${isDarkMode ? 'text-white' : 'text-black'}`}>{machine.serie}</span>
                                  <div className="flex items-center gap-2">
                                    <span className={`text-xs uppercase ${isDarkMode ? 'text-gray-500' : 'text-gray-600'}`}>{machine.tecnico ? `CONCLUÍDO ${machine.tecnico}`.toUpperCase() : 'CONCLUÍDO'}</span>
                                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                                  </div>
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
                  <div key={tech.id} className={`overflow-hidden border-2 clip-corner-top ${isDarkMode ? 'bg-gray-950' : 'bg-white'}`} style={{ borderColor: tech.borderColor }}>
                    <div className="h-2" style={{ backgroundColor: tech.borderColor }}></div>
                    <div className="p-4 pb-3">
                      <div className="flex items-center gap-2 mb-2">
                        <UserIcon className="w-5 h-5" style={{ color: tech.borderColor }} />
                        <h4 className={`text-sm font-bold tracking-wide ${isDarkMode ? 'text-white' : 'text-black'}`}>{tech.name}</h4>
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
        machine={selectedMachine}
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