/**
 * LaudoOCROverlay — Visual bounding box renderer for extracted signature fields
 *
 * Displays laudo image with bounding boxes highlighting detected:
 * - Field 11: RT signature/stamp location
 * - Field 12: Director signature/stamp + date location
 *
 * RDC 978 Art. 167 compliance: visual verification of OCR results before RT approval.
 */

import React, { useState, useRef, useEffect } from 'react';
// Types defined inline; these would normally be imported from shared types
type BoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type LaudoExtractedFields = {
  field10: { text: string; confidence?: 'high' | 'medium' | 'low' };
  field11: {
    detected: boolean;
    boundingBox?: BoundingBox | null;
    confidence?: 'high' | 'medium' | 'low';
    notes?: string;
  };
  field12: {
    detected: boolean;
    dateText?: string | null;
    boundingBox?: BoundingBox | null;
    confidence?: 'high' | 'medium' | 'low';
    notes?: string;
  };
  status?: 'completed' | 'partial' | 'failed';
  geminiLatencyMs?: number;
};

interface LaudoOCROverlayProps {
  // Laudo image URL (signed Cloud Storage URL or local file)
  imageUrl: string;
  imageAlt?: string;

  // Extracted fields with bounding boxes
  extraction: LaudoExtractedFields;

  // Optional: callback when user confirms overlay review
  onConfirm?: () => void;

  // Optional: callback to edit individual field
  onEditField?: (fieldNumber: 10 | 11 | 12) => void;

  // Optional: confidence indicator style (compact or detailed)
  confidenceMode?: 'compact' | 'detailed';

  // Optional: disable interaction (view-only mode)
  readOnly?: boolean;
}

/**
 * BoundingBoxCanvas — renders canvas overlay on image
 * Supports multiple boxes with color coding by confidence level
 */
const BoundingBoxCanvas: React.FC<{
  imageUrl: string;
  boxes: Array<{
    id: string;
    name: string;
    boundingBox: BoundingBox | null | undefined;
    confidence: 'high' | 'medium' | 'low' | undefined;
    detected: boolean;
  }>;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
}> = ({ imageUrl, boxes, canvasRef }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = new Image();
    img.onload = () => {
      setImageLoaded(true);
      if (imageRef.current && canvasRef.current) {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          canvas.width = img.width;
          canvas.height = img.height;

          // Draw image
          ctx.drawImage(img, 0, 0);

          // Draw bounding boxes
          boxes.forEach((box) => {
            if (!box.detected || !box.boundingBox) return;

            const x = (box.boundingBox.x / 100) * img.width;
            const y = (box.boundingBox.y / 100) * img.height;
            const width = (box.boundingBox.width / 100) * img.width;
            const height = (box.boundingBox.height / 100) * img.height;

            // Color by confidence
            const colors = {
              high: '#10b981', // emerald-500
              medium: '#f59e0b', // amber-500
              low: '#ef4444', // red-500
              undefined: '#6b7280', // gray-500
            };
            const color = colors[box.confidence || 'undefined'];

            // Draw box
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.strokeRect(x, y, width, height);

            // Draw label
            ctx.fillStyle = color;
            ctx.font = 'bold 14px sans-serif';
            ctx.fillText(box.name, x, y - 5);
          });
        }
      }
    };
    img.src = imageUrl;
  }, [imageUrl, boxes, canvasRef]);

  return (
    <div className="relative w-full bg-gray-100 rounded-lg overflow-hidden">
      <canvas
        ref={canvasRef as any}
        className="w-full h-auto block"
      />
      {!imageLoaded && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
          <p className="text-white text-sm">Carregando imagem...</p>
        </div>
      )}
    </div>
  );
};

/**
 * FieldConfidenceBadge — displays confidence level with color coding
 */
const FieldConfidenceBadge: React.FC<{
  confidence: 'high' | 'medium' | 'low' | undefined;
  detected: boolean;
  compact?: boolean;
}> = ({ confidence, detected, compact }) => {
  if (!detected) {
    return (
      <span className="inline-block px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded">
        Não detectado
      </span>
    );
  }

  const confidenceStyles = {
    high: 'bg-emerald-100 text-emerald-800',
    medium: 'bg-amber-100 text-amber-800',
    low: 'bg-red-100 text-red-800',
    undefined: 'bg-gray-100 text-gray-700',
  };

  const confidenceLabels = {
    high: 'Alta',
    medium: 'Média',
    low: 'Baixa',
    undefined: 'Desconhecida',
  };

  return (
    <span
      className={`inline-block px-2 py-1 text-xs rounded font-medium ${
        confidenceStyles[confidence || 'undefined']
      }`}
    >
      {compact ? confidence?.charAt(0).toUpperCase() : confidenceLabels[confidence || 'undefined']}
    </span>
  );
};

/**
 * FieldSummary — compact display of extracted field status
 */
const FieldSummary: React.FC<{
  fieldNumber: 10 | 11 | 12;
  fieldName: string;
  content: string | null;
  detected?: boolean;
  confidence?: 'high' | 'medium' | 'low';
  onEdit?: () => void;
  readOnly?: boolean;
}> = ({ fieldNumber, fieldName, content, detected, confidence, onEdit, readOnly }) => {
  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white dark:bg-gray-900 dark:border-gray-700">
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-semibold text-sm text-gray-900 dark:text-white">
          Campo {fieldNumber} — {fieldName}
        </h4>
        <FieldConfidenceBadge confidence={confidence} detected={detected ?? true} compact />
      </div>

      <div className="mb-3">
        {content ? (
          <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">{content}</p>
        ) : (
          <p className="text-sm text-gray-500 dark:text-gray-400 italic">
            Sem conteúdo extraído
          </p>
        )}
      </div>

      {!readOnly && (
        <button
          onClick={onEdit}
          className="text-xs text-blue-600 dark:text-blue-400 hover:underline font-medium"
        >
          Editar ou revisar
        </button>
      )}
    </div>
  );
};

/**
 * Main Overlay Component
 */
export const LaudoOCROverlay: React.FC<LaudoOCROverlayProps> = ({
  imageUrl,
  imageAlt = 'Laudo extractor overlay',
  extraction,
  onConfirm,
  onEditField,
  confidenceMode = 'detailed',
  readOnly = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [showFieldDetails, setShowFieldDetails] = useState(false);

  const boxes = [
    {
      id: 'field11',
      name: 'RT Assinatura',
      boundingBox: extraction.field11.boundingBox,
      confidence: extraction.field11.confidence,
      detected: extraction.field11.detected,
    },
    {
      id: 'field12',
      name: 'Diretor Assinatura',
      boundingBox: extraction.field12.boundingBox,
      confidence: extraction.field12.confidence,
      detected: extraction.field12.detected,
    },
  ];

  return (
    <div className="space-y-6 w-full max-w-4xl">
      {/* Bounding Box Visualization */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Visualização de Detecção
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          As caixas destacam os campos extraídos. Verde = alta confiança, Laranja = média, Vermelho = baixa.
        </p>
        <BoundingBoxCanvas imageUrl={imageUrl} boxes={boxes} canvasRef={canvasRef} />
      </div>

      {/* Field-by-Field Summary */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Resultados da Extração
          </h3>
          <button
            onClick={() => setShowFieldDetails(!showFieldDetails)}
            className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            {showFieldDetails ? 'Ocultar detalhes' : 'Mostrar detalhes'}
          </button>
        </div>

        {/* Field 10 — Observações */}
        <FieldSummary
          fieldNumber={10}
          fieldName="Observações"
          content={extraction.field10.text}
          confidence={extraction.field10.confidence}
          onEdit={() => onEditField?.(10)}
          readOnly={readOnly}
        />

        {/* Field 11 — RT Signature */}
        <FieldSummary
          fieldNumber={11}
          fieldName="Assinatura RT"
          content={
            extraction.field11.detected
              ? extraction.field11.notes || 'Assinatura detectada'
              : 'Não detectada'
          }
          detected={extraction.field11.detected}
          confidence={extraction.field11.confidence}
          onEdit={() => onEditField?.(11)}
          readOnly={readOnly}
        />

        {/* Field 12 — Director Signature + Date */}
        <FieldSummary
          fieldNumber={12}
          fieldName="Assinatura Diretor + Data"
          content={
            extraction.field12.detected
              ? `${extraction.field12.notes || 'Assinatura detectada'} — Data: ${extraction.field12.dateText || 'Não extraída'}`
              : 'Não detectada'
          }
          detected={extraction.field12.detected}
          confidence={extraction.field12.confidence}
          onEdit={() => onEditField?.(12)}
          readOnly={readOnly}
        />
      </div>

      {/* Overall Confidence Summary */}
      {extraction.status === 'completed' && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            <strong>Status da extração:</strong> Completada com{' '}
            <strong>
              {extraction.field11.detected && extraction.field12.detected
                ? 'assinaturas detectadas'
                : 'assinaturas não detectadas'}
            </strong>
            . Latência: {extraction.geminiLatencyMs}ms.
          </p>
        </div>
      )}

      {/* Confirmation Footer */}
      {!readOnly && onConfirm && (
        <div className="flex gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onConfirm}
            className="flex-1 px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-800 font-medium text-sm transition"
          >
            Confirmar Extração
          </button>
          <button
            onClick={() => setShowFieldDetails(!showFieldDetails)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 font-medium text-sm transition"
          >
            Revisar Novamente
          </button>
        </div>
      )}
    </div>
  );
};

export default LaudoOCROverlay;
