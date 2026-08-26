import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, Upload, CheckCircle2, AlertCircle, Trash2, Plus, Sparkles, Repeat, Package } from "lucide-react";
import { base44 } from "@/api/base44Client";

const TAREFAS_PREDEFINIDAS = ['Preparação geral', 'Revisão 3000h', 'VPS', 'EXPRESS'];

const TIPOS = [
  { id: 'nova', label: 'Nova', icon: Sparkles },
  { id: 'usada', label: 'Usada', icon: Repeat },
  { id: 'aluguer', label: 'Aluguer', icon: Package }
];

export default function BulkCreateModal({ isOpen, onClose, onSuccess }) {
  const [step, setStep] = useState('upload'); // 'upload', 'processing', 'review'
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [machines, setMachines] = useState([]);
  const [error, setError] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [customTaskInputs, setCustomTaskInputs] = useState({});

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setError(null);
    }
  };

  const handleProcessImage = async () => {
    if (!selectedFile) return;

    setIsProcessing(true);
    setStep('processing');
    setError(null);

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: selectedFile });

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Estás a analisar a fotografia de uma tabela ou lista de máquinas industriais / empilhadores (marcas como Toyota, BT, Linde, Still, etc.).

Extrai TODAS as máquinas listadas — cada linha da tabela é uma máquina. Para cada uma:
1. "modelo" — o modelo / asset type (ex: FM-X17, EXV14, RX60-30, 8FBE20T, RRE160H).
2. "serie" — o NÚMERO DE SÉRIE / serial number completo.
3. "ano" — o ano de produção (ex: 2017), ou null se não visível.

REGRAS CRÍTICAS PARA OS NÚMEROS DE SÉRIE:
- Transcreve CARÁCTER A CARÁCTER, exatamente como aparece. Não corrijas, não normalizes, não removas zeros à esquerda.
- Presta muita atenção a caracteres facilmente confundíveis: 0 (zero) vs O (letra), 1 vs I vs l, 5 vs S, 8 vs B, 2 vs Z. Usa o contexto: séries destas máquinas são maioritariamente dígitos com algumas letras maiúsculas (ex: 511903H00533, F20323H00856).
- Inclui TODOS os caracteres, incluindo letras no meio. NÃO incluas espaços dentro da série.
- NÃO saltes linhas: percorre a tabela de cima a baixo e extrai TODAS as linhas, mesmo repetidas ou parcialmente legíveis.
- Se um campo específico não for legível com confiança, devolve null nesse campo em vez de adivinhar — mas mantém a máquina na lista.`,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            machines: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  modelo: { type: ["string", "null"] },
                  serie: { type: ["string", "null"] },
                  ano: { type: ["number", "null"] }
                }
              }
            }
          },
          required: ["machines"]
        }
      });

      if (result?.machines?.length > 0) {
        const processedMachines = result.machines.map((m, idx) => ({
          tempId: `temp-${idx}`,
          modelo: m.modelo || '',
          serie: m.serie || '',
          ano: m.ano || null,
          tipo: 'usada',
          prioridade: false,
          recondicao: { bronze: false, prata: false },
          tarefas: [],
          imageUrl: file_url
        }));

        setMachines(processedMachines);
        setStep('review');
      } else {
        throw new Error("Nenhuma máquina foi detectada na imagem. Tente uma foto mais nítida.");
      }
    } catch (error) {
      console.error("Erro ao processar imagem:", error);
      setError(error.message || "Erro ao processar imagem. Tente novamente.");
      setStep('upload');
    }

    setIsProcessing(false);
  };

  const handleEditMachine = (index, field, value) => {
    setMachines(machines.map((m, i) => (i === index ? { ...m, [field]: value } : m)));
  };

  const handleRemoveMachine = (index) => {
    setMachines(machines.filter((_, i) => i !== index));
  };

  const handleTogglePredefinedTask = (index, taskText) => {
    const machine = machines[index];
    const has = machine.tarefas.some(t => t.texto === taskText);
    const newTarefas = has
      ? machine.tarefas.filter(t => t.texto !== taskText)
      : [...machine.tarefas, { texto: taskText, concluida: false }];
    handleEditMachine(index, 'tarefas', newTarefas);
  };

  const handleAddCustomTask = (index) => {
    const text = (customTaskInputs[index] || '').trim();
    if (!text) return;
    const machine = machines[index];
    handleEditMachine(index, 'tarefas', [...machine.tarefas, { texto: text, concluida: false }]);
    setCustomTaskInputs(prev => ({ ...prev, [index]: '' }));
  };

  const handleRemoveCustomTask = (index, taskText) => {
    const machine = machines[index];
    handleEditMachine(index, 'tarefas', machine.tarefas.filter(t => t.texto !== taskText));
  };

  const handleCreateAll = async () => {
    if (machines.length === 0) return;

    const invalid = machines.filter(m => !m.modelo.trim() || !m.serie.trim());
    if (invalid.length > 0) {
      setError(`${invalid.length} máquina(s) sem modelo ou série preenchidos. Complete ou remova antes de criar.`);
      return;
    }

    setIsProcessing(true);
    setError(null);

    try {
      await base44.entities.FrotaACP.bulkCreate(
        machines.map(machine => ({
          modelo: machine.modelo.trim(),
          serie: machine.serie.trim(),
          ano: machine.ano || null,
          tipo: machine.tipo,
          estado: 'a-fazer',
          prioridade: machine.prioridade,
          recondicao: machine.recondicao,
          tarefas: machine.tarefas,
          imageUrl: machine.imageUrl
        }))
      );

      onSuccess();
      handleClose();
    } catch (error) {
      console.error("Erro ao criar máquinas:", error);
      setError("Erro ao criar máquinas. Algumas podem não ter sido criadas.");
    }

    setIsProcessing(false);
  };

  const handleClose = () => {
    setStep('upload');
    setSelectedFile(null);
    setPreviewUrl(null);
    setMachines([]);
    setError(null);
    setIsProcessing(false);
    setCustomTaskInputs({});
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Upload className="w-6 h-6" />
            Criação Massiva com IA
          </DialogTitle>
        </DialogHeader>

        {/* Upload Step */}
        {step === 'upload' && (
          <div className="space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            {!selectedFile ? (
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50/50 transition-colors"
                onClick={() => document.getElementById('bulk-file-input').click()}
              >
                <Camera className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 mb-2 font-medium text-lg">
                  Tire foto ou faça upload de uma tabela com múltiplas máquinas
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  A IA irá extrair automaticamente todos os dados: Modelo, Série e Ano
                </p>
                <input
                  id="bulk-file-input"
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                  capture="environment"
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="border rounded-lg overflow-hidden">
                  <img src={previewUrl} alt="Preview" className="w-full h-auto max-h-96 object-contain bg-gray-50" />
                </div>

                <div className="flex gap-3">
                  <Button onClick={handleProcessImage} className="flex-1 h-12 bg-blue-600 hover:bg-blue-700 text-lg">
                    <Upload className="w-5 h-5 mr-2" />
                    Processar com IA
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => { setSelectedFile(null); setPreviewUrl(null); }}
                    className="h-12"
                  >
                    Trocar Imagem
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Processing Step */}
        {step === 'processing' && (
          <div className="py-12 text-center">
            <Loader2 className="w-16 h-16 mx-auto mb-4 animate-spin text-blue-600" />
            <p className="text-lg font-medium text-gray-700">Processando imagem com IA...</p>
            <p className="text-sm text-gray-500 mt-2">Extraindo dados de todas as máquinas</p>
          </div>
        )}

        {/* Review Step */}
        {step === 'review' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle2 className="w-5 h-5 text-blue-600" />
                <p className="font-semibold text-blue-900">
                  {machines.length} máquina{machines.length !== 1 ? 's' : ''} detectada{machines.length !== 1 ? 's' : ''}
                </p>
              </div>
              <p className="text-sm text-blue-700">
                Confirme os números de série, ajuste as opções e configure as tarefas antes de criar
              </p>
            </div>

            <div className="max-h-[450px] overflow-y-auto space-y-3 border rounded-lg p-4 bg-gray-50">
              {machines.map((machine, index) => (
                <div key={machine.tempId} className="bg-white rounded-lg border p-4 space-y-3">
                  {/* Dados principais */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1 grid grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs text-gray-500 font-medium mb-1 block">Modelo *</label>
                        <input
                          type="text"
                          value={machine.modelo}
                          onChange={(e) => handleEditMachine(index, 'modelo', e.target.value)}
                          className={`w-full px-2 py-1 text-sm border rounded ${!machine.modelo.trim() ? 'border-red-400 bg-red-50' : ''}`}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 font-medium mb-1 block">Série *</label>
                        <input
                          type="text"
                          value={machine.serie}
                          onChange={(e) => handleEditMachine(index, 'serie', e.target.value)}
                          className={`w-full px-2 py-1 text-sm border rounded font-mono ${!machine.serie.trim() ? 'border-red-400 bg-red-50' : ''}`}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 font-medium mb-1 block">Ano</label>
                        <input
                          type="number"
                          value={machine.ano || ''}
                          onChange={(e) => handleEditMachine(index, 'ano', parseInt(e.target.value) || null)}
                          className="w-full px-2 py-1 text-sm border rounded"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveMachine(index)}
                      className="ml-2 p-1 text-red-600 hover:bg-red-50 rounded"
                      title="Remover"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Tipo + flags */}
                  <div className="flex flex-wrap items-center gap-4 pt-2 border-t">
                    <div className="flex items-center gap-1">
                      {TIPOS.map(({ id, label, icon: Icon }) => (
                        <button
                          key={id}
                          type="button"
                          onClick={() => handleEditMachine(index, 'tipo', id)}
                          className={`flex items-center gap-1 px-2 py-1 text-xs rounded border transition-colors ${machine.tipo === id ? 'bg-black text-white border-black' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'}`}
                        >
                          <Icon className="w-3 h-3" />
                          {label}
                        </button>
                      ))}
                    </div>

                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={machine.prioridade}
                        onChange={(e) => handleEditMachine(index, 'prioridade', e.target.checked)}
                        className="w-4 h-4 rounded"
                      />
                      Prioritária
                    </label>

                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={machine.recondicao.bronze}
                        onChange={(e) => handleEditMachine(index, 'recondicao', { ...machine.recondicao, bronze: e.target.checked })}
                        className="w-4 h-4 rounded"
                      />
                      Recon Bronze
                    </label>

                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={machine.recondicao.prata}
                        onChange={(e) => handleEditMachine(index, 'recondicao', { ...machine.recondicao, prata: e.target.checked })}
                        className="w-4 h-4 rounded"
                      />
                      Recon Prata
                    </label>
                  </div>

                  {/* Tarefas */}
                  <div className="pt-2 border-t space-y-2">
                    <p className="text-xs font-semibold text-gray-700">Tarefas:</p>
                    <div className="grid grid-cols-2 gap-2">
                      {TAREFAS_PREDEFINIDAS.map((task, taskIdx) => (
                        <div key={taskIdx} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`machine-${index}-task-${taskIdx}`}
                            checked={machine.tarefas.some(t => t.texto === task)}
                            onChange={() => handleTogglePredefinedTask(index, task)}
                            className="w-4 h-4 rounded"
                          />
                          <label htmlFor={`machine-${index}-task-${taskIdx}`} className="text-xs cursor-pointer">
                            {task}
                          </label>
                        </div>
                      ))}
                    </div>

                    {/* Tarefas personalizadas */}
                    {machine.tarefas.filter(t => !TAREFAS_PREDEFINIDAS.includes(t.texto)).map((task, tIdx) => (
                      <div key={tIdx} className="flex items-center justify-between p-1.5 bg-gray-50 rounded">
                        <span className="text-xs">{task.texto}</span>
                        <button
                          onClick={() => handleRemoveCustomTask(index, task.texto)}
                          className="p-0.5 text-red-600 hover:bg-red-50 rounded"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}

                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customTaskInputs[index] || ''}
                        onChange={(e) => setCustomTaskInputs(prev => ({ ...prev, [index]: e.target.value }))}
                        placeholder="Adicionar tarefa personalizada..."
                        className="flex-1 px-2 py-1 text-xs border rounded"
                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddCustomTask(index))}
                      />
                      <Button onClick={() => handleAddCustomTask(index)} size="sm" variant="outline" disabled={!(customTaskInputs[index] || '').trim()}>
                        <Plus className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button variant="outline" onClick={handleClose} className="flex-1">
                Cancelar
              </Button>
              <Button
                onClick={handleCreateAll}
                disabled={isProcessing || machines.length === 0}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Criar Todas ({machines.length})
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}