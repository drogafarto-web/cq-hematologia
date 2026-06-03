import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 })

  const { id } = params
  const body = await req.json()

  const existing = await prisma.lot.findUnique({ where: { id } })
  if (!existing) return NextResponse.json({ success: false, error: { code: 'NOT_FOUND' } }, { status: 404 })

  const updatableFields = ['targetMean', 'sd', 'minAcceptance', 'maxAcceptance', 'reagentName', 'analyzerId'] as const
  const auditEntries: { field: string; oldValue: string; newValue: string }[] = []

  const data: Record<string, unknown> = {}
  for (const field of updatableFields) {
    if (body[field] !== undefined) {
      const oldVal = String(existing[field as keyof typeof existing] ?? '')
      const newVal = String(body[field])
      if (oldVal !== newVal) {
        auditEntries.push({ field, oldValue: oldVal, newValue: newVal })
        data[field] = body[field]
      }
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ success: true, data: existing })
  }

  const lot = await prisma.lot.update({ where: { id }, data })

  if (auditEntries.length > 0) {
    await prisma.auditLog.createMany({
      data: auditEntries.map(e => ({
        entityType: 'Lot',
        entityId: id,
        action: 'UPDATE',
        field: e.field,
        oldValue: e.oldValue,
        newValue: e.newValue,
        userId: session.user.id,
      })),
    })
  }

  return NextResponse.json({ success: true, data: lot })
}