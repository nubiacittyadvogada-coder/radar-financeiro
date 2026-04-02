'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

const MESES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

type Importacao = {
  id: string
  tipo: string
  nomeArquivo: string
  banco: string | null
  periodo: string | null
  criadoEm: string
  _count: { transacoes: number }
}

export default function PessoalImportacoesPage() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [importacoes, setImportacoes] = useState<Importacao[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmando, setConfirmando] = useState<string | null>(null)
  const [processando, setProcessando] = useState<string | null>(null)
  const [limparMes, setLimparMes] = useState(new Date().getMonth() + 1)
  const [limparAno, setLimparAno] = useState(new Date().getFullYear())
  const [confirmandoLimpar, setConfirmandoLimpar] = useState(false)
  const [processandoLimpar, setProcessandoLimpar] = useState(false)
  const [resultadoLimpar, setResultadoLimpar] = useState<string | null>(null)

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
    const res = await fetch('/api/v2/pessoal/importacoes', { headers: { Authorization: `Bearer ${t}` } })
    if (res.ok) setImportacoes(await res.json())
    setLoading(false)
  }

  async function limparPeriodo() {
    if (!token) return
    setProcessandoLimpar(true)
    setResultadoLimpar(null)
    const res = await fetch(`/api/v2/pessoal/importacoes/limpar?mes=${limparMes}&ano=${limparAno}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    const data = await res.json()
    if (res.ok) {
      setResultadoLimpar(`${data.removidas} transações removidas de ${MESES[limparMes]}/${limparAno}`)
      setConfirmandoLimpar(false)
      carregar(token)
    } else {
      setResultadoLimpar(`Erro: ${data.erro}`)
    }
    setProcessandoLimpar(false)
  }

  async function desfazer(id: string) {
    if (!token) return
    setProcessando(id)
    const res = await fetch(`/api/v2/pessoal/importacoes/${id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    if (res.ok) {
      setConfirmando(null)
      carregar(token)
    }
    setProcessando(null)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">Histórico de Importações</h1>
        <p className="text-sm text-gray-500 mt-0.5">Gerencie os arquivos importados e desfaça importações se necessário</p>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-sm text-yellow-800 mb-6">
          Desfazer uma importação remove permanentemente todas as transações daquele arquivo.
        </div>

        {/* Limpar período */}
        <div className="bg-white rounded-xl border shadow-sm p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-1">🧹 Limpar período completo</h2>
          <p className="text-xs text-gray-400 mb-3">Remove TODAS as transações de um mês/ano — útil para duplicatas ou importações sem rastreamento.</p>
          <div className="flex items-center gap-3 flex-wrap">
            <select value={limparMes} onChange={(e) => setLimparMes(+e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>{MESES[i + 1]}</option>
              ))}
            </select>
            <select value={limparAno} onChange={(e) => setLimparAno(+e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
              {[2026, 2025, 2024].map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
            {!confirmandoLimpar ? (
              <button
                onClick={() => { setConfirmandoLimpar(true); setResultadoLimpar(null) }}
                className="px-4 py-2 border border-red-300 text-red-600 rounded-lg text-sm font-medium hover:bg-red-50"
              >
                Limpar {MESES[limparMes]}/{limparAno}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-600 font-medium">Apaga TUDO de {MESES[limparMes]}/{limparAno}. Confirma?</span>
                <button onClick={limparPeriodo} disabled={processandoLimpar}
                  className="px-3 py-1.5 bg-red-600 text-white rounded-lg text-xs font-medium hover:bg-red-700 disabled:opacity-50">
                  {processandoLimpar ? '...' : 'Sim, apagar tudo'}
                </button>
                <button onClick={() => setConfirmandoLimpar(false)} className="px-3 py-1.5 border rounded-lg text-xs text-gray-600">Cancelar</button>
              </div>
            )}
          </div>
          {resultadoLimpar && (
            <p className={`text-xs mt-2 font-medium ${resultadoLimpar.startsWith('Erro') ? 'text-red-500' : 'text-green-600'}`}>
              ✓ {resultadoLimpar}
            </p>
          )}
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">Carregando...</div>
        ) : importacoes.length === 0 ? (
          <div className="text-center py-20 text-gray-400">Nenhuma importação encontrada.</div>
        ) : (
          <div className="space-y-2">
            {importacoes.map((imp) => (
              <div key={imp.id} className="bg-white rounded-xl px-5 py-4 shadow-sm border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${imp.tipo === 'pdf' ? 'bg-purple-100 text-purple-700' : 'bg-orange-100 text-orange-700'}`}>
                    {imp.tipo.toUpperCase()}
                  </span>
                  <div>
                    <div className="text-sm font-medium text-gray-900">
                      {imp.banco ? `${imp.banco}${imp.periodo ? ` — ${imp.periodo}` : ''}` : imp.nomeArquivo}
                    </div>
                    <div className="text-xs text-gray-400">
                      {imp._count.transacoes} transações · {new Date(imp.criadoEm).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                </div>

                {confirmando === imp.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-600">Confirmar exclusão?</span>
                    <button
                      onClick={() => desfazer(imp.id)}
                      disabled={processando === imp.id}
                      className="px-3 py-1 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 disabled:opacity-50"
                    >
                      {processando === imp.id ? '...' : 'Sim, desfazer'}
                    </button>
                    <button onClick={() => setConfirmando(null)} className="px-3 py-1 border rounded text-xs text-gray-600">Cancelar</button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmando(imp.id)}
                    className="px-3 py-1.5 border border-red-300 text-red-600 rounded-lg text-xs font-medium hover:bg-red-50"
                  >
                    Desfazer
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
