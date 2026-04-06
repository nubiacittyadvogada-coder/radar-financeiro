import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { Request, Response, NextFunction } from 'express'
import prisma from './db'

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me'
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d'

// Tipos de usuário no token
export type TipoUsuario = 'bpo' | 'usuario_bpo' | 'cliente' | 'usuario'

export interface TokenPayload {
  id: string
  tipo: TipoUsuario
  bpoId?: string
  email: string
  nome?: string
  temEmpresa?: boolean
  temPessoal?: boolean
  isAdmin?: boolean
  papel?: string      // 'dono' | 'funcionario'
  donoId?: string     // para funcionários: userId do dono da empresa
}

export interface AuthRequest extends Request {
  usuario?: TokenPayload
}

// --- Funções de senha ---

export async function hashSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, 12)
}

export async function verificarSenha(senha: string, hash: string): Promise<boolean> {
  return bcrypt.compare(senha, hash)
}

// --- Funções JWT ---

export function gerarToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN } as jwt.SignOptions)
}

export function verificarToken(token: string): TokenPayload {
  return jwt.verify(token, JWT_SECRET) as TokenPayload
}

// --- Middleware ---

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ erro: 'Token não fornecido' })
    return
  }

  const token = authHeader.substring(7)

  try {
    const payload = verificarToken(token)
    req.usuario = payload
    next()
  } catch {
    res.status(401).json({ erro: 'Token inválido ou expirado' })
  }
}

/**
 * Middleware que exige que o usuário seja BPO (dono ou operador).
 */
export function apenassBpo(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.usuario || (req.usuario.tipo !== 'bpo' && req.usuario.tipo !== 'usuario_bpo')) {
    res.status(403).json({ erro: 'Acesso restrito ao BPO' })
    return
  }
  next()
}

/**
 * Middleware que exige que o usuário seja cliente.
 */
export function apenasCliente(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.usuario || req.usuario.tipo !== 'cliente') {
    res.status(403).json({ erro: 'Acesso restrito ao cliente' })
    return
  }
  next()
}

/**
 * Login unificado para BPO, UsuarioBpo e Cliente.
 */
export async function login(
  email: string,
  senha: string,
  tipo: 'bpo' | 'cliente'
): Promise<{ token: string; usuario: TokenPayload } | null> {
  if (tipo === 'bpo') {
    // Tenta BPO primeiro
    const bpo = await prisma.bpo.findUnique({ where: { email } })
    if (bpo && bpo.ativo) {
      const senhaOk = await verificarSenha(senha, bpo.senhaHash)
      if (senhaOk) {
        const payload: TokenPayload = {
          id: bpo.id,
          tipo: 'bpo',
          bpoId: bpo.id,
          email: bpo.email,
        }
        return { token: gerarToken(payload), usuario: payload }
      }
    }

    // Tenta UsuarioBpo
    const usuarioBpo = await prisma.usuarioBpo.findUnique({ where: { email } })
    if (usuarioBpo && usuarioBpo.ativo) {
      const senhaOk = await verificarSenha(senha, usuarioBpo.senhaHash)
      if (senhaOk) {
        const payload: TokenPayload = {
          id: usuarioBpo.id,
          tipo: 'usuario_bpo',
          bpoId: usuarioBpo.bpoId,
          email: usuarioBpo.email,
        }
        return { token: gerarToken(payload), usuario: payload }
      }
    }

    return null
  }

  // Login de cliente
  const cliente = await prisma.cliente.findUnique({ where: { email } })
  if (cliente && cliente.ativo && cliente.senhaHash) {
    const senhaOk = await verificarSenha(senha, cliente.senhaHash)
    if (senhaOk) {
      const payload: TokenPayload = {
        id: cliente.id,
        tipo: 'cliente',
        email: cliente.email!,
      }
      return { token: gerarToken(payload), usuario: payload }
    }
  }

  return null
}

/**
 * Login para Usuario (v2).
 */
export async function loginUsuario(
  email: string,
  senha: string
): Promise<{ token: string; usuario: TokenPayload } | null> {
  const usuario = await prisma.usuario.findUnique({
    where: { email },
    include: { contaEmpresa: true, contaPessoal: true },
  })

  if (!usuario || !usuario.ativo) return null
  const senhaOk = await verificarSenha(senha, usuario.senhaHash)
  if (!senhaOk) return null

  const papel = (usuario as any).papel || 'dono'
  const donoId = (usuario as any).donoId || undefined

  const payload: TokenPayload = {
    id: usuario.id,
    tipo: 'usuario',
    email: usuario.email,
    nome: usuario.nome,
    // funcionários têm temEmpresa=true via donoId, temPessoal=false
    temEmpresa: papel === 'funcionario' ? !!donoId : !!usuario.contaEmpresa,
    temPessoal: papel === 'funcionario' ? false : !!usuario.contaPessoal,
    isAdmin: usuario.isAdmin,
    papel,
    donoId,
  }
  return { token: gerarToken(payload), usuario: payload }
}

/**
 * Cria um novo Usuario com hash de senha.
 */
export async function cadastrarUsuario(
  nome: string,
  email: string,
  senha: string
): Promise<TokenPayload> {
  const existe = await prisma.usuario.findUnique({ where: { email } })
  if (existe) throw new Error('Email já cadastrado')

  const senhaHash = await hashSenha(senha)
  const usuario = await prisma.usuario.create({ data: { nome, email, senhaHash } })

  return { id: usuario.id, tipo: 'usuario', email: usuario.email, nome: usuario.nome, temEmpresa: false, temPessoal: false }
}
