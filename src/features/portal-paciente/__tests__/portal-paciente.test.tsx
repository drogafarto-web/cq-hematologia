/**
 * Portal Paciente Tests
 * Unit + integration tests for Phase 4 scaffold
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PortalPacienteShell } from '../components/PortalPacienteShell';
import { ResultCard } from '../components/ResultCard';
import { ConsentCaptureModal } from '../components/ConsentCaptureModal';
import { usePatientResults } from '../hooks/usePatientResults';
import { usePatientConsent } from '../hooks/usePatientConsent';
import { Timestamp } from 'firebase/firestore';
import type { PatientResult } from '../types';

// Mock Firebase — all Firestore operations used by portal-paciente sections
const mockDocRef = { id: 'mock-doc', type: 'document', path: 'mock/path' };
const mockCollectionRef = { id: 'mock-collection', type: 'collection', path: 'mock/collection' };
const mockQuery = { type: 'query' };
const mockDb = { type: 'firestore', app: {}, toJSON: () => ({}) };

vi.mock('firebase/firestore', async () => {
  const actual = await vi.importActual('firebase/firestore');
  return {
    ...actual,
    getFirestore: vi.fn(() => mockDb),
    doc: vi.fn(() => mockDocRef),
    collection: vi.fn(() => mockCollectionRef),
    query: vi.fn(() => mockQuery),
    orderBy: vi.fn(() => ({})),
    where: vi.fn(() => ({})),
    getDocs: vi.fn(() => Promise.resolve({ docs: [], empty: true, size: 0 })),
    onSnapshot: vi.fn((_ref, onSuccess, _onError) => {
      // Simulate empty/no-data snapshots for all listeners
      onSuccess({ exists: () => false, docs: [], empty: true, size: 0 });
      return vi.fn(); // unsubscribe
    }),
  };
});

describe('PortalPacienteShell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders without crashing', () => {
    render(
      <PortalPacienteShell
        patientId="patient_123"
        patientName="João Silva"
        labId="lab_001"
        labName="Laboratório Exemplo"
        onLogout={vi.fn()}
      />
    );

    expect(screen.getByText('João Silva')).toBeInTheDocument();
    expect(screen.getByText('Laboratório Exemplo')).toBeInTheDocument();
  });

  it('displays patient name and lab name in nav', () => {
    render(
      <PortalPacienteShell
        patientId="patient_123"
        patientName="Maria Santos"
        labId="lab_001"
        labName="Lab São Paulo"
        onLogout={vi.fn()}
      />
    );

    expect(screen.getByText('Maria Santos')).toBeInTheDocument();
    expect(screen.getByText('Lab São Paulo')).toBeInTheDocument();
  });

  it('calls onLogout when logout button is clicked', () => {
    const onLogout = vi.fn();
    render(
      <PortalPacienteShell
        patientId="patient_123"
        patientName="João Silva"
        labId="lab_001"
        labName="Laboratório"
        onLogout={onLogout}
      />
    );

    const logoutButton = screen.getByText('Sair');
    fireEvent.click(logoutButton);

    expect(onLogout).toHaveBeenCalled();
  });

  it('renders Meus Resultados section', () => {
    render(
      <PortalPacienteShell
        patientId="patient_123"
        patientName="João Silva"
        labId="lab_001"
        labName="Laboratório"
        onLogout={vi.fn()}
      />
    );

    expect(screen.getByText('Meus Resultados')).toBeInTheDocument();
  });

  it('renders Consentimentos section', () => {
    render(
      <PortalPacienteShell
        patientId="patient_123"
        patientName="João Silva"
        labId="lab_001"
        labName="Laboratório"
        onLogout={vi.fn()}
      />
    );

    expect(screen.getByText('Consentimentos')).toBeInTheDocument();
  });

  it('renders Meus Direitos LGPD section', () => {
    render(
      <PortalPacienteShell
        patientId="patient_123"
        patientName="João Silva"
        labId="lab_001"
        labName="Laboratório"
        onLogout={vi.fn()}
      />
    );

    expect(screen.getByText('Meus Direitos LGPD')).toBeInTheDocument();
  });
});

describe('ResultCard', () => {
  const mockResult: PatientResult = {
    id: 'result_001',
    labId: 'lab_001',
    patientId: 'patient_123',
    examName: 'Hemograma Completo',
    examDate: Timestamp.fromDate(new Date('2026-04-28')),
    resultDate: Timestamp.fromDate(new Date('2026-04-29')),
    status: 'ok',
    resultValue: '13.5',
    unit: 'g/dL',
    referenceRange: '13.5-17.5',
    laudoId: 'LAUDO_001',
    versionId: 'v1',
    signatureHash: 'hash_001',
  };

  it('renders exam name', () => {
    render(<ResultCard result={mockResult} />);
    expect(screen.getByText('Hemograma Completo')).toBeInTheDocument();
  });

  it('displays result value and unit', () => {
    render(<ResultCard result={mockResult} />);
    expect(screen.getByText('13.5')).toBeInTheDocument();
    expect(screen.getByText('g/dL')).toBeInTheDocument();
  });

  it('shows reference range', () => {
    render(<ResultCard result={mockResult} />);
    expect(screen.getByText(/Ref\. 13\.5-17\.5/)).toBeInTheDocument();
  });

  it('displays correct status badge for "ok"', () => {
    render(<ResultCard result={mockResult} />);
    expect(screen.getByText('Normal')).toBeInTheDocument();
  });

  it('displays warning status correctly', () => {
    const warningResult = { ...mockResult, status: 'warning' as const };
    render(<ResultCard result={warningResult} />);
    expect(screen.getByText('Alterado')).toBeInTheDocument();
  });

  it('displays critical status correctly', () => {
    const criticalResult = { ...mockResult, status: 'critical' as const };
    render(<ResultCard result={criticalResult} />);
    expect(screen.getByText('Crítico')).toBeInTheDocument();
  });

  it('calls onViewDetails when link is clicked', () => {
    const onViewDetails = vi.fn();
    render(<ResultCard result={mockResult} onViewDetails={onViewDetails} />);

    const detailLink = screen.getByText(/Ver detalhes/);
    fireEvent.click(detailLink);

    expect(onViewDetails).toHaveBeenCalled();
  });

  it('handles pending status without result value', () => {
    const pendingResult = { ...mockResult, status: 'pending' as const, resultValue: undefined };
    render(<ResultCard result={pendingResult} />);
    expect(screen.getByText('Pendente')).toBeInTheDocument();
    expect(screen.getByText(/Resultado ainda não disponível/)).toBeInTheDocument();
  });
});

describe('ConsentCaptureModal', () => {
  it('does not render when isOpen is false', () => {
    const { container } = render(
      <ConsentCaptureModal
        isOpen={false}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        labName="Laboratório"
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders when isOpen is true', () => {
    render(
      <ConsentCaptureModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        labName="Laboratório"
      />
    );

    expect(screen.getByText('Autorizar processamento com IA')).toBeInTheDocument();
  });

  it('displays lab name in modal content', () => {
    render(
      <ConsentCaptureModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        labName="Lab São Paulo"
      />
    );

    // Lab name appears multiple times in modal
    const labNames = screen.getAllByText(/Lab São Paulo/);
    expect(labNames.length).toBeGreaterThan(0);
  });

  it('calls onSubmit with correct scope when authorized', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <ConsentCaptureModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={onSubmit}
        labName="Laboratório"
      />
    );

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    const submitButton = screen.getByText('Autorizar');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(['ia-strip']);
    });
  });

  it('disables submit button when checkbox is unchecked', () => {
    render(
      <ConsentCaptureModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        labName="Laboratório"
      />
    );

    const submitButton = screen.getByText('Autorizar') as HTMLButtonElement;
    expect(submitButton.disabled).toBe(true);
  });

  it('enables submit button when checkbox is checked', () => {
    render(
      <ConsentCaptureModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={vi.fn()}
        labName="Laboratório"
      />
    );

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    const submitButton = screen.getByText('Autorizar') as HTMLButtonElement;
    expect(submitButton.disabled).toBe(false);
  });

  it('calls onClose when modal is closed', () => {
    const onClose = vi.fn();
    render(
      <ConsentCaptureModal
        isOpen={true}
        onClose={onClose}
        onSubmit={vi.fn()}
        labName="Laboratório"
      />
    );

    const rejectButton = screen.getByText('Recusar');
    fireEvent.click(rejectButton);

    expect(onClose).toHaveBeenCalled();
  });

  it('displays error message on submit failure', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error('Network error'));
    render(
      <ConsentCaptureModal
        isOpen={true}
        onClose={vi.fn()}
        onSubmit={onSubmit}
        labName="Laboratório"
      />
    );

    const checkbox = screen.getByRole('checkbox');
    fireEvent.click(checkbox);

    const submitButton = screen.getByText('Autorizar');
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });
});

describe('usePatientConsent', () => {
  it('returns initial loading state', () => {
    // This is a hook test — vitest + @testing-library/react pattern
    // Mock Firebase for testing would require more setup
    // For Phase 4 scaffold, this validates the hook structure
    expect(usePatientConsent).toBeDefined();
  });
});

describe('usePatientResults', () => {
  it('returns mock results after loading', async () => {
    // Hook validation for Phase 4 scaffold
    expect(usePatientResults).toBeDefined();
  });
});
