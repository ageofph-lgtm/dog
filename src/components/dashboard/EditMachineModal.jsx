import React, { useState, useEffect } from "react";
import { Sparkles, Repeat, Package, Clock, Trash2 } from "lucide-react";

const TIPO_ICONS = {
  nova: { icon: Sparkles, color: 'text-blue-600', bg: 'bg-blue-100' },
  usada: { icon: Repeat, color: 'text-orange-600', bg: 'bg-orange-100' },
  aluguer: { icon: Package, color: 'text-purple-600', bg: 'bg-purple-100' }
};

const TAREFAS_PREDEFINIDAS = [
  'Preparação geral',
  'Revisão 3000h',
  'VPS',
  'EXPRESS'
];

const ESTADOS = [
  { value: 'a-fazer', label: 'A Fazer' },
  { value: 'em-preparacao-raphael', label: 'Em Preparação - Raphael' },
  { value: 'em-preparacao-nuno', label: 'Em Preparação - Nuno' },
  { value: 'em-preparacao-rogerio', label: 'Em Preparação - Rogério' },
  { value: 'em-preparacao-yano', label: 'Em Preparação - Yano' },
  { value: 'em-preparacao-patrick', label: 'Em Preparação - Patrick' },
  { value: 'concluida-raphael', label: 'Concluída - Raphael' },
  { value: 'concluida-nuno', label: 'Concluída - Nuno' },
  { value: 'concluida-rogerio', label: 'Concluída - Rogério' },
  { value: 'concluida-yano', label: 'Concluída - Yano' },
  { value: 'concluida-patrick', label: 'Concluída - Patrick' }
];

export default function EditMachineModal({ isOpen, onClose, machine, onSave }) {
  const [formData, setFormData] = useState({
    modelo: '',
    serie: '',
    ano: '',
    tipo: 'nova',
    estado: 'a-fazer',
    tecnico: null,
    tarefas: [],
    recondicao: { bronze: false, prata: false },
    prioridade: false,
    aguardaPecas: false
  });
  const [selectedTarefas, setSelectedTarefas] = useState({});
  const [customTarefas, setCustomTarefas] = useState([]);
  const [newTarefaText, setNewTarefaText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (machine && isOpen) {
      setFormData({
        modelo: machine.modelo || '',
        serie: machine.serie || '',
        ano: machine.ano || '',
        tipo: machine.tipo || 'nova',
        estado: machine.estado || 'a-fazer',
        tecnico: machine.tecnico || null,
        tarefas: machine.tarefas || [],
        recondicao: machine.recondicao || { bronze: false, prata: false },
        prioridade: machine.prioridade || false,
        aguardaPecas: machine.aguardaPecas || false
      });

      // Parse tarefas
      const preSelected = {};
      const custom = [];
      (machine.tarefas || []).forEach(t => {
        if (TAREFAS_PREDEFINIDAS.includes(t.texto)) {
          preSelected[t.texto] = true;
        } else {
          custom.push({ texto: t.texto, concluida: t.concluida });
        }
      });
      setSelectedTarefas(preSelected);
      setCustomTarefas(custom);
    }
  }, [machine, isOpen]);

  const handleEstadoChange = (novoEstado) => {
    let tecnico = null;
    if (novoEstado.includes('preparacao-') || novoEstado.includes('concluida-')) {
      const parts = novoEstado.split('-');
      tecnico = parts[parts.length - 1];
    }
    setFormData({ ...formData, estado: novoEstado, tecnico });
  };

  const handleTarefaToggle = (tarefa) => {
    setSelectedTarefas(prev => ({ ...prev, [tarefa]: !prev[tarefa] }));
  };

  const handleAddCustomTarefa = () => {
    if (newTarefaText.trim()) {
      setCustomTarefas(prev => [...prev, { texto: newTarefaText.trim(), concluida: false }]);
      setNewTarefaText('');
    }
  };

  const handleRemoveCustomTarefa = (index) => {
    setCustomTarefas(prev => prev.filter((_, i) => i !== index));
  };

  const handleToggleCustomTarefaConcluida = (index) => {
    setCustomTarefas(prev => prev.map((t, i) => 
      i === index ? { ...t, concluida: !t.concluida } : t
    ));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    const tarefas = [
      ...TAREFAS_PREDEFINIDAS.filter(tarefa => selectedTarefas[tarefa]).map(texto => {
        const existing = machine.tarefas?.find(t => t.texto === texto);
        return { texto, concluida: existing?.concluida || false };
      }),
      ...customTarefas
    ];

    await onSave({
      ...formData,
      ano: formData.ano ? parseInt(formData.ano) : null,
      tarefas
    });

    setIsSubmitting(false);
  };

  if (!isOpen || !machine) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[9998]" onClick={onClose} />
      <div className="fixed top-40 left-1/2 transform -translate-x-1/2 rounded-xl shadow-2xl z-[9999] w-[95%] max-w-lg p-6 max-h-[calc(100vh-180px)] overflow-y-auto" style={{
        background: 'linear-gradient(135deg, rgba(26, 11, 46, 0.98) 0%, rgba(38, 17, 68, 0.98) 100%)',
        backdropFilter: 'blur(20px)',
        border: '1px solid rgba(139, 92, 246, 0.3)',
        boxShadow: '0 0 40px rgba(139, 92, 246, 0.4)'
      }}>
        <h2 className="text-2xl font-bold mb-6" style={{ color: '#e9d5ff' }}>Editar Máquina</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Modelo */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#c4b5fd' }}>Modelo</label>
            <input
              type="text"
              value={formData.modelo}
              onChange={(e) => setFormData({ ...formData, modelo: e.target.value })}
              required
              className="w-full px-4 py-2 rounded-lg outline-none transition-all"
              style={{
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                color: '#e9d5ff'
              }}
            />
          </div>

          {/* Série */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#c4b5fd' }}>Número de Série</label>
            <input
              type="text"
              value={formData.serie}
              onChange={(e) => setFormData({ ...formData, serie: e.target.value })}
              required
              className="w-full px-4 py-2 rounded-lg outline-none transition-all"
              style={{
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                color: '#e9d5ff'
              }}
            />
          </div>

          {/* Ano */}
          <div>
            <label className="block text-sm font-medium mb-1" style={{ color: '#c4b5fd' }}>Ano</label>
            <input
              type="number"
              value={formData.ano}
              onChange={(e) => setFormData({ ...formData, ano: e.target.value })}
              className="w-full px-4 py-2 rounded-lg outline-none transition-all"
              style={{
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                color: '#e9d5ff'
              }}
            />
          </div>

          {/* Tipo */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: '#c4b5fd' }}>Tipo de Máquina</label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(TIPO_ICONS).map(([tipo, { icon: Icon }]) => (
                <button
                  key={tipo}
                  type="button"
                  onClick={() => setFormData({ ...formData, tipo })}
                  className="p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-2"
                  style={formData.tipo === tipo ? {
                    background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                    borderColor: 'transparent',
                    color: 'white'
                  } : {
                    background: 'rgba(139, 92, 246, 0.1)',
                    borderColor: 'rgba(139, 92, 246, 0.3)',
                    color: '#c4b5fd'
                  }}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs font-medium capitalize">{tipo}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Estado */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: '#c4b5fd' }}>Estado</label>
            <select
              value={formData.estado}
              onChange={(e) => handleEstadoChange(e.target.value)}
              className="w-full px-4 py-2 rounded-lg outline-none"
              style={{
                background: 'rgba(0,0,0,0.2)',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                color: '#e9d5ff'
              }}
            >
              {ESTADOS.map(e => (
                <option key={e.value} value={e.value} style={{ background: '#1a0b2e', color: '#e9d5ff' }}>
                  {e.label}
                </option>
              ))}
            </select>
          </div>

          {/* Recondicionamento */}
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: '#c4b5fd' }}>Recondicionamento</label>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit-recon-bronze"
                  checked={formData.recondicao?.bronze || false}
                  onChange={(e) => setFormData({
                    ...formData,
                    recondicao: { ...formData.recondicao, bronze: e.target.checked }
                  })}
                  className="w-4 h-4 rounded"
                  style={{ accentColor: '#d97706' }}
                />
                <label htmlFor="edit-recon-bronze" className="text-sm flex items-center gap-2" style={{ color: '#c4b5fd' }}>
                  <span className="bg-amber-700 text-white text-xs px-2 py-0.5 rounded-full font-bold">BRZ</span>
                  Recon Bronze
                </label>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit-recon-prata"
                  checked={formData.recondicao?.prata || false}
                  onChange={(e) => setFormData({
                    ...formData,
                    recondicao: { ...formData.recondicao, prata: e.target.checked }
                  })}
                  className="w-4 h-4 rounded"
                  style={{ accentColor: '#9ca3af' }}
                />
                <label htmlFor="edit-recon-prata" className="text-sm flex items-center gap-2" style={{ color: '#c4b5fd' }}>
                  <span className="bg-gray-400 text-white text-xs px-2 py-0.5 rounded-full font-bold">PRT</span>
                  Recon Prata
                </label>
              </div>
            </div>
          </div>

          {/* Prioridade */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="edit-prioridade"
              checked={formData.prioridade || false}
              onChange={(e) => setFormData({ ...formData, prioridade: e.target.checked })}
              className="w-4 h-4 rounded"
              style={{ accentColor: '#f43f5e' }}
            />
            <label htmlFor="edit-prioridade" className="text-sm" style={{ color: '#c4b5fd' }}>
              Marcar como Prioritária
            </label>
          </div>

          {/* Aguarda Peças */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="edit-aguarda-pecas"
              checked={formData.aguardaPecas || false}
              onChange={(e) => setFormData({ ...formData, aguardaPecas: e.target.checked })}
              className="w-4 h-4 rounded"
              style={{ accentColor: '#fbbf24' }}
            />
            <label htmlFor="edit-aguarda-pecas" className="text-sm flex items-center gap-2" style={{ color: '#c4b5fd' }}>
              <Clock className="w-4 h-4" style={{ color: '#fbbf24' }} />
              Máquina aguarda peças
            </label>
          </div>

          {/* Tarefas */}
          <div>
            <label className="block text-sm font-medium mb-3" style={{ color: '#c4b5fd' }}>Tarefas</label>
            
            {/* Tarefas Pré-definidas */}
            <div className="space-y-2 mb-3">
              {TAREFAS_PREDEFINIDAS.map(tarefa => (
                <div key={tarefa} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`edit-tarefa-${tarefa}`}
                    checked={!!selectedTarefas[tarefa]}
                    onChange={() => handleTarefaToggle(tarefa)}
                    className="w-4 h-4 rounded"
                    style={{ accentColor: '#8b5cf6' }}
                  />
                  <label htmlFor={`edit-tarefa-${tarefa}`} className="text-sm" style={{ color: '#c4b5fd' }}>
                    {tarefa}
                  </label>
                </div>
              ))}
            </div>

            {/* Tarefas Personalizadas */}
            {customTarefas.length > 0 && (
              <div className="space-y-2 mb-3 p-3 rounded-lg border" style={{
                background: 'rgba(139, 92, 246, 0.1)',
                borderColor: 'rgba(139, 92, 246, 0.2)'
              }}>
                <p className="text-xs font-semibold mb-2" style={{ color: '#a78bfa' }}>Tarefas Personalizadas:</p>
                {customTarefas.map((tarefa, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded" style={{ background: 'rgba(0,0,0,0.2)' }}>
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={tarefa.concluida}
                        onChange={() => handleToggleCustomTarefaConcluida(idx)}
                        className="w-4 h-4 rounded"
                        style={{ accentColor: '#8b5cf6' }}
                      />
                      <span className={`text-sm ${tarefa.concluida ? 'line-through' : ''}`} style={{ color: tarefa.concluida ? '#a78bfa' : '#c4b5fd' }}>
                        {tarefa.texto}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveCustomTarefa(idx)}
                      className="p-1 transition-colors"
                      style={{ color: '#f43f5e' }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Adicionar nova tarefa */}
            <div className="flex gap-2">
              <input
                type="text"
                value={newTarefaText}
                onChange={(e) => setNewTarefaText(e.target.value)}
                placeholder="Adicionar tarefa personalizada..."
                className="flex-1 px-3 py-2 text-sm rounded-lg outline-none"
                style={{
                  background: 'rgba(0,0,0,0.2)',
                  border: '1px solid rgba(139, 92, 246, 0.3)',
                  color: '#e9d5ff'
                }}
                onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCustomTarefa())}
              />
              <button
                type="button"
                onClick={handleAddCustomTarefa}
                className="px-4 py-2 text-white rounded-lg text-sm font-semibold"
                style={{ background: '#8b5cf6' }}
              >
                +
              </button>
            </div>
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-lg transition-colors"
              style={{
                background: 'rgba(0, 0, 0, 0.05)',
                color: '#c4b5fd',
                border: '1px solid rgba(139, 92, 246, 0.2)'
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 px-4 py-2 text-white rounded-lg transition-all disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%)',
                boxShadow: '0 4px 15px rgba(139, 92, 246, 0.4)'
              }}
            >
              {isSubmitting ? 'A guardar...' : 'Guardar Alterações'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}