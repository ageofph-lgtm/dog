import React, { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Camera, Loader2, AlertCircle, Zap, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { base44 } from "@/api/base44Client";

export default function ImageUploadModal({ isOpen, onClose, onSuccess, purpose = 'create' }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const fileInputRef = useRef(null);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setError(null);
      setRetryCount(0);
    }
  };

  const processImage = async (isRetry = false) => {
    if (!selectedFile) return;

    if (!isRetry) {
      setRetryCount(0);
    }
    
    setIsProcessing(true);
    setError(null);

    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file: selectedFile });

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Estás a analisar a fotografia de uma placa de identificação (nameplate) de uma máquina industrial / empilhador (marcas como Toyota, BT, Linde, Still, etc.).

Extrai com máxima precisão:
1. "modelo" — o modelo da máquina (ex: FM-X17, 8FBE20T, RRE160H, EXV14, RX60-30). Normalmente identificado como "Model", "Type", "Typ" ou "Modelo".
2. "serie" — o NÚMERO DE SÉRIE completo. Normalmente identificado como "Serial No.", "Serial Number", "S/N", "Fabr. No.", "Nr." ou "Série".
3. "ano" — o ano de fabrico (ex: 2019). Identificado como "Year", "Baujahr" ou "Ano".

REGRAS CRÍTICAS PARA O NÚMERO DE SÉRIE:
- Transcreve CARÁCTER A CARÁCTER, exatamente como está gravado. Não corrijas, não normalizes, não removas zeros.
- Presta muita atenção a caracteres facilmente confundíveis: 0 (zero) vs O (letra), 1 vs I vs l, 5 vs S, 8 vs B, 2 vs Z. Usa o contexto: séries destas máquinas são maioritariamente dígitos com algumas letras maiúsculas (ex: 511903H00533, F20323H00856).
- Inclui TODOS os caracteres, incluindo letras no meio e zeros à esquerda. NÃO incluas espaços.
- Se um campo não for legível com confiança, devolve null nesse campo em vez de adivinhar.`,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            modelo: { type: ["string", "null"] },
            serie: { type: ["string", "null"] },
            ano: { type: ["number", "null"] }
          }
        }
      });

      if (result && (result.serie || result.modelo)) {
        if (purpose === 'search') {
          if (!result.serie) throw new Error("Não foi possível ler o número de série na imagem.");
          onSuccess({ serie: result.serie, imageUrl: file_url });
        } else {
          onSuccess({
            modelo: result.modelo || '',
            serie: result.serie || '',
            ano: result.ano || '',
            imageUrl: file_url
          });
        }
        handleClose();
      } else {
        throw new Error("Não foi possível extrair dados da imagem. Tente uma foto mais nítida e próxima da placa.");
      }
    } catch (error) {
      console.error("Erro ao processar imagem:", error);
      let errorMessage = "Não foi possível processar a imagem. Tente novamente ou use a entrada manual.";
      if (error.message?.includes('timeout') || error.message?.includes('DatabaseTimeout')) {
        errorMessage = "O processamento demorou muito. Tente com uma imagem menor ou use a entrada manual.";
      }
      setError(errorMessage);
    }

    setIsProcessing(false);
  };

  const handleRetry = () => {
    if (retryCount < 3) {
      setRetryCount(prev => prev + 1);
      processImage(true);
    } else {
        setError("O processamento falhou várias vezes. Por favor, utilize a entrada manual.")
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    setError(null);
    setIsProcessing(false);
    setRetryCount(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="w-[95vw] max-w-sm mx-auto p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-lg font-semibold">
            <Camera className="w-6 h-6" />
            {purpose === 'search' ? 'Pesquisar com Imagem' : 'Adicionar com Imagem'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
              {retryCount < 3 && (
                <Button variant="link" onClick={handleRetry} className="h-auto p-0 mt-2 text-red-700">
                  <RefreshCw className="w-3 h-3 mr-1" /> Tentar Novamente
                </Button>
              )}
            </Alert>
          )}

          {!selectedFile ? (
            <div 
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-blue-500 hover:bg-blue-50/50 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Camera className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 mb-2 font-medium">
                Tire uma foto da placa de identificação
              </p>
              <p className="text-sm text-gray-500">
                O sistema tentará ler os dados automaticamente.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                capture="environment"
              />
            </div>
          ) : (
            <div className="space-y-4">
              <div className="border rounded-lg overflow-hidden shadow-inner">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-auto max-h-64 object-contain"
                />
              </div>
              
              <Button 
                onClick={() => processImage(false)} 
                disabled={isProcessing}
                className="w-full h-12 bg-green-600 hover:bg-green-700 text-lg"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Zap className="w-5 h-5 mr-2" />
                    Processar Imagem
                  </>
                )}
              </Button>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={handleClose} className="flex-1 h-12">
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}