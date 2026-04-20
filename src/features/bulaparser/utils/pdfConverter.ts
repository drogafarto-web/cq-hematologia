import * as pdfjs from 'pdfjs-dist';

// Configuração do Worker do PDF.js para o ambiente Vite
// Usamos a versão legacy ou build dependendo da instalação
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url,
).toString();

export interface ConversionProgress {
  current: number;
  total: number;
  phase: 'loading' | 'rendering' | 'stitching';
}

/**
 * Converte um arquivo PDF em uma única imagem vertical (JPG).
 * Limita a conversão às primeiras N páginas para evitar excesso de memória.
 */
export async function convertPdfToImage(
  file: File,
  maxPages = 4,
  onProgress?: (p: ConversionProgress) => void,
): Promise<{ base64: string; mimeType: string }> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: arrayBuffer });

  onProgress?.({ current: 0, total: 0, phase: 'loading' });
  const pdf = await loadingTask.promise;

  const numPages = Math.min(pdf.numPages, maxPages);
  const canvases: HTMLCanvasElement[] = [];
  let totalHeight = 0;
  let maxWidth = 0;

  // 1. Renderizar cada página em um canvas individual
  for (let i = 1; i <= numPages; i++) {
    onProgress?.({ current: i, total: numPages, phase: 'rendering' });
    const page = await pdf.getPage(i);

    // Escala 2.0 para garantir que letras pequenas fiquem legíveis
    const viewport = page.getViewport({ scale: 2.0 });

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Falha ao criar contexto 2D do Canvas.');

    canvas.height = viewport.height;
    canvas.width = viewport.width;

    await page.render({
      canvasContext: context,
      viewport: viewport,
      canvas: canvas,
    }).promise;

    canvases.push(canvas);
    totalHeight += canvas.height;
    maxWidth = Math.max(maxWidth, canvas.width);
  }

  // 2. Costurar todos os canvases em uma única imagem vertical
  onProgress?.({ current: numPages, total: numPages, phase: 'stitching' });
  const finalCanvas = document.createElement('canvas');
  finalCanvas.width = maxWidth;
  finalCanvas.height = totalHeight;
  const finalCtx = finalCanvas.getContext('2d');

  if (!finalCtx) throw new Error('Falha ao criar canvas final.');

  // Preencher fundo branco (importante para JPG)
  finalCtx.fillStyle = '#ffffff';
  finalCtx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

  let currentY = 0;
  for (const canvas of canvases) {
    // Centralizar horizontalmente se as páginas tiverem larguras diferentes
    const xOffset = (maxWidth - canvas.width) / 2;
    finalCtx.drawImage(canvas, xOffset, currentY);
    currentY += canvas.height;
  }

  // 3. Exportar como JPG (mais leve que PNG)
  // Qualidade 0.85 é o ponto ideal entre peso e nitidez
  const dataUrl = finalCanvas.toDataURL('image/jpeg', 0.85);
  const base64 = dataUrl.split(',')[1];

  return {
    base64,
    mimeType: 'image/jpeg',
  };
}
