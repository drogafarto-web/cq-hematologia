import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

const updateSchema = z.object({
  nome: z.string().min(1).optional(),
  lote: z.string().min(1).optional(),
  protrombinaMin: z.number().optional(),
  protrombinaMax: z.number().optional(),
  rniMin: z.number().optional(),
  rniMax: z.number().optional(),
  ttppaMin: z.number().optional(),
  ttppaMax: z.number().optional(),
  ativo: z.boolean().optional(),
})

export async function PUT(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 })
  }

  const body = await req.json()
  const parsed = updateSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: parsed.error.message } }, { status: 400 })
  }

  try {
    const controle = await prisma.controle.update({
      where: { id: params.id },
      data: parsed.data,
    })
    return NextResponse.json({ success: true, data: controle })
  } catch (error) {
    console.error('Erro ao atualizar controle:', error)
    return NextResponse.json({ success: false, error: { code: 'DB_ERROR', message: 'Falha ao atualizar controle' } }, { status: 500 })
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 })
  }

  try {
    await prisma.controle.delete({ where: { id: params.id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Erro ao deletar controle:', error)
    return NextResponse.json({ success: false, error: { code: 'DB_ERROR', message: 'Falha ao deletar controle' } }, { status: 500 })
  }
}
