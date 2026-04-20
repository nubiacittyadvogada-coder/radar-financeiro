/**
 * GET /api/v2/empresa/devedores/[id]/mensagens
 * Retorna o histórico de mensagens (enviadas e recebidas) de um devedor.
 *
 * POST /api/v2/empresa/devedores/[id]/mensagens
 * Envia uma mensagem manual para o devedor.
 */

import { NextRequest } from 'next/server'
import { getUsuario, getEmpresaUserId } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'
import { getZApiClient } from '@/lib/zapi'

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: getEmpresaUserId(u) } })
    if (!conta) return Response.json({ erro: 'Conta não encontrada' }, { status: 404 })

    const devedor = await prisma.clienteDevedor.findFirst({
      where: { id: params.id, contaEmpresaId: conta.id },
    })
    if (!devedor) return Response.json({ erro: 'Devedor não encontrado' }, { status: 404 })

    const mensagens = await prisma.mensagemCobranca.findMany({
      where: { clienteDevedorId: params.id },
      orderBy: { criadoEm: 'asc' },
      take: 100,
    })

    return Response.json(mensagens)
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const conta = await prisma.contaEmpresa.findUnique({ where: { usuarioId: getEmpresaUserId(u) } })
    if (!conta) return Response.json({ erro: 'Conta não encontrada' }, { status: 404 })

    const devedor = await prisma.clienteDevedor.findFirst({
      where: { id: params.id, contaEmpresaId: conta.id },
    })
    if (!devedor) return Response.json({ erro: 'Devedor não encontrado' }, { status: 404 })

    const { mensagem } = await req.json()
    if (!mensagem?.trim()) return Response.json({ erro: 'Mensagem vazia' }, { status: 400 })
    if (!devedor.telefone) return Response.json({ erro: 'Devedor sem telefone cadastrado' }, { status: 400 })

    const zapi = getZApiClient(conta, 'cobranca')
    let enviado = false
    if (zapi) {
      enviado = await zapi.enviarTexto(devedor.telefone, mensagem.trim())
    }

    await prisma.mensagemCobranca.create({
      data: {
        clienteDevedorId: devedor.id,
        direcao: 'enviada',
        canal: 'whatsapp',
        conteudo: mensagem.trim(),
        enviado,
      },
    })

    if (!enviado) return Response.json({ erro: 'Falha ao enviar. Verifique Z-API.' }, { status: 500 })
    return Response.json({ ok: true })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
