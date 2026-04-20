/**
 * POST /api/v2/empresa/importar-asaas-ofx
 * Preview do extrato OFX do Asaas para importação.
 *
 * Lógica por TRNTYPE:
 * - CREDIT (Cobrança recebida): ignora — já lançado via webhook Asaas
 * - FEE (Taxa de boleto/PIX/cartão/mensageria/WhatsApp): importa como despesa 04_GER.TAXAS ASAAS
 * - XFER para empresa ("NUBIA CITTY ADVOGADOS"): ignora — aparece no extrato Sicredi como crédito
 * - XFER pessoal (outros destinatários): importa como retirada/pró-labore
 *
 * Dedup: FITIDs armazenados em observacoes = "asaas_ofx:FITID"
 */

import { NextRequest } from 'next/server'
import { getUsuario, getEmpresaUserId } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

export const maxDuration = 30

interface AsaasTransacao {
  fitid: string
  trntype: string    // CREDIT, FEE, XFER
  data: string       // YYYY-MM-DD
  valor: number      // sempre positivo
  descricao: string
}

function extrairTag(bloco: string, tag: string): string {
  const m = bloco.match(new RegExp(`<${tag}>([^<\r\n]+)`, 'i'))
  return m ? m[1].trim() : ''
}

function parsearDataOFX(dtRaw: string): string {
  const digits = dtRaw.replace(/[^0-9]/g, '').slice(0, 8)
  if (digits.length < 8) return new Date().toISOString().slice(0, 10)
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`
}

function parsearOFX(conteudo: string): AsaasTransacao[] {
  const transacoes: AsaasTransacao[] = []

  let blocos: string[] = []
  const matchesXml = conteudo.match(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi)
  if (matchesXml && matchesXml.length > 0) {
    blocos = matchesXml
  } else {
    const partes = conteudo.split(/<STMTTRN>/i)
    if (partes.length > 1) {
      blocos = partes.slice(1).map(p => {
        const fim = p.search(/<\/(BANKTRANLIST|STMTTRNRS|OFX)>/i)
        return fim > 0 ? p.slice(0, fim) : p
      })
    }
  }

  for (const bloco of blocos) {
    const trnamt = parseFloat(extrairTag(bloco, 'TRNAMT').replace(',', '.'))
    if (isNaN(trnamt) || trnamt === 0) continue

    const fitid = extrairTag(bloco, 'FITID') || String(Date.now() + Math.random())
    const trntype = extrairTag(bloco, 'TRNTYPE').toUpperCase()
    const dtposted = extrairTag(bloco, 'DTPOSTED')
    const memo = extrairTag(bloco, 'MEMO') || extrairTag(bloco, 'NAME') || ''
    const data = parsearDataOFX(dtposted)

    transacoes.push({ fitid, trntype, data, valor: Math.abs(trnamt), descricao: memo })
  }

  return transacoes
}

// XFER para a conta da empresa no Sicredi → não criar lancamento (já virá pelo extrato Sicredi)
const NOMES_EMPRESA = ['NUBIA CITTY ADVOGADOS']

function isXferEmpresa(t: AsaasTransacao): boolean {
  const d = t.descricao.toUpperCase()
  return t.trntype === 'XFER' && NOMES_EMPRESA.some(n => d.includes(n))
}

function isXferPessoal(t: AsaasTransacao): boolean {
  return t.trntype === 'XFER' && !isXferEmpresa(t)
}

export async function POST(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: getEmpresaUserId(u) } })
    if (!conta) return Response.json({ erro: 'Conta não encontrada' }, { status: 404 })

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return Response.json({ erro: 'Arquivo não enviado' }, { status: 400 })

    const ext = file.name.toLowerCase()
    if (!ext.endsWith('.ofx') && !ext.endsWith('.qfx') && !ext.endsWith('.txt')) {
      return Response.json({ erro: 'Envie um arquivo .ofx exportado do Asaas' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    let conteudo = ''
    try { conteudo = new TextDecoder('utf-8').decode(buffer) }
    catch { conteudo = new TextDecoder('latin1').decode(buffer) }

    const todas = parsearOFX(conteudo)
    if (todas.length === 0) {
      return Response.json({ erro: 'Nenhuma transação encontrada no arquivo OFX.' }, { status: 400 })
    }

    // Separa por categoria
    const creditos = todas.filter(t => t.trntype === 'CREDIT')
    const fees = todas.filter(t => t.trntype === 'FEE')
    const xfersEmpresa = todas.filter(isXferEmpresa)
    const xfersPessoal = todas.filter(isXferPessoal)

    // FITIDs já importados via Asaas OFX
    const fitidsExistentes = new Set(
      (await prisma.lancamentoEmpresa.findMany({
        where: { contaEmpresaId: conta.id, observacoes: { startsWith: 'asaas_ofx:' } },
        select: { observacoes: true },
      })).map(l => l.observacoes?.replace('asaas_ofx:', '') || '')
    )

    const feesNovas = fees.filter(t => !fitidsExistentes.has(t.fitid))
    const retiradasNovas = xfersPessoal.filter(t => !fitidsExistentes.has(t.fitid))

    // Extrai período
    const datas = todas.map(t => t.data).sort()
    const periodo = datas.length > 0 ? `${datas[0]} a ${datas[datas.length - 1]}` : ''

    // Monta lancamentos preview — com observacoes para FITID dedup no save
    const lancamentos = [
      ...feesNovas.map(t => ({
        fitid: t.fitid,
        tipo: 'despesa',
        subtipo: 'taxas_bancarias',
        planoConta: '04_GER.TAXAS ASAAS',
        grupoConta: 'Despesas',
        tipoLancamento: 'geral',
        descricao: t.descricao,
        valor: t.valor,
        data: t.data,
        pago: true,
        observacoes: `asaas_ofx:${t.fitid}`,
        categoria: 'fee',
      })),
      ...retiradasNovas.map(t => ({
        fitid: t.fitid,
        tipo: 'despesa',
        subtipo: 'retirada',
        planoConta: '05_RET.RETIRADA NÚBIA',
        grupoConta: 'Despesas',
        tipoLancamento: 'retirada',
        descricao: t.descricao,
        valor: t.valor,
        data: t.data,
        pago: true,
        observacoes: `asaas_ofx:${t.fitid}`,
        categoria: 'retirada',
      })),
    ]

    return Response.json({
      lancamentos,
      periodo,
      banco: 'Asaas',
      stats: {
        total: todas.length,
        creditosIgnorados: creditos.length,       // já no sistema via webhook
        feesNovas: feesNovas.length,
        retiradasNovas: retiradasNovas.length,
        xfersEmpresaIgnoradas: xfersEmpresa.length,
        totalFees: feesNovas.reduce((s, t) => s + t.valor, 0),
        totalRetiradas: retiradasNovas.reduce((s, t) => s + t.valor, 0),
        totalTransferidoEmpresa: xfersEmpresa.reduce((s, t) => s + t.valor, 0),
        jaImportados: (fees.length + xfersPessoal.length) - feesNovas.length - retiradasNovas.length,
      },
    })
  } catch (err: any) {
    console.error('[importar-asaas-ofx]', err.message)
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
