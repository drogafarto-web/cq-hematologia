'use client'

interface AuditLog {
  id: string
  action: string
  field: string | null
  oldValue: string | null
  newValue: string | null
  createdAt: string
  user: { name: string } | null
}

export function AuditHistory({ auditLogs }: { auditLogs: AuditLog[] }) {
  if (!auditLogs.length) return null

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-on-surface-variant mb-2">
        Audit History
      </h3>
      <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1">
        {auditLogs.map((log) => (
          <div key={log.id} className="text-xs text-on-surface-variant leading-relaxed">
            <span className="font-medium text-on-surface">{log.user?.name || 'Unknown'}</span>
            {' · '}
            {new Date(log.createdAt).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
            {log.field ? (
              <>
                {' '}
                <span className="font-medium">{log.field}</span>:
                {' '}
                <span className="line-through">{log.oldValue}</span>
                {' → '}
                <span>{log.newValue}</span>
              </>
            ) : (
              <>
                {' '}
                <span>{log.action}</span>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
