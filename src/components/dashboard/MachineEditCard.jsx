import React from "react";
import { Sparkles, Repeat, Package, Clock } from "lucide-react";

const TAREFAS_PREDEFINIDAS = ['Preparação geral', 'Revisão 3000h', 'VPS', 'EXPRESS'];

const TIPO_ICONS = {
  nova: { icon: Sparkles },
  usada: { icon: Repeat },
  aluguer: { icon: Package }
};

const ESTADOS = [
  { value: 'a-fazer', label: 'A Fazer' },
  { value: 'em-preparacao-raphael', label: 'Em Preparação - Raphael' },
  { value: 'em-preparacao-nuno', label: 'Em Preparação - Nuno' },
  { value: 'em-preparacao-rogerio', label: 'Em Preparação - Rogério' },
  { value: 'em-preparacao-yano', label: 'Em Preparação - Yano' },
  { value: 'concluida-raphael', label: 'Concluída - Raphael' },
  { value: 'concluida-nuno', label: 'Concluída - Nuno' },
  { value: 'concluida-rogerio', label: 'Concluída - Rogério' },
  { value: 'concluida-yano', label: 'Concluída - Yano' }
];

export default function MachineEditCard({ machine, onUpdate, onRemove, onViewDetails }) {
  const [localMachine, setLocalMachine] = React.useState(machine);
  const [selectedTarefas, setSelectedTarefas] = React.useState({});
  const [customTarefas, setCustomTarefas] = React.useState([]);
  const [newTarefaText, setNewTarefaText] = React.useState('');

  React.useEffect(() => {
    setLocalMachine(machine);
    const preSelected = {};
    const custom = [];
    (machine.tarefas || []).forEach(t => {
      if (TAREFAS_PREDEFINIDAS.includes(t.texto)) preSelected[t.texto] = true;
      else custom.push({ texto: t.texto, concluida: t.concluida });
    });
    setSelectedTarefas(preSelected);
    setCustomTarefas(custom);
  }, [machine]);

  const handleUpdate = (field, value) => {
    let newMachine = { ...localMachine, [field]: value };
    
    // Se o estado mudar, atualizar também o técnico correspondente
    if (field === 'estado') {
      let tecnico = null;
      if (value.includes('preparacao-') || value.includes('concluida-')) {
        const parts = value.split('-');
        tecnico = parts[parts.length - 1];
      }
      newMachine.tecnico = tecnico;
      // Notificar o pai sobre a mudança do técnico também
      onUpdate('tecnico', tecnico);
    }

    setLocalMachine(newMachine);
    onUpdate(field, value);
  };

  const handleTarefaToggle = (tarefa) => {
    const newSelected = { ...selectedTarefas, [tarefa]: !selectedTarefas[tarefa] };
    setSelectedTarefas(newSelected);
    const tarefas = [
      ...TAREFAS_PREDEFINIDAS.filter(t => newSelected[t]).map(texto => {
        const existing = localMachine.tarefas?.find(t => t.texto === texto);
        return { texto, concluida: existing?.concluida || false };
      }),
      ...customTarefas
    ];
    handleUpdate('tarefas', tarefas);
  };

  const handleAddCustomTarefa = () => {
    if (newTarefaText.trim()) {
      const newCustom = [...customTarefas, { texto: newTarefaText.trim(), concluida: false }];
      setCustomTarefas(newCustom);
      const tarefas = [
        ...TAREFAS_PREDEFINIDAS.filter(t => selectedTarefas[t]).map(texto => {
          const existing = localMachine.tarefas?.find(t => t.texto === texto);
          return { texto, concluida: existing?.concluida || false };
        }),
        ...newCustom
      ];
      handleUpdate('tarefas', tarefas);
      setNewTarefaText('');
    }
  };

  const handleRemoveCustomTarefa = (index) => {
    const newCustom = customTarefas.filter((_, i) => i !== index);
    setCustomTarefas(newCustom);
    const tarefas = [
      ...TAREFAS_PREDEFINIDAS.filter(t => selectedTarefas[t]).map(texto => {
        const existing = localMachine.tarefas?.find(t => t.texto === texto);
        return { texto, concluida: existing?.concluida || false };
      }),
      ...newCustom
    ];
    handleUpdate('tarefas', tarefas);
  };

  return (
    <div className="bg-gradient-to-b from-purple-900 to-indigo-900 border-2 border-purple-400 rounded-xl overflow-hidden shadow-lg flex flex-col">
      <div className="p-4 bg-gradient-to-r from-purple-600 to-blue-600 text-white flex items-center justify-between flex-shrink-0">
        <div className="flex-1">
          <h3 className="font-mono font-bold text-lg">{localMachine.serie}</h3>
          <p className="text-sm text-purple-100">{localMachine.modelo}</p>
        </div>
        <button onClick={onRemove} className="p-1.5 hover:bg-white/20 rounded-full text-white transition-colors" title="Remover da seleção">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1 text-purple-200">Modelo</label>
          <input type="text" value={localMachine.modelo} onChange={(e) => handleUpdate('modelo', e.target.value)} className="w-full px-4 py-2 rounded-lg outline-none bg-black/20 border border-purple-400/30 text-white" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-purple-200">Número de Série</label>
          <input type="text" value={localMachine.serie} onChange={(e) => handleUpdate('serie', e.target.value)} className="w-full px-4 py-2 rounded-lg outline-none bg-black/20 border border-purple-400/30 text-white" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1 text-purple-200">Ano</label>
          <input type="number" value={localMachine.ano || ''} onChange={(e) => handleUpdate('ano', e.target.value ? parseInt(e.target.value) : null)} className="w-full px-4 py-2 rounded-lg outline-none bg-black/20 border border-purple-400/30 text-white" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-purple-200">Tipo de Máquina</label>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(TIPO_ICONS).map(([tipo, { icon: Icon }]) => (
              <button key={tipo} type="button" onClick={() => handleUpdate('tipo', tipo)} className={`p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-2 ${localMachine.tipo === tipo ? 'bg-purple-600 border-purple-400 text-white' : 'bg-purple-900/30 border-purple-400/30 text-purple-200'}`}>
                <Icon className="w-5 h-5" />
                <span className="text-xs font-medium capitalize">{tipo}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-purple-200">Estado</label>
          <select value={localMachine.estado} onChange={(e) => handleUpdate('estado', e.target.value)} className="w-full px-4 py-2 rounded-lg outline-none bg-black/20 border border-purple-400/30 text-white">
            {ESTADOS.map(e => (
              <option key={e.value} value={e.value} style={{ background: '#1a0b2e', color: '#e9d5ff' }}>{e.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-2 text-purple-200">Recondicionamento</label>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={localMachine.recondicao?.bronze || false} onChange={(e) => handleUpdate('recondicao', { ...localMachine.recondicao, bronze: e.target.checked })} className="w-4 h-4 rounded" />
              <label className="text-sm flex items-center gap-2 text-purple-200">
                <span className="bg-amber-700 text-white text-xs px-2 py-0.5 rounded-full font-bold">BRZ</span>
                Recon Bronze
              </label>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" checked={localMachine.recondicao?.prata || false} onChange={(e) => handleUpdate('recondicao', { ...localMachine.recondicao, prata: e.target.checked })} className="w-4 h-4 rounded" />
              <label className="text-sm flex items-center gap-2 text-purple-200">
                <span className="bg-gray-400 text-white text-xs px-2 py-0.5 rounded-full font-bold">PRT</span>
                Recon Prata
              </label>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" checked={localMachine.prioridade || false} onChange={(e) => handleUpdate('prioridade', e.target.checked)} className="w-4 h-4 rounded" />
          <label className="text-sm text-purple-200">Marcar como Prioritária</label>
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" checked={localMachine.aguardaPecas || false} onChange={(e) => handleUpdate('aguardaPecas', e.target.checked)} className="w-4 h-4 rounded" />
          <label className="text-sm flex items-center gap-2 text-purple-200">
            <Clock className="w-4 h-4 text-yellow-400" />
            Máquina aguarda peças
          </label>
        </div>
        <div>
          <h4 className="text-sm font-bold text-purple-200 mb-2">Tarefas</h4>
          <div className="space-y-2 mb-3">
            {TAREFAS_PREDEFINIDAS.map(tarefa => (
              <div key={tarefa} className="flex items-center gap-2">
                <input type="checkbox" id={`${localMachine.id}-tarefa-${tarefa}`} checked={!!selectedTarefas[tarefa]} onChange={() => handleTarefaToggle(tarefa)} className="w-4 h-4 rounded" />
                <label htmlFor={`${localMachine.id}-tarefa-${tarefa}`} className="text-sm text-purple-200">{tarefa}</label>
              </div>
            ))}
          </div>
          {customTarefas.length > 0 && (
            <div className="space-y-2 mb-3 p-3 rounded-lg bg-black/20 border border-purple-400/30">
              <p className="text-xs font-semibold text-purple-300 mb-2">Tarefas Personalizadas:</p>
              {customTarefas.map((tarefa, idx) => (
                <div key={idx} className="flex items-center justify-between p-2 rounded bg-black/30">
                  <span className={`text-sm flex-1 ${tarefa.concluida ? 'line-through text-purple-400' : 'text-purple-100'}`}>{tarefa.texto}</span>
                  <button onClick={() => handleRemoveCustomTarefa(idx)} className="p-1 hover:bg-red-500/20 rounded text-red-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <input type="text" value={newTarefaText} onChange={(e) => setNewTarefaText(e.target.value)} placeholder="Adicionar tarefa personalizada..." className="flex-1 px-3 py-2 text-sm rounded-lg outline-none bg-black/20 border border-purple-400/30 text-white" onKeyPress={(e) => e.key === 'Enter' && handleAddCustomTarefa()} />
            <button onClick={handleAddCustomTarefa} className="px-4 py-2 text-white rounded-lg text-sm font-semibold bg-purple-600 hover:bg-purple-700">+</button>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-purple-400/30 flex-shrink-0">
        <button onClick={onViewDetails} className="w-full px-4 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg text-sm font-semibold hover:from-purple-700 hover:to-blue-700 transition-colors">
          Ver Detalhes Completos
        </button>
      </div>
    </div>
  );
}