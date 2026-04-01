import * as XLSX from 'xlsx'
import prisma from './db'
import {
  classificar,
  normalizarStatusPg,
  parseValor,
  excelDateToJs,
  isRepasseExito,
} from './classificador'
import { calcularFechamento } from './calcularFechamento'

/**
 * Processa arquivo de DESPESAS.
 *
 * Colunas (aba "Despesas"):
 *   0: FAVORECIDO
 *   1: P.CONTAS
 *   2: ÁREA
 *   3: DESCRIÇÃO
 *   4: NR. DOC
 *   5: DATA COMPETÊNCIA (serial Excel)
 *   6: VALOR (numérico)
 *   7: DATA VENCIMENTO (serial Excel)
 *   8: SIT. ("OK" | "PREV")
 *   9: PG ("PG" | "")
 *  10: DATA PAGAMENTO (serial Excel)
 *  11: FORMA DE PAGAMENTO
 *  12: BANCO
 *  13: CONCILIADO
 *  14: OBS
 */
export async function processarDespesas(
  buffer: Buffer,
  clienteId: string,
  mes: number,
  ano: number,
  importacaoId: string
): Promise<{ total: number; processadas: number; erros: string[] }> {
  const wb = XLSX.read(buffer, { type: 'buffer' })

  // Tenta aba "Despesas", senão pega a primeira
  const sheetName = wb.SheetNames.includes('Despesas')
    ? 'Despesas'
    : wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

  const erros: string[] = []
  let processadas = 0
  const lancamentos: any[] = []

  // Pular cabeçalho (linha 0)
  for (let i = 1; i < data.length; i++) {
    const row = data[i]
    const planoConta = String(row[1] || '').trim()

    // Ignorar linhas sem P.CONTAS
    if (!planoConta) continue

    try {
      const { tipo, subtipo, grupoConta } = classificar(planoConta)
      const valor = parseValor(row[6])
      const { statusPg, previsto } = normalizarStatusPg(
        String(row[8] || ''),
        String(row[9] || ''),
        'despesas'
      )

      // Regime Caixa: usar DATA PAGAMENTO (col 10) para lançamentos pagos
      // Para provisionados, usar DATA COMPETÊNCIA (col 5) ou VENCIMENTO (col 7)
      const dataPg = excelDateToJs(row[10])
      const dataComp = excelDateToJs(row[5]) || excelDateToJs(row[7])
      const dataRef = previsto ? dataComp : (dataPg || dataComp)
      const linhaM = dataRef ? dataRef.getMonth() + 1 : mes
      const linhaA = dataRef ? dataRef.getFullYear() : ano

      lancamentos.push({
        importacaoId,
        clienteId,
        mes: linhaM,
        ano: linhaA,
        favorecido: String(row[0] || '').trim() || null,
        planoConta,
        grupoConta,
        area: String(row[2] || '').trim() || null,
        advogado: null,
        descricao: String(row[3] || '').trim() || null,
        dataCompetencia: dataComp,
        valor,
        dataVencimento: excelDateToJs(row[7]),
        statusPg,
        dataPagamento: excelDateToJs(row[10]),
        formaPagamento: String(row[11] || '').trim() || null,
        banco: String(row[12] || '').trim() || null,
        conciliado: String(row[13] || '').toUpperCase().includes('CONCILIADO'),
        observacoes: String(row[14] || '').trim() || null,
        tipo,
        subtipo,
        previsto,
      })

      processadas++
    } catch (err: any) {
      erros.push(`Linha ${i + 1}: ${err.message}`)
    }
  }

  // Inserir em lote
  if (lancamentos.length > 0) {
    await prisma.lancamento.createMany({ data: lancamentos })
  }

  return { total: data.length - 1, processadas, erros }
}

/**
 * Processa arquivo de RECEITAS.
 *
 * Colunas (aba "Receitas"):
 *   0: FAVORECIDO
 *   1: P.CONTAS
 *   2: ÁREA
 *   3: ADVOGADO
 *   4: DESCRIÇÃO
 *   5: DATA VENDA (serial Excel)
 *   6: VALOR (numérico)
 *   7: DATA VENC. (serial Excel)
 *   8: PG ("PG" | "")
 *   9: DATA RECEB. (serial Excel)
 *  10: BANCO
 *  11: FORMA RECEBIMENTO
 *  12: CONCILIADO
 *  13: OBS.
 */
export async function processarReceitas(
  buffer: Buffer,
  clienteId: string,
  mes: number,
  ano: number,
  importacaoId: string
): Promise<{ total: number; processadas: number; erros: string[] }> {
  const wb = XLSX.read(buffer, { type: 'buffer' })

  const sheetName = wb.SheetNames.includes('Receitas')
    ? 'Receitas'
    : wb.SheetNames[0]
  const ws = wb.Sheets[sheetName]
  const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })

  const erros: string[] = []
  let processadas = 0
  const lancamentos: any[] = []

  for (let i = 1; i < data.length; i++) {
    const row = data[i]
    const planoConta = String(row[1] || '').trim()

    if (!planoConta) continue

    try {
      const { tipo, subtipo, grupoConta } = classificar(planoConta)
      const valor = parseValor(row[6])
      const { statusPg, previsto } = normalizarStatusPg(
        String(row[8] || ''),
        undefined,
        'receitas'
      )

      // Regime Caixa: usar DATA RECEBIMENTO (col 9) para lançamentos recebidos
      // Para provisionados, usar DATA VENDA (col 5) ou VENCIMENTO (col 7)
      const dataReceb = excelDateToJs(row[9])
      const dataVenda = excelDateToJs(row[5]) || excelDateToJs(row[7])
      const dataRef = previsto ? dataVenda : (dataReceb || dataVenda)
      const linhaM = dataRef ? dataRef.getMonth() + 1 : mes
      const linhaA = dataRef ? dataRef.getFullYear() : ano

      lancamentos.push({
        importacaoId,
        clienteId,
        mes: linhaM,
        ano: linhaA,
        favorecido: String(row[0] || '').trim() || null,
        planoConta,
        grupoConta,
        area: String(row[2] || '').trim() || null,
        advogado: String(row[3] || '').trim() || null,
        descricao: String(row[4] || '').trim() || null,
        dataCompetencia: excelDateToJs(row[5]),
        valor,
        dataVencimento: excelDateToJs(row[7]),
        statusPg,
        dataPagamento: dataReceb,
        formaPagamento: String(row[11] || '').trim() || null,
        banco: String(row[10] || '').trim() || null,
        conciliado: String(row[12] || '').toUpperCase().includes('CONCILIADO'),
        observacoes: String(row[13] || '').trim() || null,
        tipo,
        subtipo,
        previsto,
      })

      processadas++
    } catch (err: any) {
      erros.push(`Linha ${i + 1}: ${err.message}`)
    }
  }

  if (lancamentos.length > 0) {
    await prisma.lancamento.createMany({ data: lancamentos })
  }

  return { total: data.length - 1, processadas, erros }
}

/**
 * Processa um arquivo de importação completo.
 * Detecta o tipo (receitas/despesas), importa, e recalcula o fechamento.
 */
export async function processarImportacao(importacaoId: string): Promise<void> {
  const importacao = await prisma.importacao.findUnique({
    where: { id: importacaoId },
  })

  if (!importacao) throw new Error('Importação não encontrada')

  try {
    await prisma.importacao.update({
      where: { id: importacaoId },
      data: { status: 'processando' },
    })

    // Ler arquivo do disco
    const fs = await import('fs')
    const path = await import('path')
    const storagePath = process.env.STORAGE_PATH || './uploads'
    const filePath = path.join(storagePath, importacao.nomeArquivo)
    const buffer = fs.readFileSync(filePath)

    let resultado: { total: number; processadas: number; erros: string[] }

    if (importacao.tipo === 'despesas') {
      resultado = await processarDespesas(
        buffer,
        importacao.clienteId,
        importacao.mes,
        importacao.ano,
        importacaoId
      )
    } else if (importacao.tipo === 'receitas') {
      resultado = await processarReceitas(
        buffer,
        importacao.clienteId,
        importacao.mes,
        importacao.ano,
        importacaoId
      )
    } else {
      throw new Error(`Tipo de importação não suportado: ${importacao.tipo}`)
    }

    await prisma.importacao.update({
      where: { id: importacaoId },
      data: {
        status: resultado.erros.length > 0 ? 'concluido' : 'concluido',
        totalLinhas: resultado.total,
        linhasProcessadas: resultado.processadas,
        erro: resultado.erros.length > 0 ? resultado.erros.join('\n') : null,
      },
    })

    // Recalcular fechamento de todos os meses encontrados no arquivo
    const mesesNoArquivo = await prisma.lancamento.findMany({
      where: { importacaoId },
      select: { mes: true, ano: true },
      distinct: ['mes', 'ano'],
    })

    for (const { mes: m, ano: a } of mesesNoArquivo) {
      await calcularFechamento(importacao.clienteId, m, a)
    }

    // Garantir que o mês da importação também seja calculado
    const jaCalculado = mesesNoArquivo.some(
      x => x.mes === importacao.mes && x.ano === importacao.ano
    )
    if (!jaCalculado) {
      await calcularFechamento(importacao.clienteId, importacao.mes, importacao.ano)
    }
  } catch (err: any) {
    await prisma.importacao.update({
      where: { id: importacaoId },
      data: {
        status: 'erro',
        erro: err.message,
      },
    })
    throw err
  }
}
