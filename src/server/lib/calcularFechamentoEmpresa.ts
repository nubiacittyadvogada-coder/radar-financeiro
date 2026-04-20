import prisma from './db'
import { classificar } from './classificador'

/**
 * V2 — calcula o fechamento mensal de uma ContaEmpresa.
 * Mesma lógica do calcularFechamento.ts original, adaptada para os novos modelos.
 */
export async function calcularFechamentoEmpresa(
  contaEmpresaId: string,
  mes: number,
  ano: number
) {
  // Inclui todos os lançamentos independente de origem (importacao, manual, asaas_webhook, ofx_sicredi, especie)
  const todos = await prisma.lancamentoEmpresa.findMany({
    where: { contaEmpresaId, mes, ano, previsto: false },
  })

  const d = (v: any) => Number(v ?? 0)
  const soma = (tipo: string, subtipo?: string) =>
    todos
      .filter((l) => l.tipo === tipo && (subtipo == null || l.subtipo === subtipo))
      .reduce((s, l) => s + Math.abs(d(l.valor)), 0)

  // ── Receitas ──────────────────────────────────────────────────────────────
  const receitaBruta = soma('receita')
  const repasseExito = todos
    .filter((l) => l.tipo === 'receita' && l.planoConta?.toLowerCase().includes('repasse'))
    .reduce((s, l) => s + Math.abs(d(l.valor)), 0)
  const impostos = soma('imposto')
  const receitaLiquida = receitaBruta - repasseExito - impostos

  // Breakdown honorários
  const honHonorariosIniciais = todos
    .filter((l) => l.tipo === 'receita' && l.subtipo === 'honorario_inicial')
    .reduce((s, l) => s + Math.abs(d(l.valor)), 0)
  const honHonorariosMensais = todos
    .filter((l) => l.tipo === 'receita' && l.subtipo === 'honorario_mensal')
    .reduce((s, l) => s + Math.abs(d(l.valor)), 0)
  const honConsultas = todos
    .filter((l) => l.tipo === 'receita' && l.subtipo === 'consulta')
    .reduce((s, l) => s + Math.abs(d(l.valor)), 0)
  const honExito = todos
    .filter((l) => l.tipo === 'receita' && l.subtipo === 'exito')
    .reduce((s, l) => s + Math.abs(d(l.valor)), 0)
  const honMultaCancelamento = todos
    .filter((l) => l.tipo === 'receita' && l.subtipo === 'multa_cancelamento')
    .reduce((s, l) => s + Math.abs(d(l.valor)), 0)

  // ── Custos e Despesas ADM ─────────────────────────────────────────────────
  const custosDiretos = soma('custo_direto')
  const margemContribuicao = receitaLiquida - custosDiretos
  const percMargem = receitaBruta > 0 ? (margemContribuicao / receitaBruta) * 100 : 0

  const despesasPessoal = soma('pessoal')
  const despesasMarketing = soma('marketing')
  const despesasGerais = soma('geral')
  const totalDespesasAdm = despesasPessoal + despesasMarketing + despesasGerais

  const lucroOperacional = margemContribuicao - totalDespesasAdm
  const percLucroOp = receitaBruta > 0 ? (lucroOperacional / receitaBruta) * 100 : 0

  // ── Retirada e Financeiro ─────────────────────────────────────────────────
  const retiradaSocios = soma('retirada')
  const receitaJuros = soma('financeiro', 'juros_recebido')
  const despesaJuros = soma('financeiro', 'juros_pago')
  const resultadoFinanceiro = receitaJuros - despesaJuros

  const lucroLiquido = lucroOperacional - retiradaSocios + resultadoFinanceiro
  const percLucroLiq = receitaBruta > 0 ? (lucroLiquido / receitaBruta) * 100 : 0

  // ── Abaixo da linha ───────────────────────────────────────────────────────
  const distribuicaoLucros = soma('distribuicao')
  const investimentos = soma('investimento')
  const emprestimosEntrada = todos
    .filter((l) => l.tipo === 'emprestimo' && d(l.valor) > 0)
    .reduce((s, l) => s + Math.abs(d(l.valor)), 0)
  const emprestimosPagamento = todos
    .filter((l) => l.tipo === 'emprestimo' && d(l.valor) < 0)
    .reduce((s, l) => s + Math.abs(d(l.valor)), 0)
  const parcelamentoImpostos = soma('parcelamento')
  const resgateAplicacao = todos
    .filter((l) => l.tipo === 'aplicacao' && d(l.valor) > 0)
    .reduce((s, l) => s + Math.abs(d(l.valor)), 0)
  const aplicacaoFinanceira = todos
    .filter((l) => l.tipo === 'aplicacao' && d(l.valor) < 0)
    .reduce((s, l) => s + Math.abs(d(l.valor)), 0)
  const aporteSocios = soma('aporte')

  const resultadoCaixa =
    lucroLiquido -
    distribuicaoLucros -
    investimentos +
    emprestimosEntrada -
    emprestimosPagamento -
    parcelamentoImpostos +
    resgateAplicacao -
    aplicacaoFinanceira +
    aporteSocios

  // ── Por setor ─────────────────────────────────────────────────────────────
  const setores: Record<string, { receita: number; custo: number }> = {}
  todos.forEach((l) => {
    if (!l.area) return
    if (!setores[l.area]) setores[l.area] = { receita: 0, custo: 0 }
    if (l.tipo === 'receita') setores[l.area].receita += Math.abs(d(l.valor))
    else setores[l.area].custo += Math.abs(d(l.valor))
  })

  // ── Por advogado ──────────────────────────────────────────────────────────
  const advogados: Record<string, { receita: number; qtd: number }> = {}
  todos.forEach((l) => {
    if (!l.advogado || l.tipo !== 'receita') return
    if (!advogados[l.advogado]) advogados[l.advogado] = { receita: 0, qtd: 0 }
    advogados[l.advogado].receita += Math.abs(d(l.valor))
    advogados[l.advogado].qtd += 1
  })

  // ── Previsões ─────────────────────────────────────────────────────────────
  const previstas = await prisma.lancamentoEmpresa.findMany({
    where: { contaEmpresaId, mes, ano, previsto: true },
  })
  const receitaPrevista = previstas
    .filter((l) => l.tipo === 'receita')
    .reduce((s, l) => s + Math.abs(d(l.valor)), 0)
  const despesaPrevista = previstas
    .filter((l) => l.tipo !== 'receita')
    .reduce((s, l) => s + Math.abs(d(l.valor)), 0)

  const dados = {
    contaEmpresaId,
    mes,
    ano,
    receitaBruta,
    honHonorariosIniciais,
    honHonorariosMensais,
    honConsultas,
    honExito,
    honMultaCancelamento,
    repasseExito,
    impostos,
    receitaLiquida,
    custosDiretos,
    margemContribuicao,
    percMargem,
    despesasPessoal,
    despesasMarketing,
    despesasGerais,
    totalDespesasAdm,
    lucroOperacional,
    percLucroOp,
    retiradaSocios,
    receitaJuros,
    despesaJuros,
    resultadoFinanceiro,
    lucroLiquido,
    percLucroLiq,
    distribuicaoLucros,
    investimentos,
    emprestimosEntrada,
    emprestimosPagamento,
    parcelamentoImpostos,
    resgateAplicacao,
    aplicacaoFinanceira,
    aporteSocios,
    resultadoCaixa,
    resultadosPorSetor: Object.keys(setores).length > 0 ? setores : undefined,
    resultadosPorAdvogado: Object.keys(advogados).length > 0 ? advogados : undefined,
    receitaPrevista: receitaPrevista > 0 ? receitaPrevista : undefined,
    despesaPrevista: despesaPrevista > 0 ? despesaPrevista : undefined,
  }

  const fechamento = await prisma.fechamentoEmpresa.upsert({
    where: { contaEmpresaId_mes_ano: { contaEmpresaId, mes, ano } },
    update: dados,
    create: dados,
  })

  return fechamento
}
