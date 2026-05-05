import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { usePlayer } from '../contexts/PlayerContext'
import Layout from '../components/Layout'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts'

const TYPE_LABELS = {
  creature: 'クリーチャー', instant: 'インスタント', sorcery: 'ソーサリー',
  enchantment: 'エンチャント', artifact: 'アーティファクト', land: '土地',
}
const COLOR_DOT = {
  white: 'bg-yellow-100 border border-yellow-300', blue: 'bg-blue-500',
  black: 'bg-gray-900 border border-gray-500', red: 'bg-red-500',
  green: 'bg-green-600', colorless: 'bg-gray-400',
  multicolor: 'bg-gradient-to-br from-yellow-400 to-purple-500',
}

function PriceChart({ cardId }) {
  const [history, setHistory] = useState([])

  useEffect(() => {
    supabase
      .from('market_history')
      .select('price, recorded_at')
      .eq('card_id', cardId)
      .order('recorded_at', { ascending: true })
      .limit(30)
      .then(({ data }) => {
        setHistory((data || []).map(h => ({
          price: h.price,
          time: new Date(h.recorded_at).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }),
        })))
      })
  }, [cardId])

  if (history.length < 2) {
    return <p className="text-gray-500 text-sm text-center py-4">価格履歴がまだありません</p>
  }

  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={history}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis dataKey="time" tick={{ fill: '#9ca3af', fontSize: 10 }} />
        <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} width={45} />
        <Tooltip
          contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: 8 }}
          labelStyle={{ color: '#9ca3af' }}
          formatter={(v) => [`${v}G`, '価格']}
        />
        <Line type="monotone" dataKey="price" stroke="#a855f7" strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

function CardModal({ card, market, onClose, onPurchase, purchasing }) {
  const displayPrice = market?.current_price ?? card.price
  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-2xl border border-gray-700 max-w-md w-full p-6" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-start mb-4">
          <div>
            <h2 className="text-xl font-bold text-white">{card.name}</h2>
            <p className="text-gray-400 text-sm">{TYPE_LABELS[card.card_type] || card.card_type}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white text-xl">✕</button>
        </div>

        {card.art_url && (
          <img src={card.art_url} alt={card.name} className="w-full h-40 object-cover rounded-lg mb-4" />
        )}

        {card.effect_text && (
          <p className="text-gray-300 text-sm mb-4 leading-relaxed whitespace-pre-wrap">{card.effect_text.replace(/\\n/g, '\n')}</p>
        )}

        <div className="bg-gray-900 rounded-xl p-4 mb-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-400">{market ? '現在価格' : '基本価格'}</span>
            <span className="text-yellow-400 font-bold font-mono">{displayPrice?.toLocaleString()}G</span>
          </div>
          {market && (
            <>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">基本価格</span>
                <span className="text-gray-300 font-mono">{market.base_price?.toLocaleString()}G</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">流通枚数</span>
                <span className="text-gray-300">{market.total_copies}枚</span>
              </div>
            </>
          )}
        </div>

        {market && (
          <div className="mb-4">
            <p className="text-gray-400 text-xs mb-2">価格推移</p>
            <PriceChart cardId={card.id} />
          </div>
        )}

        {market ? (
          <button
            onClick={() => onPurchase(card.id, displayPrice)}
            disabled={purchasing}
            className="w-full bg-yellow-500 hover:bg-yellow-400 disabled:bg-gray-600 disabled:cursor-not-allowed text-gray-900 font-bold py-3 rounded-xl transition-colors"
          >
            {purchasing ? '購入中...' : `${displayPrice?.toLocaleString()}G で購入`}
          </button>
        ) : (
          <p className="text-center text-gray-500 text-sm py-2">マーケット未出品</p>
        )}
      </div>
    </div>
  )
}

function PackCard({ pack, onOpen, opening }) {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 hover:border-purple-600 transition-colors">
      <div className="text-3xl mb-3">📦</div>
      <h3 className="font-semibold text-white mb-1">{pack.name}</h3>
      <p className="text-gray-400 text-sm mb-3">{pack.card_count}枚入り</p>
      <div className="flex items-center justify-between">
        <span className="text-yellow-400 font-bold font-mono">{pack.price.toLocaleString()}G</span>
        <button
          onClick={() => onOpen(pack.id, pack.price)}
          disabled={opening === pack.id}
          className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white text-sm px-4 py-2 rounded-lg transition-colors"
        >
          {opening === pack.id ? '開封中...' : '開封'}
        </button>
      </div>
    </div>
  )
}

export default function MarketPage() {
  const { player, refreshPlayer } = usePlayer()
  const [tab, setTab] = useState('cards')
  const [cards, setCards] = useState([])
  const [packs, setPacks] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [purchasing, setPurchasing] = useState(false)
  const [opening, setOpening] = useState(null)
  const [message, setMessage] = useState('')
  const [packResult, setPackResult] = useState(null)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      const [{ data: cardData }, { data: packData }] = await Promise.all([
        supabase.from('cards').select('*, card_market(*)').order('created_at', { ascending: false }),
        supabase.from('packs').select('*').eq('is_active', true),
      ])
      setCards(cardData || [])
      setPacks(packData || [])
      setLoading(false)
    }
    fetchData()
  }, [])

  const showMessage = (msg) => {
    setMessage(msg)
    setTimeout(() => setMessage(''), 3000)
  }

  const handlePurchase = async (cardId, price) => {
    if (!player) return
    if (player.balance < price) {
      showMessage('残高が不足しています')
      return
    }
    setPurchasing(true)
    const { error } = await supabase.rpc('purchase_card', {
      p_buyer_id: player.id,
      p_card_id: cardId,
    })
    if (error) {
      showMessage(`購入失敗: ${error.message}`)
    } else {
      showMessage('購入しました！')
      setSelected(null)
      await refreshPlayer()
      // カード再取得
      const { data } = await supabase.from('cards').select('*, card_market(*)').order('created_at', { ascending: false })
      setCards(data || [])
    }
    setPurchasing(false)
  }

  const handleOpenPack = async (packId, price) => {
    if (!player) return
    if (player.balance < price) {
      showMessage('残高が不足しています')
      return
    }
    setOpening(packId)
    const { data, error } = await supabase.rpc('open_pack', {
      p_player_id: player.id,
      p_pack_id: packId,
    })
    if (error) {
      showMessage(`開封失敗: ${error.message}`)
    } else {
      // RPCがUUID配列を返す場合はカード情報を取得
      if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'string') {
        const { data: cardData } = await supabase
          .from('cards')
          .select('id, name, card_type, color')
          .in('id', data)
        setPackResult(cardData || data)
      } else {
        setPackResult(data)
      }
      await refreshPlayer()
    }
    setOpening(null)
  }

  const filtered = cards.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase())
  )

  const selectedCard = selected ? cards.find(c => c.id === selected) : null
  const selectedMarket = selectedCard?.card_market?.[0] ?? selectedCard?.card_market

  return (
    <Layout>
      {message && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 bg-gray-800 border border-purple-600 text-white px-6 py-3 rounded-xl z-50 shadow-xl">
          {message}
        </div>
      )}

      {packResult && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-2xl border border-gray-700 max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-white mb-4 text-center">📦 開封結果</h2>
            <div className="space-y-2 mb-6">
              {(Array.isArray(packResult) ? packResult : []).map((card, i) => (
                <div key={i} className="flex items-center justify-between bg-gray-900 rounded-lg px-4 py-2">
                  <span className="text-white text-sm">{card.name || card}</span>
                  <span className="text-purple-400 text-xs">{TYPE_LABELS[card.card_type] || ''}</span>
                </div>
              ))}
              {!Array.isArray(packResult) && (
                <p className="text-gray-400 text-sm text-center">開封完了</p>
              )}
            </div>
            <button
              onClick={() => setPackResult(null)}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-2.5 rounded-xl"
            >
              閉じる
            </button>
          </div>
        </div>
      )}

      {selectedCard && (
        <CardModal
          card={selectedCard}
          market={selectedMarket}
          onClose={() => setSelected(null)}
          onPurchase={handlePurchase}
          purchasing={purchasing}
        />
      )}

      <div className="flex gap-2 mb-6">
        {[['cards', 'カード購入'], ['packs', 'パック開封']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-5 py-2 rounded-lg font-medium text-sm transition-colors ${
              tab === key ? 'bg-purple-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white border border-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'cards' && (
        <>
          <div className="mb-4">
            <input
              type="text"
              placeholder="カード名で検索..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-purple-500 w-full max-w-xs"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="text-gray-400">読み込み中...</div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filtered.map(card => {
                const market = Array.isArray(card.card_market) ? card.card_market[0] : card.card_market
                const displayPrice = market?.current_price ?? card.price
                return (
                  <button
                    key={card.id}
                    onClick={() => setSelected(card.id)}
                    className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden hover:border-purple-600 transition-colors text-left group"
                  >
                    {card.art_url ? (
                      <div className="aspect-[5/7] overflow-hidden bg-gray-900">
                        <img src={card.art_url} alt={card.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                      </div>
                    ) : (
                      <div className="aspect-[5/7] bg-gray-900 flex items-center justify-center">
                        <span className="text-gray-600 text-4xl">🃏</span>
                      </div>
                    )}
                    <div className="p-3">
                      <div className="flex items-center gap-1.5 mb-1">
                        <div className={`w-3 h-3 rounded-full shrink-0 ${COLOR_DOT[card.color] || 'bg-gray-500'}`} />
                        <p className="text-white text-xs font-medium truncate">{card.name}</p>
                      </div>
                      <p className="text-yellow-400 text-sm font-bold font-mono">{displayPrice?.toLocaleString()}G</p>
                      <p className="text-gray-500 text-xs">
                        {market ? `${market.total_copies}枚流通` : '基本価格'}
                      </p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </>
      )}

      {tab === 'packs' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {packs.length === 0 ? (
            <p className="text-gray-400 col-span-full text-center py-10">パックがありません</p>
          ) : (
            packs.map(pack => (
              <PackCard key={pack.id} pack={pack} onOpen={handleOpenPack} opening={opening} />
            ))
          )}
        </div>
      )}
    </Layout>
  )
}
