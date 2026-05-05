import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { usePlayer } from '../contexts/PlayerContext'
import Layout from '../components/Layout'

const TYPE_LABELS = {
  creature: 'クリーチャー', instant: 'インスタント', sorcery: 'ソーサリー',
  enchantment: 'エンチャント', artifact: 'アーティファクト', land: '土地',
}
const TYPE_BADGE = {
  creature: 'bg-red-900/50 text-red-300 border-red-700',
  instant: 'bg-blue-900/50 text-blue-300 border-blue-700',
  sorcery: 'bg-purple-900/50 text-purple-300 border-purple-700',
  enchantment: 'bg-green-900/50 text-green-300 border-green-700',
  artifact: 'bg-gray-700/50 text-gray-300 border-gray-600',
  land: 'bg-yellow-900/50 text-yellow-300 border-yellow-700',
}
const COLOR_DOT = {
  white: 'bg-yellow-100 border border-yellow-300', blue: 'bg-blue-500',
  black: 'bg-gray-900 border border-gray-500', red: 'bg-red-500',
  green: 'bg-green-600', colorless: 'bg-gray-400',
  multicolor: 'bg-gradient-to-br from-yellow-400 to-purple-500',
}

export default function CollectionPage() {
  const { player } = usePlayer()
  const [collection, setCollection] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    if (!player) return
    const fetchCollection = async () => {
      setLoading(true)
      const { data } = await supabase
        .from('player_collection')
        .select('quantity, cards(*)')
        .eq('player_id', player.id)
        .order('created_at', { ascending: false, foreignTable: 'cards' })
      setCollection(data || [])
      setLoading(false)
    }
    fetchCollection()
  }, [player])

  const filtered = collection.filter(item =>
    item.cards?.name?.toLowerCase().includes(search.toLowerCase())
  )

  const totalCards = collection.reduce((sum, item) => sum + item.quantity, 0)

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">コレクション</h1>
          <p className="text-gray-400 text-sm mt-1">{collection.length}種 / {totalCards}枚</p>
        </div>
        <input
          type="text"
          placeholder="カード名で検索..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-purple-500 w-48"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-gray-400">読み込み中...</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">📭</div>
          <p className="text-gray-400">コレクションが空です</p>
          <p className="text-gray-500 text-sm mt-1">マーケットでカードを購入するか、カードを作成してください</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
          {filtered.map(item => {
            const card = item.cards
            if (!card) return null
            return (
              <div key={card.id} className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden hover:border-purple-600 transition-colors">
                {card.art_url ? (
                  <div className="aspect-[5/7] overflow-hidden bg-gray-900 relative">
                    <img src={card.art_url} alt={card.name} className="w-full h-full object-cover" />
                    <div className="absolute top-2 right-2 bg-black/70 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      ×{item.quantity}
                    </div>
                  </div>
                ) : (
                  <div className="aspect-[5/7] bg-gray-900 flex items-center justify-center relative">
                    <span className="text-gray-600 text-5xl">🃏</span>
                    <div className="absolute top-2 right-2 bg-black/70 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      ×{item.quantity}
                    </div>
                  </div>
                )}
                <div className="p-3">
                  <div className="flex items-start justify-between gap-1 mb-2">
                    <p className="text-white text-xs font-medium leading-tight">{card.name}</p>
                    <div className={`w-3 h-3 rounded-full shrink-0 mt-0.5 ${COLOR_DOT[card.color] || 'bg-gray-500'}`} />
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-xs px-1.5 py-0.5 rounded border ${TYPE_BADGE[card.card_type] || 'bg-gray-700 text-gray-300 border-gray-600'}`}>
                      {TYPE_LABELS[card.card_type] || card.card_type}
                    </span>
                    {card.card_type === 'creature' && card.power != null && (
                      <span className="text-xs text-gray-400 font-mono">{card.power}/{card.toughness}</span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Layout>
  )
}
