import { NextRequest } from 'next/server'
import { getUsuario } from '@/lib/auth-utils'
import prisma from '@/server/lib/db'

async function getProjeto(req: NextRequest, id: string) {
  const u = getUsuario(req)
  if (!u || u.tipo !== 'usuario') return null
  const conta = await prisma.contaPessoal.findUnique({ where: { usuarioId: u.id } })
  if (!conta) return null
  return prisma.projetoPessoal.findFirst({ where: { id, contaPessoalId: conta.id } })
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })
    const projeto = await getProjeto(req, params.id)
    if (!projeto) return Response.json({ erro: 'Projeto não encontrado' }, { status: 404 })

    const { nome, descricao, orcamento, cor } = await req.json()
    const atualizado = await prisma.projetoPessoal.update({
      where: { id: params.id },
      data: {
        nome: nome ?? projeto.nome,
        descricao: descricao !== undefined ? descricao || null : projeto.descricao,
        orcamento: orcamento !== undefined ? (orcamento ? Number(orcamento) : null) : projeto.orcamento,
        cor: cor ?? projeto.cor,
      },
    })
    return Response.json(atualizado)
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })
    const projeto = await getProjeto(req, params.id)
    if (!projeto) return Response.json({ erro: 'Projeto não encontrado' }, { status: 404 })
    await prisma.projetoPessoal.delete({ where: { id: params.id } })
    return Response.json({ ok: true })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
