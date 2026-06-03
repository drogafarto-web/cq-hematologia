/**
 * useBrowserHistorySync — integra o roteamento interno (zustand `currentView`)
 * com a History API do browser.
 *
 * Sem isso, a seta "voltar" do navegador faz o usuário SAIR do app (e
 * potencialmente perder login/state). Com isso, voltar/avançar do navegador
 * navega pelo histórico de views internas como qualquer SPA bem comportada.
 *
 * Estratégia:
 *   - mount: `replaceState` registra a view atual no histórico
 *   - mudança de view: `pushState` empilha nova entrada
 *   - `popstate` (clique em voltar/avançar): aplica `state.view` no store
 *     sem disparar novo `pushState` (ref guard previne loop)
 *
 * Não usa URL hash/path — propositalmente. Mexer na URL exigiria roteamento
 * deep-link real (entrada por URL → view), o que é trabalho separado e
 * potencialmente quebra fluxos de login/auth. Aqui só queremos que voltar
 * volte. URLs reais ficam pra depois.
 */

import { useEffect, useRef } from 'react';
import { useAppStore } from '../../store/useAppStore';
import type { View } from '../../types';

const VALID_VIEWS: ReadonlySet<View> = new Set<View>([
  'hub',
  'analyzer',
  'bulaparser',
  'superadmin',
  'reports',
  'ciq-imuno',
  'coagulacao',
  'uroanalise',
  'insumos',
  'lab-settings',
  'educacao-continuada',
  'controle-temperatura',
  'sgq-documentos',
  'rastreabilidade',
  'equipamentos',
  'risks',
  'kpis',
  'lab-apoio',
  'pre-pos-analitico',
  'vhs',
]);

function isView(v: unknown): v is View {
  return typeof v === 'string' && VALID_VIEWS.has(v as View);
}

export function useBrowserHistorySync(): void {
  const currentView = useAppStore((s) => s.currentView);
  const setCurrentView = useAppStore((s) => s.setCurrentView);

  // Flag levantada DURANTE handler de popstate, lida no efeito de pushState
  // pra suprimir o push (senão criaria entrada duplicada e quebraria voltar).
  const fromPopState = useRef(false);

  // Mount: substitui state inicial pelo currentView corrente.
  // Sem replaceState, o primeiro pushState empilha por cima de uma entry
  // sem `state.view` — e voltar tenta ler `e.state.view` que vem null,
  // fallback pra 'hub'. Funciona, mas a primeira "voltada" pode parecer
  // estranha. replaceState alinha o histórico desde o início.
  useEffect(() => {
    window.history.replaceState({ view: currentView }, '');
    const onPop = (e: PopStateEvent) => {
      const next = isView(e.state?.view) ? e.state.view : 'hub';
      fromPopState.current = true;
      setCurrentView(next);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
    // Intencionalmente sem deps — listener montado uma vez no boot do app.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Toda mudança de view (exceto a vinda de popstate) empilha nova entry.
  useEffect(() => {
    if (fromPopState.current) {
      fromPopState.current = false;
      return;
    }
    window.history.pushState({ view: currentView }, '');
  }, [currentView]);
}
