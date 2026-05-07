import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Layout from '../components/Layout'
import CardDetailModal from '../components/CardDetailModal'

const TYPE_LABELS = {
  creature: 'クリーチャー',
  instant: 'インスタント',
  sorcery: 'ソーサリー',
  enchantment: 'エンチャント',
  artifact: 'アーティファクト',
  land: '土地',
}

const SUBTYPE_LABELS = {
  subtype_vampire: '吸血鬼',
  subtype_angel: '天使',
  subtype_dragon: 'ドラゴン',
  subtype_elf: 'エルフ',
  subtype_goblin: 'ゴブリン',
  subtype_zombie: 'ゾンビ',
  subtype_human: '人間',
  subtype_knight: '騎士',
  subtype_wizard: 'ウィザード',
  subtype_warrior: '戦士',
  subtype_merfolk: '人魚',
  subtype_beast: '野獣',
  subtype_spirit: '精霊',
  subtype_bird: '鳥',
  subtype_cat: '猫',
  subtype_soldier: '兵士',
  subtype_noble: '貴族',
  subtype_rabbit: '兎',
  subtype_cleric: 'クレリック',
  subtype_rogue: 'ならず者',
  subtype_scout: 'スカウト',
  subtype_shaman: 'シャーマン',
  subtype_warlock: '邪術師',
  subtype_skeleton: 'スケルトン',
  subtype_phyrexian: 'ファイレクシアン',
  subtype_worm: 'ワーム',
  subtype_pirate: '海賊',
  subtype_horse: '馬',
  subtype_sphinx: 'スフィンクス',
  subtype_faerie: 'フェアリー',
  subtype_turtle: '亀',
  subtype_construct: '構築物',
  subtype_wall: '壁',
  subtype_djinn: 'ジン',
  subtype_shark: 'サメ',
  subtype_lizard: 'トカゲ',
  subtype_dwarf: 'ドワーフ',
  subtype_berserker: '狂戦士',
  subtype_elder: 'エルダー',
  subtype_dinosaur: '恐竜',
  subtype_druid: 'ドルイド',
  subtype_archer: '射手',
  subtype_snake: '蛇',
  subtype_giant: '巨人',
  subtype_elemental: 'エレメンタル',
  subtype_spider: '蜘蛛',
  subtype_treefolk: 'ツリーフォーク',
  subtype_ninja: '忍者',
  subtype_demon: '悪魔',
}

function getSubtypeLabel(keywords) {
  const subtypes = (keywords || [])
    .map(kw => SUBTYPE_LABELS[kw.type])
    .filter(Boolean)
  return subtypes.length ? subtypes.join('・') : null
}

const COLOR_LABELS = {
  white: '白', blue: '青', black: '黒', red: '赤', green: '緑', colorless: '無色', multicolor: '多色',
}

const MTG_KEYWORD_LABELS = {
  flying: '飛行', haste: '速攻', vigilance: '警戒', trample: 'トランプル', reach: '到達',
  first_strike: '先制攻撃', double_strike: '二段攻撃', lifelink: '絆魂', deathtouch: '接死', menace: '威迫',
  defender: '防衛', indestructible: '破壊不能', hexproof: '呪禁', shroud: '被覆', flash: '瞬速',
  ward: '護法', protection: 'プロテクション', cycling: 'サイクリング', kicker: 'キッカー', flashback: 'フラッシュバック',
  equip: '装備', morph: '変異', unearth: '発掘', delve: '探査',
}
const ORIGINAL_KW = new Set(['拝金', '徴収', '栄光', '簒奪'])

// CardDetailModal と同じフレーム定義
const FRAME = {
  white:     { outer: 'bg-gradient-to-b from-yellow-100 to-yellow-200 border-yellow-300',    header: 'bg-gradient-to-r from-yellow-50 to-yellow-100 text-gray-900',   typebar: 'bg-gradient-to-r from-yellow-50 to-yellow-100 text-gray-800', textbox: 'bg-amber-50 text-gray-800',    pt: 'bg-yellow-100 text-gray-900 border-yellow-400' },
  blue:      { outer: 'bg-gradient-to-b from-blue-300 to-blue-500 border-blue-600',          header: 'bg-gradient-to-r from-blue-200 to-blue-300 text-gray-900',      typebar: 'bg-gradient-to-r from-blue-200 to-blue-300 text-gray-800',   textbox: 'bg-blue-50 text-gray-800',     pt: 'bg-blue-200 text-gray-900 border-blue-400' },
  black:     { outer: 'bg-gradient-to-b from-gray-600 to-gray-800 border-gray-900',          header: 'bg-gradient-to-r from-gray-700 to-gray-800 text-gray-100',      typebar: 'bg-gradient-to-r from-gray-700 to-gray-800 text-gray-200',   textbox: 'bg-gray-900 text-gray-200',    pt: 'bg-gray-700 text-gray-100 border-gray-500' },
  red:       { outer: 'bg-gradient-to-b from-red-400 to-red-600 border-red-700',             header: 'bg-gradient-to-r from-red-200 to-red-300 text-gray-900',        typebar: 'bg-gradient-to-r from-red-200 to-red-300 text-gray-800',     textbox: 'bg-red-50 text-gray-800',      pt: 'bg-red-200 text-gray-900 border-red-400' },
  green:     { outer: 'bg-gradient-to-b from-green-400 to-green-700 border-green-800',       header: 'bg-gradient-to-r from-green-200 to-green-300 text-gray-900',    typebar: 'bg-gradient-to-r from-green-200 to-green-300 text-gray-800', textbox: 'bg-green-50 text-gray-800',    pt: 'bg-green-200 text-gray-900 border-green-400' },
  colorless: { outer: 'bg-gradient-to-b from-gray-300 to-gray-400 border-gray-500',          header: 'bg-gradient-to-r from-gray-200 to-gray-300 text-gray-900',      typebar: 'bg-gradient-to-r from-gray-200 to-gray-300 text-gray-800',   textbox: 'bg-gray-100 text-gray-800',    pt: 'bg-gray-200 text-gray-900 border-gray-400' },
  multicolor:{ outer: 'bg-gradient-to-b from-yellow-300 via-amber-400 to-yellow-500 border-yellow-600', header: 'bg-gradient-to-r from-yellow-100 to-amber-200 text-gray-900', typebar: 'bg-gradient-to-r from-yellow-100 to-amber-200 text-gray-800', textbox: 'bg-amber-50 text-gray-800', pt: 'bg-yellow-200 text-gray-900 border-yellow-500' },
}
const DEFAULT_FRAME = FRAME.colorless

function CardItem({ card, onClick }) {
  const keywords = Array.isArray(card.keywords) ? card.keywords : []
  const frame = FRAME[card.color] || DEFAULT_FRAME
  const subtypeLabel = getSubtypeLabel(keywords)
  const isCrea = card.card_type === 'creature'

  const visibleKws = keywords.filter(kw => MTG_KEYWORD_LABELS[kw.type] || ORIGINAL_KW.has(kw.type))
  const kwText = visibleKws.map(kw => {
    if (ORIGINAL_KW.has(kw.type)) return kw.type
    return MTG_KEYWORD_LABELS[kw.type]
  }).join('、')

  return (
    <div
      className={`rounded-xl border-4 ${frame.outer} shadow-lg cursor-pointer hover:scale-[1.02] transition-transform`}
      onClick={onClick}
    >
      <div className="p-1.5 flex flex-col gap-1">

        {/* 名前バー */}
        <div className={`flex items-center justify-between px-2 py-1 rounded-md border border-black/10 ${frame.header}`}>
          <span className="font-bold text-xs leading-tight truncate pr-1">{card.name}</span>
          {card.mana_cost && (
            <span className="font-mono text-xs font-bold shrink-0">{card.mana_cost}</span>
          )}
        </div>

        {/* アート（MTGのアートボックスは横長：縦横比 約3:2） */}
        <div className="rounded overflow-hidden border border-black/20 aspect-[3/2]">
          {card.art_url ? (
            <img
              src={card.art_url}
              alt={card.name}
              className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
            />
          ) : (
            <div className="w-full h-full bg-gray-700/50 flex items-center justify-center">
              <span className="text-4xl opacity-20">🃏</span>
            </div>
          )}
        </div>

        {/* タイプ行 */}
        <div className={`flex items-center px-2 py-0.5 rounded-md border border-black/10 text-xs font-semibold ${frame.typebar}`}>
          <span className="truncate">
            {TYPE_LABELS[card.card_type] || card.card_type}
            {subtypeLabel && <span className="font-normal"> — {subtypeLabel}</span>}
          </span>
        </div>

        {/* テキストボックス */}
        <div className={`rounded-md border border-black/10 px-2 py-1.5 min-h-[56px] flex flex-col justify-between ${frame.textbox}`}>
          <div>
            {kwText && (
              <p className="text-xs italic mb-1 leading-snug line-clamp-1">{kwText}</p>
            )}
            {card.effect_text && (
              <p className="text-xs leading-snug line-clamp-3 whitespace-pre-wrap">
                {card.effect_text.replace(/\\n/g, '\n')}
              </p>
            )}
            {!kwText && !card.effect_text && (
              <p className="text-xs opacity-30 italic">（効果なし）</p>
            )}
          </div>
          {isCrea && card.power != null && card.toughness != null && (
            <div className="flex justify-end mt-1">
              <span className={`font-mono font-bold text-xs px-2 py-0.5 rounded border-2 ${frame.pt}`}>
                {card.power}/{card.toughness}
              </span>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

export default function CardsPage() {
  const navigate = useNavigate()
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState({ card_type: '', color: '', search: '' })
  const [detailCard, setDetailCard] = useState(null)

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

  const TYPES = ['creature', 'instant', 'sorcery', 'enchantment', 'artifact', 'land']
  const COLORS = ['white', 'blue', 'black', 'red', 'green', 'colorless', 'multicolor']

  return (
    <Layout>
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
            {TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
          </select>
          <select
            value={filter.color}
            onChange={(e) => setFilter(f => ({ ...f, color: e.target.value }))}
            className="bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
          >
            <option value="">すべての色</option>
            {COLORS.map(c => <option key={c} value={c}>{COLOR_LABELS[c]}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-gray-400">読み込み中...</div>
        </div>
      ) : error ? (
        <div className="bg-red-900/50 border border-red-700 rounded-lg px-4 py-3 text-red-300 text-sm">{error}</div>
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
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {cards.map(card => <CardItem key={card.id} card={card} onClick={() => setDetailCard(card)} />)}
          </div>
        </>
      )}
      <CardDetailModal card={detailCard} onClose={() => setDetailCard(null)} />
    </Layout>
  )
}
