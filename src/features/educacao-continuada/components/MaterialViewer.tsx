import type { MaterialDidatico } from '../types/EducacaoContinuada';

export interface MaterialViewerProps {
  material: MaterialDidatico;
  /** Altura do embed (ignorada para link). Default 480px. */
  height?: number;
}

/**
 * Renderiza MaterialDidatico inline:
 *  - `pdf` / `apresentacao`: <iframe src={url}> (browsers modernos renderizam PDF nativamente)
 *  - `video`: iframe embed se URL bater com whitelist YouTube/Vimeo; senão link
 *  - `link`: anchor externo
 *
 * Whitelist de vídeo evita embed arbitrário de domínios não confiáveis.
 * URLs fora da whitelist viram clickable link "abrir em nova aba".
 */
export function MaterialViewer({ material, height = 480 }: MaterialViewerProps) {
  if (material.tipo === 'link') {
    return (
      <a
        href={material.url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900 px-3 py-2 text-sm font-medium text-emerald-300 hover:border-emerald-500/40 hover:bg-emerald-500/10"
      >
        {material.titulo}
        <span aria-hidden>↗</span>
      </a>
    );
  }

  if (material.tipo === 'video') {
    const embedUrl = toVideoEmbedUrl(material.url);
    if (embedUrl) {
      return (
        <iframe
          src={embedUrl}
          title={material.titulo}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="w-full rounded-md border border-slate-800 bg-slate-900"
          style={{ height }}
        />
      );
    }
    return (
      <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
        URL de vídeo fora da whitelist (YouTube/Vimeo).{' '}
        <a
          href={material.url}
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-amber-100"
        >
          Abrir em nova aba
        </a>
      </div>
    );
  }

  // pdf | apresentacao — embed nativo do browser
  return (
    <iframe
      src={material.url}
      title={material.titulo}
      className="w-full rounded-md border border-slate-800 bg-slate-900"
      style={{ height }}
    />
  );
}

// ─── Whitelist de vídeo ──────────────────────────────────────────────────────

const YOUTUBE_RE = /^(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/;
const VIMEO_RE = /^(?:https?:\/\/)?(?:www\.)?vimeo\.com\/(\d+)/;

function toVideoEmbedUrl(url: string): string | null {
  const yt = url.match(YOUTUBE_RE);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = url.match(VIMEO_RE);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return null;
}
