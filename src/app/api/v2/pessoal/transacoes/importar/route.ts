import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

export async function POST(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaPessoal.findUnique({ where: { usuarioId: u.id } })
    if (!conta) return Response.json({ erro: 'Conta pessoal não encontrada' }, { status: 404 })

    const body = await req.json()
    const { transacoes, banco, periodo, nomeArquivo, tipoImport } = body
    if (!Array.isArray(transacoes) || transacoes.length === 0) {
      return Response.json({ erro: 'transacoes[] obrigatório' }, { status: 400 })
    }

    // Mapa de categorias pelo nome (busca ou cria automaticamente)
    const categoriasExistentes = await prisma.categoriaPessoal.findMany({
      where: { contaPessoalId: conta.id },
    })
    const catMap = new Map(categoriasExistentes.map((c) => [c.nome.toLowerCase(), c.id]))

    // Determinar categorias que precisam ser criadas
    const receitasCats = new Set(['salário', 'freelance / consultoria', 'investimentos'])
    const nomesNecessarios = new Set<string>()
    transacoes.forEach((t: any) => {
      const nome = String(t.categoria || 'Outros').trim()
      if (nome && !catMap.has(nome.toLowerCase())) nomesNecessarios.add(nome)
    })
    for (const nome of nomesNecessarios) {
      const tipo = receitasCats.has(nome.toLowerCase()) ? 'receita' : 'despesa'
      const nova = await prisma.categoriaPessoal.upsert({
        where: { contaPessoalId_nome: { contaPessoalId: conta.id, nome } },
        create: { contaPessoalId: conta.id, nome, tipo, padrao: true },
        update: {},
      })
      catMap.set(nome.toLowerCase(), nova.id)
    }

    // Garantir que "Outros" existe
    if (!catMap.has('outros')) {
      const nova = await prisma.categoriaPessoal.upsert({
        where: { contaPessoalId_nome: { contaPessoalId: conta.id, nome: 'Outros' } },
        create: { contaPessoalId: conta.id, nome: 'Outros', tipo: 'despesa', padrao: true },
        update: {},
      })
      catMap.set('outros', nova.id)
    }
    const catOutrosId = catMap.get('outros')!

    // Para CC: tenta extrair mes/ano do periodo da fatura (ex: "Abril/2026")
    const MESES_PT: Record<string, number> = {
      janeiro: 1, fevereiro: 2, março: 3, marco: 3, abril: 4, maio: 5, junho: 6,
      julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
    }
    let faturaMes: number | null = null
    let faturaAno: number | null = null
    if (periodo) {
      const partes = String(periodo).toLowerCase().replace('/', ' ').split(/\s+/)
      const nomeM = partes.find((p) => MESES_PT[p])
      const nomeA = partes.find((p) => /^\d{4}$/.test(p))
      if (nomeM && nomeA) { faturaMes = MESES_PT[nomeM]; faturaAno = parseInt(nomeA) }
    }

    const dados = transacoes.map((t: any) => {
      const data = new Date(t.data)
      const catNome = String(t.categoria || 'Outros').trim().toLowerCase()
      const categoriaId = catMap.get(catNome) || catOutrosId

      // CC: usa mês/ano da fatura para não espalhar compras em meses anteriores
      const isCartao = t.origem === 'cartao'
      const mes = isCartao && faturaMes ? faturaMes : (isNaN(data.getTime()) ? new Date().getMonth() + 1 : data.getMonth() + 1)
      const ano = isCartao && faturaAno ? faturaAno : (isNaN(data.getTime()) ? new Date().getFullYear() : data.getFullYear())

      return {
        contaPessoalId: conta.id,
        tipo: t.tipo === 'receita' ? 'receita' : 'despesa',
        descricao: String(t.descricao || '').trim(),
        valor: Math.abs(Number(t.valor)),
        data: isNaN(data.getTime()) ? new Date() : data,
        mes,
        ano,
        categoriaId,
        cartao: t.cartao || null,
        origem: t.origem || 'importacao_excel',
        observacoes: t.observacoes || null,
      }
    })

    // Criar registro de importação para rastreamento
    const importacao = await prisma.importacaoPessoal.create({
      data: {
        contaPessoalId: conta.id,
        tipo: tipoImport || 'excel',
        nomeArquivo: nomeArquivo || 'importação',
        banco: banco || null,
        periodo: periodo || null,
      },
    })

    await prisma.transacaoPessoal.createMany({
      data: dados.map((d) => ({ ...d, importacaoId: importacao.id })),
    })
    return Response.json({ ok: true, total: dados.length }, { status: 201 })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
