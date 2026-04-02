import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

// GET /api/v2/pessoal/resumo?mes=X&ano=Y
// Retorna totais do mês + breakdown por categoria
export async function GET(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaPessoal.findUnique({ where: { usuarioId: u.id } })
    if (!conta) return Response.json({ totalReceitas: 0, totalDespesas: 0, saldo: 0, porCategoria: [] })

    const { searchParams } = new URL(req.url)
    const mes = Number(searchParams.get('mes') || new Date().getMonth() + 1)
    const ano = Number(searchParams.get('ano') || new Date().getFullYear())

    const transacoes = await prisma.transacaoPessoal.findMany({
      where: { contaPessoalId: conta.id, mes, ano },
      include: { categoria: true },
    })

    // Separar transações de cartão das demais (para não duplicar)
    const transacoesNormais = transacoes.filter((t) => t.origem !== 'cartao')
    const transacoesCartao = transacoes.filter((t) => t.origem === 'cartao')

    const totalReceitas = transacoesNormais
      .filter((t) => t.tipo === 'receita')
      .reduce((s, t) => s + Number(t.valor), 0)

    const totalDespesas = transacoesNormais
      .filter((t) => t.tipo === 'despesa')
      .reduce((s, t) => s + Number(t.valor), 0)

    // Por categoria (apenas transações normais) — chave inclui tipo para não misturar receita/despesa
    const catMap = new Map<string, { nome: string; tipo: string; total: number; cor?: string | null }>()
    for (const t of transacoesNormais) {
      const catKey = `${t.categoriaId || 'sem-categoria'}-${t.tipo}`
      const catNome = t.categoria?.nome || 'Sem categoria'
      if (!catMap.has(catKey)) {
        catMap.set(catKey, { nome: catNome, tipo: t.tipo, total: 0, cor: t.categoria?.cor })
      }
      catMap.get(catKey)!.total += Number(t.valor)
    }

    // Breakdown do cartão por categoria
    const cartaoMap = new Map<string, { nome: string; total: number }>()
    for (const t of transacoesCartao) {
      const catNome = t.categoria?.nome || 'Outros'
      if (!cartaoMap.has(catNome)) cartaoMap.set(catNome, { nome: catNome, total: 0 })
      cartaoMap.get(catNome)!.total += Number(t.valor)
    }
    const totalCartao = transacoesCartao.reduce((s, t) => s + Number(t.valor), 0)
    const cartaoNome = transacoesCartao[0]?.cartao || null

    // Orçamentos do mês
    const orcamentos = await prisma.orcamentoPessoal.findMany({
      where: { contaPessoalId: conta.id, mes, ano },
      include: { categoria: true },
    })

    // Alertas: compara mês atual com média dos 3 meses anteriores
    const mesesAnteriores: { mes: number; ano: number }[] = []
    for (let i = 1; i <= 3; i++) {
      let m2 = mes - i; let a2 = ano
      if (m2 <= 0) { m2 += 12; a2 -= 1 }
      mesesAnteriores.push({ mes: m2, ano: a2 })
    }
    const txAnteriores = await prisma.transacaoPessoal.findMany({
      where: {
        contaPessoalId: conta.id,
        origem: { not: 'cartao' },
        tipo: 'despesa',
        OR: mesesAnteriores,
      },
      include: { categoria: true },
    })
    // Média por categoria dos meses anteriores
    const catAnteriorMap = new Map<string, { total: number; meses: Set<string> }>()
    for (const t of txAnteriores) {
      const catNome = t.categoria?.nome || 'Sem categoria'
      if (!catAnteriorMap.has(catNome)) catAnteriorMap.set(catNome, { total: 0, meses: new Set() })
      const c = catAnteriorMap.get(catNome)!
      c.total += Number(t.valor)
      c.meses.add(`${t.ano}-${t.mes}`)
    }

    const alertas: { categoria: string; atual: number; media: number; variacao: number; tipo: 'acima' | 'abaixo' }[] = []
    for (const [id, cat] of catMap) {
      if (cat.tipo !== 'despesa') continue
      const ant = catAnteriorMap.get(cat.nome)
      if (!ant || ant.meses.size === 0) continue
      const media = ant.total / ant.meses.size
      if (media < 50) continue // ignora categorias muito pequenas
      const variacao = ((cat.total - media) / media) * 100
      if (Math.abs(variacao) >= 25) {
        alertas.push({ categoria: cat.nome, atual: cat.total, media, variacao, tipo: variacao > 0 ? 'acima' : 'abaixo' })
      }
    }
    alertas.sort((a, b) => Math.abs(b.variacao) - Math.abs(a.variacao))

    return Response.json({
      totalReceitas,
      totalDespesas,
      saldo: totalReceitas - totalDespesas,
      porCategoria: Array.from(catMap.entries()).map(([id, c]) => ({ id, ...c })),
      orcamentos,
      alertas,
      cartao: totalCartao > 0 ? {
        nome: cartaoNome,
        total: totalCartao,
        porCategoria: Array.from(cartaoMap.values()).sort((a, b) => b.total - a.total),
      } : null,
    })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
