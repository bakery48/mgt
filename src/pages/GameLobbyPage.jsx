import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { usePlayer } from '../contexts/PlayerContext'
import Layout from '../components/Layout'
import { CPU_USERNAME } from '../lib/cpuPlayer'
import { EVENT_CARDS } from '../data/eventCards'
import { ACTION_CARDS } from '../data/actionCards'
import { assignStarterDeck } from '../lib/assignStarterDeck'

const STATUS_LABEL = { waiting: '待機中', in_progress: '進行中', finished: '終了' }
const STATUS_COLOR = { waiting: 'text-green-400', in_progress: 'text-yellow-400', finished: 'text-gray-500' }

function SliderField({ label, value, min, max, step, format, onChange }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-sm text-gray-300">{label}</span>
        <span className="text-sm font-bold text-purple-300 font-mono">{format(value)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(+e.target.value)}
        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-500"
      />
      <div className="flex justify-between text-xs text-gray-600 mt-1">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  )
}

export default function GameLobbyPage() {
  const { player } = usePlayer()
  const navigate = useNavigate()
  const [games, setGames] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [showCpuSettings, setShowCpuSettings] = useState(false)
  const [joinId, setJoinId] = useState('')
  const [creating, setCreating] = useState(false)
  const [startingCpu, setStartingCpu] = useState(false)
  const [settings, setSettings] = useState({
    total_rounds: 5,
    vp_threshold: 15,
    cash_threshold: 5000,
    starting_balance: 1000,
    starting_life: 20,
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

  const createGame = async () => {
    setCreating(true)
    const { data, error } = await supabase
      .from('games')
      .insert({
        status: 'waiting',
        total_rounds: settings.total_rounds,
        current_round: 0,
        vp_threshold: settings.vp_threshold,
        cash_threshold: settings.cash_threshold,
        starting_balance: settings.starting_balance,
        starting_life: settings.starting_life,
        game_state: {},
      })
      .select()
      .single()
    if (error) { alert(error.message); setCreating(false); return }

    await supabase.from('game_players').insert({
      game_id: data.id,
      player_id: player.id,
      victory_points: 0,
      balance: settings.starting_balance,
      bye_last_round: false,
      turn_order: 1,
      is_winner: false,
    })
    navigate(`/game/${data.id}`)
  }

  const startCpuGame = async () => {
    if (!player) return
    setStartingCpu(true)
    try {
      // CPUプレイヤーの取得または作成
      let { data: cpuPlayer } = await supabase
        .from('players')
        .select('id')
        .eq('username', CPU_USERNAME)
        .maybeSingle()
      if (!cpuPlayer) {
        const { data: newCpu, error } = await supabase
          .from('players')
          .insert({ username: CPU_USERNAME, balance: 0 })
          .select('id')
          .single()
        if (error) { alert('CPUプレイヤー作成失敗: ' + error.message); return }
        cpuPlayer = newCpu
      }

      // スターターデッキをそれぞれ割り当て
      const [humanDeckId, cpuDeckId] = await Promise.all([
        assignStarterDeck(player.id),
        assignStarterDeck(cpuPlayer.id),
      ])

      // フェーズ1の初期状態をゲーム作成時点で埋め込む
      const eventCard = EVENT_CARDS[Math.floor(Math.random() * EVENT_CARDS.length)]
      const initialGameState = {
        round_phase: 'event',
        event_card: eventCard,
        dice_result: null,
        event_confirmed: {},
        action_cards: {
          [player.id]: ACTION_CARDS[Math.floor(Math.random() * ACTION_CARDS.length)],
          [cpuPlayer.id]: ACTION_CARDS[Math.floor(Math.random() * ACTION_CARDS.length)],
        },
        action_played: {},
        modifiers: { [player.id]: {}, [cpuPlayer.id]: {} },
        life_event_modifier: 0,
      }

      const { data: game, error: gameErr } = await supabase
        .from('games')
        .insert({
          status: 'between_rounds',
          total_rounds: settings.total_rounds,
          current_round: 1,
          vp_threshold: settings.vp_threshold,
          cash_threshold: settings.cash_threshold,
          starting_balance: settings.starting_balance,
          starting_life: settings.starting_life,
          game_state: initialGameState,
        })
        .select('id')
        .single()
      if (gameErr) { alert('ゲーム作成失敗: ' + gameErr.message); return }

      await supabase.from('game_players').insert([
        { game_id: game.id, player_id: player.id, turn_order: 1, victory_points: 0, balance: settings.starting_balance, bye_last_round: false, is_winner: false, deck_id: humanDeckId },
        { game_id: game.id, player_id: cpuPlayer.id, turn_order: 2, victory_points: 0, balance: settings.starting_balance, bye_last_round: false, is_winner: false, deck_id: cpuDeckId },
      ])

      navigate(`/game/${game.id}`)
    } catch (err) {
      alert('エラー: ' + err.message)
    } finally {
      setStartingCpu(false)
    }
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
        <div className="flex gap-2">
          <button
            onClick={() => { setShowCpuSettings(v => !v); setShowCreate(false) }}
            className="bg-green-700 hover:bg-green-600 text-white px-4 py-2 rounded-lg text-sm transition-colors"
          >
            🤖 CPUとゲーム開始
          </button>
          <button
            onClick={() => { setShowCreate(v => !v); setShowCpuSettings(false) }}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm transition-colors"
          >
            + ゲーム作成
          </button>
        </div>
      </div>

      {/* 共通設定パネル */}
      {(showCreate || showCpuSettings) && (
        <div className="bg-gray-800 border border-purple-700 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold text-purple-400 mb-5">
            {showCpuSettings ? '🤖 CPU対戦設定' : '新規ゲーム設定'}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5 mb-6">
            <SliderField label="ラウンド数" value={settings.total_rounds} min={1} max={20} step={1}
              format={v => `${v}ラウンド`}
              onChange={v => setSettings(s => ({ ...s, total_rounds: v }))} />
            <SliderField label="目標勝利点" value={settings.vp_threshold} min={5} max={30} step={1}
              format={v => `${v} VP`}
              onChange={v => setSettings(s => ({ ...s, vp_threshold: v }))} />
            <SliderField label="現金勝利閾値" value={settings.cash_threshold} min={1000} max={20000} step={500}
              format={v => `${v.toLocaleString()} G`}
              onChange={v => setSettings(s => ({ ...s, cash_threshold: v }))} />
            <SliderField label="初期配布G" value={settings.starting_balance} min={0} max={5000} step={100}
              format={v => `${v.toLocaleString()} G`}
              onChange={v => setSettings(s => ({ ...s, starting_balance: v }))} />
            <SliderField label="バトル初期LP" value={settings.starting_life} min={10} max={40} step={1}
              format={v => `${v} LP`}
              onChange={v => setSettings(s => ({ ...s, starting_life: v }))} />
          </div>
          <div className="flex gap-3">
            {showCpuSettings ? (
              <button
                onClick={startCpuGame}
                disabled={startingCpu}
                className="bg-green-600 hover:bg-green-500 disabled:bg-gray-600 text-white px-6 py-2 rounded-lg text-sm font-medium"
              >
                {startingCpu ? '準備中...' : '🤖 この設定で開始'}
              </button>
            ) : (
              <button
                onClick={createGame}
                disabled={creating}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white px-6 py-2 rounded-lg text-sm font-medium"
              >
                {creating ? '作成中...' : 'ゲーム作成'}
              </button>
            )}
            <button
              onClick={() => { setShowCreate(false); setShowCpuSettings(false) }}
              className="text-gray-400 hover:text-white px-4 py-2 text-sm"
            >
              キャンセル
            </button>
          </div>
        </div>
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
                <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                  <span>{game.total_rounds}ラウンド</span>
                  <span>目標VP: {game.vp_threshold}</span>
                  <span>現金勝利: {game.cash_threshold?.toLocaleString()}G</span>
                  <span>初期G: {(game.starting_balance ?? 1000).toLocaleString()}G</span>
                  <span>初期LP: {game.starting_life ?? 20}</span>
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
