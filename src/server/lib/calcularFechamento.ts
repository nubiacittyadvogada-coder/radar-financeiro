import { Decimal } from '@prisma/client/runtime/library'
import prisma from './db'
import { verificarAlertas } from './alertas'
import { classificar } from './classificador'

/**
 * Calcula o fechamento mensal de um cliente a partir dos lançamentos importados.
 *
 * Fórmulas (confirmadas pelo DRE real):
 *   Receita Bruta = soma 01_RPS.* (exceto REPASSE ÊXITO)
 *   Repasse Êxito = soma 01_RPS.REPASSE ÊXITO (valor absoluto, será deduzido)
 *   Impostos = soma 02_IMP.* (valor absoluto)
 *   Receita Líquida = Receita Bruta - Repasse - Impostos
 *   Custos Diretos = soma 03_CSP.* (valor absoluto)
 *   Margem de Contribuição = Receita Líquida - Custos Diretos
 *   % Margem = Margem / Receita Bruta * 100
 *   Despesas ADM = Pessoal + Marketing + Gerais (valores absolutos)
 *   Lucro Operacional = Margem - Despesas ADM
 *   Retirada Sócios = soma 05_RET.* (valor absoluto)
 *   Resultado Financeiro = Receita Juros - Despesa Juros
 *   Lucro Líquido = Lucro Operacional - Retirada + Resultado Financeiro
 *
 * Abaixo da linha (Resultado de Caixa):
 *   + Distribuição Lucros (07_DLC)
 *   + Investimentos (08_INV)
 *   + Empréstimos entrada/pagamento (09_EMP)
 *   + Parcelamento Impostos (12_PCI)
 *   + Aplicações resgate/aplicação (10_APL)
 *   + Aportes (11_APT)
 *   Resultado Caixa = Lucro Líquido + soma dos itens acima
 */
export async function calcularFechamento(
  clienteId: string,
  mes: number,
  ano: number
) {
  // Buscar todos os lançamentos PAGOS do período (importados)
  const lancamentosImportados = await prisma.lancamento.findMany({
    where: { clienteId, mes, ano, previsto: false },
  })

  // Buscar lançamentos manuais do período (realizados)
  const manuais = await prisma.lancamentoManual.findMany({
    where: { clienteId, mes, ano, previsto: false },
  })

  // Converter manuais para o mesmo formato dos importados
  const manuaisConvertidos = manuais.map((m) => {
    let subtipo: string | null = null
    try { subtipo = classificar(m.planoConta).subtipo } catch {}
    return {
      tipo: m.tipoContabil,
      subtipo,
      planoConta: m.planoConta,
      grupoConta: m.grupoConta,
      valor: m.valor,
      previsto: m.previsto,
    } as any
  })

  // Unir ambas as fontes
  const lancamentos = [...lancamentosImportados, ...manuaisConvertidos]

  // Helpers
  const somarPorTipo = (tipo: string) =>
    lancamentos
      .filter((l) => l.tipo === tipo)
      .reduce((acc, l) => acc + Number(l.valor), 0)

  const somarPorGrupo = (grupo: string) =>
    lancamentos
      .filter((l) => l.grupoConta === grupo)
      .reduce((acc, l) => acc + Number(l.valor), 0)

  const somarPorSubtipo = (tipo: string, subtipo: string) =>
    lancamentos
      .filter((l) => l.tipo === tipo && l.subtipo === subtipo)
      .reduce((acc, l) => acc + Number(l.valor), 0)

  const somarPorPlanoConta = (contém: string) =>
    lancamentos
      .filter((l) => l.planoConta.toUpperCase().includes(contém.toUpperCase()))
      .reduce((acc, l) => acc + Number(l.valor), 0)

  // === RECEITAS ===
  const receitasAll = lancamentos.filter((l) => l.tipo === 'receita')
  const repasseExitoLancs = receitasAll.filter((l) =>
    l.subtipo?.includes('repasse_exito') || l.planoConta.toUpperCase().includes('REPASSE')
  )
  const receitasSemRepasse = receitasAll.filter(
    (l) => !l.subtipo?.includes('repasse_exito') && !l.planoConta.toUpperCase().includes('REPASSE')
  )

  const honHonorariosIniciais = receitasSemRepasse
    .filter((l) => l.subtipo === 'honorarios_iniciais')
    .reduce((acc, l) => acc + Number(l.valor), 0)

  const honHonorariosMensais = receitasSemRepasse
    .filter((l) => l.subtipo === 'honorarios_mensais')
    .reduce((acc, l) => acc + Number(l.valor), 0)

  const honConsultas = receitasSemRepasse
    .filter((l) => l.subtipo === 'consulta')
    .reduce((acc, l) => acc + Number(l.valor), 0)

  const honExito = receitasSemRepasse
    .filter((l) => l.subtipo === 'exito')
    .reduce((acc, l) => acc + Number(l.valor), 0)

  const honMultaCancelamento = receitasSemRepasse
    .filter((l) => l.subtipo === 'multa_cancelamento')
    .reduce((acc, l) => acc + Number(l.valor), 0)

  const receitaBruta = receitasSemRepasse.reduce((acc, l) => acc + Number(l.valor), 0)
  const repasseExito = Math.abs(repasseExitoLancs.reduce((acc, l) => acc + Number(l.valor), 0))

  // === IMPOSTOS ===
  const impostos = Math.abs(somarPorTipo('imposto'))

  // === RECEITA LÍQUIDA ===
  const receitaLiquida = receitaBruta - repasseExito - impostos

  // === CUSTOS DIRETOS ===
  // No DRE, custos diretos incluem reembolso como positivo
  const custosDiretosLancs = lancamentos.filter((l) => l.tipo === 'custo_direto')
  const custosDiretos = Math.abs(
    custosDiretosLancs.reduce((acc, l) => acc + Number(l.valor), 0)
  )

  // === MARGEM ===
  const margemContribuicao = receitaLiquida - custosDiretos
  const percMargem = receitaBruta > 0
    ? round((margemContribuicao / receitaBruta) * 100, 2)
    : 0

  // === DESPESAS ADM ===
  const despesasPessoal = Math.abs(somarPorTipo('pessoal'))
  const despesasMarketing = Math.abs(somarPorTipo('marketing'))
  const despesasGerais = Math.abs(somarPorTipo('geral'))
  const totalDespesasAdm = despesasPessoal + despesasMarketing + despesasGerais

  // === LUCRO OPERACIONAL ===
  const lucroOperacional = margemContribuicao - totalDespesasAdm
  const percLucroOp = receitaBruta > 0
    ? round((lucroOperacional / receitaBruta) * 100, 2)
    : 0

  // === RETIRADA ===
  const retiradaSocios = Math.abs(somarPorTipo('retirada'))

  // === RESULTADO FINANCEIRO ===
  const financeiroLancs = lancamentos.filter((l) => l.tipo === 'financeiro')
  const receitaJuros = financeiroLancs
    .filter((l) => l.subtipo?.includes('receita'))
    .reduce((acc, l) => acc + Math.abs(Number(l.valor)), 0)
  const despesaJuros = financeiroLancs
    .filter((l) => l.subtipo?.includes('despesa'))
    .reduce((acc, l) => acc + Math.abs(Number(l.valor)), 0)
  const resultadoFinanceiro = receitaJuros - despesaJuros

  // === LUCRO LÍQUIDO ===
  // Confirmado pelo DRE: Lucro Liq = Lucro Op - Retirada + Result. Financeiro
  const lucroLiquido = lucroOperacional - retiradaSocios + resultadoFinanceiro
  const percLucroLiq = receitaBruta > 0
    ? round((lucroLiquido / receitaBruta) * 100, 2)
    : 0

  // === ABAIXO DA LINHA ===
  const distribuicaoLucros = Math.abs(somarPorTipo('distribuicao'))
  const investimentos = Math.abs(somarPorTipo('investimento'))

  const emprestimosLancs = lancamentos.filter((l) => l.tipo === 'emprestimo')
  const emprestimosEntrada = emprestimosLancs
    .filter((l) => l.subtipo?.includes('entrada'))
    .reduce((acc, l) => acc + Math.abs(Number(l.valor)), 0)
  const emprestimosPagamento = emprestimosLancs
    .filter((l) => l.subtipo?.includes('pagamento'))
    .reduce((acc, l) => acc + Math.abs(Number(l.valor)), 0)

  const parcelamentoLancs = lancamentos.filter((l) => l.tipo === 'parcelamento')
  const parcelamentoImpostos = Math.abs(
    parcelamentoLancs
      .filter((l) => l.subtipo?.includes('pagamento'))
      .reduce((acc, l) => acc + Number(l.valor), 0)
  )

  const aplicacaoLancs = lancamentos.filter((l) => l.tipo === 'aplicacao')
  const resgateAplicacao = aplicacaoLancs
    .filter((l) => l.subtipo?.includes('resgate'))
    .reduce((acc, l) => acc + Math.abs(Number(l.valor)), 0)
  const aplicacaoFinanceira = aplicacaoLancs
    .filter((l) => !l.subtipo?.includes('resgate'))
    .reduce((acc, l) => acc + Math.abs(Number(l.valor)), 0)

  const aporteSocios = Math.abs(somarPorTipo('aporte'))

  // === RESULTADO DE CAIXA ===
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

  // === SALDO (buscar fechamento anterior) ===
  const fechamentoAnterior = await buscarFechamentoAnterior(clienteId, mes, ano)
  const saldoAnterior = fechamentoAnterior
    ? Number(fechamentoAnterior.saldoFinal || 0)
    : null
  const saldoFinal = saldoAnterior !== null
    ? saldoAnterior + resultadoCaixa
    : null

  // === RESULTADO POR SETOR ===
  const setores = ['CRIMINAL', 'CÍVEL', 'TRABALHISTA', 'PREVIDENCIÁRIO', 'GERAL']
  const resultadosPorSetor: Record<string, any> = {}

  for (const setor of setores) {
    const lancSetor = lancamentos.filter(
      (l) => l.area?.toUpperCase() === setor
    )
    if (lancSetor.length === 0) continue

    const recSetor = lancSetor
      .filter((l) => l.tipo === 'receita' && !l.subtipo?.includes('repasse'))
      .reduce((acc, l) => acc + Number(l.valor), 0)

    const custoSetor = Math.abs(
      lancSetor
        .filter((l) => l.tipo === 'custo_direto')
        .reduce((acc, l) => acc + Number(l.valor), 0)
    )

    resultadosPorSetor[setor] = {
      receita: round(recSetor, 2),
      custos: round(custoSetor, 2),
      margem: round(recSetor - custoSetor, 2),
    }
  }

  // === PREVISÃO (lançamentos com previsto = true) ===
  const lancPrevistos = await prisma.lancamento.findMany({
    where: { clienteId, mes, ano, previsto: true },
  })

  const receitaPrevista = lancPrevistos
    .filter((l) => l.tipo === 'receita')
    .reduce((acc, l) => acc + Number(l.valor), 0)

  const despesaPrevista = Math.abs(
    lancPrevistos
      .filter((l) => !['receita', 'financeiro', 'aplicacao', 'aporte'].includes(l.tipo))
      .reduce((acc, l) => acc + Number(l.valor), 0)
  )

  // === UPSERT FECHAMENTO ===
  const fechamento = await prisma.fechamento.upsert({
    where: {
      clienteId_mes_ano: { clienteId, mes, ano },
    },
    update: {
      receitaBruta: round(receitaBruta, 2),
      honHonorariosIniciais: round(honHonorariosIniciais, 2),
      honHonorariosMensais: round(honHonorariosMensais, 2),
      honConsultas: round(honConsultas, 2),
      honExito: round(honExito, 2),
      honMultaCancelamento: round(honMultaCancelamento, 2),
      repasseExito: round(repasseExito, 2),
      impostos: round(impostos, 2),
      receitaLiquida: round(receitaLiquida, 2),
      custosDiretos: round(custosDiretos, 2),
      margemContribuicao: round(margemContribuicao, 2),
      percMargem,
      despesasPessoal: round(despesasPessoal, 2),
      despesasMarketing: round(despesasMarketing, 2),
      despesasGerais: round(despesasGerais, 2),
      totalDespesasAdm: round(totalDespesasAdm, 2),
      lucroOperacional: round(lucroOperacional, 2),
      percLucroOp,
      retiradaSocios: round(retiradaSocios, 2),
      receitaJuros: round(receitaJuros, 2),
      despesaJuros: round(despesaJuros, 2),
      resultadoFinanceiro: round(resultadoFinanceiro, 2),
      lucroLiquido: round(lucroLiquido, 2),
      percLucroLiq,
      distribuicaoLucros: round(distribuicaoLucros, 2),
      investimentos: round(investimentos, 2),
      emprestimosEntrada: round(emprestimosEntrada, 2),
      emprestimosPagamento: round(emprestimosPagamento, 2),
      parcelamentoImpostos: round(parcelamentoImpostos, 2),
      resgateAplicacao: round(resgateAplicacao, 2),
      aplicacaoFinanceira: round(aplicacaoFinanceira, 2),
      aporteSocios: round(aporteSocios, 2),
      resultadoCaixa: round(resultadoCaixa, 2),
      saldoAnterior: saldoAnterior !== null ? round(saldoAnterior, 2) : null,
      saldoFinal: saldoFinal !== null ? round(saldoFinal, 2) : null,
      resultadosPorSetor,
      receitaPrevista: round(receitaPrevista, 2),
      despesaPrevista: round(despesaPrevista, 2),
    },
    create: {
      clienteId,
      mes,
      ano,
      receitaBruta: round(receitaBruta, 2),
      honHonorariosIniciais: round(honHonorariosIniciais, 2),
      honHonorariosMensais: round(honHonorariosMensais, 2),
      honConsultas: round(honConsultas, 2),
      honExito: round(honExito, 2),
      honMultaCancelamento: round(honMultaCancelamento, 2),
      repasseExito: round(repasseExito, 2),
      impostos: round(impostos, 2),
      receitaLiquida: round(receitaLiquida, 2),
      custosDiretos: round(custosDiretos, 2),
      margemContribuicao: round(margemContribuicao, 2),
      percMargem,
      despesasPessoal: round(despesasPessoal, 2),
      despesasMarketing: round(despesasMarketing, 2),
      despesasGerais: round(despesasGerais, 2),
      totalDespesasAdm: round(totalDespesasAdm, 2),
      lucroOperacional: round(lucroOperacional, 2),
      percLucroOp,
      retiradaSocios: round(retiradaSocios, 2),
      receitaJuros: round(receitaJuros, 2),
      despesaJuros: round(despesaJuros, 2),
      resultadoFinanceiro: round(resultadoFinanceiro, 2),
      lucroLiquido: round(lucroLiquido, 2),
      percLucroLiq,
      distribuicaoLucros: round(distribuicaoLucros, 2),
      investimentos: round(investimentos, 2),
      emprestimosEntrada: round(emprestimosEntrada, 2),
      emprestimosPagamento: round(emprestimosPagamento, 2),
      parcelamentoImpostos: round(parcelamentoImpostos, 2),
      resgateAplicacao: round(resgateAplicacao, 2),
      aplicacaoFinanceira: round(aplicacaoFinanceira, 2),
      aporteSocios: round(aporteSocios, 2),
      resultadoCaixa: round(resultadoCaixa, 2),
      saldoAnterior: saldoAnterior !== null ? round(saldoAnterior, 2) : null,
      saldoFinal: saldoFinal !== null ? round(saldoFinal, 2) : null,
      resultadosPorSetor,
      receitaPrevista: round(receitaPrevista, 2),
      despesaPrevista: round(despesaPrevista, 2),
    },
  })

  // Verificar alertas após calcular fechamento
  await verificarAlertas(clienteId, mes, ano)

  return fechamento
}

async function buscarFechamentoAnterior(
  clienteId: string,
  mes: number,
  ano: number
) {
  const mesAnterior = mes === 1 ? 12 : mes - 1
  const anoAnterior = mes === 1 ? ano - 1 : ano

  return prisma.fechamento.findUnique({
    where: {
      clienteId_mes_ano: {
        clienteId,
        mes: mesAnterior,
        ano: anoAnterior,
      },
    },
  })
}

function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals)
  return Math.round(value * factor) / factor
}
