import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { usePlayer } from '../contexts/PlayerContext'
import Layout from '../components/Layout'

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
const TYPE_ORDER = ['creature', 'land', 'instant', 'sorcery', 'enchantment', 'artifact']

const FORMAT_CONFIG = {
  standard:    { min: 60, maxCopies: 4, landUnlimited: false, label: 'スタンダード',    desc: '60枚以上・同名4枚まで' },
  limited:     { min: 40, maxCopies: 4, landUnlimited: true,  label: 'リミテッド',      desc: '40枚以上・土地無制限' },
  magic_league:{ min: 30, maxCopies: 4, landUnlimited: true,  label: 'マジックリーグ', desc: '30枚以上・土地無制限' },
}

export default function DeckEditPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { player } = usePlayer()

  const [deck, setDeck] = useState(null)
  const [collection, setCollection] = useState([])  // { card, owned }
  const [deckCards, setDeckCards] = useState({})     // { card_id: quantity }
  const [format, setFormat] = useState('standard')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [validating, setValidating] = useState(false)
  const [validMsg, setValidMsg] = useState('')
  const [search, setSearch] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const savedDeckRef = useRef({})  // tracks last-saved state for diff-based save

  useEffect(() => {
    if (!player) return
    const load = async () => {
      setLoading(true)
      const [{ data: deckData }, { data: colData }, { data: dcData }] = await Promise.all([
        supabase.from('decks').select('*').eq('id', id).single(),
        supabase.from('player_collection').select('quantity, cards(*)').eq('player_id', player.id),
        supabase.from('deck_cards').select('card_id, quantity').eq('deck_id', id),
      ])
      setDeck(deckData)
      setFormat(deckData?.format || 'standard')
      setCollection(colData || [])
      const map = {}
      ;(dcData || []).forEach(dc => { map[dc.card_id] = dc.quantity })
      setDeckCards(map)
      savedDeckRef.current = { ...map }
      setLoading(false)
    }
    load()
  }, [id, player])

  const totalCount = Object.values(deckCards).reduce((s, q) => s + q, 0)

  const fCfg = FORMAT_CONFIG[format] || FORMAT_CONFIG.standard

  const addCard = useCallback((cardId) => {
    setDeckCards(prev => {
      const cur = prev[cardId] || 0
      const item = collection.find(c => c.cards?.id === cardId)
      const owned = item?.quantity || 0
      const isLand = item?.cards?.card_type === 'land'
      const cfg = FORMAT_CONFIG[format] || FORMAT_CONFIG.standard
      const maxCopies = (cfg.landUnlimited && isLand) ? Infinity : cfg.maxCopies
      if (cur >= maxCopies || cur >= owned) return prev
      setDirty(true)
      return { ...prev, [cardId]: cur + 1 }
    })
  }, [collection, format])

  const removeCard = useCallback((cardId) => {
    setDeckCards(prev => {
      const cur = prev[cardId] || 0
      if (cur <= 0) return prev
      setDirty(true)
      const next = { ...prev }
      if (cur === 1) delete next[cardId]
      else next[cardId] = cur - 1
      return next
    })
  }, [])

  const save = async () => {
    setSaving(true)
    setSaveMsg('')

    // Save format to decks table
    await supabase.from('decks').update({ format }).eq('id', id)

    const upsertRows = Object.entries(deckCards)
      .filter(([, q]) => q > 0)
      .map(([card_id, quantity]) => ({ deck_id: id, card_id, quantity }))

    // Cards that existed before but are now gone
    const removedIds = Object.keys(savedDeckRef.current).filter(cid => !deckCards[cid])

    // Upsert current cards
    if (upsertRows.length > 0) {
      const { error } = await supabase.from('deck_cards').upsert(upsertRows, { onConflict: 'deck_id,card_id' })
      if (error) { setSaveMsg('保存失敗: ' + error.message); setSaving(false); return }
    }

    // Delete only the cards that were explicitly removed
    if (removedIds.length > 0) {
      const { error } = await supabase.from('deck_cards').delete().eq('deck_id', id).in('card_id', removedIds)
      if (error) { setSaveMsg('保存失敗: ' + error.message); setSaving(false); return }
    }

    // If deck is now empty and savedDeck was not empty, delete all
    if (upsertRows.length === 0 && Object.keys(savedDeckRef.current).length > 0) {
      const { error } = await supabase.from('deck_cards').delete().eq('deck_id', id)
      if (error) { setSaveMsg('保存失敗: ' + error.message); setSaving(false); return }
    }

    savedDeckRef.current = { ...deckCards }
    setDirty(false)
    setSaveMsg('保存しました')
    setTimeout(() => setSaveMsg(''), 2000)
    setSaving(false)
  }

  const validate = async () => {
    setValidating(true)
    const cfg = FORMAT_CONFIG[format] || FORMAT_CONFIG.standard
    const isValid = totalCount >= cfg.min
    setValidMsg(isValid
      ? `✓ デッキは有効です（${cfg.min}枚以上）`
      : `✗ デッキが無効です（${cfg.min}枚以上にしてください）`
    )
    setValidating(false)
  }

  const countColor = totalCount < fCfg.min ? 'text-red-400' : 'text-green-400'

  // コレクションカードをタイプ別ソート
  const filteredCollection = collection
    .filter(item => item.cards?.name?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const ai = TYPE_ORDER.indexOf(a.cards?.card_type)
      const bi = TYPE_ORDER.indexOf(b.cards?.card_type)
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    })

  // デッキ内カードをコレクションから引いて表示用に構築
  const deckList = Object.entries(deckCards)
    .filter(([, q]) => q > 0)
    .map(([card_id, quantity]) => {
      const item = collection.find(c => c.cards?.id === card_id)
      return { card: item?.cards, card_id, quantity }
    })
    .filter(d => d.card)
    .sort((a, b) => {
      const ai = TYPE_ORDER.indexOf(a.card?.card_type)
      const bi = TYPE_ORDER.indexOf(b.card?.card_type)
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi)
    })

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <div className="text-gray-400">読み込み中...</div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="mb-4 bg-yellow-900/30 border border-yellow-700/50 rounded-lg px-4 py-2 text-yellow-400 text-xs">
        このデッキはバトル練習専用です。ゲームでは参加時にスターターデッキが自動付与されます。
      </div>

      {/* フォーマット選択 */}
      <div className="mb-4 bg-gray-800 border border-gray-700 rounded-xl p-3">
        <p className="text-gray-400 text-xs mb-2">フォーマット</p>
        <div className="flex gap-2">
          {Object.entries(FORMAT_CONFIG).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => { setFormat(key); setDirty(true); setValidMsg('') }}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                format === key
                  ? 'bg-purple-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              <div>{cfg.label}</div>
              <div className="text-xs opacity-70 mt-0.5">{cfg.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* ヘッダー */}
      <div className="flex items-center justify-between mb-4 gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/decks')} className="text-gray-400 hover:text-white text-sm">← デッキ一覧</button>
          <h1 className="text-xl font-bold text-white">{deck?.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          {saveMsg && <span className="text-green-400 text-sm">{saveMsg}</span>}
          {validMsg && <span className={`text-sm ${validMsg.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>{validMsg}</span>}
          <button
            onClick={validate}
            disabled={validating || dirty}
            className="bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white text-sm px-3 py-2 rounded-lg transition-colors"
          >
            検証
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white text-sm px-4 py-2 rounded-lg transition-colors"
          >
            {saving ? '保存中...' : '保存'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 左: コレクション */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">コレクション</h2>
            <input
              type="text"
              placeholder="検索..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-purple-500 w-36"
            />
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
            {filteredCollection.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">コレクションが空です</p>
            ) : (
              <div className="divide-y divide-gray-700 max-h-[600px] overflow-y-auto">
                {filteredCollection.map(({ cards: card, quantity: owned }) => {
                  const inDeck = deckCards[card.id] || 0
                  const isLand = card.card_type === 'land'
                  const maxCopies = (fCfg.landUnlimited && isLand) ? Infinity : fCfg.maxCopies
                  const canAdd = inDeck < maxCopies && inDeck < owned
                  return (
                    <div key={card.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-750 group">
                      <div className={`w-3 h-3 rounded-full shrink-0 ${COLOR_DOT[card.color] || 'bg-gray-500'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{card.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-gray-500 text-xs">{TYPE_LABELS[card.card_type] || card.card_type}</span>
                          {card.mana_cost && <span className="text-gray-500 text-xs font-mono">{card.mana_cost}</span>}
                          {card.card_type === 'creature' && <span className="text-gray-500 text-xs">{card.power}/{card.toughness}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-gray-500 text-xs">所持{owned}</span>
                        {inDeck > 0 && (
                          <span className="text-purple-400 text-xs font-bold bg-purple-900/40 px-1.5 py-0.5 rounded">
                            {inDeck}枚
                          </span>
                        )}
                        <button
                          onClick={() => removeCard(card.id)}
                          disabled={inDeck === 0}
                          className="w-7 h-7 rounded-lg bg-gray-700 hover:bg-red-800 disabled:opacity-30 text-white text-sm flex items-center justify-center transition-colors"
                        >
                          −
                        </button>
                        <button
                          onClick={() => addCard(card.id)}
                          disabled={!canAdd}
                          className="w-7 h-7 rounded-lg bg-gray-700 hover:bg-purple-700 disabled:opacity-30 text-white text-sm flex items-center justify-center transition-colors"
                        >
                          ＋
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* 右: デッキ */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">デッキ</h2>
            <span className={`text-2xl font-bold font-mono ${countColor}`}>
              {totalCount}<span className="text-gray-500 text-sm font-normal ml-1">/ {fCfg.min}枚以上</span>
            </span>
          </div>

          <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
            {deckList.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-8">カードを追加してください</p>
            ) : (
              <div className="divide-y divide-gray-700 max-h-[600px] overflow-y-auto">
                {deckList.map(({ card, card_id, quantity }) => {
                  const isLand = card?.card_type === 'land'
                  const maxCopies = (fCfg.landUnlimited && isLand) ? Infinity : fCfg.maxCopies
                  return (
                    <div key={card_id} className="flex items-center gap-3 px-4 py-3">
                      <div className={`w-3 h-3 rounded-full shrink-0 ${COLOR_DOT[card?.color] || 'bg-gray-500'}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{card?.name}</p>
                        <span className="text-gray-500 text-xs">{TYPE_LABELS[card?.card_type] || card?.card_type}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={() => removeCard(card_id)}
                          className="w-7 h-7 rounded-lg bg-gray-700 hover:bg-red-800 text-white text-sm flex items-center justify-center transition-colors"
                        >
                          −
                        </button>
                        <span className="text-white text-sm font-bold w-4 text-center">{quantity}</span>
                        <button
                          onClick={() => addCard(card_id)}
                          disabled={quantity >= maxCopies}
                          className="w-7 h-7 rounded-lg bg-gray-700 hover:bg-purple-700 disabled:opacity-30 text-white text-sm flex items-center justify-center transition-colors"
                        >
                          ＋
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* タイプ別内訳 */}
          {deckList.length > 0 && (
            <div className="mt-3 bg-gray-800 border border-gray-700 rounded-xl p-4">
              <p className="text-gray-400 text-xs mb-2">タイプ別</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(
                  deckList.reduce((acc, { card, quantity }) => {
                    const t = card?.card_type || 'unknown'
                    acc[t] = (acc[t] || 0) + quantity
                    return acc
                  }, {})
                ).map(([type, count]) => (
                  <span key={type} className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded">
                    {TYPE_LABELS[type] || type}: {count}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  )
}
