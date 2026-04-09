/**
 * POST /api/v2/empresa/lancamentos/limpar-duplicatas
 * Remove lançamentos importados (PDF/xlsx) que têm correspondente manual
 * com mesmo valor (±5%) e data próxima (±7 dias) no mesmo mês/ano.
 * Mantém o manual e deleta o importado.
 */

import { NextRequest } from 'next/server'
import { getUsuario, getEmpresaUserId } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'
import { calcularFechamentoEmpresa } from '@/server/lib/calcularFechamentoEmpresa'

export async function POST(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: getEmpresaUserId(u) } })
    if (!conta) return Response.json({ erro: 'Conta não encontrada' }, { status: 404 })

    const body = await req.json().catch(() => ({}))
    const mes = body.mes ? Number(body.mes) : undefined
    const ano = body.ano ? Number(body.ano) : undefined

    // Busca todos os lançamentos (manuais e importados)
    const todos = await prisma.lancamentoEmpresa.findMany({
      where: {
        contaEmpresaId: conta.id,
        ...(mes && ano ? { mes, ano } : {}),
      },
      orderBy: { criadoEm: 'asc' },
    })

    const manuais = todos.filter(l => l.origem === 'manual')
    const importados = todos.filter(l => l.origem === 'importacao')

    const idsParaDeletar: string[] = []
    const idsManualMarcadoPago: string[] = []

    for (const imp of importados) {
      if (!imp.dataCompetencia) continue
      const valorImp = Number(imp.valor)

      const match = manuais.find(m => {
        if (!m.dataCompetencia) return false
        // Mesmo tipo (receita/despesa)
        const mesmoTipo = (imp.tipo === 'receita') === (m.tipo === 'receita')
        if (!mesmoTipo) return false
        // Valor próximo ±5%
        const diffValor = Math.abs(Number(m.valor) - valorImp) / (valorImp || 1)
        if (diffValor > 0.05) return false
        // Data próxima ±7 dias
        const diffDias = Math.abs(new Date(m.dataCompetencia!).getTime() - new Date(imp.dataCompetencia!).getTime()) / 86400000
        return diffDias <= 7
      })

      if (match) {
        idsParaDeletar.push(imp.id)
        // Se o manual estava pendente, marca como pago
        if (match.statusPg !== 'pago' && !idsManualMarcadoPago.includes(match.id)) {
          idsManualMarcadoPago.push(match.id)
        }
      }
    }

    // Deleta importados duplicados
    if (idsParaDeletar.length > 0) {
      await prisma.lancamentoEmpresa.deleteMany({
        where: { id: { in: idsParaDeletar } },
      })
    }

    // Marca manuais correspondentes como pago
    if (idsManualMarcadoPago.length > 0) {
      await prisma.lancamentoEmpresa.updateMany({
        where: { id: { in: idsManualMarcadoPago } },
        data: { statusPg: 'pago', dataPagamento: new Date() },
      })
    }

    // Recalcula fechamentos afetados
    const mesesAfetados = new Set(
      idsParaDeletar.map(id => {
        const l = importados.find(i => i.id === id)
        return l ? `${l.mes}-${l.ano}` : null
      }).filter(Boolean) as string[]
    )
    for (const chave of mesesAfetados) {
      const [m, a] = chave.split('-').map(Number)
      await calcularFechamentoEmpresa(conta.id, m, a)
    }

    return Response.json({
      ok: true,
      deletados: idsParaDeletar.length,
      marcadosPago: idsManualMarcadoPago.length,
    })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
