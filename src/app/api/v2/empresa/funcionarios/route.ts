import { NextRequest } from 'next/server'
import { getUsuario, getEmpresaUserId } from '@/lib/auth-utils'
import { hashSenha } from '@/server/lib/auth'
import prisma from '@/server/lib/db'

// GET — lista funcionários vinculados à empresa
export async function GET(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })
    if (u.papel === 'funcionario') return Response.json({ erro: 'Apenas o dono pode gerenciar funcionários' }, { status: 403 })

    const funcionarios = await prisma.usuario.findMany({
      where: { donoId: u.id },
      select: { id: true, nome: true, email: true, ativo: true, criadoEm: true },
      orderBy: { criadoEm: 'asc' },
    })
    return Response.json(funcionarios)
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

// POST — cria um funcionário vinculado à empresa do dono
export async function POST(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })
    if (u.papel === 'funcionario') return Response.json({ erro: 'Apenas o dono pode criar funcionários' }, { status: 403 })

    const { nome, email, senha } = await req.json()
    if (!nome || !email || !senha) return Response.json({ erro: 'Nome, email e senha são obrigatórios' }, { status: 400 })
    if (senha.length < 6) return Response.json({ erro: 'Senha deve ter pelo menos 6 caracteres' }, { status: 400 })

    const existe = await prisma.usuario.findUnique({ where: { email } })
    if (existe) return Response.json({ erro: 'Email já cadastrado' }, { status: 400 })

    const senhaHash = await hashSenha(senha)
    const funcionario = await prisma.usuario.create({
      data: {
        nome,
        email,
        senhaHash,
        papel: 'funcionario',
        donoId: u.id,
        plano: 'basico',
      } as any,
    })

    return Response.json({
      id: funcionario.id,
      nome: funcionario.nome,
      email: funcionario.email,
    }, { status: 201 })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}

// DELETE — remove um funcionário
export async function DELETE(req: NextRequest) {
  try {
    const u = getUsuario(req)
    if (!u || u.tipo !== 'usuario') return Response.json({ erro: 'Não autorizado' }, { status: 401 })
    if (u.papel === 'funcionario') return Response.json({ erro: 'Apenas o dono pode remover funcionários' }, { status: 403 })

    const { id } = await req.json()
    const funcionario = await prisma.usuario.findFirst({
      where: { id, donoId: u.id, papel: 'funcionario' } as any,
    })
    if (!funcionario) return Response.json({ erro: 'Funcionário não encontrado' }, { status: 404 })

    await prisma.usuario.delete({ where: { id } })
    return Response.json({ ok: true })
  } catch (err: any) {
    return Response.json({ erro: err.message }, { status: 500 })
  }
}
