'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const router = useRouter()
  const [modo, setModo] = useState<'usuario' | 'legado'>('usuario')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [tipoLegado, setTipoLegado] = useState<'cliente' | 'bpo'>('cliente')
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    setLoading(true)

    try {
      if (modo === 'usuario') {
        const res = await fetch('/api/v2/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, senha }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.erro || 'Erro ao entrar')

        localStorage.setItem('radar_token', data.token)
        localStorage.setItem('radar_usuario', JSON.stringify(data.usuario))
        // Cookie de sessão para proteção server-side via middleware
        document.cookie = `radar_sessao=1; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Strict`

        // Redireciona conforme modos ativos (empresa/pessoal tem prioridade sobre admin)
        if (data.usuario.temEmpresa) {
          router.push('/empresa/dashboard')
        } else if (data.usuario.temPessoal) {
          router.push('/pessoal/dashboard')
        } else if (data.usuario.isAdmin) {
          router.push('/admin')
        } else {
          router.push('/onboarding')
        }
      } else {
        // Login legado (BPO/cliente)
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, senha, tipo: tipoLegado }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.erro || 'Erro ao entrar')

        localStorage.setItem('radar_token', data.token)
        localStorage.setItem('radar_usuario', JSON.stringify(data.usuario))
        document.cookie = `radar_sessao=1; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Strict`

        if (data.usuario.tipo === 'cliente') {
          router.push('/dashboard')
        } else {
          router.push('/bpo/dashboard')
        }
      }
    } catch (err: any) {
      setErro(err.message || 'Email ou senha inválidos')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Radar Financeiro</h1>
            <p className="text-gray-500 mt-2">Seus números, sua decisão</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="seu@email.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
              <input
                type="password"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                placeholder="••••••••"
                required
              />
            </div>

            {erro && (
              <div className="bg-red-50 text-red-600 px-4 py-2.5 rounded-lg text-sm">{erro}</div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          <div className="mt-6 text-center text-sm text-gray-500">
            Não tem conta?{' '}
            <Link href="/cadastro" className="text-blue-600 hover:underline font-medium">
              Cadastre-se grátis
            </Link>
          </div>

          <div className="mt-4 text-center text-xs text-gray-400 flex justify-center gap-3">
            <Link href="/termos" className="hover:text-gray-600 hover:underline">Termos de Uso</Link>
            <span>·</span>
            <Link href="/privacidade" className="hover:text-gray-600 hover:underline">Privacidade & LGPD</Link>
          </div>

        </div>
      </div>
    </div>
  )
}
