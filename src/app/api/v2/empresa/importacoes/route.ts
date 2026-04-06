import { NextRequest } from 'next/server'
import { getUsuario, getEmpresaUserId } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

// GET /api/v2/empresa/importacoes
export async function GET(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: getEmpresaUserId(u) } })
    if (!conta) return Response.json({ erro: 'Conta empresa não encontrada' }, { status: 404 })

    const importacoes = await prisma.importacaoEmpresa.findMany({
      where: { contaEmpresaId: conta.id },
      orderBy: { criadoEm: 'desc' },
      include: {
        _count: { select: { lancamentos: true } },
      },
    })

    return Response.json(importacoes)
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
