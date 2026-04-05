import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'
import { AsaasClient } from '@/lib/asaas'
import { PLANOS, PlanoKey } from '@/lib/planos'

const PLATFORM_KEY = process.env.ASAAS_PLATFORM_KEY || ''

export async function POST(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const { plano, cpfCnpj, billingType = 'PIX' } = await req.json()

    if (!['pro', 'premium'].includes(plano)) {
      return Response.json({ erro: 'Plano inválido' }, { status: 400 })
    }
    if (!PLATFORM_KEY) {
      return Response.json({ erro: 'Gateway de pagamento não configurado' }, { status: 500 })
    }

    const usuario = await prisma.usuario.findUnique({ where: { id: u.id } })
    if (!usuario) return Response.json({ erro: 'Usuário não encontrado' }, { status: 404 })

    const asaas = new AsaasClient(PLATFORM_KEY)
    const planoInfo = PLANOS[plano as PlanoKey]

    // Cria ou reutiliza cliente Asaas
    let asaasCustomerId = usuario.asaasCustomerId
    if (!asaasCustomerId) {
      // Tenta buscar por cpfCnpj se fornecido
      if (cpfCnpj) {
        const clienteExistente = await asaas.buscarCliente(cpfCnpj)
        if (clienteExistente) {
          asaasCustomerId = clienteExistente.id
        }
      }
      if (!asaasCustomerId) {
        const clienteAsaas = await asaas.criarCliente({
          name: usuario.nome,
          email: usuario.email,
          cpfCnpj: cpfCnpj || undefined,
        })
        asaasCustomerId = clienteAsaas.id
      }
      await prisma.usuario.update({ where: { id: u.id }, data: { asaasCustomerId } })
    }

    // Cancela assinatura anterior se existir
    const assinaturaAtual = await prisma.assinaturaRadar.findUnique({ where: { usuarioId: u.id } })
    if (assinaturaAtual?.asaasSubId) {
      try { await asaas.cancelarAssinatura(assinaturaAtual.asaasSubId) } catch {}
    }

    // Cria assinatura no Asaas
    const hoje = new Date()
    const vencimento = new Date(hoje)
    vencimento.setDate(vencimento.getDate() + 3) // vence em 3 dias
    const nextDueDate = vencimento.toISOString().slice(0, 10)

    const subAsaas = await asaas.criarAssinatura({
      customer: asaasCustomerId,
      billingType: billingType as 'PIX' | 'BOLETO' | 'CREDIT_CARD',
      value: planoInfo.preco,
      nextDueDate,
      cycle: 'MONTHLY',
      description: `Radar Financeiro — Plano ${planoInfo.nome}`,
      externalReference: u.id,
    })

    // Busca o primeiro pagamento gerado para pegar o link
    let linkPagamento: string | null = null
    try {
      const pagamentos = await asaas.listarPagamentosAssinatura(subAsaas.id)
      if (pagamentos[0]) {
        linkPagamento = pagamentos[0].invoiceUrl || pagamentos[0].bankSlipUrl || null
        // Para PIX, busca QR code
        if (billingType === 'PIX' && pagamentos[0].id) {
          try {
            const pix = await asaas.gerarQrCodePix(pagamentos[0].id)
            linkPagamento = pix.encodedImage ? null : linkPagamento // mantém invoiceUrl para PIX
          } catch {}
        }
      }
    } catch {}

    // Salva/atualiza assinatura no banco
    const assinatura = await prisma.assinaturaRadar.upsert({
      where: { usuarioId: u.id },
      update: {
        plano,
        status: 'pendente',
        asaasSubId: subAsaas.id,
        valorMensal: planoInfo.preco,
        venceEm: vencimento,
        linkPagamento,
      },
      create: {
        usuarioId: u.id,
        plano,
        status: 'pendente',
        asaasSubId: subAsaas.id,
        valorMensal: planoInfo.preco,
        venceEm: vencimento,
        linkPagamento,
      },
    })

    return Response.json({ ok: true, assinatura, linkPagamento, asaasSubId: subAsaas.id }, { status: 201 })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
