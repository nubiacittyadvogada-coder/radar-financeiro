'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

type Usuario = {
  id: string
  nome: string
  email: string
  plano: string
  ativo: boolean
  isAdmin: boolean
  criadoEm: string
  contaEmpresa: { nomeEmpresa: string; asaasAtivo: boolean; alertaAtivo: boolean } | null
  contaPessoal: { id: string; _count: { transacoes: number; metas: number } } | null
}

const PLANOS = ['basico', 'pro', 'premium']

export default function AdminUsuariosPage() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [total, setTotal] = useState(0)
  const [paginas, setPaginas] = useState(1)
  const [pagina, setPagina] = useState(1)
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(true)
  const [atualizando, setAtualizando] = useState<string | null>(null)

  useEffect(() => {
    const u = localStorage.getItem('radar_usuario')
    const t = localStorage.getItem('radar_token')
    if (!u || !t) { router.push('/login'); return }
    const parsed = JSON.parse(u)
    if (!parsed.isAdmin) { router.push('/login'); return }
    setToken(t)
  }, [router])

  const carregar = useCallback(async () => {
    if (!token) return
    setLoading(true)
    const params = new URLSearchParams({ pagina: String(pagina) })
    if (busca) params.set('q', busca)
    const res = await fetch(`/api/v2/admin/usuarios?${params}`, { headers: { Authorization: `Bearer ${token}` } })
    if (res.ok) {
      const data = await res.json()
      setUsuarios(data.usuarios)
      setTotal(data.total)
      setPaginas(data.paginas)
    }
    setLoading(false)
  }, [token, pagina, busca])

  useEffect(() => { carregar() }, [carregar])

  async function atualizar(id: string, patch: { ativo?: boolean; plano?: string }) {
    if (!token) return
    setAtualizando(id)
    await fetch('/api/v2/admin/usuarios', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ id, ...patch }),
    })
    carregar()
    setAtualizando(null)
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Usuários</h1>
          <p className="text-gray-500 text-sm mt-1">{total} usuário(s) no total</p>
        </div>
        <input
          type="search"
          placeholder="Buscar por nome ou email..."
          value={busca}
          onChange={(e) => { setBusca(e.target.value); setPagina(1) }}
          className="px-4 py-2 border rounded-lg text-sm w-72 focus:ring-2 focus:ring-blue-500 outline-none"
        />
      </div>

      {loading ? (
        <div className="text-gray-400">Carregando...</div>
      ) : (
        <>
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-5 py-3 text-xs text-gray-500 uppercase tracking-wide font-medium">Usuário</th>
                  <th className="text-left px-5 py-3 text-xs text-gray-500 uppercase tracking-wide font-medium">Modo</th>
                  <th className="text-left px-5 py-3 text-xs text-gray-500 uppercase tracking-wide font-medium">Cadastro</th>
                  <th className="text-left px-5 py-3 text-xs text-gray-500 uppercase tracking-wide font-medium">Plano</th>
                  <th className="text-left px-5 py-3 text-xs text-gray-500 uppercase tracking-wide font-medium">Status</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {usuarios.map((u) => (
                  <tr key={u.id} className={`hover:bg-gray-50 ${!u.ativo ? 'opacity-50' : ''}`}>
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-gray-900">{u.nome}</div>
                      <div className="text-xs text-gray-400">{u.email}</div>
                      {u.isAdmin && <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-medium">admin</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex gap-1.5">
                        {u.contaEmpresa && (
                          <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                            🏢 {u.contaEmpresa.nomeEmpresa}
                          </span>
                        )}
                        {u.contaPessoal && (
                          <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                            👤 {u.contaPessoal._count.transacoes} transações
                          </span>
                        )}
                        {!u.contaEmpresa && !u.contaPessoal && (
                          <span className="text-xs text-gray-400">onboarding pendente</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-gray-500">
                      {new Date(u.criadoEm).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-5 py-3.5">
                      <select
                        value={u.plano}
                        disabled={atualizando === u.id}
                        onChange={(e) => atualizar(u.id, { plano: e.target.value })}
                        className="text-xs border rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 outline-none"
                      >
                        {PLANOS.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${u.ativo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {u.ativo ? 'Ativo' : 'Suspenso'}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {!u.isAdmin && (
                        <button
                          onClick={() => atualizar(u.id, { ativo: !u.ativo })}
                          disabled={atualizando === u.id}
                          className={`text-xs px-3 py-1.5 rounded-lg font-medium ${u.ativo ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-700 hover:bg-green-100'} disabled:opacity-50`}
                        >
                          {atualizando === u.id ? '...' : u.ativo ? 'Suspender' : 'Ativar'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Paginação */}
          {paginas > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              {Array.from({ length: paginas }, (_, i) => (
                <button
                  key={i}
                  onClick={() => setPagina(i + 1)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium ${pagina === i + 1 ? 'bg-blue-600 text-white' : 'bg-white border text-gray-600 hover:bg-gray-50'}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
