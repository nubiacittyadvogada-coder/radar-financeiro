import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

export async function GET(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaPessoal.findUnique({ where: { usuarioId: u.id } })
    if (!conta) return Response.json({ erro: 'Conta não encontrada' }, { status: 404 })

    const importacoes = await prisma.importacaoPessoal.findMany({
      where: { contaPessoalId: conta.id },
      orderBy: { criadoEm: 'desc' },
      include: { _count: { select: { transacoes: true } } },
    })

    return Response.json(importacoes)
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
