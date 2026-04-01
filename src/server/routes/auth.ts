import { Router, Request, Response } from 'express'
import { login, authMiddleware, AuthRequest } from '../lib/auth'

const router = Router()

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  const { email, senha, tipo } = req.body

  if (!email || !senha || !tipo) {
    res.status(400).json({ erro: 'Email, senha e tipo são obrigatórios' })
    return
  }

  if (tipo !== 'bpo' && tipo !== 'cliente') {
    res.status(400).json({ erro: 'Tipo deve ser "bpo" ou "cliente"' })
    return
  }

  const resultado = await login(email, senha, tipo)

  if (!resultado) {
    res.status(401).json({ erro: 'Email ou senha inválidos' })
    return
  }

  res.json({
    token: resultado.token,
    usuario: {
      id: resultado.usuario.id,
      tipo: resultado.usuario.tipo,
      email: resultado.usuario.email,
      bpoId: resultado.usuario.bpoId,
    },
  })
})

// POST /api/auth/me — retorna dados do usuário autenticado
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
  res.json({ usuario: req.usuario })
})

export default router
