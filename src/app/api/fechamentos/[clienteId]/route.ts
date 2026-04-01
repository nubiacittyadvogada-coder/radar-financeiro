import { NextRequest } from 'next/server'
import { getUsuario, isBpo } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

async function verificarAcesso(u: any, clienteId: string) {
  if (u.tipo === 'cliente') return u.id === clienteId
  if (isBpo(u)) {
    const c = await prisma.cliente.findFirst({ where: { id: clienteId, bpoId: u.bpoId! } })
    return !!c
  }
  return false
}

export async function GET(req: NextRequest, { params }: { params: { clienteId: string } }) {
  const u = getUsuario(req)
  if (!u) return Response.json({ erro: 'Não autorizado' }, { status: 401 })

  const { clienteId } = params
  if (!await verificarAcesso(u, clienteId)) return Response.json({ erro: 'Acesso negado' }, { status: 403 })

  const { searchParams } = new URL(req.url)
  const path = req.url

  // Rota /historico
  if (path.includes('/historico')) {
    const ultimos = parseInt(searchParams.get('ultimos') || '6')
    const fechamentos = await prisma.fechamento.findMany({
      where: { clienteId },
      orderBy: [{ ano: 'desc' }, { mes: 'desc' }],
      take: ultimos,
      select: {
        id: true, mes: true, ano: true, receitaBruta: true, receitaLiquida: true,
        lucroOperacional: true, percLucroOp: true, lucroLiquido: true, percLucroLiq: true,
        saldoFinal: true, resultadoCaixa: true, retiradaSocios: true,
        totalDespesasAdm: true, margemContribuicao: true, percMargem: true, pdfUrl: true,
      },
    })
    return Response.json(fechamentos)
  }

  // Rota normal com mes/ano
  const mes = parseInt(searchParams.get('mes') || '')
  const ano = parseInt(searchParams.get('ano') || '')
  if (!mes || !ano) return Response.json({ erro: 'Parâmetros mes e ano são obrigatórios' }, { status: 400 })

  const fechamento = await prisma.fechamento.findUnique({
    where: { clienteId_mes_ano: { clienteId, mes, ano } },
  })
  if (!fechamento) return Response.json({ erro: 'Fechamento não encontrado' }, { status: 404 })

  const lancamentos = await prisma.lancamento.findMany({
    where: { clienteId, mes, ano, previsto: false },
    orderBy: { valor: 'desc' },
  })

  return Response.json({ fechamento, lancamentos })
}
