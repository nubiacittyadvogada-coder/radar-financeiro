/**
 * POST /api/v2/empresa/importar-ofx
 * Parseia arquivo OFX (Sicredi / qualquer banco) e retorna preview das transações.
 * Tenta casar créditos com clientes pelo CPF/CNPJ presente no campo NAME ou MEMO.
 */

import { NextRequest } from 'next/server'
import { getUsuario, getEmpresaUserId } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

export const maxDuration = 30

// ─── Parser OFX ──────────────────────────────────────────────────────────────

interface OFXTransacao {
  fitid: string
  tipo: 'credito' | 'debito'
  data: string           // YYYY-MM-DD
  valor: number          // sempre positivo
  descricao: string
  cpfCnpjDetectado: string | null
}

function extrairTag(bloco: string, tag: string): string {
  const m = bloco.match(new RegExp(`<${tag}>([^<\r\n]+)`, 'i'))
  return m ? m[1].trim() : ''
}

function parsearDataOFX(dtRaw: string): string {
  // Formatos Sicredi: 20240315120000[-3:BRT] ou 20240315
  const digits = dtRaw.replace(/[^0-9]/g, '').slice(0, 8)
  if (digits.length < 8) return new Date().toISOString().slice(0, 10)
  const y = digits.slice(0, 4)
  const m = digits.slice(4, 6)
  const d = digits.slice(6, 8)
  return `${y}-${m}-${d}`
}

function extrairCpfCnpj(texto: string): string | null {
  // CNPJ: 14 dígitos (formatado ou não)
  const cnpj = texto.match(/\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/)
  if (cnpj) {
    const digits = cnpj[0].replace(/\D/g, '')
    if (digits.length === 14) return digits
  }
  // CPF: 11 dígitos
  const cpf = texto.match(/\d{3}\.?\d{3}\.?\d{3}-?\d{2}/)
  if (cpf) {
    const digits = cpf[0].replace(/\D/g, '')
    if (digits.length === 11) return digits
  }
  return null
}

function parsearOFX(conteudo: string): OFXTransacao[] {
  const transacoes: OFXTransacao[] = []

  // Tenta XML primeiro (tags fechadas), depois SGML (sem fechamento)
  let blocos: string[] = []

  // XML-style: <STMTTRN>...</STMTTRN>
  const matchesXml = conteudo.match(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi)
  if (matchesXml && matchesXml.length > 0) {
    blocos = matchesXml
  } else {
    // SGML-style: entre <STMTTRN> tags (sem fechamento)
    const partes = conteudo.split(/<STMTTRN>/i)
    if (partes.length > 1) {
      // partes[0] é cabeçalho, resto são blocos de transação
      blocos = partes.slice(1).map(p => {
        // Termina no próximo bloco de nível superior
        const fim = p.search(/<\/(BANKTRANLIST|STMTTRNRS|OFX)>/i)
        return fim > 0 ? p.slice(0, fim) : p
      })
    }
  }

  for (const bloco of blocos) {
    const trntype = extrairTag(bloco, 'TRNTYPE').toUpperCase()
    const dtposted = extrairTag(bloco, 'DTPOSTED')
    const trnamtRaw = extrairTag(bloco, 'TRNAMT').replace(',', '.')
    const fitid = extrairTag(bloco, 'FITID') || String(Math.random())
    const name = extrairTag(bloco, 'NAME')
    const memo = extrairTag(bloco, 'MEMO')

    const trnamt = parseFloat(trnamtRaw)
    if (isNaN(trnamt) || trnamt === 0) continue

    const tipo: 'credito' | 'debito' = trnamt > 0 ? 'credito' : 'debito'
    const valor = Math.abs(trnamt)
    const data = parsearDataOFX(dtposted)

    // Descrição: prefere MEMO se tiver conteúdo, senão NAME
    const descricao = memo || name || `${trntype} ${data}`

    // Tenta extrair CPF/CNPJ do texto combinado
    const textoCompleto = `${name} ${memo}`
    const cpfCnpjDetectado = extrairCpfCnpj(textoCompleto)

    transacoes.push({ fitid, tipo, data, valor, descricao, cpfCnpjDetectado })
  }

  return transacoes
}

// ─── Classificação simplificada para débitos ────────────────────────────────

function classificarDebito(descricao: string): { planoConta: string; tipo: string; subtipo: string; grupoConta: string } {
  const d = descricao.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')

  if (d.match(/salario|prolabore|pro-labore|folha|rescisao|ferias|13|decimo/))
    return { planoConta: '04_PES.SALÁRIOS E PRÓ-LABORE', tipo: 'pessoal', subtipo: 'salarios', grupoConta: 'Despesas' }
  if (d.match(/aluguel|locacao|iptu|condominio/))
    return { planoConta: '04_GER.ALUGUEL', tipo: 'geral', subtipo: 'aluguel', grupoConta: 'Despesas' }
  if (d.match(/google|meta|facebook|instagram|marketing|publicidade|anuncio/))
    return { planoConta: '04_MKT.MARKETING DIGITAL', tipo: 'marketing', subtipo: 'marketing_digital', grupoConta: 'Despesas' }
  if (d.match(/das|simples|irpj|csll|iss|cofins|pis|imposto|tributo/))
    return { planoConta: '02_IMP.SIMPLES NACIONAL', tipo: 'imposto', subtipo: 'simples_nacional', grupoConta: 'Despesas' }
  if (d.match(/banco|tarifa|ted|doc|manutencao conta|juros/))
    return { planoConta: '04_GER.DESPESAS BANCÁRIAS', tipo: 'geral', subtipo: 'despesas_bancarias', grupoConta: 'Despesas' }
  if (d.match(/sistema|software|assinatura|plano|licenca/))
    return { planoConta: '04_GER.SOFTWARES E SISTEMAS', tipo: 'geral', subtipo: 'softwares_sistemas', grupoConta: 'Despesas' }
  if (d.match(/retirada|socio|distribuicao|dividendo/))
    return { planoConta: '05_RET.RETIRADA', tipo: 'retirada', subtipo: 'retirada', grupoConta: 'Despesas' }

  return { planoConta: '04_GER.DESPESAS GERAIS', tipo: 'geral', subtipo: 'despesas_gerais', grupoConta: 'Despesas' }
}

// ─── Route ───────────────────────────────────────────────────────────────────

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
      return Response.json({ erro: 'Envie um arquivo .ofx ou .qfx exportado pelo banco' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    // OFX pode estar em latin-1 ou utf-8
    let conteudo = ''
    try {
      conteudo = new TextDecoder('utf-8').decode(buffer)
    } catch {
      conteudo = new TextDecoder('latin1').decode(buffer)
    }

    const transacoesOFX = parsearOFX(conteudo)
    if (transacoesOFX.length === 0) {
      return Response.json({ erro: 'Nenhuma transação encontrada no arquivo OFX. Verifique se o arquivo é um extrato bancário válido.' }, { status: 400 })
    }

    // Busca todos os clientes da empresa para casar CPF/CNPJ
    const clientes = await prisma.clienteDevedor.findMany({
      where: { contaEmpresaId: conta.id, cpfCnpj: { not: null } },
      select: { id: true, nome: true, cpfCnpj: true },
    })

    // Índice CPF/CNPJ (só dígitos) → cliente
    const indiceCpfCnpj: Record<string, { id: string; nome: string }> = {}
    for (const c of clientes) {
      if (c.cpfCnpj) {
        const digits = c.cpfCnpj.replace(/\D/g, '')
        indiceCpfCnpj[digits] = { id: c.id, nome: c.nome }
      }
    }

    // Extrai período do arquivo
    const datasArr = transacoesOFX.map(t => t.data).sort()
    const periodo = datasArr.length > 0
      ? `${datasArr[0]} a ${datasArr[datasArr.length - 1]}`
      : 'período desconhecido'

    // Monta transações enriquecidas para o preview
    const transacoes = transacoesOFX.map(t => {
      let clienteEncontrado: { id: string; nome: string } | null = null
      if (t.cpfCnpjDetectado) {
        clienteEncontrado = indiceCpfCnpj[t.cpfCnpjDetectado] || null
      }

      if (t.tipo === 'credito') {
        return {
          fitid: t.fitid,
          tipo: 'receita',
          data: t.data,
          valor: t.valor,
          descricao: t.descricao,
          cpfCnpjDetectado: t.cpfCnpjDetectado,
          clienteNome: clienteEncontrado?.nome || null,
          planoConta: '01_RPS.HONORÁRIOS MENSAIS',
          grupoConta: 'Receitas',
          tipoLancamento: 'receita',
          subtipo: 'honorario_mensal',
        }
      } else {
        const cls = classificarDebito(t.descricao)
        return {
          fitid: t.fitid,
          tipo: 'despesa',
          data: t.data,
          valor: t.valor,
          descricao: t.descricao,
          cpfCnpjDetectado: t.cpfCnpjDetectado,
          clienteNome: null,
          planoConta: cls.planoConta,
          grupoConta: cls.grupoConta,
          tipoLancamento: cls.tipo,
          subtipo: cls.subtipo,
        }
      }
    })

    const totalCreditos = transacoes.filter(t => t.tipo === 'receita').reduce((s, t) => s + t.valor, 0)
    const totalDebitos = transacoes.filter(t => t.tipo === 'despesa').reduce((s, t) => s + t.valor, 0)
    const creditosComCliente = transacoes.filter(t => t.tipo === 'receita' && t.clienteNome).length

    return Response.json({
      transacoes,
      periodo,
      totalCreditos,
      totalDebitos,
      creditosComCliente,
      banco: 'Sicredi',
    })
  } catch (err: any) {
    console.error('[importar-ofx]', err.message)
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
