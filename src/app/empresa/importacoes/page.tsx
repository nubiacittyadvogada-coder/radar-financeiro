'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { formatarMoeda, MESES } from '@/lib/utils'

const TIPO_LABEL: Record<string, { label: string; cor: string }> = {
  receitas: { label: 'Receitas', cor: 'bg-green-100 text-green-700' },
  despesas: { label: 'Despesas', cor: 'bg-red-100 text-red-600' },
  contas: { label: 'Contas a Pagar', cor: 'bg-orange-100 text-orange-600' },
  dre: { label: 'DRE', cor: 'bg-blue-100 text-blue-600' },
}

export default function ImportacoesPage() {
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [importacoes, setImportacoes] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [desfazendo, setDesfazendo] = useState<string | null>(null)
  const [mensagem, setMensagem] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  useEffect(() => {
    const u = localStorage.getItem('radar_usuario')
    const t = localStorage.getItem('radar_token')
    if (!u || !t) { router.push('/login'); return }
    const parsed = JSON.parse(u)
    if (parsed.tipo !== 'usuario') { router.push('/login'); return }
    setToken(t)
  }, [router])

  const carregar = useCallback(async () => {
    if (!token) return
    setLoading(true)
    try {
      const res = await fetch('/api/v2/empresa/importacoes', { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) setImportacoes(await res.json())
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => { carregar() }, [carregar])

  async function desfazer(id: string, nomeArquivo: string) {
    if (!confirm(`Desfazer a importação "${nomeArquivo}"?\n\nTodos os lançamentos dessa importação serão removidos e os fechamentos recalculados.`)) return
    setDesfazendo(id)
    setMensagem(null)
    try {
      const res = await fetch(`/api/v2/empresa/importacoes/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.erro)
      setMensagem({ tipo: 'ok', texto: `Importação removida: ${data.lancamentosRemovidos} lançamentos, ${data.mesesRecalculados} mês(es) recalculado(s).` })
      await carregar()
    } catch (err: any) {
      setMensagem({ tipo: 'erro', texto: err.message })
    } finally {
      setDesfazendo(null)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Histórico de Importações</h1>
          <p className="text-sm text-gray-500 mt-0.5">Gerencie e desfaça importações realizadas</p>
        </div>
        <button
          onClick={() => router.push('/empresa/importar')}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          + Nova importação
        </button>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-4">
        {mensagem && (
          <div className={`px-4 py-3 rounded-xl text-sm ${mensagem.tipo === 'ok' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
            {mensagem.tipo === 'ok' ? '✅' : '❌'} {mensagem.texto}
          </div>
        )}

        {loading ? (
          <div className="text-center py-20 text-gray-400">Carregando...</div>
        ) : importacoes.length === 0 ? (
          <div className="bg-white rounded-xl p-8 text-center shadow-sm border">
            <div className="text-4xl mb-4">📂</div>
            <h2 className="text-lg font-semibold text-gray-800 mb-2">Nenhuma importação ainda</h2>
            <p className="text-gray-500 mb-6">Importe planilhas de receitas, despesas ou contas a pagar.</p>
            <button
              onClick={() => router.push('/empresa/importar')}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
            >
              Ir para Importar
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Arquivo</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Competência</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Lançamentos</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Data</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {importacoes.map((imp: any) => {
                  const conf = TIPO_LABEL[imp.tipo] || { label: imp.tipo, cor: 'bg-gray-100 text-gray-600' }
                  const data = new Date(imp.criadoEm)
                  return (
                    <tr key={imp.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${conf.cor}`}>{conf.label}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 max-w-[180px] truncate">{imp.nomeArquivo}</td>
                      <td className="px-4 py-3 text-gray-600">{MESES[imp.mes]} {imp.ano}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-700">{imp._count?.lancamentos ?? imp.linhasProcessadas ?? '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{data.toLocaleDateString('pt-BR')} {data.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => desfazer(imp.id, imp.nomeArquivo)}
                          disabled={desfazendo === imp.id}
                          className="text-xs px-3 py-1.5 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-40"
                        >
                          {desfazendo === imp.id ? 'Removendo...' : 'Desfazer'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-sm text-yellow-700">
          <strong>Atenção:</strong> Desfazer uma importação remove permanentemente todos os lançamentos daquele arquivo e recalcula o DRE dos meses afetados.
        </div>
      </main>
    </div>
  )
}
