import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import { ZApiClient } from '@/lib/zapi'
import prisma from '@/server/lib/db'

export async function POST(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: u.id } })
    if (!conta) return Response.json({ erro: 'Conta não encontrada' }, { status: 404 })

    if (!conta.zapiInstanceId || !conta.zapiToken || !conta.zapiClientToken) {
      return Response.json({ erro: 'Z-API não configurado. Preencha Instance ID, Token e Client Token em Configurações.' }, { status: 400 })
    }

    if (!conta.telefoneAlerta) {
      return Response.json({ erro: 'Número de WhatsApp não configurado em Configurações.' }, { status: 400 })
    }

    const zapi = new ZApiClient(conta.zapiInstanceId, conta.zapiToken, conta.zapiClientToken)

    const mensagem = `✅ *Radar Financeiro — Teste de Conexão*\n\nOlá, *${conta.nomeEmpresa}*!\n\nSua integração WhatsApp está funcionando corretamente. Você receberá alertas de vencimento e resumos semanais neste número.\n\n_Radar Financeiro_ 🚀`

    const enviado = await zapi.enviarTexto(conta.telefoneAlerta, mensagem)

    if (!enviado) {
      return Response.json({ erro: 'Falha ao enviar mensagem. Verifique se a instância Z-API está conectada e as credenciais estão corretas.' }, { status: 500 })
    }

    return Response.json({ ok: true, mensagem: `Mensagem de teste enviada para ${conta.telefoneAlerta}` })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
