import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

export async function GET(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaPessoal.findUnique({ where: { usuarioId: u.id } })
    if (!conta) return Response.json({ erro: 'Conta não encontrada' }, { status: 404 })

    // Buscar todas as transações CC com padrão de parcela (X/N)
    const txs = await prisma.transacaoPessoal.findMany({
      where: {
        contaPessoalId: conta.id,
        origem: 'cartao',
        descricao: { contains: '/' },
      },
      include: { categoria: { select: { nome: true } } },
      orderBy: [{ ano: 'asc' }, { mes: 'asc' }],
    })

    // Filtrar apenas os que têm padrão (X/N) na descrição
    const parcelaRegex = /^(.+?)\s*\((\d+)\/(\d+)\)\s*$/
    const grupos: Record<string, {
      nome: string
      valorMensal: number
      parcelas: { x: number; n: number; mes: number; ano: number }[]
      categoria: string | null
    }> = {}

    for (const tx of txs) {
      const match = tx.descricao.match(parcelaRegex)
      if (!match) continue

      const nome = match[1].trim()
      const x = parseInt(match[2])
      const n = parseInt(match[3])
      const valorMensal = Number(tx.valor)

      if (!grupos[nome]) {
        grupos[nome] = {
          nome,
          valorMensal,
          parcelas: [],
          categoria: tx.categoria?.nome || null,
        }
      }

      grupos[nome].parcelas.push({ x, n, mes: tx.mes, ano: tx.ano })
    }

    // Processar cada grupo
    const hoje = new Date()
    const mesAtual = hoje.getMonth() + 1
    const anoAtual = hoje.getFullYear()

    const mapa = Object.values(grupos)
      .map(grupo => {
        // Pegar a parcela mais recente importada
        const sorted = [...grupo.parcelas].sort((a, b) =>
          a.ano !== b.ano ? a.ano - b.ano : a.mes - b.mes
        )
        const ultima = sorted[sorted.length - 1]
        const n = ultima.n
        const xMax = ultima.x

        // Parcelas restantes a partir de agora
        const restantes = n - xMax

        // Mês de encerramento
        let mesFim = ultima.mes + restantes
        let anoFim = ultima.ano
        while (mesFim > 12) { mesFim -= 12; anoFim++ }

        // Total comprometido futuro
        const totalFuturo = restantes * grupo.valorMensal

        // Já encerrado?
        const encerrado = restantes <= 0 ||
          (ultima.ano < anoAtual) ||
          (ultima.ano === anoAtual && ultima.mes < mesAtual - 1)

        return {
          nome: grupo.nome,
          categoria: grupo.categoria,
          parcelaAtual: xMax,
          totalParcelas: n,
          restantes,
          valorMensal: grupo.valorMensal,
          totalFuturo,
          mesFim,
          anoFim,
          encerrado,
        }
      })
      .filter(p => !p.encerrado && p.restantes > 0)
      .sort((a, b) => b.totalFuturo - a.totalFuturo)

    // Total comprometido
    const totalMensal = mapa.reduce((s, p) => s + p.valorMensal, 0)
    const totalGlobal = mapa.reduce((s, p) => s + p.totalFuturo, 0)

    return Response.json({ mapa, totalMensal, totalGlobal })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
