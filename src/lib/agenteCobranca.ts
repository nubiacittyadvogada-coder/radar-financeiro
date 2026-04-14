/**
 * Agente de cobrança com IA.
 * Classifica o devedor, gera mensagem personalizada e envia via Z-API.
 * Integra com Asaas para criar/consultar cobranças.
 */

import prisma from '@/server/lib/db'
import { getAsaasClient } from './asaas'
import { getZApiClient } from './zapi'

const ANTHROPIC_API = 'https://api.anthropic.com/v1/messages'

type PerfilDevedor = 'primeiro_atraso' | 'segundo_atraso' | 'recorrente' | 'longo_prazo'

/**
 * Gera mensagem de cobrança personalizada com IA.
 */
async function gerarMensagemCobranca(
  nomeCliente: string,
  descricao: string,
  valor: number,
  diasAtraso: number,
  perfil: PerfilDevedor,
  linkPagamento: string | null
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return gerarMensagemFallback(nomeCliente, descricao, valor, diasAtraso, perfil, linkPagamento)
  }

  const perfilDescricao = {
    primeiro_atraso: 'primeiro atraso — tom amigável e compreensivo, lembre que esquecimentos acontecem',
    segundo_atraso: 'segundo atraso — tom cordial mas direto, reforce a necessidade de regularização e ofereça facilidades de pagamento',
    recorrente: 'atraso recorrente — tom mais firme mas ainda respeitoso, mencione a importância de regularizar',
    longo_prazo: 'longo período em atraso — tom sério, mencione consequências, mas abra espaço para acordo',
  }[perfil]

  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

  const prompt = `Gere uma mensagem de cobrança WhatsApp para o seguinte cenário:
- Cliente: ${nomeCliente}
- Débito: ${descricao}
- Valor: ${fmt(valor)}
- Dias em atraso: ${diasAtraso}
- Perfil: ${perfilDescricao}
${linkPagamento ? `- Link de pagamento: ${linkPagamento}` : ''}

A mensagem deve ser:
- Profissional e respeitosa
- Máximo 150 palavras
- Em português brasileiro
- Incluir o valor e referência do débito
${linkPagamento ? '- Incluir o link de pagamento no final' : ''}
- NÃO incluir saudação genérica como "Prezado"

Responda apenas com o texto da mensagem, sem explicações.`

  try {
    const res = await fetch(ANTHROPIC_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    const data = await res.json()
    return data.content?.[0]?.text || gerarMensagemFallback(nomeCliente, descricao, valor, diasAtraso, perfil, linkPagamento)
  } catch {
    return gerarMensagemFallback(nomeCliente, descricao, valor, diasAtraso, perfil, linkPagamento)
  }
}

function gerarMensagemFallback(
  nome: string,
  descricao: string,
  valor: number,
  diasAtraso: number,
  perfil: PerfilDevedor,
  link: string | null
): string {
  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
  const saudacao = perfil === 'primeiro_atraso'
    ? `Olá, ${nome}! Tudo bem? Passando para lembrá-lo(a)`
    : perfil === 'segundo_atraso'
    ? `${nome}, entramos em contato novamente`
    : perfil === 'recorrente'
    ? `${nome}, verificamos`
    : `${nome}, sua situação`

  const corpo = perfil === 'primeiro_atraso'
    ? `que há um débito em aberto referente a "${descricao}" no valor de ${fmt(valor)}, com ${diasAtraso} dia(s) em atraso. Acreditamos que pode ter sido um esquecimento.`
    : perfil === 'segundo_atraso'
    ? `pois o débito "${descricao}" de ${fmt(valor)} permanece em aberto, com ${diasAtraso} dias em atraso. Gostaríamos de ajudá-lo(a) a regularizar — podemos verificar opções de pagamento facilitado.`
    : perfil === 'recorrente'
    ? `que o débito "${descricao}" de ${fmt(valor)} está com ${diasAtraso} dias em atraso. Regularize para evitar maiores encargos.`
    : `com o débito "${descricao}" de ${fmt(valor)} está com ${diasAtraso} dias em atraso. Entre em contato conosco para negociarmos uma solução.`

  return `${saudacao} ${corpo}${link ? `\n\nPague agora: ${link}` : '\n\nQualquer dúvida, estamos à disposição.'}`
}

/**
 * Executa uma rodada de cobrança para um devedor específico.
 */
export async function executarCobrancaDevedor(cobrancaId: string) {
  const cobranca = await prisma.cobrancaDevedor.findUnique({
    where: { id: cobrancaId },
    include: {
      clienteDevedor: {
        include: { contaEmpresa: true },
      },
    },
  })

  if (!cobranca || cobranca.status !== 'pendente') return

  const { clienteDevedor } = cobranca
  const { contaEmpresa } = clienteDevedor

  // Verifica se cobrança está pausada para este devedor
  if (clienteDevedor.cobrancaPausadaAte && new Date(clienteDevedor.cobrancaPausadaAte) > new Date()) {
    return { enviado: false, pulado: true, motivo: 'cobrança pausada manualmente' }
  }

  // Verifica intervalo mínimo de 3 dias desde a última mensagem enviada ao devedor
  const INTERVALO_DIAS = 3
  const ultimaMensagem = await prisma.mensagemCobranca.findFirst({
    where: { clienteDevedorId: clienteDevedor.id, direcao: 'enviada', enviado: true },
    orderBy: { criadoEm: 'desc' },
  })
  if (ultimaMensagem) {
    const diasDesdeUltima = (Date.now() - new Date(ultimaMensagem.criadoEm).getTime()) / (1000 * 60 * 60 * 24)
    if (diasDesdeUltima < INTERVALO_DIAS) {
      return { enviado: false, pulado: true, motivo: `aguardando intervalo (${Math.ceil(INTERVALO_DIAS - diasDesdeUltima)}d restante)` }
    }
  }

  const diasAtraso = Math.max(0, Math.floor(
    (Date.now() - new Date(cobranca.vencimento).getTime()) / (1000 * 60 * 60 * 24)
  ))

  // Determina e atualiza perfil do devedor automaticamente
  let perfil: PerfilDevedor = clienteDevedor.perfilDevedor as PerfilDevedor

  const totalCobrancasPendentes = await prisma.cobrancaDevedor.count({
    where: { clienteDevedorId: clienteDevedor.id, status: 'pendente' },
  })
  const totalCobrancasHistorico = await prisma.cobrancaDevedor.count({
    where: { clienteDevedorId: clienteDevedor.id },
  })

  let novoPerfil: PerfilDevedor = 'primeiro_atraso'
  if (totalCobrancasHistorico >= 5 || diasAtraso >= 90) novoPerfil = 'longo_prazo'
  else if (totalCobrancasHistorico >= 3 || diasAtraso >= 60) novoPerfil = 'recorrente'
  else if (totalCobrancasHistorico >= 2 || diasAtraso >= 30) novoPerfil = 'segundo_atraso'

  if (novoPerfil !== perfil) {
    perfil = novoPerfil
    await prisma.clienteDevedor.update({
      where: { id: clienteDevedor.id },
      data: { perfilDevedor: novoPerfil },
    })
  }

  // Cria/busca cobrança no Asaas se configurado
  let linkPagamento: string | null = null
  if (contaEmpresa.asaasAtivo && contaEmpresa.asaasApiKey && !cobranca.asaasPaymentId) {
    try {
      const asaas = getAsaasClient(contaEmpresa.asaasApiKey)

      // Garante que o cliente existe no Asaas
      let asaasCustomerId = clienteDevedor.asaasCustomerId
      if (!asaasCustomerId) {
        const cliente = clienteDevedor.cpfCnpj
          ? await asaas.buscarCliente(clienteDevedor.cpfCnpj)
          : null
        if (cliente) {
          asaasCustomerId = cliente.id
        } else {
          const novoCliente = await asaas.criarCliente({
            name: clienteDevedor.nome,
            cpfCnpj: clienteDevedor.cpfCnpj || undefined,
            email: clienteDevedor.email || undefined,
            mobilePhone: clienteDevedor.telefone || undefined,
          })
          asaasCustomerId = novoCliente.id
        }
        await prisma.clienteDevedor.update({
          where: { id: clienteDevedor.id },
          data: { asaasCustomerId },
        })
      }

      // Cria cobrança PIX
      const novaCobranca = await asaas.criarCobranca({
        customer: asaasCustomerId!,
        billingType: 'PIX',
        value: Number(cobranca.valor),
        dueDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        description: cobranca.descricao,
        externalReference: cobranca.id,
        fine: { value: 2 },
        interest: { value: 1 },
      })

      linkPagamento = novaCobranca.invoiceUrl || null
      await prisma.cobrancaDevedor.update({
        where: { id: cobrancaId },
        data: {
          asaasPaymentId: novaCobranca.id,
          asaasLink: linkPagamento,
        },
      })
    } catch (err: any) {
      console.error('[Asaas] Erro ao criar cobrança:', err.message)
    }
  } else if (cobranca.asaasLink) {
    linkPagamento = cobranca.asaasLink
  }

  // Gera mensagem com IA
  const mensagem = await gerarMensagemCobranca(
    clienteDevedor.nome,
    cobranca.descricao,
    Number(cobranca.valor),
    diasAtraso,
    perfil,
    linkPagamento
  )

  // Envia via Z-API
  let enviado = false
  if (clienteDevedor.telefone) {
    const zapi = getZApiClient(contaEmpresa)
    if (zapi) {
      enviado = await zapi.enviarTexto(clienteDevedor.telefone, mensagem)
    }
  }

  // Salva mensagem
  await prisma.mensagemCobranca.create({
    data: {
      clienteDevedorId: clienteDevedor.id,
      cobrancaId: cobranca.id,
      direcao: 'enviada',
      canal: 'whatsapp',
      conteudo: mensagem,
      enviado,
    },
  })

  // Atualiza etapa
  await prisma.cobrancaDevedor.update({
    where: { id: cobrancaId },
    data: { etapaAtual: `cobranca_${diasAtraso}d`, agenteAtivo: true },
  })

  return { enviado, mensagem, linkPagamento }
}

/**
 * Executa cobrança para todas as cobranças em atraso de uma empresa.
 */
export async function executarReguaCobranca(contaEmpresaId: string) {
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)

  const cobrancasAtrasadas = await prisma.cobrancaDevedor.findMany({
    where: {
      clienteDevedor: { contaEmpresaId },
      status: 'pendente',
      vencimento: { lt: hoje },
    },
    include: { clienteDevedor: true },
  })

  const resultados: Array<{ id: string; enviado: boolean }> = []
  for (const cobranca of cobrancasAtrasadas) {
    try {
      const r = await executarCobrancaDevedor(cobranca.id)
      resultados.push({ id: cobranca.id, enviado: r?.enviado || false })
    } catch (err: any) {
      console.error(`[Cobrança] Erro em ${cobranca.id}:`, err.message)
      resultados.push({ id: cobranca.id, enviado: false })
    }
  }

  return resultados
}
