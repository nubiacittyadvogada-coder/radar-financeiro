'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { formatarMoeda } from '@/lib/utils'

const CORES = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4']

type Projeto = {
  id: string
  nome: string
  descricao: string | null
  orcamento: any
  cor: string | null
  _count: { transacoes: number }
}

export default function PessoalProjetosPage() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [projetos, setProjetos] = useState<Projeto[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState<Projeto | null>(null)
  const [form, setForm] = useState({ nome: '', descricao: '', orcamento: '', cor: CORES[0] })

  useEffect(() => {
    const u = localStorage.getItem('radar_usuario')
    const t = localStorage.getItem('radar_token')
    if (!u || !t) { router.push('/login'); return }
    const parsed = JSON.parse(u)
    if (parsed.tipo !== 'usuario') { router.push('/login'); return }
    setToken(t)
    carregar(t)
  }, [router])

  async function carregar(t: string) {
    setLoading(true)
    const res = await fetch('/api/v2/pessoal/projetos', { headers: { Authorization: `Bearer ${t}` } })
    if (res.ok) setProjetos(await res.json())
    setLoading(false)
  }

  function abrirNovo() {
    setEditando(null)
    setForm({ nome: '', descricao: '', orcamento: '', cor: CORES[0] })
    setShowForm(true)
  }

  function abrirEditar(p: Projeto) {
    setEditando(p)
    setForm({
      nome: p.nome,
      descricao: p.descricao || '',
      orcamento: p.orcamento ? String(p.orcamento) : '',
      cor: p.cor || CORES[0],
    })
    setShowForm(true)
  }

  async function salvar() {
    if (!token || !form.nome) return
    const body = { ...form, orcamento: form.orcamento ? Number(form.orcamento) : null }
    if (editando) {
      const res = await fetch(`/api/v2/pessoal/projetos/${editando.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      if (res.ok) { setShowForm(false); carregar(token) }
    } else {
      const res = await fetch('/api/v2/pessoal/projetos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })
      if (res.ok) { setShowForm(false); carregar(token) }
    }
  }

  async function deletar(id: string) {
    if (!token || !confirm('Excluir projeto? As transações vinculadas não serão deletadas.')) return
    await fetch(`/api/v2/pessoal/projetos/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } })
    carregar(token)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Projetos</h1>
          <p className="text-sm text-gray-500">Organize gastos por projeto ou objetivo</p>
        </div>
        <button onClick={abrirNovo} className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
          + Novo projeto
        </button>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        {showForm && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <h2 className="font-bold mb-4">{editando ? 'Editar projeto' : 'Novo projeto'}</h2>
              <div className="space-y-3">
                <input placeholder="Nome *" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
                <input placeholder="Descrição" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
                <input type="number" placeholder="Orçamento (R$)" value={form.orcamento} onChange={(e) => setForm({ ...form, orcamento: e.target.value })} className="w-full px-3 py-2 border rounded-lg text-sm" />
                <div>
                  <label className="text-xs text-gray-500 block mb-2">Cor</label>
                  <div className="flex gap-2">
                    {CORES.map((c) => (
                      <button key={c} onClick={() => setForm({ ...form, cor: c })}
                        className={`w-7 h-7 rounded-full border-2 transition ${form.cor === c ? 'border-gray-800 scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowForm(false)} className="flex-1 px-4 py-2 border rounded-lg text-sm text-gray-600">Cancelar</button>
                <button onClick={salvar} className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium">
                  {editando ? 'Salvar' : 'Criar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-gray-400">Carregando...</div>
        ) : projetos.length === 0 ? (
          <div className="text-center py-16">
            <div className="text-4xl mb-4">📁</div>
            <p className="text-gray-500 mb-4">Nenhum projeto criado.</p>
            <p className="text-sm text-gray-400">Use projetos para organizar gastos por objetivo (viagem, reforma, evento, etc.)</p>
            <button onClick={abrirNovo} className="mt-4 px-5 py-2.5 bg-green-600 text-white rounded-lg text-sm font-medium">Criar projeto</button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {projetos.map((p) => (
              <div key={p.id} className="bg-white rounded-xl p-5 shadow-sm border group relative">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: p.cor || '#3b82f6' }} />
                  <span className="font-semibold text-gray-900 flex-1">{p.nome}</span>
                  {/* ações — aparecem no hover */}
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => abrirEditar(p)}
                      className="text-xs px-2 py-1 text-gray-400 hover:text-blue-500 rounded"
                      title="Editar"
                    >✏️</button>
                    <button
                      onClick={() => deletar(p.id)}
                      className="text-xs px-2 py-1 text-gray-400 hover:text-red-500 rounded"
                      title="Excluir"
                    >🗑️</button>
                  </div>
                </div>
                {p.descricao && <p className="text-sm text-gray-500 mb-2">{p.descricao}</p>}
                <div className="flex items-center justify-between text-sm">
                  {p.orcamento && (
                    <span className="text-gray-500">Orçamento: <strong>{formatarMoeda(p.orcamento)}</strong></span>
                  )}
                  <span className="text-gray-400 text-xs">{p._count.transacoes} transação(ões)</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
