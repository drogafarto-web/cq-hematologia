import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Timestamp } from 'firebase/firestore';
import { ComunicacaoModal } from '../components/ComunicacaoModal';
import type { CriticosEscalacao } from '../types';

const makeEscalacao = (overrides: Partial<CriticosEscalacao> = {}): CriticosEscalacao => ({
  id: 'esc-123',
  labId: 'lab-1',
  laudoId: 'laudo-1',
  laudoVersion: 1,
  exameId: 'ex-1',
  analitoId: 'K',
  valorObtido: 6.8,
  thresholdId: 'th-1',
  severidade: 'alta',
  motivo: 'Acima de 6.5',
  pacienteId: 'p1',
  pacienteNome: 'Maria Silva',
  pacienteIdade: 60,
  pacienteSexo: 'F',
  medicoId: 'm1',
  medicoNome: 'Dr. Antônio',
  medicoTelefone: '+5511999999999',
  medicoEmail: 'doc@example.com',
  rtId: 'rt1',
  rtNome: 'RT Teste',
  rtEmail: 'rt@example.com',
  escalacoes: [],
  status: 'enviado',
  sla_status: 'em_prazo',
  sla_minutos_target: 60,
  criadoEm: Timestamp.fromMillis(Date.now() - 10 * 60 * 1000),
  criadoPor: 'rt1',
  atualizadoEm: Timestamp.fromMillis(Date.now()),
  atualizadoPor: 'rt1',
  deletadoEm: null,
  ...overrides,
});

describe('ComunicacaoModal', () => {
  // Real timers — the modal uses setInterval for the SLA tick; mocked
  // timers would block userEvent / waitFor under @testing-library.

  it('renders patient, exam value, and severity badge', () => {
    const escalacao = makeEscalacao();
    render(
      <ComunicacaoModal
        escalacao={escalacao}
        onClose={vi.fn()}
        onAcknowledge={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByText('Maria Silva')).toBeTruthy();
    expect(screen.getByText('6.8')).toBeTruthy();
    expect(screen.getByText('Dr. Antônio')).toBeTruthy();
    expect(screen.getByText('+5511999999999')).toBeTruthy();
    // Either "crítico alto" badge or alta severidade indicator should appear.
    expect(screen.getByText(/crítico alto/i)).toBeTruthy();
  });

  it('fires onAcknowledge with the escalacao id and trimmed notas', async () => {
    const onAcknowledge = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    const escalacao = makeEscalacao();
    render(
      <ComunicacaoModal escalacao={escalacao} onClose={onClose} onAcknowledge={onAcknowledge} />,
    );

    const textarea = screen.getByLabelText(/notas do reconhecimento/i) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: '  Médico contatado por telefone  ' } });

    const confirm = screen.getByRole('button', { name: /confirmar reconhecimento/i });
    fireEvent.click(confirm);

    await waitFor(() => {
      expect(onAcknowledge).toHaveBeenCalledTimes(1);
    });
    expect(onAcknowledge).toHaveBeenCalledWith({
      escalacaoId: 'esc-123',
      notas: 'Médico contatado por telefone',
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('omits notas field when textarea is empty', async () => {
    const onAcknowledge = vi.fn().mockResolvedValue(undefined);
    const escalacao = makeEscalacao();
    render(
      <ComunicacaoModal escalacao={escalacao} onClose={vi.fn()} onAcknowledge={onAcknowledge} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /confirmar reconhecimento/i }));

    await waitFor(() => expect(onAcknowledge).toHaveBeenCalled());
    expect(onAcknowledge).toHaveBeenCalledWith({
      escalacaoId: 'esc-123',
      notas: undefined,
    });
  });

  it('surfaces errors from onAcknowledge without closing the modal', async () => {
    const onAcknowledge = vi.fn().mockRejectedValue(new Error('callable indisponível'));
    const onClose = vi.fn();
    const escalacao = makeEscalacao();
    render(
      <ComunicacaoModal escalacao={escalacao} onClose={onClose} onAcknowledge={onAcknowledge} />,
    );

    fireEvent.click(screen.getByRole('button', { name: /confirmar reconhecimento/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/indisponível/);
    });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('hides the confirm button when escalacao is already reconhecida', () => {
    const escalacao = makeEscalacao({
      status: 'reconhecido',
      tempo_sla_ms: 5 * 60 * 1000,
    });
    render(<ComunicacaoModal escalacao={escalacao} onClose={vi.fn()} onAcknowledge={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /confirmar reconhecimento/i })).toBeNull();
    expect(screen.getByText(/já foi reconhecida/i)).toBeTruthy();
  });
});
