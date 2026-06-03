'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Panel } from '@/components/ui/panel';
import { AuditHistory } from './audit-history';

const analytes = [
  { value: 'PT-INR', label: 'PT-INR' },
  { value: 'APTT', label: 'APTT' },
  { value: 'Fibrinogen', label: 'Fibrinogen' },
  { value: 'TT', label: 'TT' },
  { value: 'D-Dimer', label: 'D-Dimer' },
];

const lotFormSchema = z.object({
  lotNumber: z.string().min(1, 'Required'),
  analyte: z.string().min(1, 'Required'),
  level: z.coerce.number().refine((v) => v === 1 || v === 2, { message: 'Must be 1 or 2' }),
  reagentName: z.string().min(1, 'Required'),
  analyzerId: z.string().min(1, 'Required'),
  targetMean: z.coerce.number().positive('Must be positive'),
  sd: z.coerce.number().positive('Must be positive'),
  minAcceptance: z.coerce.number(),
  maxAcceptance: z.coerce.number(),
});

type LotFormValues = z.infer<typeof lotFormSchema>;

interface LotFormProps {
  open: boolean;
  onClose: () => void;
  lot: any | null;
  analyzers: any[];
  onSaved: (lot: any) => void;
}

export function LotForm({ open, onClose, lot, analyzers, onSaved }: LotFormProps) {
  const isEdit = !!lot;
  const [saving, setSaving] = useState(false);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<LotFormValues>({
    resolver: zodResolver(lotFormSchema),
    defaultValues: { level: 1 },
  });

  useEffect(() => {
    if (lot) {
      reset({
        lotNumber: lot.lotNumber,
        analyte: lot.analyte,
        level: lot.level,
        reagentName: lot.reagentName,
        analyzerId: lot.analyzerId,
        targetMean: Number(lot.targetMean),
        sd: Number(lot.sd),
        minAcceptance: Number(lot.minAcceptance),
        maxAcceptance: Number(lot.maxAcceptance),
      });
      fetch(`/api/lots/${lot.id}/audit`)
        .then((r) => r.json())
        .then((res) => {
          if (res.success) setAuditLogs(res.data);
        })
        .catch(() => {});
    } else {
      reset({
        lotNumber: '',
        analyte: '',
        level: 1,
        reagentName: '',
        analyzerId: '',
        targetMean: 0,
        sd: 0,
        minAcceptance: 0,
        maxAcceptance: 0,
      });
      setAuditLogs([]);
    }
  }, [lot, reset]);

  const onSubmit = async (data: LotFormValues) => {
    setSaving(true);
    try {
      const url = isEdit ? `/api/lots/${lot.id}` : '/api/lots';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (json.success) {
        onSaved(json.data);
      }
    } catch {
      // Error handled silently – user can add toast later
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async () => {
    if (!confirm('Archive this lot?')) return;
    try {
      const res = await fetch(`/api/lots/${lot.id}/archive`, { method: 'POST' });
      const json = await res.json();
      if (json.success) onSaved(json.data);
    } catch {
      // Error handled silently
    }
  };

  const analyzerOptions = analyzers.map((a: any) => ({
    value: a.id,
    label: `${a.analyzerId} – ${a.model}`,
  }));

  const footer = (
    <>
      <Button variant="outline" onClick={onClose}>
        Cancel
      </Button>
      <Button loading={saving} onClick={handleSubmit(onSubmit)}>
        Save
      </Button>
    </>
  );

  return (
    <Panel
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit Lot ${lot.lotNumber}` : 'New Lot'}
      footer={footer}
    >
      <div className="space-y-4">
        <Select
          label="Analyte"
          options={analytes}
          placeholder="Select analyte"
          error={errors.analyte?.message}
          {...register('analyte')}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Lot Number"
            error={errors.lotNumber?.message}
            placeholder="e.g. L2024-001"
            {...register('lotNumber')}
          />
          <Input
            label="Level"
            error={errors.level?.message}
            placeholder="1 or 2"
            {...register('level')}
          />
        </div>

        <Input
          label="Reagent Name"
          error={errors.reagentName?.message}
          {...register('reagentName')}
        />

        <Select
          label="Analyzer"
          options={analyzerOptions}
          placeholder="Select analyzer"
          error={errors.analyzerId?.message}
          {...register('analyzerId')}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Target Mean"
            className="font-mono"
            error={errors.targetMean?.message}
            {...register('targetMean')}
          />
          <Input label="SD" className="font-mono" error={errors.sd?.message} {...register('sd')} />
          <Input
            label="Min Acceptance"
            className="font-mono"
            error={errors.minAcceptance?.message}
            {...register('minAcceptance')}
          />
          <Input
            label="Max Acceptance"
            className="font-mono"
            error={errors.maxAcceptance?.message}
            {...register('maxAcceptance')}
          />
        </div>

        {isEdit && (
          <>
            <div className="border-t border-border pt-4">
              <Button variant="danger" onClick={handleArchive}>
                Archive this lot
              </Button>
            </div>
            {auditLogs.length > 0 && (
              <div className="border-t border-border pt-4">
                <AuditHistory auditLogs={auditLogs} />
              </div>
            )}
          </>
        )}
      </div>
    </Panel>
  );
}
