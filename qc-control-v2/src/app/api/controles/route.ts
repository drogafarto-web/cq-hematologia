import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/db'
import { z } from 'zod'

export async function GET() {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 })
  }

  try {
    const controles = await prisma.controle.findMany({
      orderBy: { nome: 'asc' },
    })
    return NextResponse.json({ success: true, data: controles })
  } catch (error) {
    console.error('Erro ao buscar controles:', error)
    return NextResponse.json({ success: false, error: { code: 'DB_ERROR', message: 'Falha ao buscar controles' } }, { status: 500 })
  }
}

const createSchema = z.object({
  nome: z.string().min(1),
  lote: z.string().min(1),
  protrombinaMin: z.number(),
  protrombinaMax: z.number(),
  rniMin: z.number(),
  rniMax: z.number(),
  ttppaMin: z.number(),
  ttppaMax: z.number(),
  ativo: z.boolean().default(true),
})

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 })
  }

  const body = await req.json()
  const parsed = createSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ success: false, error: { code: 'VALIDATION', message: parsed.error.message } }, { status: 400 })
  }

  try {
    const controle = await prisma.controle.create({
      data: parsed.data,
    })
    return NextResponse.json({ success: true, data: controle })
  } catch (error) {
    console.error('Erro ao criar controle:', error)
    return NextResponse.json({ success: false, error: { code: 'DB_ERROR', message: 'Falha ao criar controle' } }, { status: 500 })
  }
}
