/**
 * GET /api/v2/empresa/especie/pendentes
 * Retorna lançamentos de espécie aguardando aprovação.
 */

import { NextRequest } from 'next/server'
import { getUsuario, getEmpresaUserId } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

export async function GET(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: getEmpresaUserId(u) } })
    if (!conta) return Response.json({ erro: 'Conta não encontrada' }, { status: 404 })

    const pendentes = await prisma.lancamentoEmpresa.findMany({
      where: { contaEmpresaId: conta.id, origem: 'especie', statusPg: 'pendente_aprovacao' },
      orderBy: { criadoEm: 'desc' },
      select: {
        id: true,
        favorecido: true,
        descricao: true,
        valor: true,
        dataCompetencia: true,
        criadoEm: true,
      },
    })

    // Retorna também o link público de espécie para exibir no dashboard
    return Response.json({
      pendentes,
      linkEspecie: conta.tokenEspecie
        ? `${process.env.NEXT_PUBLIC_URL || ''}/lancamento-especie/${conta.tokenEspecie}`
        : null,
    })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
