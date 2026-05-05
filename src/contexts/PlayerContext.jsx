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
      .insert({ username, balance: 1000 })
      .select()
      .single()
    if (error) throw error
    localStorage.setItem(STORAGE_KEY, data.id)
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
