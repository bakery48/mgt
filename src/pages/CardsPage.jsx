import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { usePlayer } from '../contexts/PlayerContext'

const TYPE_LABELS = {
  creature: 'クリーチャー',
  instant: 'インスタント',
  sorcery: 'ソーサリー',
  enchantment: 'エンチャント',
  artifact: 'アーティファクト',
  land: '土地',
}

const COLOR_LABELS = {
  white: '白', blue: '青', black: '黒', red: '赤', green: '緑', colorless: '無色', multicolor: '多色',
}

const COLOR_DOT = {
  white: 'bg-yellow-100 border border-yellow-300',
  blue: 'bg-blue-500',
  black: 'bg-gray-900 border border-gray-500',
  red: 'bg-red-500',
  green: 'bg-green-600',
  colorless: 'bg-gray-400',
  multicolor: 'bg-gradient-to-br from-yellow-400 to-purple-500',
}

const TYPE_BADGE = {
  creature: 'bg-red-900/50 text-red-300 border-red-700',
  instant: 'bg-blue-900/50 text-blue-300 border-blue-700',
  sorcery: 'bg-purple-900/50 text-purple-300 border-purple-700',
  enchantment: 'bg-green-900/50 text-green-300 border-green-700',
  artifact: 'bg-gray-700/50 text-gray-300 border-gray-600',
  land: 'bg-yellow-900/50 text-yellow-300 border-yellow-700',
}

const MTG_KEYWORD_LABELS = {
  flying: '飛行', haste: '速攻', vigilance: '警戒', trample: 'トランプル', reach: '到達',
  first_strike: '先制攻撃', double_strike: '二段攻撃', lifelink: '絆魂', deathtouch: '接死', menace: '威迫',
  defender: '防衛', indestructible: '破壊不能', hexproof: '呪禁', shroud: '被覆', flash: '瞬速',
  ward: '護法', protection: 'プロテクション', cycling: 'サイクリング', kicker: 'キッカー', flashback: 'フラッシュバック',
  equip: '装備', morph: '変異', unearth: '発掘', delve: '探査',
}

const ORIGINAL_KW = new Set(['拝金', '徴収', '栄光', '簒奪'])

function KeywordTag({ kw }) {
  const label = MTG_KEYWORD_LABELS[kw.type] || kw.type
  const isOriginal = ORIGINAL_KW.has(kw.type)
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs border ${
      isOriginal
        ? 'bg-amber-900/50 text-amber-300 border-amber-700'
        : 'bg-gray-700 text-gray-300 border-gray-600'
    }`}>
      {label}
      {isOriginal && kw.value != null && (
        <span className="text-amber-400 font-mono">{kw.value}</span>
      )}
    </span>
  )
}

function CardItem({ card }) {
  const keywords = Array.isArray(card.keywords) ? card.keywords : []

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden hover:border-purple-600 transition-colors group">
      {card.art_url ? (
        <div className="aspect-[5/7] overflow-hidden bg-gray-900">
          <img
            src={card.art_url}
            alt={card.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        </div>
      ) : (
        <div className="aspect-[5/7] bg-gray-900 flex items-center justify-center">
          <span className="text-gray-600 text-5xl">🃏</span>
        </div>
      )}

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-white text-sm leading-tight">{card.name}</h3>
          <div
            className={`w-4 h-4 rounded-full shrink-0 mt-0.5 ${COLOR_DOT[card.color] || 'bg-gray-500'}`}
            title={COLOR_LABELS[card.color]}
          />
        </div>

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className={`text-xs px-2 py-0.5 rounded border ${TYPE_BADGE[card.card_type] || 'bg-gray-700 text-gray-300 border-gray-600'}`}>
            {TYPE_LABELS[card.card_type] || card.card_type}
          </span>
          {card.mana_cost && (
            <span className="text-xs text-gray-400 font-mono">{card.mana_cost}</span>
          )}
          {card.card_type === 'creature' && card.power != null && card.toughness != null && (
            <span className="text-xs text-gray-300 font-mono bg-gray-700 px-2 py-0.5 rounded">
              {card.power}/{card.toughness}
            </span>
          )}
        </div>

        {card.effect_text && (
          <p className="text-xs text-gray-400 leading-relaxed mb-3 line-clamp-3">
            {card.effect_text}
          </p>
        )}

        {keywords.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {keywords.slice(0, 4).map((kw, i) => (
              <KeywordTag key={i} kw={kw} />
            ))}
            {keywords.length > 4 && (
              <span className="text-xs text-gray-500">+{keywords.length - 4}</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function CardsPage() {
  const navigate = useNavigate()
  const { player, clearPlayer } = usePlayer()
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState({ card_type: '', color: '', search: '' })

  useEffect(() => {
    const fetchCards = async () => {
      setLoading(true)
      let query = supabase.from('cards').select('*').order('created_at', { ascending: false })
      if (filter.card_type) query = query.eq('card_type', filter.card_type)
      if (filter.color) query = query.eq('color', filter.color)
      if (filter.search) query = query.ilike('name', `%${filter.search}%`)
      const { data, error } = await query
      if (error) setError(error.message)
      else setCards(data || [])
      setLoading(false)
    }
    fetchCards()
  }, [filter])

  const TYPES = ['', 'creature', 'instant', 'sorcery', 'enchantment', 'artifact', 'land']
  const COLORS = ['', 'white', 'blue', 'black', 'red', 'green', 'colorless', 'multicolor']

  return (
    <div className="min-h-screen">
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <h1 className="text-xl font-bold text-purple-400 shrink-0">MTG Board Game</h1>
          <div className="flex items-center gap-3 ml-auto">
            <div className="text-right hidden sm:block">
              <div className="text-white text-sm font-medium">{player?.username}</div>
              <div className="text-yellow-400 text-xs font-mono">{player?.balance?.toLocaleString()}G</div>
            </div>
            <button
              onClick={() => navigate('/cards/create')}
              className="bg-purple-600 hover:bg-purple-700 text-white text-sm px-4 py-2 rounded-lg transition-colors shrink-0"
            >
              + カード作成
            </button>
            <button
              onClick={clearPlayer}
              className="text-gray-500 hover:text-gray-300 text-xs px-2 py-2 rounded transition-colors shrink-0"
              title="プレイヤー変更"
            >
              退出
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-gray-800 rounded-xl p-4 border border-gray-700 mb-6">
          <div className="flex flex-wrap gap-3">
            <input
              type="text"
              placeholder="カード名で検索..."
              value={filter.search}
              onChange={(e) => setFilter(f => ({ ...f, search: e.target.value }))}
              className="bg-gray-900 border border-gray-600 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-purple-500 flex-1 min-w-40"
            />
            <select
              value={filter.card_type}
              onChange={(e) => setFilter(f => ({ ...f, card_type: e.target.value }))}
              className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
            >
              <option value="">すべてのタイプ</option>
              {TYPES.filter(Boolean).map(t => (
                <option key={t} value={t}>{TYPE_LABELS[t]}</option>
              ))}
            </select>
            <select
              value={filter.color}
              onChange={(e) => setFilter(f => ({ ...f, color: e.target.value }))}
              className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
            >
              <option value="">すべての色</option>
              {COLORS.filter(Boolean).map(c => (
                <option key={c} value={c}>{COLOR_LABELS[c]}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-gray-400">読み込み中...</div>
          </div>
        ) : error ? (
          <div className="bg-red-900/50 border border-red-700 rounded-lg px-4 py-3 text-red-300 text-sm">
            {error}
          </div>
        ) : cards.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl mb-4">🃏</div>
            <p className="text-gray-400 mb-4">カードがまだありません</p>
            <button
              onClick={() => navigate('/cards/create')}
              className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2.5 rounded-lg transition-colors"
            >
              最初のカードを作成
            </button>
          </div>
        ) : (
          <>
            <p className="text-gray-400 text-sm mb-4">{cards.length} 枚のカード</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {cards.map(card => (
                <CardItem key={card.id} card={card} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
