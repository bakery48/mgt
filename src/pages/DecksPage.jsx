import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { usePlayer } from '../contexts/PlayerContext'
import Layout from '../components/Layout'

export default function DecksPage() {
  const { player } = usePlayer()
  const navigate = useNavigate()
  const [decks, setDecks] = useState([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [showForm, setShowForm] = useState(false)

  const fetchDecks = async () => {
    setLoading(true)
    const { data: deckData, error: deckError } = await supabase
      .from('decks')
      .select('*')
      .eq('player_id', player.id)
    if (deckError) { console.error('fetchDecks error:', deckError); setLoading(false); return }
    const deckIds = (deckData || []).map(d => d.id)
    let cardCounts = {}
    if (deckIds.length > 0) {
      const { data: dcData } = await supabase
        .from('deck_cards')
        .select('deck_id, quantity')
        .in('deck_id', deckIds)
      for (const row of (dcData || [])) {
        cardCounts[row.deck_id] = (cardCounts[row.deck_id] || 0) + row.quantity
      }
    }
    setDecks((deckData || []).map(d => ({ ...d, total_cards: cardCounts[d.id] || 0 })))
    setLoading(false)
  }

  useEffect(() => { if (player) fetchDecks() }, [player])

  const createDeck = async (e) => {
    e.preventDefault()
    if (!newName.trim()) return
    setCreating(true)
    const { data, error } = await supabase
      .from('decks')
      .insert({ player_id: player.id, name: newName.trim() })
      .select()
      .single()
    if (!error && data) {
      navigate(`/decks/${data.id}`)
    }
    setCreating(false)
  }

  const deleteDeck = async (deckId, e) => {
    e.stopPropagation()
    if (!confirm('このデッキを削除しますか？')) return
    await supabase.from('decks').delete().eq('id', deckId)
    fetchDecks()
  }

  const getDeckCount = (deck) => deck.total_cards || 0

  const getValidityColor = (count) => {
    if (count === 0) return 'text-gray-500'
    if (count < 40) return 'text-red-400'
    if (count <= 60) return 'text-green-400'
    return 'text-red-400'
  }

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">デッキ一覧</h1>
        <button
          onClick={() => setShowForm(true)}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
        >
          + 新規デッキ
        </button>
      </div>

      {showForm && (
        <form onSubmit={createDeck} className="bg-gray-800 border border-gray-700 rounded-xl p-4 mb-6 flex gap-3">
          <input
            autoFocus
            type="text"
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="デッキ名を入力..."
            className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
          />
          <button
            type="submit"
            disabled={creating || !newName.trim()}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm"
          >
            {creating ? '作成中...' : '作成'}
          </button>
          <button
            type="button"
            onClick={() => { setShowForm(false); setNewName('') }}
            className="text-gray-400 hover:text-white px-3 py-2 rounded-lg text-sm"
          >
            キャンセル
          </button>
        </form>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-gray-400">読み込み中...</div>
        </div>
      ) : decks.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">📋</div>
          <p className="text-gray-400 mb-4">デッキがまだありません</p>
          <button
            onClick={() => setShowForm(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-lg"
          >
            最初のデッキを作成
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {decks.map(deck => {
            const count = getDeckCount(deck)
            return (
              <div
                key={deck.id}
                onClick={() => navigate(`/decks/${deck.id}`)}
                className="bg-gray-800 border border-gray-700 rounded-xl p-5 hover:border-purple-600 transition-colors cursor-pointer group"
              >
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-white group-hover:text-purple-300 transition-colors">
                    {deck.name}
                  </h3>
                  <button
                    onClick={(e) => deleteDeck(deck.id, e)}
                    className="text-gray-600 hover:text-red-400 text-sm transition-colors"
                  >
                    ✕
                  </button>
                </div>
                <div className="flex items-center justify-between">
                  <span className={`text-2xl font-bold font-mono ${getValidityColor(count)}`}>
                    {count}
                  </span>
                  <span className="text-gray-500 text-sm">枚</span>
                </div>
                <p className={`text-xs mt-1 ${getValidityColor(count)}`}>
                  {count === 0 ? 'カード未追加' : count < 40 ? `あと${40 - count}枚必要` : count <= 60 ? '有効' : '枚数オーバー'}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </Layout>
  )
}
