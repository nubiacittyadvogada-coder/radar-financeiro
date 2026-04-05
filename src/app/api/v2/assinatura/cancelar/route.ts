import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'
import { AsaasClient } from '@/lib/asaas'

const PLATFORM_KEY = process.env.ASAAS_PLATFORM_KEY || ''

export async function POST(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })

    const assinatura = await prisma.assinaturaRadar.findUnique({ where: { usuarioId: u.id } })
    if (!assinatura) return Response.json({ erro: 'Nenhuma assinatura ativa' }, { status: 404 })

    if (PLATFORM_KEY && assinatura.asaasSubId) {
      try {
        const asaas = new AsaasClient(PLATFORM_KEY)
        await asaas.cancelarAssinatura(assinatura.asaasSubId)
      } catch {}
    }

    await prisma.assinaturaRadar.update({
      where: { usuarioId: u.id },
      data: { status: 'cancelada' },
    })
    // Mantém plano até vencer — não revoga imediatamente

    return Response.json({ ok: true })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
