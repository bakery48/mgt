import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

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
        // DBに見つからなければ削除
        localStorage.removeItem(STORAGE_KEY)
      }
      setLoading(false)
    }
    restore()
  }, [])

  const createPlayer = async (username) => {
    const { data, error } = await supabase
      .from('players')
      .insert({ username, balance: 10000 })
      .select()
      .single()
    if (error) throw error
    localStorage.setItem(STORAGE_KEY, data.id)
    setPlayer(data)

    // スターターカードを付与（基本土地×各4枚 + 安価クリーチャー×各2枚）
    const STARTER_CARDS = [
      { name: '平野', qty: 4 }, { name: '島', qty: 4 }, { name: '沼', qty: 4 },
      { name: '山', qty: 4 },  { name: '森', qty: 4 },
      { name: '守護の衛兵', qty: 2 }, { name: '炎の精霊', qty: 2 },
      { name: 'ゴブリンの突撃者', qty: 2 }, { name: '骸骨の戦士', qty: 2 },
      { name: '回復の妖精', qty: 2 },
    ]
    const names = STARTER_CARDS.map(c => c.name)
    const { data: cardRows } = await supabase.from('cards').select('id, name').in('name', names)
    if (cardRows?.length) {
      const inserts = []
      for (const { name, qty } of STARTER_CARDS) {
        const card = cardRows.find(c => c.name === name)
        if (card) inserts.push({ player_id: data.id, card_id: card.id, quantity: qty })
      }
      if (inserts.length) await supabase.from('player_collection').insert(inserts)
    }

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
