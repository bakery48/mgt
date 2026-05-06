import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { STARTER_DECKS } from '../data/starterDecks'

const PlayerContext = createContext(null)

const STORAGE_KEY = 'mtg_player_id'

const MISSING_CARDS = [
  { name: '神秘の潮流', card_type: 'sorcery',  color: 'blue',  mana_cost: '{2}{U}', power: null, toughness: null, effect_text: 'カードを2枚引く。',                                                                           keywords: [],                                          price: 800 },
  { name: '怨念の騎兵', card_type: 'creature', color: 'black', mana_cost: '{2}{B}', power: 2,    toughness: 2,    effect_text: '接死、威迫を持つ。',                                                                         keywords: [{ type: 'deathtouch' }, { type: 'menace' }], price: 900 },
  { name: '巨大化',     card_type: 'instant',  color: 'green', mana_cost: '{G}',    power: null, toughness: null, effect_text: 'クリーチャー1体を対象とし、ターン終了時までそれは+3/+3の修整を受ける。', keywords: [],                                          price: 600 },
  { name: '神聖なる壁', card_type: 'creature', color: 'white', mana_cost: '{1}{W}', power: 0,    toughness: 6,    effect_text: '防衛を持つ。',                                                                               keywords: [{ type: 'defender' }],                       price: 700 },
]

async function seedMissingCards() {
  const names = MISSING_CARDS.map(c => c.name)
  const { data: existing } = await supabase.from('cards').select('name').in('name', names)
  const existingNames = new Set((existing || []).map(c => c.name))
  const toInsert = MISSING_CARDS.filter(c => !existingNames.has(c.name))
  if (toInsert.length > 0) {
    await supabase.from('cards').insert(toInsert)
  }
}

export function PlayerProvider({ children }) {
  const [player, setPlayer] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const restore = async () => {
      await seedMissingCards()
      const savedId = localStorage.getItem(STORAGE_KEY)
      if (savedId) {
        const { data } = await supabase
          .from('players')
          .select('*')
          .eq('id', savedId)
          .single()
        if (data) {
          setPlayer(data)
          setLoading(false)
          return
        }
        localStorage.removeItem(STORAGE_KEY)
      }
      setLoading(false)
    }
    restore()
  }, [])

  const ensureStarterDecks = async (playerId) => {
    const { count } = await supabase
      .from('decks')
      .select('id', { count: 'exact', head: true })
      .eq('player_id', playerId)
      .eq('name', STARTER_DECKS[0].name)
    if (count > 0) return

    const allCardNames = [...new Set(STARTER_DECKS.flatMap(d => d.cards.map(c => c.name)))]
    const { data: cardRows } = await supabase.from('cards').select('id, name').in('name', allCardNames)
    if (!cardRows?.length) return

    const nameToId = {}
    for (const row of cardRows) nameToId[row.name] = row.id

    const collectionMap = {}
    for (const deck of STARTER_DECKS) {
      for (const c of deck.cards) {
        const cardId = nameToId[c.name]
        if (cardId) collectionMap[cardId] = (collectionMap[cardId] || 0) + c.quantity
      }
    }
    const collectionInserts = Object.entries(collectionMap).map(([card_id, quantity]) => ({
      player_id: playerId, card_id, quantity,
    }))
    if (collectionInserts.length) {
      await supabase.from('player_collection').upsert(collectionInserts, { onConflict: 'player_id,card_id' })
    }

    for (const template of STARTER_DECKS) {
      const { data: newDeck } = await supabase
        .from('decks')
        .insert({ name: template.name, player_id: playerId, format: 'magic_league' })
        .select('id')
        .single()
      if (newDeck) {
        const deckCardInserts = template.cards
          .filter(c => nameToId[c.name])
          .map(c => ({ deck_id: newDeck.id, card_id: nameToId[c.name], quantity: c.quantity }))
        if (deckCardInserts.length) {
          await supabase.from('deck_cards').insert(deckCardInserts)
        }
      }
    }
  }

  const createPlayer = async (username) => {
    // 既存ユーザー名があれば再ログイン、なければ新規作成
    const { data: existing } = await supabase
      .from('players')
      .select()
      .eq('username', username)
      .maybeSingle()
    if (existing) {
      localStorage.setItem(STORAGE_KEY, existing.id)
      await ensureStarterDecks(existing.id)
      setPlayer(existing)
      return
    }
    const { data, error } = await supabase
      .from('players')
      .insert({ username, balance: 10000 })
      .select()
      .single()
    if (error) throw error
    localStorage.setItem(STORAGE_KEY, data.id)
    await ensureStarterDecks(data.id)
    setPlayer(data)
    return data
  }

  const refreshPlayer = async () => {
    if (!player) return
    const { data } = await supabase
      .from('players')
      .select('*')
      .eq('id', player.id)
      .single()
    if (data) setPlayer(data)
  }

  const clearPlayer = () => {
    localStorage.removeItem(STORAGE_KEY)
    setPlayer(null)
  }

  return (
    <PlayerContext.Provider value={{ player, loading, createPlayer, refreshPlayer, clearPlayer }}>
      {children}
    </PlayerContext.Provider>
  )
}

export const usePlayer = () => useContext(PlayerContext)
