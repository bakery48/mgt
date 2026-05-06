import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { STARTER_DECKS } from '../data/starterDecks'

const PlayerContext = createContext(null)

const STORAGE_KEY = 'mtg_player_id'

export function PlayerProvider({ children }) {
  const [player, setPlayer] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const restore = async () => {
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

  const createPlayer = async (username) => {
    // 既存ユーザー名があれば再ログイン、なければ新規作成
    const { data: existing } = await supabase
      .from('players')
      .select()
      .eq('username', username)
      .maybeSingle()
    if (existing) {
      localStorage.setItem(STORAGE_KEY, existing.id)
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

    // 全15スターターデッキを一括作成（setPlayer前に完了させる）
    const allCardNames = [...new Set(STARTER_DECKS.flatMap(d => d.cards.map(c => c.name)))]
    const { data: cardRows } = await supabase.from('cards').select('id, name').in('name', allCardNames)

    if (cardRows?.length) {
      const nameToId = {}
      for (const row of cardRows) nameToId[row.name] = row.id

      // コレクション: 全デッキ分のカードを合算して追加
      const collectionMap = {}
      for (const deck of STARTER_DECKS) {
        for (const c of deck.cards) {
          const cardId = nameToId[c.name]
          if (cardId) collectionMap[cardId] = (collectionMap[cardId] || 0) + c.quantity
        }
      }
      const collectionInserts = Object.entries(collectionMap).map(([card_id, quantity]) => ({
        player_id: data.id, card_id, quantity,
      }))
      if (collectionInserts.length) {
        await supabase.from('player_collection').insert(collectionInserts)
      }

      // 全15デッキを作成
      for (const template of STARTER_DECKS) {
        const { data: newDeck } = await supabase
          .from('decks')
          .insert({ name: template.name, player_id: data.id, format: 'magic_league' })
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
