'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function ContaPage() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [usuario, setUsuario] = useState<any>(null)
  const [form, setForm] = useState({ senhaAtual: '', novaSenha: '', confirmar: '' })
  const [salvando, setSalvando] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  useEffect(() => {
    const u = localStorage.getItem('radar_usuario')
    const t = localStorage.getItem('radar_token')
    if (!u || !t) { router.push('/login'); return }
    const parsed = JSON.parse(u)
    if (parsed.tipo !== 'usuario') { router.push('/login'); return }
    setToken(t)
    setUsuario(parsed)
  }, [router])

  async function alterarSenha(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)
    if (form.novaSenha !== form.confirmar) {
      setMsg({ tipo: 'erro', texto: 'A nova senha e a confirmação não coincidem.' })
      return
    }
    if (form.novaSenha.length < 6) {
      setMsg({ tipo: 'erro', texto: 'Nova senha deve ter pelo menos 6 caracteres.' })
      return
    }
    setSalvando(true)
    try {
      const res = await fetch('/api/v2/auth/alterar-senha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ senhaAtual: form.senhaAtual, novaSenha: form.novaSenha }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erro)
      setMsg({ tipo: 'ok', texto: 'Senha alterada com sucesso!' })
      setForm({ senhaAtual: '', novaSenha: '', confirmar: '' })
    } catch (err: any) {
      setMsg({ tipo: 'erro', texto: err.message })
    } finally {
      setSalvando(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center pt-16 px-4">
      <div className="w-full max-w-md">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Minha conta</h1>
          {usuario && <p className="text-gray-500 mt-1">{usuario.email}</p>}
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border">
          <h2 className="font-semibold text-gray-800 mb-5">Alterar senha</h2>
          <form onSubmit={alterarSenha} className="space-y-4">
            <div>
              <label className="text-sm text-gray-500 block mb-1">Senha atual</label>
              <input
                type="password"
                value={form.senhaAtual}
                onChange={(e) => setForm({ ...form, senhaAtual: e.target.value })}
                required
                className="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="text-sm text-gray-500 block mb-1">Nova senha</label>
              <input
                type="password"
                value={form.novaSenha}
                onChange={(e) => setForm({ ...form, novaSenha: e.target.value })}
                required
                minLength={6}
                className="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="text-sm text-gray-500 block mb-1">Confirmar nova senha</label>
              <input
                type="password"
                value={form.confirmar}
                onChange={(e) => setForm({ ...form, confirmar: e.target.value })}
                required
                className="w-full px-3 py-2.5 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {msg && (
              <div className={`px-4 py-3 rounded-lg text-sm ${msg.tipo === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                {msg.texto}
              </div>
            )}

            <button
              type="submit"
              disabled={salvando || !form.senhaAtual || !form.novaSenha || !form.confirmar}
              className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-50"
            >
              {salvando ? 'Salvando...' : 'Alterar senha'}
            </button>
          </form>
        </div>

        <div className="mt-4 flex gap-3">
          {usuario?.temEmpresa && (
            <button onClick={() => router.push('/empresa/dashboard')} className="text-sm text-gray-500 hover:text-gray-700">
              ← Voltar para Empresa
            </button>
          )}
          {usuario?.temPessoal && (
            <button onClick={() => router.push('/pessoal/dashboard')} className="text-sm text-gray-500 hover:text-gray-700">
              ← Voltar para Pessoal
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
