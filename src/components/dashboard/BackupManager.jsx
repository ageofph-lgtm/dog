import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Upload, AlertCircle, CheckCircle2, Loader2, HardDrive } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { freezeRunningTimersInHistorico, countRunningTimerMarkers } from "@/lib/timerHistorico";

export default function BackupManager({ isOpen, onClose, onSuccess }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleExport = async () => {
    setIsProcessing(true);
    setError(null);
    setSuccess(null);

    try {
      // Carregar todos os dados
      const machines = await base44.entities.FrotaACP.list();
      const pedidos = await base44.entities.Pedido.list();
      const customizations = await base44.entities.TechnicianCustomization.list();

      const backupData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        data: {
          machines,
          pedidos,
          customizations
        }
      };

      // Criar arquivo JSON e fazer download
      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-watcher-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setSuccess(`Backup criado com sucesso! ${machines.length} máquinas, ${pedidos.length} pedidos.`);
    } catch (error) {
      console.error("Erro ao criar backup:", error);
      setError("Erro ao criar backup. Tente novamente.");
    }

    setIsProcessing(false);
  };

  const handleImport = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!window.confirm(`⚠️ ATENÇÃO!\n\nO restore irá SUBSTITUIR todos os dados atuais.\n\nDeseja continuar?`)) {
      e.target.value = '';
      return;
    }

    setIsProcessing(true);
    setError(null);
    setSuccess(null);

    try {
      const text = await file.text();
      const backupData = JSON.parse(text);

      if (!backupData.version || !backupData.data) {
        throw new Error("Formato de backup inválido");
      }

      const { machines, pedidos, customizations } = backupData.data;
      const backupTimestamp = backupData.timestamp;

      // Apagar dados existentes
      const existingMachines = await base44.entities.FrotaACP.list();
      const existingPedidos = await base44.entities.Pedido.list();
      const existingCustomizations = await base44.entities.TechnicianCustomization.list();

      // Deletar em paralelo
      await Promise.all([
        ...existingMachines.map(m => base44.entities.FrotaACP.delete(m.id)),
        ...existingPedidos.map(p => base44.entities.Pedido.delete(p.id)),
        ...existingCustomizations.map(c => base44.entities.TechnicianCustomization.delete(c.id))
      ]);

      // Conta quantos timers iam vir activos no restore (para informar o utilizador)
      // e converte os markers `running` em `paused`, capando o tempo no momento do
      // backup. Sem isto, máquinas que estavam em curso no momento do backup
      // apareceriam a contar tempo desde o backup até agora.
      let frozenTimers = 0;
      const machinesData = machines.map(({ id, created_date, updated_date, created_by, ...rest }) => {
        const before = rest.historico;
        frozenTimers += countRunningTimerMarkers(before);
        return {
          ...rest,
          historico: freezeRunningTimersInHistorico(before, backupTimestamp),
        };
      });
      const pedidosData = pedidos.map(({ id, created_date, updated_date, created_by, ...rest }) => rest);
      const customizationsData = customizations.map(({ id, created_date, updated_date, created_by, ...rest }) => rest);

      await Promise.all([
        ...machinesData.map(m => base44.entities.FrotaACP.create(m)),
        ...pedidosData.map(p => base44.entities.Pedido.create(p)),
        ...customizationsData.map(c => base44.entities.TechnicianCustomization.create(c))
      ]);

      const frozenNote = frozenTimers > 0
        ? ` ${frozenTimers} timer(s) que estavam em curso no backup foram pausados (estado capturado em ${new Date(backupTimestamp).toLocaleString('pt-PT')}).`
        : '';
      setSuccess(`Restore concluído! ${machines.length} máquinas, ${pedidos.length} pedidos restaurados.${frozenNote}`);

      setTimeout(() => {
        onSuccess();
        onClose();
      }, 2000);

    } catch (error) {
      console.error("Erro ao restaurar backup:", error);
      setError(`Erro ao restaurar backup: ${error.message}`);
    }

    setIsProcessing(false);
    e.target.value = '';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <HardDrive className="w-6 h-6" />
            Backup & Restore
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {success && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-800">{success}</p>
            </div>
          )}

          <div className="space-y-3">
            {/* Export */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                <Download className="w-5 h-5" />
                Exportar Backup
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                Baixe todos os dados em um arquivo JSON
              </p>
              <Button
                onClick={handleExport}
                disabled={isProcessing}
                className="w-full bg-blue-600 hover:bg-blue-700"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Exportando...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-2" />
                    Exportar Dados
                  </>
                )}
              </Button>
            </div>

            {/* Import */}
            <div className="border rounded-lg p-4 bg-gray-50">
              <h3 className="font-semibold mb-2 flex items-center gap-2 text-red-600">
                <Upload className="w-5 h-5" />
                Restaurar Backup
              </h3>
              <p className="text-sm text-gray-600 mb-1">
                ⚠️ Substitui TODOS os dados atuais
              </p>
              <p className="text-xs text-red-600 mb-3 font-medium">
                Esta ação não pode ser desfeita!
              </p>
              <input
                type="file"
                accept=".json"
                onChange={handleImport}
                disabled={isProcessing}
                className="block w-full text-sm text-gray-600
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-semibold
                  file:bg-red-600 file:text-white
                  hover:file:bg-red-700
                  file:cursor-pointer
                  cursor-pointer
                  disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex-1"
              disabled={isProcessing}
            >
              Fechar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
