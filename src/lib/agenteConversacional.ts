/**
 * Agente conversacional de cobrança.
 * Processa mensagens recebidas de devedores via WhatsApp e responde com IA.
 * Regra: desconto ≤ 10% → aprovação automática. > 10% → aguarda dono aprovar.
 */

import prisma from '@/server/lib/db'
import { getZApiClient } from './zapi'

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'
const DESCONTO_AUTOMATICO_MAX = 10 // %

type AcaoAgente =
  | { tipo: 'responder'; mensagem: string }
  | { tipo: 'enviar_pix'; mensagem: string; cobrancaId: string }
  | { tipo: 'propor_acordo'; mensagem: string; desconto: number; parcelas: number; cobrancaId: string }
  | { tipo: 'aguardar_aprovacao'; mensagem: string; desconto: number; parcelas: number; cobrancaId: string; mensagemParaDevedor: string }

/**
 * Processa uma mensagem recebida de um devedor e executa a ação adequada.
 */
export async function processarMensagemDevedor(
  contaEmpresa: {
    id: string
    nomeEmpresa: string
    zapiInstanceId?: string | null
    zapiToken?: string | null
    zapiClientToken?: string | null
    zapiInstanceIdCobranca?: string | null
    zapiTokenCobranca?: string | null
    zapiClientTokenCobranca?: string | null
    telefoneAlerta?: string | null
    asaasAtivo: boolean
    asaasApiKey?: string | null
    cobrancaDescontoMax?: any
    cobrancaParcelasMax?: any
    chavePix?: string | null
  },
  telefoneDevedor: string,
  mensagemTexto: string
): Promise<void> {
  // Normaliza telefone recebido (só dígitos)
  const telNormalizado = telefoneDevedor.replace(/\D/g, '')

  // Busca todos devedores da empresa e compara telefone normalizado
  const devedores = await prisma.clienteDevedor.findMany({
    where: { contaEmpresaId: contaEmpresa.id, ativo: true },
    include: {
      cobrancas: {
        where: { status: 'pendente' },
        orderBy: { vencimento: 'asc' },
      },
      mensagens: {
        orderBy: { criadoEm: 'desc' },
        take: 10,
      },
    },
  })

  const devedor = devedores.find(d => {
    if (!d.telefone) return false
    const telDB = d.telefone.replace(/\D/g, '')
    // Compara exato, ou sem o 55 do país, ou adicionando 55
    return telDB === telNormalizado
      || telDB === `55${telNormalizado}`
      || `55${telDB}` === telNormalizado
      || telDB.slice(-10) === telNormalizado.slice(-10) // últimos 10 dígitos (DDD+número)
  })

  if (!devedor) {
    console.log(`[Agente] Mensagem ignorada — número ${telefoneDevedor} não cadastrado como devedor na empresa ${contaEmpresa.nomeEmpresa}`)
    return
  }

  // Salva mensagem recebida
  await prisma.mensagemCobranca.create({
    data: {
      clienteDevedorId: devedor.id,
      direcao: 'recebida',
      canal: 'whatsapp',
      conteudo: mensagemTexto,
      enviado: true,
    },
  })

  if (devedor.cobrancas.length === 0) {
    // Sem cobranças pendentes — agradece
    await enviarResposta(contaEmpresa, devedor, 'Olá! Não encontrei cobranças pendentes em seu cadastro. Se precisar de algo, estamos à disposição.')
    return
  }

  console.log(`[Agente] Devedor encontrado: ${devedor.nome} | ${devedor.cobrancas.length} cobrança(s) pendente(s)`)

  // Monta contexto para a IA
  const acao = await decidirAcao(contaEmpresa, devedor, mensagemTexto)
  console.log(`[Agente] Ação decidida: ${acao.tipo} para ${devedor.nome}`)
  await executarAcao(contaEmpresa, devedor, acao)
  console.log(`[Agente] Resposta enviada para ${devedor.nome} (${devedor.telefone})`)
}

async function decidirAcao(
  conta: any,
  devedor: any,
  mensagem: string
): Promise<AcaoAgente> {
  const totalDevido = devedor.cobrancas.reduce((s: number, c: any) => s + Number(c.valor), 0)
  const cobrancaPrincipal = devedor.cobrancas[0]
  const diasAtraso = Math.max(0, Math.floor(
    (Date.now() - new Date(cobrancaPrincipal.vencimento).getTime()) / (1000 * 60 * 60 * 24)
  ))
  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
  const limiteDesconto = Number(conta.cobrancaDescontoMax) || 30

  // Histórico recente (últimas mensagens)
  const historico = devedor.mensagens
    .reverse()
    .map((m: any) => `[${m.direcao === 'enviada' ? 'Advogado' : devedor.nome}]: ${m.conteudo}`)
    .join('\n')

  const cobrancasTexto = devedor.cobrancas
    .map((c: any) => `• ${c.descricao} — ${fmt(Number(c.valor))} (venc. ${new Date(c.vencimento).toLocaleDateString('pt-BR')})`)
    .join('\n')

  const prompt = `Você é o assistente de cobrança de ${conta.nomeEmpresa}. Seu papel é negociar a quitação de dívidas de forma respeitosa e eficiente.

DADOS DO DEVEDOR:
- Nome: ${devedor.nome}
- Total devido: ${fmt(totalDevido)}
- Dias em atraso: ${diasAtraso}
- Perfil: ${devedor.perfilDevedor}

COBRANÇAS PENDENTES:
${cobrancasTexto}

HISTÓRICO DA CONVERSA:
${historico}

NOVA MENSAGEM DO DEVEDOR: "${mensagem}"

REGRAS:
- Você pode oferecer desconto de até ${DESCONTO_AUTOMATICO_MAX}% automaticamente
- Acima de ${DESCONTO_AUTOMATICO_MAX}%, você propõe mas avisa que precisa de aprovação
- O desconto máximo possível é ${limiteDesconto}%
- Você pode parcelar em até ${conta.cobrancaParcelasMax || 12}x
- Seja profissional, direto e empático
- Máximo 120 palavras por resposta
- Português brasileiro

Responda em JSON com exatamente este formato:
{
  "acao": "responder" | "enviar_pix" | "propor_acordo" | "aguardar_aprovacao",
  "mensagem": "texto da resposta para o devedor",
  "desconto": 0,
  "parcelas": 1,
  "motivo": "breve explicação da decisão"
}

- "responder": apenas responde sem proposta formal
- "enviar_pix": devedor quer pagar — envie o link de pagamento
- "propor_acordo": desconto ≤ ${DESCONTO_AUTOMATICO_MAX}% — pode fechar automaticamente
- "aguardar_aprovacao": desconto > ${DESCONTO_AUTOMATICO_MAX}% — precisa aprovação do advogado`

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) return { tipo: 'responder', mensagem: gerarRespostaFallback(mensagem, devedor) }

    const res = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    const data = await res.json()
    const texto = data.content?.[0]?.text || ''
    const json = JSON.parse(texto.match(/\{[\s\S]*\}/)?.[0] || '{}')

    const desconto = Number(json.desconto) || 0
    const parcelas = Number(json.parcelas) || 1
    const mensagemIA = json.mensagem || gerarRespostaFallback(mensagem, devedor)

    if (json.acao === 'enviar_pix') {
      return { tipo: 'enviar_pix', mensagem: mensagemIA, cobrancaId: cobrancaPrincipal.id }
    }

    if (json.acao === 'propor_acordo' || json.acao === 'aguardar_aprovacao') {
      if (desconto > DESCONTO_AUTOMATICO_MAX) {
        // Mensagem para o devedor dizendo que está verificando
        const msgEspera = `${devedor.nome}, recebi sua proposta. Vou verificar com nossa equipe e retorno em breve com uma resposta. 🙏`
        return {
          tipo: 'aguardar_aprovacao',
          mensagem: msgEspera,
          desconto,
          parcelas,
          cobrancaId: cobrancaPrincipal.id,
          mensagemParaDevedor: mensagemIA,
        }
      }
      return { tipo: 'propor_acordo', mensagem: mensagemIA, desconto, parcelas, cobrancaId: cobrancaPrincipal.id }
    }

    return { tipo: 'responder', mensagem: mensagemIA }
  } catch {
    return { tipo: 'responder', mensagem: gerarRespostaFallback(mensagem, devedor) }
  }
}

async function executarAcao(conta: any, devedor: any, acao: AcaoAgente): Promise<void> {
  const zapi = getZApiClient(conta, 'cobranca')

  if (acao.tipo === 'responder') {
    await enviarResposta(conta, devedor, acao.mensagem)
    return
  }

  if (acao.tipo === 'enviar_pix') {
    const cobranca = devedor.cobrancas.find((c: any) => c.id === acao.cobrancaId)
    const linkPix = cobranca?.asaasLink || null
    let mensagemFinal = acao.mensagem
    if (linkPix) {
      mensagemFinal += `\n\n💳 *Link de pagamento:*\n${linkPix}`
    } else if (conta.chavePix) {
      mensagemFinal += `\n\n🔑 *PIX:* ${conta.chavePix}`
    }
    await enviarResposta(conta, devedor, mensagemFinal)
    return
  }

  if (acao.tipo === 'propor_acordo') {
    const cobranca = devedor.cobrancas.find((c: any) => c.id === acao.cobrancaId)
    if (!cobranca) return
    const valorAcordado = Number(cobranca.valor) * (1 - acao.desconto / 100)

    // Salva acordo aprovado automaticamente
    await prisma.acordoCobranca.create({
      data: {
        clienteDevedorId: devedor.id,
        cobrancaId: acao.cobrancaId,
        tipo: acao.desconto > 0 && acao.parcelas > 1 ? 'desconto_parcelamento' : acao.desconto > 0 ? 'desconto' : 'parcelamento',
        valorOriginal: Number(cobranca.valor),
        valorAcordado,
        parcelas: acao.parcelas,
        status: 'aceito',
        precisaAprovacao: false,
        aprovadoPor: 'automatico',
        aprovadoEm: new Date(),
      },
    })

    await enviarResposta(conta, devedor, acao.mensagem)
    return
  }

  if (acao.tipo === 'aguardar_aprovacao') {
    const cobranca = devedor.cobrancas.find((c: any) => c.id === acao.cobrancaId)
    if (!cobranca) return
    const valorAcordado = Number(cobranca.valor) * (1 - acao.desconto / 100)
    const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

    // Salva acordo pendente de aprovação
    const acordo = await prisma.acordoCobranca.create({
      data: {
        clienteDevedorId: devedor.id,
        cobrancaId: acao.cobrancaId,
        tipo: acao.desconto > 0 && acao.parcelas > 1 ? 'desconto_parcelamento' : acao.desconto > 0 ? 'desconto' : 'parcelamento',
        valorOriginal: Number(cobranca.valor),
        valorAcordado,
        parcelas: acao.parcelas,
        status: 'aguardando_aprovacao',
        precisaAprovacao: true,
        mensagemProposta: acao.mensagemParaDevedor,
      },
    })

    // Envia mensagem de espera para o devedor
    await enviarResposta(conta, devedor, acao.mensagem)

    // Notifica o dono via WhatsApp (instância jurídica para alertas internos)
    const zapiJuridico = getZApiClient(conta, 'juridico')
    if (conta.telefoneAlerta && zapiJuridico) {
      const notificacao = `🔔 *Radar Financeiro — Aprovação necessária*\n\n` +
        `*Devedor:* ${devedor.nome}\n` +
        `*Proposta:* ${acao.desconto}% de desconto em ${acao.parcelas}x\n` +
        `*Valor original:* ${fmt(Number(cobranca.valor))}\n` +
        `*Valor acordado:* ${fmt(valorAcordado)}\n\n` +
        `Acesse Cobranças no Radar para aprovar ou recusar.`
      await zapiJuridico.enviarTexto(conta.telefoneAlerta, notificacao)
    }
    return
  }
}

async function enviarResposta(conta: any, devedor: any, mensagem: string): Promise<void> {
  if (!devedor.telefone) return
  const zapi = getZApiClient(conta, 'cobranca')
  let enviado = false
  if (zapi) {
    enviado = await zapi.enviarTexto(devedor.telefone, mensagem)
  }
  await prisma.mensagemCobranca.create({
    data: {
      clienteDevedorId: devedor.id,
      direcao: 'enviada',
      canal: 'whatsapp',
      conteudo: mensagem,
      enviado,
    },
  })
}

function gerarRespostaFallback(mensagem: string, devedor: any): string {
  const lower = mensagem.toLowerCase()
  if (lower.includes('pix') || lower.includes('pagar') || lower.includes('pago')) {
    return `${devedor.nome}, vou gerar o link de pagamento para você. Um momento! 🙏`
  }
  if (lower.includes('parcel') || lower.includes('prazo') || lower.includes('dividir')) {
    return `${devedor.nome}, entendo sua situação. Podemos verificar opções de parcelamento. Me diga quantas parcelas você consegue arcar.`
  }
  if (lower.includes('desconto') || lower.includes('reduz') || lower.includes('negociar')) {
    return `${devedor.nome}, vou verificar o que podemos fazer e retorno em breve com uma proposta.`
  }
  return `Olá, ${devedor.nome}! Recebemos sua mensagem e retornaremos em breve. Qualquer dúvida, estamos à disposição.`
}
