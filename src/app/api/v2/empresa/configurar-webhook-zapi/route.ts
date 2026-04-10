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
    const host = req.headers.get('host') || 'radar-financeiro-roan.vercel.app'
    const protocol = host.includes('localhost') ? 'http' : 'https'
    const webhookUrl = `${protocol}://${host}/api/v2/webhook/zapi`

    const ok = await zapi.configurarWebhookRecebimento(webhookUrl)

    if (ok) {
      return Response.json({ ok: true, webhookUrl, mensagem: 'Webhook configurado com sucesso!' })
    } else {
      return Response.json({ erro: 'Falha ao configurar webhook na Z-API. Verifique as credenciais.' }, { status: 500 })
    }
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
