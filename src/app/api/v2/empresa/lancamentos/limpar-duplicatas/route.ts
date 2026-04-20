/**
 * POST /api/v2/empresa/lancamentos/limpar-duplicatas
 *
 * Detecta e remove lançamentos duplicados entre TODAS as origens:
 * manual, importacao, ofx_sicredi, asaas_webhook, especie
 *
 * Regra de prioridade (qual manter):
 *   manual > asaas_webhook > ofx_sicredi > importacao
 *
 * Dois lançamentos são considerados duplicatas quando:
 *   - Mesmo tipo (receita/despesa)
 *   - Valor ±5%
 *   - Data de competência ±7 dias
 *   - Mesmo mês/ano
 */

import { NextRequest } from 'next/server'
import { getUsuario, getEmpresaUserId } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'
import { calcularFechamentoEmpresa } from '@/server/lib/calcularFechamentoEmpresa'

// Prioridade: quanto menor o número, mais confiável — mantém o de menor valor
const PRIORIDADE: Record<string, number> = {
  manual:         0,
  asaas_webhook:  1,
  ofx_sicredi:    2,
  importacao:     3,
  especie:        4,
}

function prioridade(origem: string): number {
  return PRIORIDADE[origem] ?? 10
}

export async function POST(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: getEmpresaUserId(u) } })
    if (!conta) return Response.json({ erro: 'Conta não encontrada' }, { status: 404 })

    const body = await req.json().catch(() => ({}))
    const mesParam = body.mes ? Number(body.mes) : undefined
    const anoParam = body.ano ? Number(body.ano) : undefined

    // Busca todos os lançamentos do período (exceto espécie pendente de aprovação)
    const todos = await prisma.lancamentoEmpresa.findMany({
      where: {
        contaEmpresaId: conta.id,
        ...(mesParam && anoParam ? { mes: mesParam, ano: anoParam } : {}),
        NOT: { statusPg: 'pendente_aprovacao' },
      },
      orderBy: { criadoEm: 'asc' },
    })

    const idsParaDeletar: string[] = []
    const jaProcessados = new Set<string>() // ids já marcados como "vencedor" ou "perdedor"

    for (let i = 0; i < todos.length; i++) {
      const a = todos[i]
      if (jaProcessados.has(a.id)) continue
      if (!a.dataCompetencia) continue

      const valorA = Math.abs(Number(a.valor))
      const dataA = new Date(a.dataCompetencia).getTime()

      // Grupo de duplicatas: começa com o lançamento A
      const grupo: typeof todos = [a]

      for (let j = i + 1; j < todos.length; j++) {
        const b = todos[j]
        if (jaProcessados.has(b.id)) continue
        if (!b.dataCompetencia) continue
        // Mesmo tipo
        if (a.tipo !== b.tipo) continue
        // Mesmo mês/ano
        if (a.mes !== b.mes || a.ano !== b.ano) continue
        // Valor ±5%
        const valorB = Math.abs(Number(b.valor))
        const diffValor = Math.abs(valorA - valorB) / (Math.max(valorA, valorB) || 1)
        if (diffValor > 0.05) continue
        // Data ±7 dias
        const diffDias = Math.abs(dataA - new Date(b.dataCompetencia).getTime()) / 86400000
        if (diffDias > 7) continue

        grupo.push(b)
      }

      if (grupo.length === 1) continue // sem duplicata

      // Ordena pelo critério de prioridade: menor número = melhor
      grupo.sort((x, y) => {
        const pa = prioridade(x.origem)
        const pb = prioridade(y.origem)
        if (pa !== pb) return pa - pb
        // Mesma prioridade: prefere o mais antigo (primeiro criado)
        return new Date(x.criadoEm).getTime() - new Date(y.criadoEm).getTime()
      })

      const vencedor = grupo[0]
      const perdedores = grupo.slice(1)

      jaProcessados.add(vencedor.id)
      for (const p of perdedores) {
        jaProcessados.add(p.id)
        idsParaDeletar.push(p.id)
      }

      // Se o vencedor está pendente mas algum perdedor estava pago, marca vencedor como pago
      const algumPago = grupo.some(l => l.statusPg === 'pago' || l.statusPg === 'OK PG')
      if (algumPago && vencedor.statusPg !== 'pago') {
        await prisma.lancamentoEmpresa.update({
          where: { id: vencedor.id },
          data: { statusPg: 'pago', dataPagamento: new Date() },
        })
      }
    }

    // Deleta duplicatas
    let deletados = 0
    if (idsParaDeletar.length > 0) {
      const resultado = await prisma.lancamentoEmpresa.deleteMany({
        where: { id: { in: idsParaDeletar } },
      })
      deletados = resultado.count
    }

    // Recalcula fechamentos afetados
    const chavesAfetadas = new Set(
      idsParaDeletar
        .map(id => todos.find(l => l.id === id))
        .filter(Boolean)
        .map(l => `${l!.mes}-${l!.ano}`)
    )
    for (const chave of chavesAfetadas) {
      const [m, a] = chave.split('-').map(Number)
      await calcularFechamentoEmpresa(conta.id, m, a)
    }

    return Response.json({
      ok: true,
      deletados,
      mesesRecalculados: chavesAfetadas.size,
    })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
