import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { usePlayer } from '../contexts/PlayerContext'
import Layout from '../components/Layout'
import { CPU_USERNAME } from '../lib/cpuPlayer'

export default function BattleLobbyPage() {
  const { player } = usePlayer()
  const navigate = useNavigate()

  const [decks, setDecks] = useState([])
  const [selectedDeckId, setSelectedDeckId] = useState('')
  const [startingLife, setStartingLife] = useState(20)
  const [openBattles, setOpenBattles] = useState([])
  const [loading, setLoading] = useState(true)
  const [starting, setStarting] = useState(false)
  const [creating, setCreating] = useState(false)
  const [joinId, setJoinId] = useState('')
  const chanRef = useRef(null)

  const fetchData = async () => {
    setLoading(true)
    const [{ data: deckData }, { data: gameData }] = await Promise.all([
      supabase.from('decks').select('id, name, format').eq('player_id', player.id),
      supabase.from('games').select('*, game_players(player_id, players(username))').eq('status', 'waiting'),
    ])
    const myDecks = deckData || []
    setDecks(myDecks)
    if (myDecks.length > 0 && !selectedDeckId) setSelectedDeckId(myDecks[0].id)
    const battles = (gameData || []).filter(g => g.game_state?.game_type === 'battle')
    setOpenBattles(battles)
    setLoading(false)
  }

  useEffect(() => {
    if (!player) return
    fetchData()
    chanRef.current = supabase.channel('battle_lobby')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games' }, fetchData)
      .subscribe()
    return () => chanRef.current?.unsubscribe()
  }, [player])

  const getCpuPlayer = async () => {
    let { data: cpu } = await supabase.from('players').select('id').eq('username', CPU_USERNAME).maybeSingle()
    if (!cpu) {
      const { data: newCpu, error } = await supabase.from('players').insert({ username: CPU_USERNAME, balance: 0 }).select('id').single()
      if (error) throw new Error('CPU作成失敗: ' + error.message)
      cpu = newCpu
    }
    return cpu
  }

  const createGameEntry = async (deckId, opponentId, opponentDeckId, status) => {
    const { data: game, error } = await supabase.from('games').insert({
      status,
      total_rounds: 1,
      current_round: 1,
      vp_threshold: 99,
      cash_threshold: 99999,
      starting_balance: 0,
      starting_life: startingLife,
      game_state: { game_type: 'battle', starting_life: startingLife },
    }).select('id').single()
    if (error) throw new Error('ゲーム作成失敗: ' + error.message)

    const players = [
      { game_id: game.id, player_id: player.id, turn_order: 1, victory_points: 0, balance: 0, bye_last_round: false, is_winner: false, deck_id: deckId },
    ]
    if (opponentId) {
      players.push({ game_id: game.id, player_id: opponentId, turn_order: 2, victory_points: 0, balance: 0, bye_last_round: false, is_winner: false, deck_id: opponentDeckId })
    }
    await supabase.from('game_players').insert(players)
    return game.id
  }

  const startCpuBattle = async () => {
    if (!selectedDeckId) { alert('デッキを選択してください'); return }
    setStarting(true)
    try {
      const cpu = await getCpuPlayer()

      // CPU用のスターターデッキを割り当て
      const { assignStarterDeck } = await import('../lib/assignStarterDeck')
      const cpuDeckId = await assignStarterDeck(cpu.id)

      const gameId = await createGameEntry(selectedDeckId, cpu.id, cpuDeckId, 'in_progress')
      navigate(`/game/${gameId}/play`)
    } catch (err) {
      alert('エラー: ' + err.message)
    } finally {
      setStarting(false)
    }
  }

  const createBattle = async () => {
    if (!selectedDeckId) { alert('デッキを選択してください'); return }
    setCreating(true)
    try {
      const gameId = await createGameEntry(selectedDeckId, null, null, 'waiting')
      navigate(`/battle/${gameId}`)
    } catch (err) {
      alert('エラー: ' + err.message)
    } finally {
      setCreating(false)
    }
  }

  const joinByIdHandler = () => {
    const trimmed = joinId.trim()
    if (!trimmed) return
    navigate(`/battle/${trimmed}`)
  }

  return (
    <Layout>
      <h1 className="text-2xl font-bold text-white mb-6">対戦ロビー</h1>

      {/* 設定パネル */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">対戦設定</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 mb-5">
          {/* デッキ選択 */}
          <div>
            <label className="block text-sm text-gray-300 mb-1.5">使用デッキ</label>
            {decks.length === 0 ? (
              <p className="text-gray-500 text-sm">デッキがありません。先にデッキを作成してください。</p>
            ) : (
              <select
                value={selectedDeckId}
                onChange={e => setSelectedDeckId(e.target.value)}
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
              >
                {decks.map(d => (
                  <option key={d.id} value={d.id}>{d.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* 初期ライフ */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-sm text-gray-300">初期ライフ</label>
              <span className="text-sm font-bold text-purple-300 font-mono">{startingLife} LP</span>
            </div>
            <input
              type="range" min={10} max={40} step={1} value={startingLife}
              onChange={e => setStartingLife(+e.target.value)}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
            />
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>10 LP</span><span>40 LP</span>
            </div>
          </div>
        </div>

        {/* ボタン */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={startCpuBattle}
            disabled={starting || !selectedDeckId}
            className="bg-green-700 hover:bg-green-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            {starting ? '準備中...' : '🤖 CPU対戦'}
          </button>
          <button
            onClick={createBattle}
            disabled={creating || !selectedDeckId}
            className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            {creating ? '作成中...' : '+ 対戦を作成'}
          </button>
        </div>
      </div>

      {/* IDで参加 */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 mb-6 flex gap-3 items-center">
        <span className="text-gray-400 text-sm shrink-0">IDで参加:</span>
        <input
          type="text"
          value={joinId}
          onChange={e => setJoinId(e.target.value)}
          placeholder="対戦IDを貼り付け"
          onKeyDown={e => e.key === 'Enter' && joinByIdHandler()}
          className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
        />
        <button
          onClick={joinByIdHandler}
          disabled={!joinId.trim()}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm shrink-0"
        >
          参加
        </button>
      </div>

      {/* 募集中の対戦一覧 */}
      <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">募集中の対戦</h2>
      {loading ? (
        <div className="text-center py-10 text-gray-400">読み込み中...</div>
      ) : openBattles.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-5xl mb-3">⚔</div>
          <p className="text-gray-400">募集中の対戦はありません</p>
        </div>
      ) : (
        <div className="space-y-3">
          {openBattles.map(battle => {
            const host = battle.game_players?.[0]
            const isHost = host?.player_id === player.id
            return (
              <div
                key={battle.id}
                onClick={() => navigate(`/battle/${battle.id}`)}
                className="bg-gray-800 border border-gray-700 hover:border-purple-600 rounded-xl p-4 cursor-pointer transition-colors flex items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-green-400 text-sm font-medium">● 募集中</span>
                    {isHost && <span className="text-xs bg-purple-800 text-purple-300 px-1.5 py-0.5 rounded">あなたのルーム</span>}
                  </div>
                  <div className="text-xs text-gray-400 font-mono">{battle.id.slice(0, 12)}...</div>
                  <div className="text-xs text-gray-500 mt-1">
                    ホスト: {host?.players?.username ?? '?'} / 初期LP: {battle.starting_life ?? 20}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-white font-bold text-lg">{battle.game_players?.length ?? 0}/2</p>
                  <p className="text-gray-500 text-xs">人参加</p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Layout>
  )
}
