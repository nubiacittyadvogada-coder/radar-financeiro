/**
 * Parser de extratos bancários
 * Suporta: OFX (Banco do Brasil, Itaú, Sicredi), CSV genérico
 */

export interface TransacaoExtrato {
  data: Date
  descricao: string
  valor: number        // positivo = crédito, negativo = débito
  tipo: 'credito' | 'debito'
  id?: string          // ID da transação no banco
}

// ─── OFX Parser ───────────────────────────────────────────────────────────────
// OFX é um formato SGML (parecido com XML mas sem fechamento de tags)
// Usado por BB, Itaú, Sicredi, Bradesco, etc.

export function parsearOFX(conteudo: string): TransacaoExtrato[] {
  const transacoes: TransacaoExtrato[] = []

  // Normalizar quebras de linha e remover BOM
  const texto = conteudo.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n').replace(/\r/g, '\n')

  // Encontrar todas as transações entre <STMTTRN> e </STMTTRN>
  const blocos = texto.match(/<STMTTRN>[\s\S]*?<\/STMTTRN>/gi) || []

  for (const bloco of blocos) {
    const trnType = extrairTag(bloco, 'TRNTYPE')
    const dtPosted = extrairTag(bloco, 'DTPOSTED')
    const trnAmt = extrairTag(bloco, 'TRNAMT')
    const memo = extrairTag(bloco, 'MEMO') || extrairTag(bloco, 'NAME') || ''
    const fitId = extrairTag(bloco, 'FITID')

    if (!dtPosted || !trnAmt) continue

    const valor = parseFloat(trnAmt.replace(',', '.'))
    if (isNaN(valor) || valor === 0) continue

    const data = parsearDataOFX(dtPosted)
    if (!data) continue

    transacoes.push({
      data,
      descricao: limparDescricao(memo),
      valor: Math.abs(valor),
      tipo: valor > 0 ? 'credito' : 'debito',
      id: fitId || undefined,
    })
  }

  return transacoes.sort((a, b) => a.data.getTime() - b.data.getTime())
}

// ─── CSV Parser ───────────────────────────────────────────────────────────────

export function parsearCSV(conteudo: string, banco: string): TransacaoExtrato[] {
  const linhas = conteudo
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0)

  if (banco === 'itau') return parsearCSVItau(linhas)
  if (banco === 'bb') return parsearCSVBB(linhas)
  if (banco === 'sicredi') return parsearCSVSicredi(linhas)

  return parsearCSVGenerico(linhas)
}

// Itaú CSV: Data;Histórico;Docto.;Crédito;Débito;Saldo
function parsearCSVItau(linhas: string[]): TransacaoExtrato[] {
  const transacoes: TransacaoExtrato[] = []
  // Pular cabeçalho e linhas de saldo final
  for (const linha of linhas) {
    const cols = linha.split(';')
    if (cols.length < 5) continue
    const data = parsearDataBR(cols[0].trim())
    if (!data) continue
    const historico = cols[1]?.trim() || ''
    if (historico.toLowerCase().includes('saldo') || historico === '') continue

    const credito = parsearValorBR(cols[3])
    const debito = parsearValorBR(cols[4])

    if (credito > 0) {
      transacoes.push({ data, descricao: limparDescricao(historico), valor: credito, tipo: 'credito' })
    } else if (debito > 0) {
      transacoes.push({ data, descricao: limparDescricao(historico), valor: debito, tipo: 'debito' })
    }
  }
  return transacoes
}

// Banco do Brasil CSV: Data;Histórico;Documento;Crédito;Débito;Saldo
function parsearCSVBB(linhas: string[]): TransacaoExtrato[] {
  const transacoes: TransacaoExtrato[] = []
  for (const linha of linhas) {
    const cols = linha.split(';')
    if (cols.length < 5) continue
    const data = parsearDataBR(cols[0].trim())
    if (!data) continue
    const historico = cols[1]?.trim() || ''
    if (historico === '' || historico.toLowerCase().includes('saldo')) continue

    const credito = parsearValorBR(cols[3])
    const debito = parsearValorBR(cols[4])

    if (credito > 0) {
      transacoes.push({ data, descricao: limparDescricao(historico), valor: credito, tipo: 'credito' })
    } else if (debito > 0) {
      transacoes.push({ data, descricao: limparDescricao(historico), valor: debito, tipo: 'debito' })
    }
  }
  return transacoes
}

// Sicredi CSV: similar ao BB
function parsearCSVSicredi(linhas: string[]): TransacaoExtrato[] {
  return parsearCSVBB(linhas) // Formato muito similar
}

// Genérico: tenta inferir colunas
function parsearCSVGenerico(linhas: string[]): TransacaoExtrato[] {
  const transacoes: TransacaoExtrato[] = []
  const sep = linhas[0]?.includes(';') ? ';' : ','

  for (let i = 1; i < linhas.length; i++) {
    const cols = linhas[i].split(sep).map(c => c.trim().replace(/"/g, ''))
    if (cols.length < 3) continue

    // Tenta encontrar data na primeira coluna
    const data = parsearDataBR(cols[0]) || parsearDataOFX(cols[0])
    if (!data) continue

    const descricao = cols[1] || ''
    // Tenta achar valor em qualquer coluna numérica
    for (let j = 2; j < cols.length; j++) {
      const v = parsearValorBR(cols[j])
      if (v !== 0) {
        transacoes.push({
          data,
          descricao: limparDescricao(descricao),
          valor: Math.abs(v),
          tipo: v > 0 ? 'credito' : 'debito',
        })
        break
      }
    }
  }
  return transacoes
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extrairTag(texto: string, tag: string): string {
  // OFX não tem fechamento de tag: <TAG>valor\n
  const regex = new RegExp(`<${tag}>([^<\\n\\r]*)`, 'i')
  const match = texto.match(regex)
  return match ? match[1].trim() : ''
}

function parsearDataOFX(dtStr: string): Date | null {
  // Formatos: 20260101, 20260101120000, 20260101120000[-3:BRT]
  const limpa = dtStr.replace(/\[.*\]/, '').trim()
  const ano = parseInt(limpa.substring(0, 4))
  const mes = parseInt(limpa.substring(4, 6)) - 1
  const dia = parseInt(limpa.substring(6, 8))
  if (isNaN(ano) || isNaN(mes) || isNaN(dia)) return null
  return new Date(ano, mes, dia, 12, 0, 0)
}

function parsearDataBR(str: string): Date | null {
  // DD/MM/YYYY ou DD/MM/YY
  const m = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (!m) return null
  const dia = parseInt(m[1])
  const mes = parseInt(m[2]) - 1
  let ano = parseInt(m[3])
  if (ano < 100) ano += 2000
  return new Date(ano, mes, dia, 12, 0, 0)
}

function parsearValorBR(str: string): number {
  if (!str) return 0
  const limpa = str.trim().replace(/\s/g, '').replace('R$', '')
  if (!limpa || limpa === '-') return 0
  // 1.234,56 → 1234.56
  const normalizado = limpa.replace(/\./g, '').replace(',', '.')
  const v = parseFloat(normalizado)
  return isNaN(v) ? 0 : v
}

function limparDescricao(desc: string): string {
  return desc
    .replace(/\s+/g, ' ')
    .replace(/['"]/g, '')
    .trim()
    .substring(0, 120)
}
