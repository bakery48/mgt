import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { usePlayer } from '../contexts/PlayerContext'
import Layout from '../components/Layout'

const STATUS_LABEL = { waiting: '待機中', in_progress: '進行中', finished: '終了' }
const STATUS_COLOR = { waiting: 'text-green-400', in_progress: 'text-yellow-400', finished: 'text-gray-500' }

export default function GameLobbyPage() {
  const { player } = usePlayer()
  const navigate = useNavigate()
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [joinId, setJoinId] = useState('')
  const [creating, setCreating] = useState(false)
  const [settings, setSettings] = useState({
    total_rounds: 5,
    vp_threshold: 15,
    cash_threshold: 5000,
  })

  const fetchGames = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('games')
      .select('*, game_players(player_id)')
      .in('status', ['waiting', 'in_progress'])
      .order('created_at', { ascending: false })
    setGames(data || [])
    setLoading(false)
  }

  useEffect(() => { fetchGames() }, [])

  const createGame = async (e) => {
    e.preventDefault()
    setCreating(true)
    const { data, error } = await supabase
      .from('games')
      .insert({
        status: 'waiting',
        total_rounds: settings.total_rounds,
        current_round: 0,
        vp_threshold: settings.vp_threshold,
        cash_threshold: settings.cash_threshold,
        game_state: {},
      })
      .select()
      .single()
    if (error) { alert(error.message); setCreating(false); return }

    // ホストとして参加
    await supabase.from('game_players').insert({
      game_id: data.id,
      player_id: player.id,
      victory_points: 0,
      bye_last_round: false,
      turn_order: 1,
      is_winner: false,
    })
    navigate(`/game/${data.id}`)
  }

  const joinGame = async () => {
    const trimmed = joinId.trim()
    if (!trimmed) return
    const { data: game } = await supabase
      .from('games')
      .select('id, status')
      .eq('id', trimmed)
      .single()
    if (!game) { alert('ゲームが見つかりません'); return }
    if (game.status !== 'waiting') { alert('このゲームは参加できません'); return }
    navigate(`/game/${game.id}`)
  }

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-white">ゲームロビー</h1>
        <button
          onClick={() => setShowCreate(v => !v)}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
        >
          + ゲーム作成
        </button>
      </div>

      {/* ゲーム作成フォーム */}
      {showCreate && (
        <form onSubmit={createGame} className="bg-gray-800 border border-purple-700 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-purple-400 mb-4">新規ゲーム設定</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm text-gray-300 mb-1">ラウンド数</label>
              <input
                type="number" min="1" max="20"
                value={settings.total_rounds}
                onChange={e => setSettings(s => ({ ...s, total_rounds: +e.target.value }))}
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">勝利点閾値</label>
              <input
                type="number" min="1"
                value={settings.vp_threshold}
                onChange={e => setSettings(s => ({ ...s, vp_threshold: +e.target.value }))}
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1">現金閾値（G）</label>
              <input
                type="number" min="1"
                value={settings.cash_threshold}
                onChange={e => setSettings(s => ({ ...s, cash_threshold: +e.target.value }))}
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              type="submit" disabled={creating}
              className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white px-6 py-2 rounded-lg text-sm"
            >
              {creating ? '作成中...' : 'ゲーム作成'}
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-white px-4 py-2 text-sm">
              キャンセル
            </button>
          </div>
        </form>
      )}

      {/* IDで参加 */}
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-4 mb-6 flex gap-3 items-center">
        <span className="text-gray-400 text-sm shrink-0">IDで参加:</span>
        <input
          type="text"
          value={joinId}
          onChange={e => setJoinId(e.target.value)}
          placeholder="ゲームIDを貼り付け"
          className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
          onKeyDown={e => e.key === 'Enter' && joinGame()}
        />
        <button
          onClick={joinGame}
          disabled={!joinId.trim()}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg text-sm shrink-0"
        >
          参加
        </button>
      </div>

      {/* ゲーム一覧 */}
      {loading ? (
        <div className="text-center py-10 text-gray-400">読み込み中...</div>
      ) : games.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">🎮</div>
          <p className="text-gray-400">進行中のゲームはありません</p>
        </div>
      ) : (
        <div className="space-y-3">
          {games.map(game => (
            <div
              key={game.id}
              onClick={() => navigate(`/game/${game.id}`)}
              className="bg-gray-800 border border-gray-700 rounded-xl p-4 hover:border-purple-600 transition-colors cursor-pointer flex items-center justify-between gap-4"
            >
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-sm font-medium ${STATUS_COLOR[game.status]}`}>
                    ● {STATUS_LABEL[game.status]}
                  </span>
                  <span className="text-gray-500 text-xs font-mono">{game.id.slice(0, 8)}...</span>
                </div>
                <div className="flex gap-4 text-xs text-gray-400">
                  <span>{game.total_rounds}ラウンド</span>
                  <span>VP閾値: {game.vp_threshold}</span>
                  <span>現金閾値: {game.cash_threshold?.toLocaleString()}G</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-white font-bold text-lg">{game.game_players?.length ?? 0}</p>
                <p className="text-gray-500 text-xs">人参加</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  )
}
