import { NextRequest } from 'next/server'
import { getUsuario, getEmpresaUserId } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'
import { executarReguaCobranca } from '@/lib/agenteCobranca'

export const maxDuration = 60

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: getEmpresaUserId(u) } })
    if (!conta) return Response.json({ erro: 'Conta empresa não encontrada' }, { status: 404 })

    // Executa cobrança para todas as pendências do devedor
    const cobrancas = await prisma.cobrancaDevedor.findMany({
      where: { clienteDevedorId: params.id, status: 'pendente' },
    })

    const resultados = []
    for (const c of cobrancas) {
      const { executarCobrancaDevedor } = await import('@/lib/agenteCobranca')
      const r = await executarCobrancaDevedor(c.id)
      resultados.push({ cobrancaId: c.id, ...r })
    }

    return Response.json({ ok: true, resultados })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
