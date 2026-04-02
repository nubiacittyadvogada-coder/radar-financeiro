import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

const NECESSIDADES = ['Moradia', 'Supermercado', 'Restaurante', 'Combustível', 'Saúde', 'Transporte', 'Educação', 'Serviços / Assinaturas', 'Impostos pessoais', 'Empréstimos']
const DESEJOS = ['Lazer', 'Vestuário', 'Loja / Compras', 'Outros']

// GET /api/v2/pessoal/saude
export async function GET(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaPessoal.findUnique({ where: { usuarioId: u.id } })
    if (!conta) return Response.json({ semDados: true })

    // Últimos 6 meses para garantir 3 com dados
    const hoje = new Date()
    const mesesBusca: { mes: number; ano: number }[] = []
    for (let i = 0; i < 6; i++) {
      let mes = hoje.getMonth() + 1 - i
      let ano = hoje.getFullYear()
      if (mes <= 0) { mes += 12; ano -= 1 }
      mesesBusca.push({ mes, ano })
    }

    const transacoes = await prisma.transacaoPessoal.findMany({
      where: {
        contaPessoalId: conta.id,
        OR: mesesBusca.map(({ mes, ano }) => ({ mes, ano })),
      },
      include: { categoria: true },
    })

    // Agrupar por mês/ano
    type MesData = {
      mes: number; ano: number
      receitas: number; despesas: number; cartao: number
      catBank: Map<string, number>
      catCartao: Map<string, number>
    }
    const mesesMap = new Map<string, MesData>()

    for (const t of transacoes) {
      const key = `${t.ano}-${t.mes}`
      if (!mesesMap.has(key)) {
        mesesMap.set(key, {
          mes: t.mes, ano: t.ano,
          receitas: 0, despesas: 0, cartao: 0,
          catBank: new Map(), catCartao: new Map(),
        })
      }
      const m = mesesMap.get(key)!
      const catNome = t.categoria?.nome || 'Outros'

      if (t.origem === 'cartao') {
        m.cartao += Number(t.valor)
        m.catCartao.set(catNome, (m.catCartao.get(catNome) || 0) + Number(t.valor))
      } else if (t.tipo === 'receita') {
        m.receitas += Number(t.valor)
      } else {
        m.despesas += Number(t.valor)
        m.catBank.set(catNome, (m.catBank.get(catNome) || 0) + Number(t.valor))
      }
    }

    // 3 meses mais recentes com receitas
    const mesesOrdenados = Array.from(mesesMap.values())
      .filter((m) => m.receitas > 0)
      .sort((a, b) => a.ano !== b.ano ? b.ano - a.ano : b.mes - a.mes)
      .slice(0, 3)

    if (mesesOrdenados.length === 0) return Response.json({ semDados: true })

    const n = mesesOrdenados.length
    const avg = (fn: (m: MesData) => number) => mesesOrdenados.reduce((s, m) => s + fn(m), 0) / n

    const mediaReceitas = avg((m) => m.receitas)
    const mediaDespesas = avg((m) => m.despesas)
    const mediaCartao = avg((m) => m.cartao)
    const temCartao = mediaCartao > 0

    // Médias por categoria
    const catBankMedia = new Map<string, number>()
    const catCartaoMedia = new Map<string, number>()
    for (const m of mesesOrdenados) {
      for (const [cat, val] of m.catBank) catBankMedia.set(cat, (catBankMedia.get(cat) || 0) + val / n)
      for (const [cat, val] of m.catCartao) catCartaoMedia.set(cat, (catCartaoMedia.get(cat) || 0) + val / n)
    }

    // 50/30/20: se tem cartão, exclui "Outros" do extrato (geralmente = PAGTO FATURA)
    let necessidades = 0, desejos = 0
    for (const [cat, val] of catBankMedia) {
      if (temCartao && cat === 'Outros') continue // ignora Outros do extrato quando CC existe
      if (NECESSIDADES.includes(cat)) necessidades += val
      else if (cat !== 'Investimentos') desejos += val // Investimentos não entra em desejos
    }
    for (const [cat, val] of catCartaoMedia) {
      if (NECESSIDADES.includes(cat)) necessidades += val
      else desejos += val
    }

    // Poupança real (caixa) = receitas - saídas reais do extrato
    const poupancaReal = mediaReceitas - mediaDespesas
    const taxaPoupanca = mediaReceitas > 0 ? (poupancaReal / mediaReceitas) * 100 : 0
    const cartaoPctReceita = mediaReceitas > 0 ? (mediaCartao / mediaReceitas) * 100 : 0

    // % em relação à receita (para regra 50/30/20)
    const pctNecessidades = mediaReceitas > 0 ? (necessidades / mediaReceitas) * 100 : 0
    const pctDesejos = mediaReceitas > 0 ? (desejos / mediaReceitas) * 100 : 0
    const pctPoupanca = taxaPoupanca < 0 ? 0 : taxaPoupanca

    // Reserva de emergência
    const posicoes = await prisma.investimentoPessoal.findMany({ where: { contaPessoalId: conta.id } })
    const saldoInvestimentos = posicoes.reduce((s, p) => s + Number(p.saldoAtual), 0)
    const mediaSaidas = mediaDespesas // saída real de caixa por mês
    const mesesReserva = mediaSaidas > 0 ? saldoInvestimentos / mediaSaidas : 0

    // SCORE (100 pts)
    // Taxa de poupança: 30 pts
    let ptsPoupanca = 0
    if (taxaPoupanca >= 20) ptsPoupanca = 30
    else if (taxaPoupanca >= 15) ptsPoupanca = 25
    else if (taxaPoupanca >= 10) ptsPoupanca = 18
    else if (taxaPoupanca >= 5) ptsPoupanca = 10
    else if (taxaPoupanca > 0) ptsPoupanca = 4

    // Regra 50/30/20: 30 pts (distância do ideal)
    const distNec = Math.abs(pctNecessidades - 50)
    const distDes = Math.abs(pctDesejos - 30)
    const distPoup = Math.abs(pctPoupanca - 20)
    const distTotal = distNec + distDes + distPoup
    let pts5020 = 0
    if (distTotal <= 8) pts5020 = 30
    else if (distTotal <= 18) pts5020 = 22
    else if (distTotal <= 30) pts5020 = 14
    else if (distTotal <= 45) pts5020 = 6

    // Reserva de emergência: 25 pts
    let ptsReserva = 0
    if (mesesReserva >= 6) ptsReserva = 25
    else if (mesesReserva >= 4) ptsReserva = 18
    else if (mesesReserva >= 2) ptsReserva = 10
    else if (mesesReserva >= 1) ptsReserva = 4

    // Cartão % renda: 15 pts
    let ptsCartao = 15
    if (temCartao) {
      if (cartaoPctReceita > 60) ptsCartao = 0
      else if (cartaoPctReceita > 50) ptsCartao = 3
      else if (cartaoPctReceita > 40) ptsCartao = 6
      else if (cartaoPctReceita > 30) ptsCartao = 10
      else if (cartaoPctReceita > 20) ptsCartao = 13
    }

    const score = Math.round(ptsPoupanca + pts5020 + ptsReserva + ptsCartao)

    // Dicas ordenadas por impacto
    const dicas: { titulo: string; detalhe: string; urgencia: 'alta' | 'media' | 'baixa' }[] = []

    if (taxaPoupanca < 5) {
      dicas.push({ titulo: 'Taxa de poupança crítica', detalhe: `Você está guardando apenas ${taxaPoupanca.toFixed(0)}% da renda. Tente reduzir gastos variáveis (lazer, vestuário) para chegar a pelo menos 10%.`, urgencia: 'alta' })
    } else if (taxaPoupanca < 15) {
      dicas.push({ titulo: 'Aumente sua poupança', detalhe: `Taxa atual: ${taxaPoupanca.toFixed(0)}%. O ideal é 20%. Cada R$${(mediaReceitas * 0.01).toFixed(0)} a mais poupado por mês faz diferença ao longo do ano.`, urgencia: 'media' })
    }

    if (mesesReserva < 3) {
      dicas.push({ titulo: 'Reserva de emergência insuficiente', detalhe: `Sua reserva cobre ${mesesReserva.toFixed(1)} meses de gastos. O mínimo recomendado é 3 meses, o ideal é 6. Priorize isso antes de outros investimentos.`, urgencia: 'alta' })
    } else if (mesesReserva < 6) {
      dicas.push({ titulo: 'Reserva de emergência em construção', detalhe: `Você tem ${mesesReserva.toFixed(1)} meses de reserva. Meta: 6 meses. Faltam R${((6 - mesesReserva) * mediaSaidas).toFixed(0)} para chegar lá.`, urgencia: 'media' })
    }

    if (temCartao && cartaoPctReceita > 40) {
      dicas.push({ titulo: 'Cartão acima do recomendado', detalhe: `${cartaoPctReceita.toFixed(0)}% da sua renda vai para o cartão. O ideal é até 30%. Revise assinaturas e compras parceladas em aberto.`, urgencia: 'alta' })
    } else if (temCartao && cartaoPctReceita > 30) {
      dicas.push({ titulo: 'Atenção ao uso do cartão', detalhe: `Cartão representa ${cartaoPctReceita.toFixed(0)}% da renda. Está um pouco acima do ideal de 30%. Verifique quais categorias estão pesando mais.`, urgencia: 'media' })
    }

    if (pctDesejos > 35) {
      dicas.push({ titulo: 'Desejos acima do limite', detalhe: `Lazer + vestuário + outros somam ${pctDesejos.toFixed(0)}% da renda. Na regra 50/30/20, o limite é 30%. Identifique onde cortar.`, urgencia: 'media' })
    }

    if (pctNecessidades > 60) {
      dicas.push({ titulo: 'Necessidades comprometendo a renda', detalhe: `Moradia, alimentação e serviços fixos estão tomando ${pctNecessidades.toFixed(0)}% da renda. Veja se há contratos ou assinaturas que podem ser renegociados.`, urgencia: 'alta' })
    }

    if (dicas.length === 0 && score >= 70) {
      dicas.push({ titulo: 'Finanças saudáveis!', detalhe: 'Você está no caminho certo. Continue monitorando mês a mês e foque em aumentar os investimentos.', urgencia: 'baixa' })
    }

    return Response.json({
      score,
      mesesAnalisados: n,
      mediaReceitas,
      mediaDespesas,
      mediaCartao,
      taxaPoupanca,
      cartaoPctReceita,
      temCartao,
      regra502030: {
        necessidades: { valor: necessidades, pct: pctNecessidades, ideal: 50 },
        desejos: { valor: desejos, pct: pctDesejos, ideal: 30 },
        poupanca: { valor: poupancaReal, pct: pctPoupanca, ideal: 20 },
      },
      reservaEmergencia: {
        meses: mesesReserva,
        saldoInvestimentos,
        mediaSaidas,
        metaMeses: 6,
        faltaParaMeta: Math.max(0, (6 - mesesReserva) * mediaSaidas),
      },
      pontos: { ptsPoupanca, pts5020, ptsReserva, ptsCartao },
      dicas,
    })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
