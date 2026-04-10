/**
 * POST /api/v2/empresa/configurar-webhook-zapi
 * Configura automaticamente o webhook de recebimento de mensagens na Z-API.
 */

import { NextRequest } from 'next/server'
import { getUsuario, getEmpresaUserId } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'
import { ZApiClient } from '@/lib/zapi'

export async function POST(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: getEmpresaUserId(u) } })
    if (!conta) return Response.json({ erro: 'Conta não encontrada' }, { status: 404 })

    if (!conta.zapiInstanceId || !conta.zapiToken || !conta.zapiClientToken) {
      return Response.json({ erro: 'Credenciais Z-API não configuradas' }, { status: 400 })
    }

    const zapi = new ZApiClient(conta.zapiInstanceId, conta.zapiToken, conta.zapiClientToken)
    const webhookUrl = 'https://radar-financeiro-roan.vercel.app/api/v2/webhook/zapi'

    const resultado = await zapi.configurarWebhookRecebimento(webhookUrl)

    if (resultado.ok) {
      return Response.json({
        ok: true,
        webhookUrl,
        mensagem: 'Webhook configurado com sucesso! A IA vai responder automaticamente.',
        detalhes: resultado.detalhes,
      })
    } else {
      return Response.json({
        ok: false,
        webhookUrl,
        erro: resultado.detalhes,
        instrucoes: `Configure manualmente: no painel Z-API, vá em Webhooks → "On Message Received" → cole a URL: ${webhookUrl}`,
      }, { status: 200 })
    }
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
