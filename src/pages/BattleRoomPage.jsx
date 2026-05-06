import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { usePlayer } from '../contexts/PlayerContext'
import Layout from '../components/Layout'

export default function BattleRoomPage() {
  const { id: gameId } = useParams()
  const { player } = usePlayer()
  const navigate = useNavigate()

  const [game, setGame] = useState(null)
  const [participants, setParticipants] = useState([])
  const [decks, setDecks] = useState([])
  const [selectedDeckId, setSelectedDeckId] = useState('')
  const [joining, setJoining] = useState(false)
  const [starting, setStarting] = useState(false)
  const [loading, setLoading] = useState(true)
  const chanRef = useRef(null)

  const fetchRoom = async () => {
    const [{ data: gameData }, { data: gpData }, { data: deckData }] = await Promise.all([
      supabase.from('games').select('*').eq('id', gameId).single(),
      supabase.from('game_players').select('*, players(username), decks(name)').eq('game_id', gameId).order('turn_order'),
      supabase.from('decks').select('id, name, format').eq('player_id', player.id),
    ])
    setGame(gameData)
    setParticipants(gpData || [])
    const myDecks = deckData || []
    setDecks(myDecks)
    if (myDecks.length > 0 && !selectedDeckId) setSelectedDeckId(myDecks[0].id)
    setLoading(false)

    // 対戦開始済みなら直接playへ
    if (gameData?.status === 'in_progress') {
      navigate(`/game/${gameId}/play`, { replace: true })
    }
  }

  useEffect(() => {
    if (!player) return
    fetchRoom()
    chanRef.current = supabase.channel(`battle_room_${gameId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, fetchRoom)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${gameId}` }, fetchRoom)
      .subscribe()
    return () => chanRef.current?.unsubscribe()
  }, [gameId, player])

  const myEntry = participants.find(p => p.player_id === player?.id)
  const isHost = participants[0]?.player_id === player?.id
  const isFull = participants.length >= 2
  const allReady = isFull && participants.every(p => p.deck_id)

  const joinBattle = async () => {
    if (!selectedDeckId) { alert('デッキを選択してください'); return }
    setJoining(true)
    try {
      await supabase.from('game_players').insert({
        game_id: gameId,
        player_id: player.id,
        turn_order: 2,
        victory_points: 0,
        balance: 0,
        bye_last_round: false,
        is_winner: false,
        deck_id: selectedDeckId,
      })
      await fetchRoom()
    } catch (err) {
      alert('参加失敗: ' + err.message)
    } finally {
      setJoining(false)
    }
  }

  const startBattle = async () => {
    if (!allReady) return
    setStarting(true)
    try {
      await supabase.from('games').update({ status: 'in_progress' }).eq('id', gameId)
      navigate(`/game/${gameId}/play`)
    } catch (err) {
      alert('開始失敗: ' + err.message)
      setStarting(false)
    }
  }

  const copyId = () => navigator.clipboard?.writeText(gameId)

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <div className="text-gray-400">読み込み中...</div>
        </div>
      </Layout>
    )
  }

  if (!game) {
    return (
      <Layout>
        <div className="text-center py-20 text-gray-400">対戦が見つかりません</div>
      </Layout>
    )
  }

  const startingLife = game.game_state?.starting_life ?? game.starting_life ?? 20

  return (
    <Layout>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/battle')} className="text-gray-400 hover:text-white text-sm">← 対戦ロビー</button>
        <h1 className="text-xl font-bold text-white">対戦ルーム</h1>
      </div>

      {/* ルームID */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 mb-5 flex items-center gap-3">
        <div className="flex-1">
          <p className="text-gray-400 text-xs mb-1">ルームID（相手に共有）</p>
          <p className="text-white font-mono text-sm break-all">{gameId}</p>
        </div>
        <button
          onClick={copyId}
          className="bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs px-3 py-2 rounded-lg shrink-0"
        >
          コピー
        </button>
      </div>

      {/* 設定 */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 mb-5 flex gap-6 text-sm">
        <div>
          <p className="text-gray-500 text-xs">初期ライフ</p>
          <p className="text-white font-bold">{startingLife} LP</p>
        </div>
      </div>

      {/* プレイヤー一覧 */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 mb-5">
        <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-4">参加プレイヤー</h2>
        <div className="space-y-3">
          {[0, 1].map(i => {
            const gp = participants[i]
            const isMe = gp?.player_id === player?.id
            return (
              <div
                key={i}
                className={`flex items-center gap-3 p-3 rounded-lg ${gp ? 'bg-gray-750 border border-gray-600' : 'border border-dashed border-gray-700'}`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${gp ? 'bg-purple-700 text-white' : 'bg-gray-700 text-gray-500'}`}>
                  {i + 1}
                </div>
                {gp ? (
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-white font-medium">{gp.players?.username}</p>
                      {isMe && <span className="text-xs bg-blue-800 text-blue-300 px-1.5 py-0.5 rounded">あなた</span>}
                      {i === 0 && <span className="text-xs bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded">ホスト</span>}
                    </div>
                    <p className="text-gray-400 text-xs mt-0.5">
                      {gp.decks?.name ?? <span className="text-yellow-500">デッキ未選択</span>}
                    </p>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">待機中...</p>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 参加フォーム（未参加の場合） */}
      {!myEntry && !isFull && (
        <div className="bg-gray-800 border border-purple-700 rounded-xl p-5 mb-5">
          <h2 className="text-sm font-semibold text-purple-400 mb-3">デッキを選んで参加</h2>
          <select
            value={selectedDeckId}
            onChange={e => setSelectedDeckId(e.target.value)}
            className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500 mb-3"
          >
            {decks.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
          <button
            onClick={joinBattle}
            disabled={joining || !selectedDeckId}
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            {joining ? '参加中...' : '参加する'}
          </button>
        </div>
      )}

      {!myEntry && isFull && (
        <div className="bg-gray-800 border border-red-800 rounded-xl p-4 mb-5 text-center text-red-400 text-sm">
          このルームは満員です
        </div>
      )}

      {/* 開始ボタン（ホストのみ） */}
      {isHost && (
        <button
          onClick={startBattle}
          disabled={!allReady || starting}
          className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:cursor-not-allowed text-white py-3 rounded-xl text-base font-bold transition-colors"
        >
          {starting ? '開始中...' : allReady ? '⚔ 対戦開始！' : '相手の参加を待っています...'}
        </button>
      )}

      {!isHost && myEntry && (
        <div className="text-center text-gray-400 py-4">
          {allReady ? 'ホストが対戦を開始するのを待っています...' : '相手の参加を待っています...'}
        </div>
      )}
    </Layout>
  )
}
