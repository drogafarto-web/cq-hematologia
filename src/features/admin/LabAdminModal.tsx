import { useState, useRef } from 'react';
import type { Lab } from '../../types';
import type { CreateLabPayload } from './services/labAdminService';

export type LabFormPayload = Omit<CreateLabPayload, 'logoFile'>;

interface Props {
  lab?: Lab;
  onConfirm: (payload: LabFormPayload, logoFile?: File) => Promise<void>;
  onClose: () => void;
}

// ─── Masks ────────────────────────────────────────────────────────────────────

function maskCNPJ(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function maskCEP(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 8);
  return d.length <= 5 ? d : `${d.slice(0, 5)}-${d.slice(5)}`;
}

function maskPhone(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LabAdminModal({ lab, onConfirm, onClose }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const isEdit = Boolean(lab);

  /* Logo */
  const [logoFile, setLogoFile] = useState<File | undefined>();
  const [preview, setPreview] = useState<string | null>(lab?.logoUrl ?? null);

  /* Identification */
  const [name, setName] = useState(lab?.name ?? '');
  const [legalName, setLegalName] = useState(lab?.legalName ?? '');
  const [cnpj, setCnpj] = useState(lab?.cnpj ?? '');

  /* Contact */
  const [email, setEmail] = useState(lab?.contact?.email ?? '');
  const [phone, setPhone] = useState(lab?.contact?.phone ?? '');

  /* Address */
  const [zipCode, setZipCode] = useState(lab?.address?.zipCode ?? '');
  const [street, setStreet] = useState(lab?.address?.street ?? '');
  const [number, setNumber] = useState(lab?.address?.number ?? '');
  const [complement, setComplement] = useState(lab?.address?.complement ?? '');
  const [neighborhood, setNeighborhood] = useState(lab?.address?.neighborhood ?? '');
  const [city, setCity] = useState(lab?.address?.city ?? '');
  const [uf, setUf] = useState(lab?.address?.state ?? '');

  /* Compliance */
  const [cnesCode, setCnesCode] = useState(lab?.compliance?.cnesCode ?? '');
  const [anvisaLicense, setAnvisaLicense] = useState(lab?.compliance?.anvisaLicense ?? '');
  const [iso15189, setIso15189] = useState(lab?.compliance?.iso15189 ?? false);
  const [accreditationBody, setAccreditationBody] = useState(
    lab?.compliance?.accreditationBody ?? '',
  );

  /* Backup */
  const [backupEmail, setBackupEmail] = useState(lab?.backup?.email ?? '');
  const [backupEnabled, setBackupEnabled] = useState(lab?.backup?.enabled ?? false);
  const [stalenessThreshold, setStalenessThreshold] = useState(
    String(lab?.backup?.stalenessThresholdDays ?? 3),
  );

  /* UI state */
  const [saving, setSaving] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── Handlers ────────────────────────────────────────────────────────────────

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError('Logo deve ter no máximo 2 MB.');
      return;
    }
    setLogoFile(file);
    setPreview(URL.createObjectURL(file));
    setError(null);
  }

  async function handleCepBlur() {
    const digits = zipCode.replace(/\D/g, '');
    if (digits.length !== 8) return;
    setCepLoading(true);
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = (await res.json()) as Record<string, string>;
      if (!data['erro']) {
        setStreet(data['logradouro'] || '');
        setNeighborhood(data['bairro'] || '');
        setCity(data['localidade'] || '');
        setUf(data['uf'] || '');
      }
    } catch {
      /* swallow */
    } finally {
      setCepLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Nome do laboratório é obrigatório.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: LabFormPayload = {
        name: trimmedName,
        legalName: legalName.trim() || undefined,
        cnpj: cnpj.trim() || undefined,
        contact: {
          email: email.trim(),
          phone: phone.trim(),
        },
        address: {
          zipCode: zipCode.trim(),
          street: street.trim(),
          number: number.trim(),
          complement: complement.trim() || undefined,
          neighborhood: neighborhood.trim(),
          city: city.trim(),
          state: uf.trim().toUpperCase(),
        },
        compliance: {
          cnesCode: cnesCode.trim() || undefined,
          anvisaLicense: anvisaLicense.trim() || undefined,
          iso15189,
          accreditationBody: accreditationBody.trim() || undefined,
        },
        backup: {
          email: backupEmail.trim() || null,
          enabled: backupEnabled,
          stalenessThresholdDays: Math.max(1, Math.min(30, parseInt(stalenessThreshold, 10) || 3)),
        },
      };
      await onConfirm(payload, logoFile);
      onClose();
    } catch {
      setError('Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  // ── Styles ──────────────────────────────────────────────────────────────────

  const inputCls =
    'w-full bg-white/[0.05] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white ' +
    'placeholder-white/20 focus:outline-none focus:border-white/25 focus:bg-white/[0.07] transition-all';

  const labelCls = 'block text-[11px] font-medium text-white/40 uppercase tracking-wider mb-1.5';

  const sectionTitleCls = 'text-[11px] font-semibold text-white/25 uppercase tracking-widest';

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-xl bg-[#141414] border border-white/10 rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* ── Header ── */}
        <div className="px-6 py-5 border-b border-white/[0.07] shrink-0">
          <h2 className="text-base font-semibold text-white/90">
            {isEdit ? 'Editar laboratório' : 'Novo laboratório'}
          </h2>
          <p className="text-xs text-white/35 mt-0.5">Dados cadastrais do tenant</p>
        </div>

        {/* ── Scrollable form body + sticky footer ── */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-7">
            {/* ── Identificação ── */}
            <section className="space-y-4">
              <p className={sectionTitleCls}>Identificação</p>

              {/* Logo + Nome */}
              <div className="flex items-start gap-4">
                <div
                  className="w-16 h-16 rounded-xl border-2 border-dashed border-white/15 flex items-center justify-center cursor-pointer hover:border-white/30 transition-colors overflow-hidden bg-white/[0.03] shrink-0"
                  onClick={() => fileRef.current?.click()}
                  title="Clique para selecionar logo"
                >
                  {preview ? (
                    <img src={preview} alt="Logo" className="w-full h-full object-cover" />
                  ) : (
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      className="text-white/20"
                    >
                      <path
                        d="M4 16l4-4 4 4 4-6 4 6"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <rect
                        x="3"
                        y="3"
                        width="18"
                        height="18"
                        rx="3"
                        stroke="currentColor"
                        strokeWidth="1.5"
                      />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0 space-y-3">
                  <div>
                    <label className={labelCls}>Nome do laboratório *</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ex: Lab Central"
                      autoFocus
                      className={inputCls}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="text-xs text-white/35 hover:text-white/60 transition-colors"
                  >
                    {preview ? 'Trocar logo' : '+ Adicionar logo'}
                  </button>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFile}
                  aria-label="Selecionar logo do laboratório"
                  className="hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Razão Social</label>
                  <input
                    type="text"
                    value={legalName}
                    onChange={(e) => setLegalName(e.target.value)}
                    placeholder="Nome jurídico completo"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>CNPJ</label>
                  <input
                    type="text"
                    value={cnpj}
                    onChange={(e) => setCnpj(maskCNPJ(e.target.value))}
                    placeholder="00.000.000/0000-00"
                    inputMode="numeric"
                    className={inputCls}
                  />
                </div>
              </div>
            </section>

            {/* ── Contato ── */}
            <section className="space-y-4">
              <p className={sectionTitleCls}>Contato</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>E-mail</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="lab@exemplo.com"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>WhatsApp / Telefone</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(maskPhone(e.target.value))}
                    placeholder="(00) 00000-0000"
                    inputMode="tel"
                    className={inputCls}
                  />
                </div>
              </div>
            </section>

            {/* ── Endereço ── */}
            <section className="space-y-3">
              <p className={sectionTitleCls}>Endereço</p>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>CEP</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={zipCode}
                      onChange={(e) => setZipCode(maskCEP(e.target.value))}
                      onBlur={handleCepBlur}
                      placeholder="00000-000"
                      inputMode="numeric"
                      className={inputCls}
                    />
                    {cepLoading && (
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
                    )}
                  </div>
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Logradouro</label>
                  <input
                    type="text"
                    value={street}
                    onChange={(e) => setStreet(e.target.value)}
                    placeholder="Rua, Av., Praça…"
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className={labelCls}>Número</label>
                  <input
                    type="text"
                    value={number}
                    onChange={(e) => setNumber(e.target.value)}
                    placeholder="123"
                    className={inputCls}
                  />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Complemento</label>
                  <input
                    type="text"
                    value={complement}
                    onChange={(e) => setComplement(e.target.value)}
                    placeholder="Sala, andar (opcional)"
                    className={inputCls}
                  />
                </div>
              </div>

              <div className="grid grid-cols-5 gap-3">
                <div className="col-span-2">
                  <label className={labelCls}>Bairro</label>
                  <input
                    type="text"
                    value={neighborhood}
                    onChange={(e) => setNeighborhood(e.target.value)}
                    placeholder="Bairro"
                    className={inputCls}
                  />
                </div>
                <div className="col-span-2">
                  <label className={labelCls}>Cidade</label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="Cidade"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>UF</label>
                  <input
                    type="text"
                    value={uf}
                    onChange={(e) => setUf(e.target.value.toUpperCase().slice(0, 2))}
                    placeholder="SP"
                    maxLength={2}
                    className={inputCls}
                  />
                </div>
              </div>
            </section>

            {/* ── Conformidade ── */}
            <section className="space-y-3">
              <p className={sectionTitleCls}>Conformidade</p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Código CNES</label>
                  <input
                    type="text"
                    value={cnesCode}
                    onChange={(e) => setCnesCode(e.target.value)}
                    placeholder="7 dígitos"
                    inputMode="numeric"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Licença ANVISA</label>
                  <input
                    type="text"
                    value={anvisaLicense}
                    onChange={(e) => setAnvisaLicense(e.target.value)}
                    placeholder="N° da autorização"
                    className={inputCls}
                  />
                </div>
              </div>

              <div>
                <label className={labelCls}>Organismo acreditador</label>
                <input
                  type="text"
                  value={accreditationBody}
                  onChange={(e) => setAccreditationBody(e.target.value)}
                  placeholder="Ex: DICQ, ONA, PALC, SBPC/ML"
                  className={inputCls}
                />
              </div>

              <button
                type="button"
                onClick={() => setIso15189((v) => !v)}
                className="flex items-center gap-3 group"
              >
                <span
                  className={
                    'w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0 ' +
                    (iso15189
                      ? 'bg-white border-white'
                      : 'border-white/20 bg-transparent group-hover:border-white/35')
                  }
                >
                  {iso15189 && (
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                      <path
                        d="M2 6l3 3 5-5"
                        stroke="#000"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
                <span className="text-sm text-white/70 select-none">Acreditado ISO 15189</span>
              </button>
            </section>

            {/* ── Backup ── */}
            <section className="space-y-4">
              <p className={sectionTitleCls}>Backup por E-mail</p>

              <div>
                <label className={labelCls}>E-mail de destino</label>
                <input
                  type="email"
                  value={backupEmail}
                  onChange={(e) => setBackupEmail(e.target.value)}
                  placeholder="backup@seulab.com.br"
                  className={inputCls}
                />
                <p className="mt-1.5 text-[11px] text-white/25">
                  Relatório PDF dos últimos 30 dias enviado diariamente. Inclui alertas de
                  inatividade por módulo.
                </p>
              </div>

              <div>
                <label className={labelCls}>Alerta de inatividade após (dias)</label>
                <input
                  type="number"
                  min={1}
                  max={30}
                  value={stalenessThreshold}
                  onChange={(e) => setStalenessThreshold(e.target.value)}
                  className={inputCls + ' w-32'}
                />
                <p className="mt-1.5 text-[11px] text-white/25">
                  Sem registros por este período → alerta no email. Crítico após 7 dias.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setBackupEnabled((v) => !v)}
                className="flex items-center gap-3 group"
              >
                <span
                  className={
                    'w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0 ' +
                    (backupEnabled
                      ? 'bg-white border-white'
                      : 'border-white/20 bg-transparent group-hover:border-white/35')
                  }
                >
                  {backupEnabled && (
                    <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                      <path
                        d="M2 6l3 3 5-5"
                        stroke="#000"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
                <span className="text-sm text-white/70 select-none">Backup automático ativado</span>
              </button>
            </section>

            {error && <p className="text-xs text-red-400">{error}</p>}
          </div>

          {/* ── Footer ── */}
          <div className="px-6 py-4 border-t border-white/[0.07] shrink-0 flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-white/60 hover:text-white/90 hover:bg-white/[0.05] transition-all"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="flex-1 py-2.5 rounded-xl bg-white text-black text-sm font-medium hover:bg-white/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {saving ? 'Salvando…' : isEdit ? 'Salvar alterações' : 'Criar laboratório'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
