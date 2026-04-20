import { describe, it, expect, vi, afterEach } from 'vitest';
import { firestoreErrorMessage } from '../../../src/shared/utils/firebaseErrors';

// ─── firestoreErrorMessage ────────────────────────────────────────────────────

describe('firestoreErrorMessage', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ── Non-Error throws ────────────────────────────────────────────────────────

  it('retorna fallback quando throw é uma string', () => {
    expect(firestoreErrorMessage('something broke')).toBe('Erro inesperado. Tente novamente.');
  });

  it('retorna fallback quando throw é null', () => {
    expect(firestoreErrorMessage(null)).toBe('Erro inesperado. Tente novamente.');
  });

  it('retorna fallback quando throw é undefined', () => {
    expect(firestoreErrorMessage(undefined)).toBe('Erro inesperado. Tente novamente.');
  });

  it('retorna fallback quando throw é um número', () => {
    expect(firestoreErrorMessage(404)).toBe('Erro inesperado. Tente novamente.');
  });

  it('retorna fallback quando throw é um objeto sem prototype Error', () => {
    expect(firestoreErrorMessage({ code: 'permission-denied', message: 'nope' })).toBe(
      'Erro inesperado. Tente novamente.',
    );
  });

  // ── Plain JS Error (no code) ────────────────────────────────────────────────

  it('retorna fallback para TypeError sem code (ex: Timestamp.fromDate(null))', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const err = new TypeError('Cannot read properties of null (reading getTime)');
    expect(firestoreErrorMessage(err)).toBe('Erro inesperado. Tente novamente.');
  });

  it('loga no console.error quando é um Error sem code', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    firestoreErrorMessage(new Error('plain error'));
    expect(spy).toHaveBeenCalledOnce();
  });

  // ── FirestoreError — código sem prefixo ─────────────────────────────────────

  it('mapeia permission-denied', () => {
    const err = Object.assign(new Error('denied'), { code: 'permission-denied' });
    expect(firestoreErrorMessage(err)).toBe('Sem permissão para realizar esta operação.');
  });

  it('mapeia not-found', () => {
    const err = Object.assign(new Error('not found'), { code: 'not-found' });
    expect(firestoreErrorMessage(err)).toBe('Documento não encontrado.');
  });

  it('mapeia unauthenticated', () => {
    const err = Object.assign(new Error('auth'), { code: 'unauthenticated' });
    expect(firestoreErrorMessage(err)).toBe('Sessão expirada. Faça login novamente.');
  });

  it('mapeia unavailable', () => {
    const err = Object.assign(new Error('down'), { code: 'unavailable' });
    expect(firestoreErrorMessage(err)).toBe(
      'Serviço temporariamente indisponível. Verifique sua conexão.',
    );
  });

  it('mapeia invalid-argument (novo mapeamento adicionado na correção)', () => {
    const err = Object.assign(new Error('bad data'), { code: 'invalid-argument' });
    expect(firestoreErrorMessage(err)).toBe(
      'Dados inválidos. Verifique os valores e tente novamente.',
    );
  });

  it('retorna Erro Firebase: <code> para código desconhecido', () => {
    const err = Object.assign(new Error('unknown'), { code: 'unknown-code' });
    expect(firestoreErrorMessage(err)).toBe('Erro Firebase: unknown-code');
  });

  // ── FirebaseError — código com prefixo "firestore/" ─────────────────────────
  // Firebase v10 base class lança código prefixado: "firestore/permission-denied"

  it('mapeia firestore/permission-denied (prefixo Firebase base class)', () => {
    const err = Object.assign(new Error('denied'), { code: 'firestore/permission-denied' });
    expect(firestoreErrorMessage(err)).toBe('Sem permissão para realizar esta operação.');
  });

  it('mapeia firestore/invalid-argument (prefixo Firebase base class)', () => {
    const err = Object.assign(new Error('bad data'), { code: 'firestore/invalid-argument' });
    expect(firestoreErrorMessage(err)).toBe(
      'Dados inválidos. Verifique os valores e tente novamente.',
    );
  });

  it('mapeia firestore/unauthenticated (prefixo Firebase base class)', () => {
    const err = Object.assign(new Error('auth'), { code: 'firestore/unauthenticated' });
    expect(firestoreErrorMessage(err)).toBe('Sessão expirada. Faça login novamente.');
  });

  it('retorna Erro Firebase: <code> para prefixo desconhecido', () => {
    const err = Object.assign(new Error('storage error'), { code: 'storage/object-not-found' });
    expect(firestoreErrorMessage(err)).toBe('Erro Firebase: object-not-found');
  });

  it('lida com código vazio string (sem prefixo)', () => {
    const err = Object.assign(new Error('empty code'), { code: '' });
    // código falsy → trata como Error sem code
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(firestoreErrorMessage(err)).toBe('Erro inesperado. Tente novamente.');
  });
});
