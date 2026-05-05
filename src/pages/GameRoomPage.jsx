import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { usePlayer } from '../contexts/PlayerContext'
import Layout from '../components/Layout'

export default function GameRoomPage() {
  const { id: gameId } = useParams()
  const navigate = useNavigate()
  const { player } = usePlayer()
  const channelRef = useRef(null)

  const [game, setGame] = useState(null)
  const [participants, setParticipants] = useState([])
  const [myDecks, setMyDecks] = useState([])
  const [selectedDeck, setSelectedDeck] = useState(null)
  const [joined, setJoined] = useState(false)
  const [joining, setJoining] = useState(false)
  const [starting, setStarting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const isHost = participants.length > 0 && participants[0]?.player_id === player?.id
  const status = game?.status

  const fetchRoom = async () => {
    const [{ data: gameData }, { data: gpData }, { data: deckData }] = await Promise.all([
      supabase.from('games').select('*').eq('id', gameId).single(),
      supabase
        .from('game_players')
        .select('*, players(username, balance)')
        .eq('game_id', gameId)
        .order('turn_order', { ascending: true }),
      supabase.from('decks').select('*, deck_cards(quantity)').eq('player_id', player.id),
    ])
    setGame(gameData)
    setParticipants(gpData || [])
    setMyDecks(deckData || [])
    const me = (gpData || []).find(gp => gp.player_id === player.id)
    setJoined(!!me)
    if (me?.deck_id) setSelectedDeck(me.deck_id)
    setLoading(false)

    if (gameData?.status === 'in_progress') {
      navigate(`/game/${gameId}/play`)
    }
  }

  useEffect(() => {
    if (!player) return
    fetchRoom()

    channelRef.current = supabase
      .channel(`game_room_${gameId}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'game_players',
        filter: `game_id=eq.${gameId}`,
      }, () => fetchRoom())
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'games',
        filter: `id=eq.${gameId}`,
      }, ({ new: newGame }) => {
        setGame(newGame)
        if (newGame.status === 'in_progress') {
          navigate(`/game/${gameId}/play`)
        }
      })
      .subscribe()

    return () => channelRef.current?.unsubscribe()
  }, [gameId, player])

  const join = async () => {
    setJoining(true)
    const nextOrder = participants.length + 1
    const { error } = await supabase.from('game_players').insert({
      game_id: gameId,
      player_id: player.id,
      victory_points: 0,
      bye_last_round: false,
      turn_order: nextOrder,
      is_winner: false,
    })
    if (error) alert(error.message)
    setJoining(false)
  }

  const updateDeck = async (deckId) => {
    setSelectedDeck(deckId)
    await supabase
      .from('game_players')
      .update({ deck_id: deckId })
      .eq('game_id', gameId)
      .eq('player_id', player.id)
  }

  const startGame = async () => {
    if (participants.length < 2) { alert('2人以上必要です'); return }
    const allDecksSet = participants.every(p => p.deck_id)
    if (!allDecksSet) { alert('全員がデッキを選択してください'); return }
    setStarting(true)
    const { error } = await supabase
      .from('games')
      .update({ status: 'in_progress', current_round: 1 })
      .eq('id', gameId)
    if (error) { alert(error.message); setStarting(false) }
  }

  const startNextRound = async () => {
    setStarting(true)
    const { error } = await supabase
      .from('games')
      .update({ status: 'in_progress', game_state: {} })
      .eq('id', gameId)
    if (error) { alert(error.message); setStarting(false) }
  }

  const copyId = () => {
    navigator.clipboard.writeText(gameId)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getDeckCount = (deck) =>
    (deck.deck_cards || []).reduce((s, dc) => s + dc.quantity, 0)

  const finalWinner = participants.find(p => p.player_id === game?.winner_id)

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-20">
          <div className="text-gray-400">読み込み中...</div>
        </div>
      </Layout>
    )
  }

  // ─── ゲーム終了画面 ───────────────────────────────────────
  if (status === 'finished') {
    return (
      <Layout>
        <div className="max-w-lg mx-auto text-center py-16">
          <div className="text-7xl mb-6">🏆</div>
          <h1 className="text-3xl font-bold text-white mb-2">ゲーム終了！</h1>
          <p className="text-yellow-400 text-xl font-semibold mb-8">
            {finalWinner?.players?.username || '不明'} の勝利
          </p>

          {/* 最終スコア */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden mb-8">
            <div className="px-4 py-3 border-b border-gray-700">
              <p className="text-gray-400 text-sm font-semibold">最終スコア</p>
            </div>
            {[...participants]
              .sort((a, b) => b.victory_points - a.victory_points)
              .map((gp, i) => (
                <div key={gp.player_id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-700 last:border-0">
                  <span className="text-2xl w-8 text-center shrink-0">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                  </span>
                  <div className="flex-1">
                    <p className="text-white font-medium">{gp.players?.username}</p>
                    <p className="text-gray-400 text-xs">{gp.players?.balance?.toLocaleString()}G</p>
                  </div>
                  <div className="text-right">
                    <p className="text-yellow-400 font-bold">{gp.victory_points} VP</p>
                  </div>
                </div>
              ))}
          </div>

          <button
            onClick={() => navigate('/game')}
            className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-xl font-medium transition-colors"
          >
            ロビーに戻る
          </button>
        </div>
      </Layout>
    )
  }

  // ─── ラウンド間画面 ───────────────────────────────────────
  if (status === 'between_rounds') {
    return (
      <Layout>
        <div className="max-w-lg mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-white mb-1">
              ラウンド {(game?.current_round ?? 1) - 1} 終了
            </h1>
            <p className="text-gray-400 text-sm">
              次のラウンド: {game?.current_round} / {game?.total_rounds}
            </p>
          </div>

          {/* スコアボード */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden mb-6">
            <div className="px-4 py-3 border-b border-gray-700">
              <p className="text-gray-400 text-sm font-semibold">現在のスコア</p>
            </div>
            {[...participants]
              .sort((a, b) => b.victory_points - a.victory_points)
              .map((gp, i) => (
                <div key={gp.player_id} className="flex items-center gap-3 px-4 py-3 border-b border-gray-700 last:border-0">
                  <span className="text-xl w-8 text-center shrink-0">
                    {i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}
                  </span>
                  <div className="flex-1">
                    <p className="text-white font-medium">
                      {gp.players?.username}
                      {gp.player_id === player?.id && <span className="text-purple-400 text-xs ml-2">（あなた）</span>}
                    </p>
                    <p className="text-gray-400 text-xs">{gp.players?.balance?.toLocaleString()}G</p>
                  </div>
                  <div className="text-right">
                    <p className="text-yellow-400 font-bold text-lg">{gp.victory_points} VP</p>
                    {game?.vp_threshold && (
                      <p className="text-gray-500 text-xs">/ {game.vp_threshold}</p>
                    )}
                  </div>
                </div>
              ))}
          </div>

          {isHost ? (
            <button
              onClick={startNextRound}
              disabled={starting}
              className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-600 text-white font-bold py-4 rounded-xl transition-colors text-lg"
            >
              {starting ? '準備中...' : `🎮 ラウンド ${game?.current_round} 開始`}
            </button>
          ) : (
            <div className="text-center text-gray-400 py-4">
              ホストがラウンドを開始するまでお待ちください...
            </div>
          )}
        </div>
      </Layout>
    )
  }

  // ─── 待合室（waiting / 初回） ─────────────────────────────
  return (
    <Layout>
      {/* ゲーム情報ヘッダー */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-5 mb-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div>
            <h1 className="text-xl font-bold text-white mb-1">ゲーム待合室</h1>
            <div className="flex items-center gap-2">
              <span className="text-gray-500 text-xs font-mono">{gameId}</span>
              <button
                onClick={copyId}
                className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
              >
                {copied ? '✓ コピー済' : 'IDをコピー'}
              </button>
            </div>
          </div>
          <span className="text-green-400 text-sm font-medium">● 待機中</span>
        </div>
        <div className="flex flex-wrap gap-4 text-sm text-gray-300">
          <span>📅 {game?.total_rounds}ラウンド</span>
          <span>🏆 VP閾値: {game?.vp_threshold}</span>
          <span>💰 現金閾値: {game?.cash_threshold?.toLocaleString()}G</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 参加者一覧 */}
        <div>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
            参加者 ({participants.length}人)
          </h2>
          <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
            {participants.length === 0 ? (
              <p className="text-gray-500 text-sm text-center py-6">まだ誰もいません</p>
            ) : (
              <div className="divide-y divide-gray-700">
                {participants.map((gp, i) => (
                  <div key={gp.player_id} className="flex items-center gap-3 px-4 py-3">
                    <div className="w-8 h-8 rounded-full bg-purple-700 flex items-center justify-center text-white text-sm font-bold shrink-0">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-white text-sm font-medium">{gp.players?.username}</p>
                        {i === 0 && <span className="text-xs bg-yellow-600/30 text-yellow-400 border border-yellow-700 px-1.5 py-0.5 rounded">ホスト</span>}
                        {gp.player_id === player?.id && <span className="text-xs text-purple-400">（あなた）</span>}
                      </div>
                      <p className="text-gray-500 text-xs">{gp.players?.balance?.toLocaleString()}G</p>
                    </div>
                    <div className="shrink-0 text-right">
                      {gp.deck_id ? (
                        <span className="text-green-400 text-xs">✓ デッキ選択済</span>
                      ) : (
                        <span className="text-red-400 text-xs">デッキ未選択</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {!joined && (
            <button
              onClick={join}
              disabled={joining}
              className="w-full mt-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white py-3 rounded-xl font-medium transition-colors"
            >
              {joining ? '参加中...' : 'このゲームに参加する'}
            </button>
          )}
        </div>

        {/* デッキ選択 */}
        {joined && (
          <div>
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
              デッキ選択
            </h2>
            <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden">
              {myDecks.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-gray-400 text-sm mb-2">デッキがありません</p>
                  <button
                    onClick={() => navigate('/decks')}
                    className="text-purple-400 hover:text-purple-300 text-sm"
                  >
                    デッキを作成する →
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-gray-700">
                  {myDecks.map(deck => {
                    const count = getDeckCount(deck)
                    const isValid = count >= 40 && count <= 60
                    const isSelected = selectedDeck === deck.id
                    return (
                      <button
                        key={deck.id}
                        onClick={() => isValid && updateDeck(deck.id)}
                        disabled={!isValid}
                        className={`w-full flex items-center gap-3 px-4 py-3 transition-colors text-left ${
                          isSelected
                            ? 'bg-purple-900/40 border-l-2 border-purple-500'
                            : isValid
                            ? 'hover:bg-gray-750'
                            : 'opacity-40 cursor-not-allowed'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                          isSelected ? 'border-purple-500 bg-purple-500' : 'border-gray-500'
                        }`}>
                          {isSelected && <div className="w-2 h-2 bg-white rounded-full" />}
                        </div>
                        <div className="flex-1">
                          <p className="text-white text-sm font-medium">{deck.name}</p>
                          <p className={`text-xs ${isValid ? 'text-green-400' : 'text-red-400'}`}>
                            {count}枚 {!isValid && '（40〜60枚必要）'}
                          </p>
                        </div>
                        {isSelected && <span className="text-purple-400 text-xs">選択中</span>}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {isHost && (
              <div className="mt-4">
                <button
                  onClick={startGame}
                  disabled={starting || !participants.every(p => p.deck_id) || participants.length < 2}
                  className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-colors text-lg"
                >
                  {starting ? '開始中...' : '🎮 ゲーム開始'}
                </button>
                {participants.length < 2 && (
                  <p className="text-gray-500 text-xs text-center mt-2">2人以上必要です</p>
                )}
                {participants.length >= 2 && !participants.every(p => p.deck_id) && (
                  <p className="text-gray-500 text-xs text-center mt-2">全員がデッキを選択してください</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  )
}
