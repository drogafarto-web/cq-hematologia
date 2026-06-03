function toDate(v: Date | string | null | undefined): Date | null {
  if (v === null || v === undefined) return null
  return new Date(v)
}

export function deriveAnalyzerStatus(analyzer: {
  status: string;
  calibrations: { nextDueAt: Date | string | null | undefined }[];
  maintenances: { nextScheduledAt: Date | string | null | undefined }[];
}): string {
  const now = new Date()

  if (analyzer.status === 'OUT_OF_SERVICE') {
    return 'OUT_OF_SERVICE'
  }

  const calsWithDates = analyzer.calibrations
    .map(c => ({ due: toDate(c.nextDueAt) }))
    .filter((c): c is { due: Date } => c.due !== null)
    .sort((a, b) => b.due.getTime() - a.due.getTime())

  const latestCal = calsWithDates[0] ?? null

  if (!latestCal) {
    return 'CAL_OVERDUE'
  }

  const calDueAt = latestCal.due
  const calDaysUntil = Math.ceil((calDueAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  if (calDueAt < now) {
    return 'CAL_OVERDUE'
  }

  if (calDaysUntil <= 30) {
    return 'CAL_DUE_SOON'
  }

  const maintsWithDates = analyzer.maintenances
    .map(m => ({ due: toDate(m.nextScheduledAt) }))
    .filter((m): m is { due: Date } => m.due !== null)
    .sort((a, b) => b.due.getTime() - a.due.getTime())

  const latestMaint = maintsWithDates[0] ?? null

  if (latestMaint) {
    const maintDueAt = latestMaint.due
    const maintDaysUntil = Math.ceil((maintDueAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    if (maintDueAt < now) {
      return 'MAINTENANCE_OVERDUE'
    }

    if (maintDaysUntil <= 30) {
      return 'MAINTENANCE_DUE'
    }
  }

  return 'OPERATIONAL'
}
