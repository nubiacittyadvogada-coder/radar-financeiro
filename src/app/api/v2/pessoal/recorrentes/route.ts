import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

// Normaliza descrição para detectar recorrências
function normalizar(desc: string): string {
  return desc
    .toUpperCase()
    .replace(/\b(PIX|DEB|CRED|PAGTO|PGTO|TRF|TRANSF|DEBITO|CREDITO|BR|COM|LTDA|SA|ME)\b/g, '')
    .replace(/\d+/g, '')
    .replace(/[^A-Z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 28)
}

// GET /api/v2/pessoal/recorrentes
export async function GET(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaPessoal.findUnique({ where: { usuarioId: u.id } })
    if (!conta) return Response.json({ recorrentes: [], projecao: null })

    const hoje = new Date()
    const mesesBusca: { mes: number; ano: number }[] = []
    for (let i = 0; i < 5; i++) {
      let mes = hoje.getMonth() + 1 - i
      let ano = hoje.getFullYear()
      if (mes <= 0) { mes += 12; ano -= 1 }
      mesesBusca.push({ mes, ano })
    }

    const transacoes = await prisma.transacaoPessoal.findMany({
      where: {
        contaPessoalId: conta.id,
        tipo: 'despesa',
        origem: { not: 'cartao' },
        OR: mesesBusca.map(({ mes, ano }) => ({ mes, ano })),
      },
      include: { categoria: true },
      orderBy: { data: 'desc' },
    })

    // Agrupa por descrição normalizada
    const grupos = new Map<string, {
      descricaoOriginal: string
      categoria: string | null
      categoriaId: string | null
      valores: number[]
      meses: Set<string>
    }>()

    for (const t of transacoes) {
      const chave = normalizar(t.descricao || '')
      if (!chave || chave.length < 4) continue
      if (!grupos.has(chave)) {
        grupos.set(chave, {
          descricaoOriginal: t.descricao || '',
          categoria: t.categoria?.nome || null,
          categoriaId: t.categoriaId,
          valores: [],
          meses: new Set(),
        })
      }
      const g = grupos.get(chave)!
      g.valores.push(Number(t.valor))
      g.meses.add(`${t.ano}-${t.mes}`)
      // mantém a descrição mais curta/limpa
      if ((t.descricao || '').length < g.descricaoOriginal.length) {
        g.descricaoOriginal = t.descricao || ''
      }
    }

    // Filtra recorrentes: aparece em 2+ meses
    const recorrentes = Array.from(grupos.entries())
      .filter(([, g]) => g.meses.size >= 2)
      .map(([, g]) => ({
        descricao: g.descricaoOriginal,
        categoria: g.categoria,
        valorMedio: g.valores.reduce((s, v) => s + v, 0) / g.valores.length,
        mesesPresente: g.meses.size,
        recorrenciaTotal: g.valores.reduce((s, v) => s + v, 0),
      }))
      .sort((a, b) => b.valorMedio - a.valorMedio)

    const totalMensalRecorrentes = recorrentes.reduce((s, r) => s + r.valorMedio, 0)

    // Assinaturas específicas (categoria Serviços / Assinaturas ou nome-chave)
    const ASSINATURAS_KEYWORDS = ['NETFLIX', 'SPOTIFY', 'AMAZON', 'APPLE', 'GOOGLE', 'YOUTUBE', 'DISNEY', 'HBO', 'WELLHUB', 'GYMPASS', 'VIVO', 'CLARO', 'TIM', 'OI', 'ANUIDADE', 'MENSALIDADE']
    const assinaturas = recorrentes.filter((r) =>
      r.categoria === 'Serviços / Assinaturas' ||
      ASSINATURAS_KEYWORDS.some((kw) => r.descricao.toUpperCase().includes(kw))
    )
    const totalAssinaturas = assinaturas.reduce((s, r) => s + r.valorMedio, 0)

    // ---- PROJEÇÃO DO PRÓXIMO MÊS ----
    // Últimos 3 meses com receitas para média por categoria
    const mesesProjecao: { mes: number; ano: number }[] = []
    for (let i = 1; i <= 4; i++) {
      let mes = hoje.getMonth() + 1 - i
      let ano = hoje.getFullYear()
      if (mes <= 0) { mes += 12; ano -= 1 }
      mesesProjecao.push({ mes, ano })
    }

    const txProjecao = await prisma.transacaoPessoal.findMany({
      where: {
        contaPessoalId: conta.id,
        OR: mesesProjecao.map(({ mes, ano }) => ({ mes, ano })),
      },
      include: { categoria: true },
    })

    // Agrupa por mês e categoria
    type MesGrupo = { receitas: number; catDespesas: Map<string, number>; cartao: number }
    const mesesData = new Map<string, MesGrupo>()
    for (const t of txProjecao) {
      const key = `${t.ano}-${t.mes}`
      if (!mesesData.has(key)) mesesData.set(key, { receitas: 0, catDespesas: new Map(), cartao: 0 })
      const m = mesesData.get(key)!
      const cat = t.categoria?.nome || 'Outros'
      if (t.origem === 'cartao') {
        m.cartao += Number(t.valor)
        m.catDespesas.set(`💳 ${cat}`, (m.catDespesas.get(`💳 ${cat}`) || 0) + Number(t.valor))
      } else if (t.tipo === 'receita') {
        m.receitas += Number(t.valor)
      } else {
        m.catDespesas.set(cat, (m.catDespesas.get(cat) || 0) + Number(t.valor))
      }
    }

    const mesesComReceita = Array.from(mesesData.values()).filter((m) => m.receitas > 0)
    const n = Math.max(1, mesesComReceita.length)

    // Média por categoria
    const catMedia = new Map<string, number>()
    for (const m of mesesComReceita) {
      for (const [cat, val] of m.catDespesas) {
        catMedia.set(cat, (catMedia.get(cat) || 0) + val / n)
      }
    }
    const mediaReceitas = mesesComReceita.reduce((s, m) => s + m.receitas, 0) / n

    // Próximo mês
    let proxMes = hoje.getMonth() + 2
    let proxAno = hoje.getFullYear()
    if (proxMes > 12) { proxMes = 1; proxAno += 1 }

    const categoriasProjeto = Array.from(catMedia.entries())
      .map(([nome, valor]) => ({ nome, valor: Math.round(valor) }))
      .filter((c) => c.valor > 0)
      .sort((a, b) => b.valor - a.valor)

    const totalProjetado = categoriasProjeto.reduce((s, c) => s + c.valor, 0)

    const projecao = {
      mes: proxMes,
      ano: proxAno,
      totalProjetado,
      mediaReceitas: Math.round(mediaReceitas),
      saldoEstimado: Math.round(mediaReceitas - totalProjetado),
      baseadoEmMeses: n,
      porCategoria: categoriasProjeto,
    }

    return Response.json({ recorrentes, totalMensalRecorrentes, assinaturas, totalAssinaturas, projecao })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
