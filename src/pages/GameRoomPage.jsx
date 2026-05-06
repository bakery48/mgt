import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { usePlayer } from '../contexts/PlayerContext'
import Layout from '../components/Layout'
import { initGameState } from '../lib/gameEngine'
import { CPU_USERNAME } from '../lib/cpuPlayer'
import { EVENT_CARDS } from '../data/eventCards'
import { ACTION_CARDS } from '../data/actionCards'

export default function GameRoomPage() {
  const { id: gameId } = useParams()
  const navigate = useNavigate()
  const { player } = usePlayer()
  const channelRef = useRef(null)
  const autoStartedRef = useRef(false)

  const [game, setGame] = useState(null)
  const [participants, setParticipants] = useState([])
  const [myDecks, setMyDecks] = useState([])
  const [selectedDeck, setSelectedDeck] = useState(null)
  const [joined, setJoined] = useState(false)
  const [joining, setJoining] = useState(false)
  const [starting, setStarting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [phaseToast, setPhaseToast] = useState(null)

  const isHost = participants.length > 0 && participants[0]?.player_id === player?.id
  const status = game?.status
  const cpuParticipant = participants.find(p => p.players?.username === CPU_USERNAME)
  const cpuId = cpuParticipant?.player_id ?? null
  const isCpuGame = !!cpuId

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

  // ─── フェーズ開始トースト ─────────────────────────────────
  const PHASE_TOAST = {
    event:  'フェーズ1: イベント',
    action: 'フェーズ2: アクション',
    ready:  '準備完了！',
  }
  useEffect(() => {
    const phase = game?.game_state?.round_phase
    if (!phase) return
    const msg = PHASE_TOAST[phase]
    if (!msg) return
    setPhaseToast(msg)
    const t = setTimeout(() => setPhaseToast(null), 500)
    return () => clearTimeout(t)
  }, [game?.game_state?.round_phase])

  // ─── CPU自動プレイ（ラウンド間フェーズ） ────────────────────
  const applyCpuActionEffect = async (card, cpuGp) => {
    const ep = card.effect_params || {}
    const t = card.effect_type
    const humanGp = participants.find(p => p.player_id !== cpuId)
    if (t === 'vp_self') {
      await supabase.from('game_players')
        .update({ victory_points: (cpuGp?.victory_points || 0) + ep.amount })
        .eq('game_id', gameId).eq('player_id', cpuId)
    } else if (t === 'gold_self') {
      await supabase.from('players')
        .update({ balance: Math.max(0, (cpuGp?.players?.balance || 0) + ep.amount) })
        .eq('id', cpuId)
    } else if ((t === 'vp_target' || t === 'vp_random') && humanGp) {
      await supabase.from('game_players')
        .update({ victory_points: Math.max(0, (humanGp.victory_points || 0) + ep.amount) })
        .eq('game_id', gameId).eq('player_id', humanGp.player_id)
    } else if (t === 'gold_steal' && humanGp) {
      const steal = Math.min(ep.amount, humanGp.players?.balance || 0)
      await Promise.all([
        supabase.from('players').update({ balance: Math.max(0, (humanGp.players?.balance || 0) - steal) }).eq('id', humanGp.player_id),
        supabase.from('players').update({ balance: (cpuGp?.players?.balance || 0) + steal }).eq('id', cpuId),
      ])
    } else if (t === 'mana_bonus') return { mana_bonus: ep.amount }
    else if (t === 'life_bonus') return { life_bonus: ep.amount }
    else if (t === 'go_first') return { go_first: true }
    else if (t === 'draw_bonus') return { draw_bonus: ep.amount }
    return {}
  }

  useEffect(() => {
    if (!isCpuGame || !cpuId || status !== 'between_rounds' || !game?.game_state || starting) return
    const meta = game.game_state
    const roundPhase = meta.round_phase

    // イベントフェーズ自動開始（CPU対戦のみ・二重実行防止）
    if (!roundPhase && isHost) {
      if (autoStartedRef.current) return
      autoStartedRef.current = true
      const t = setTimeout(() => startEventPhase(), 800)
      return () => clearTimeout(t)
    }
    autoStartedRef.current = false  // フェーズが始まったらリセット

    // CPU自動イベント確認
    if (roundPhase === 'event' && !meta.event_confirmed?.[cpuId]) {
      const isDiceEvent = meta.event_card?.effect_type === 'dice_random'
      if (isDiceEvent && meta.dice_result == null) return
      const t = setTimeout(async () => {
        const confirmed = { ...(meta.event_confirmed || {}), [cpuId]: true }
        const allConfirmed = participants.every(gp => confirmed[gp.player_id])
        await supabase.from('games').update({
          game_state: { ...meta, event_confirmed: confirmed, ...(allConfirmed ? { round_phase: 'action' } : {}) }
        }).eq('id', gameId)
      }, 700)
      return () => clearTimeout(t)
    }

    // バトル自動開始（全員ready後、CPU対戦のみ）
    if (roundPhase === 'ready' && isHost) {
      const t = setTimeout(() => startBattle(), 1200)
      return () => clearTimeout(t)
    }

    // CPUアクションカード自動プレイ
    if (roundPhase === 'action' && meta.action_played?.[cpuId] == null) {
      const t = setTimeout(async () => {
        const cpuGp = participants.find(p => p.player_id === cpuId)
        const cpuCard = meta.action_cards?.[cpuId]
        const battleMods = cpuCard ? (await applyCpuActionEffect(cpuCard, cpuGp)) : {}
        const modifiers = { ...(meta.modifiers || {}), [cpuId]: { ...(meta.modifiers?.[cpuId] || {}), ...battleMods } }
        const actionPlayed = { ...(meta.action_played || {}), [cpuId]: true }
        const allDone = participants.every(gp => actionPlayed[gp.player_id] != null)
        await supabase.from('games').update({
          game_state: { ...meta, modifiers, action_played: actionPlayed, ...(allDone ? { round_phase: 'ready' } : {}) }
        }).eq('id', gameId)
      }, 700)
      return () => clearTimeout(t)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game?.game_state?.round_phase, game?.game_state?.dice_result, status, cpuId, isCpuGame, isHost, starting])

  // ─── イベント効果適用（ホストのみ実行） ──────────────────────
  const applyEventEffect = async (eventCard, diceResult, parts) => {
    const ep = eventCard.effect_params || {}
    const t = eventCard.effect_type
    const ps = parts || participants

    if (t === 'vp_all') {
      await Promise.all(ps.map(gp =>
        supabase.from('game_players')
          .update({ victory_points: Math.max(0, (gp.victory_points || 0) + ep.amount) })
          .eq('game_id', gameId).eq('player_id', gp.player_id)
      ))
    } else if (t === 'gold_all') {
      await Promise.all(ps.map(gp =>
        supabase.from('players')
          .update({ balance: Math.max(0, (gp.players?.balance || 0) + ep.amount) })
          .eq('id', gp.player_id)
      ))
    } else if (t === 'life_modifier') {
      return { life_event_modifier: ep.amount }
    } else if (t === 'vp_last_bonus') {
      const last = [...ps].sort((a, b) => (a.victory_points || 0) - (b.victory_points || 0))[0]
      if (last) await supabase.from('game_players')
        .update({ victory_points: (last.victory_points || 0) + ep.amount })
        .eq('game_id', gameId).eq('player_id', last.player_id)
    } else if (t === 'gold_last_bonus') {
      const last = [...ps].sort((a, b) => (a.players?.balance || 0) - (b.players?.balance || 0))[0]
      if (last) await supabase.from('players')
        .update({ balance: (last.players?.balance || 0) + ep.amount })
        .eq('id', last.player_id)
    } else if (t === 'price_cheap_surge') {
      const { data: cards } = await supabase.from('cards').select('id, price').lte('price', ep.threshold)
      if (cards?.length) await Promise.all(cards.map(c =>
        supabase.from('cards').update({ price: Math.round(c.price * ep.multiplier) }).eq('id', c.id)
      ))
    } else if (t === 'price_expensive_crash' || t === 'price_expensive_surge') {
      const { data: cards } = await supabase.from('cards').select('id, price').gte('price', ep.threshold)
      if (cards?.length) await Promise.all(cards.map(c =>
        supabase.from('cards').update({ price: Math.round(c.price * ep.multiplier) }).eq('id', c.id)
      ))
    } else if (t === 'pack_all') {
      const { data: allCards } = await supabase.from('cards').select('id')
      if (allCards?.length) {
        for (const gp of ps) {
          for (let i = 0; i < 3; i++) {
            const cardId = allCards[Math.floor(Math.random() * allCards.length)].id
            const { data: ex } = await supabase.from('player_collection')
              .select('quantity').eq('player_id', gp.player_id).eq('card_id', cardId).maybeSingle()
            if (ex) {
              await supabase.from('player_collection')
                .update({ quantity: ex.quantity + 1 }).eq('player_id', gp.player_id).eq('card_id', cardId)
            } else {
              await supabase.from('player_collection')
                .insert({ player_id: gp.player_id, card_id: cardId, quantity: 1 })
            }
          }
        }
      }
    } else if (t === 'dice_random' && diceResult != null) {
      const result = (ep.results || []).find(r => diceResult >= r.min && diceResult <= r.max)
      if (result?.sub_type === 'vp_all') {
        await Promise.all(ps.map(gp =>
          supabase.from('game_players')
            .update({ victory_points: Math.max(0, (gp.victory_points || 0) + result.amount) })
            .eq('game_id', gameId).eq('player_id', gp.player_id)
        ))
      }
    }
    return {}
  }

  // ─── アクション効果適用（各プレイヤー自身が実行） ─────────────
  const applyActionCardEffect = async (card) => {
    const ep = card.effect_params || {}
    const t = card.effect_type
    const myGp = participants.find(p => p.player_id === player?.id)
    const oppGp = participants.find(p => p.player_id !== player?.id)

    if (t === 'vp_self') {
      await supabase.from('game_players')
        .update({ victory_points: (myGp?.victory_points || 0) + ep.amount })
        .eq('game_id', gameId).eq('player_id', player.id)
    } else if (t === 'gold_self') {
      await supabase.from('players')
        .update({ balance: (myGp?.players?.balance || 0) + ep.amount })
        .eq('id', player.id)
    } else if (t === 'vp_target' || t === 'vp_random') {
      if (oppGp) await supabase.from('game_players')
        .update({ victory_points: Math.max(0, (oppGp.victory_points || 0) + ep.amount) })
        .eq('game_id', gameId).eq('player_id', oppGp.player_id)
    } else if (t === 'gold_steal') {
      if (oppGp) {
        const steal = Math.min(ep.amount, oppGp.players?.balance || 0)
        await Promise.all([
          supabase.from('players').update({ balance: Math.max(0, (oppGp.players?.balance || 0) - steal) }).eq('id', oppGp.player_id),
          supabase.from('players').update({ balance: (myGp?.players?.balance || 0) + steal }).eq('id', player.id),
        ])
      }
    } else if (t === 'pack_self') {
      const { data: allCards } = await supabase.from('cards').select('id')
      if (allCards?.length) {
        for (let i = 0; i < 3; i++) {
          const cardId = allCards[Math.floor(Math.random() * allCards.length)].id
          const { data: ex } = await supabase.from('player_collection')
            .select('quantity').eq('player_id', player.id).eq('card_id', cardId).maybeSingle()
          if (ex) {
            await supabase.from('player_collection')
              .update({ quantity: ex.quantity + 1 }).eq('player_id', player.id).eq('card_id', cardId)
          } else {
            await supabase.from('player_collection')
              .insert({ player_id: player.id, card_id: cardId, quantity: 1 })
          }
        }
      }
    } else if (t === 'mana_bonus') {
      return { mana_bonus: ep.amount }
    } else if (t === 'life_bonus') {
      return { life_bonus: ep.amount }
    } else if (t === 'go_first') {
      return { go_first: true }
    } else if (t === 'draw_bonus') {
      return { draw_bonus: ep.amount }
    }
    return {}
  }

  // ─── フェーズ開始（ホスト） ────────────────────────────────────
  const startEventPhase = async () => {
    setStarting(true)
    // fresh fetch to avoid stale closure on participants
    const { data: freshParts } = await supabase
      .from('game_players').select('player_id').eq('game_id', gameId)
    const parts = freshParts?.length ? freshParts : participants
    const eventCard = EVENT_CARDS[Math.floor(Math.random() * EVENT_CARDS.length)]
    const actionCards = {}
    const modifiers = {}
    for (const gp of parts) {
      actionCards[gp.player_id] = ACTION_CARDS[Math.floor(Math.random() * ACTION_CARDS.length)]
      modifiers[gp.player_id] = {}
    }
    await supabase.from('games').update({
      game_state: {
        round_phase: 'event',
        event_card: eventCard,
        dice_result: null,
        event_confirmed: {},
        action_cards: actionCards,
        action_played: {},
        modifiers,
        life_event_modifier: 0,
      }
    }).eq('id', gameId)
    setStarting(false)
  }

  const rollDice = async () => {
    const meta = game.game_state || {}
    const result = Math.floor(Math.random() * 6) + 1
    await supabase.from('games').update({ game_state: { ...meta, dice_result: result } }).eq('id', gameId)
  }

  const confirmEvent = async () => {
    const meta = game.game_state || {}
    let extra = {}
    if (isHost) {
      // 最新のparticipantsデータを取得してから効果適用
      const { data: freshParts } = await supabase
        .from('game_players').select('*, players(username, balance)')
        .eq('game_id', gameId).order('turn_order')
      extra = await applyEventEffect(meta.event_card, meta.dice_result, freshParts || participants)
    }
    const confirmed = { ...(meta.event_confirmed || {}), [player.id]: true }
    const allConfirmed = participants.every(gp => confirmed[gp.player_id])
    await supabase.from('games').update({
      game_state: { ...meta, ...extra, event_confirmed: confirmed, ...(allConfirmed ? { round_phase: 'action' } : {}) }
    }).eq('id', gameId)
  }

  const playActionCard = async (play) => {
    const meta = game.game_state || {}
    const myCard = meta.action_cards?.[player?.id]
    let battleMods = {}
    if (play && myCard) battleMods = await applyActionCardEffect(myCard)
    const modifiers = { ...(meta.modifiers || {}), [player.id]: { ...(meta.modifiers?.[player.id] || {}), ...battleMods } }
    const actionPlayed = { ...(meta.action_played || {}), [player.id]: play }
    const allDone = participants.every(gp => actionPlayed[gp.player_id] != null)
    await supabase.from('games').update({
      game_state: { ...meta, modifiers, action_played: actionPlayed, ...(allDone ? { round_phase: 'ready' } : {}) }
    }).eq('id', gameId)
  }

  // ─── バトル開始（ホスト）: modifiers適用済みゲーム状態を作成 ──
  const startBattle = async () => {
    setStarting(true)
    const meta = game.game_state || {}
    const deckMap = {}
    for (const gp of participants) {
      const { data: dcData } = await supabase
        .from('deck_cards').select('card_id, quantity').eq('deck_id', gp.deck_id)
      const expanded = []
      for (const dc of (dcData || [])) {
        for (let i = 0; i < dc.quantity; i++) expanded.push(dc.card_id)
      }
      deckMap[gp.player_id] = expanded
    }
    const playerOrder = participants.map(gp => gp.player_id)
    const gs = initGameState(playerOrder, deckMap)

    // バトル修飾子の適用
    const lifeEvMod = meta.life_event_modifier || 0
    for (const [pid, mods] of Object.entries(meta.modifiers || {})) {
      const ps = gs.players[pid]
      if (!ps) continue
      ps.life = (ps.life || 20) + (mods.life_bonus || 0) + lifeEvMod
      if (mods.mana_bonus) ps.mana_pool.colorless = (ps.mana_pool.colorless || 0) + mods.mana_bonus
      for (let i = 0; i < (mods.draw_bonus || 0); i++) {
        const card = ps.library.shift()
        if (card) ps.hand.push(card)
      }
    }
    // 先攻: 1人のみgo_firstの場合
    const goFirstPids = Object.entries(meta.modifiers || {}).filter(([, m]) => m.go_first).map(([pid]) => pid)
    if (goFirstPids.length === 1) {
      gs.active_player = goFirstPids[0]
      gs.priority = goFirstPids[0]
    }

    const { error } = await supabase.from('games').update({ status: 'in_progress', game_state: gs }).eq('id', gameId)
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

  const toastOverlay = phaseToast && (
    <div className="fixed inset-0 flex items-center justify-center z-50 pointer-events-none">
      <div className="bg-gray-900 border border-purple-500 text-white text-2xl font-bold px-10 py-5 rounded-2xl shadow-2xl">
        {phaseToast}
      </div>
    </div>
  )

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
        {toastOverlay}
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
    const meta = game?.game_state || {}
    const roundPhase = meta.round_phase       // undefined | 'event' | 'action' | 'ready'
    const eventCard = meta.event_card
    const myActionCard = meta.action_cards?.[player?.id]
    const myEventConfirmed = !!meta.event_confirmed?.[player?.id]
    const myActionDecided = meta.action_played?.[player?.id] != null
    const confirmedCount = Object.values(meta.event_confirmed || {}).filter(Boolean).length
    const actionDecidedCount = Object.keys(meta.action_played || {}).length
    const isDiceEvent = eventCard?.effect_type === 'dice_random'
    const canConfirmEvent = !myEventConfirmed && (!isDiceEvent || meta.dice_result != null)

    return (
      <Layout>
        {toastOverlay}
        <div className="max-w-lg mx-auto">
          {/* ヘッダー */}
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-white mb-1">
              ラウンド {(game?.current_round ?? 1) - 1} 終了
            </h1>
            <p className="text-gray-400 text-sm">
              次のラウンド: {game?.current_round} / {game?.total_rounds}
            </p>
          </div>

          {/* スコアボード */}
          <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden mb-5">
            <div className="px-4 py-2 border-b border-gray-700">
              <p className="text-gray-400 text-xs font-semibold uppercase tracking-wide">現在のスコア</p>
            </div>
            {[...participants].sort((a, b) => b.victory_points - a.victory_points).map((gp, i) => (
              <div key={gp.player_id} className="flex items-center gap-3 px-4 py-2.5 border-b border-gray-700 last:border-0">
                <span className="text-lg w-7 text-center shrink-0">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-white text-sm font-medium">{gp.players?.username}</span>
                  {gp.player_id === player?.id && <span className="text-purple-400 text-xs ml-2">（あなた）</span>}
                  <span className="text-gray-500 text-xs ml-2">{gp.players?.balance?.toLocaleString()}G</span>
                </div>
                <span className="text-yellow-400 font-bold">{gp.victory_points} VP</span>
              </div>
            ))}
          </div>

          {/* ── フェーズ未開始 ── */}
          {!roundPhase && (
            isHost ? (
              <button onClick={startEventPhase} disabled={starting}
                className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-600 text-white font-bold py-4 rounded-xl transition-colors text-lg">
                {starting ? '準備中...' : '🌟 フェーズ1: イベント開始'}
              </button>
            ) : (
              <p className="text-center text-gray-400 py-4">ホストがフェーズを開始するまでお待ちください...</p>
            )
          )}

          {/* ── フェーズ1: イベント ── */}
          {roundPhase === 'event' && eventCard && (
            <div className="bg-gray-800 border border-indigo-600 rounded-xl p-5 mb-4">
              <p className="text-indigo-400 text-xs font-semibold uppercase tracking-wide mb-3">
                フェーズ1 — イベントカード（全員共通）
              </p>
              <h3 className="text-white text-xl font-bold mb-2">{eventCard.name}</h3>
              <p className="text-gray-300 text-sm leading-relaxed mb-4">{eventCard.description}</p>

              {/* サイコロ判定 */}
              {isDiceEvent && (
                <div className="bg-gray-900 rounded-lg p-4 mb-4 text-center">
                  {meta.dice_result != null ? (
                    <div>
                      <p className="text-5xl font-bold text-white mb-1">🎲 {meta.dice_result}</p>
                      <p className="text-gray-400 text-sm">
                        {meta.dice_result <= 3 ? '1〜3: 全員VP-1' : '4〜6: 全員VP+2'}
                      </p>
                    </div>
                  ) : isHost ? (
                    <button onClick={rollDice}
                      className="bg-yellow-600 hover:bg-yellow-500 text-white px-8 py-2.5 rounded-lg font-bold transition-colors">
                      🎲 サイコロを振る
                    </button>
                  ) : (
                    <p className="text-gray-400 text-sm">ホストがサイコロを振ります...</p>
                  )}
                </div>
              )}

              {canConfirmEvent ? (
                <button onClick={confirmEvent}
                  className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-3 rounded-lg transition-colors">
                  {isHost ? '✓ 効果を適用して確認' : '✓ 確認'}
                </button>
              ) : myEventConfirmed ? (
                <p className="text-green-400 text-center py-2 font-medium">✓ 確認済み</p>
              ) : null}
              <p className="text-gray-500 text-xs text-center mt-2">{confirmedCount} / {participants.length} 人確認済み</p>
            </div>
          )}

          {/* ── フェーズ2: アクション ── */}
          {roundPhase === 'action' && (
            <div className="bg-gray-800 border border-purple-600 rounded-xl p-5 mb-4">
              <p className="text-purple-400 text-xs font-semibold uppercase tracking-wide mb-3">
                フェーズ2 — アクションカード（自分のみ）
              </p>
              {!myActionDecided ? (
                myActionCard ? (
                  <>
                    <h3 className="text-white text-xl font-bold mb-2">{myActionCard.name}</h3>
                    <p className="text-gray-300 text-sm leading-relaxed mb-5">{myActionCard.description}</p>
                    <div className="flex gap-3">
                      <button onClick={() => playActionCard(true)}
                        className="flex-1 bg-purple-600 hover:bg-purple-500 text-white font-bold py-3 rounded-lg transition-colors">
                        ▶ プレイする
                      </button>
                      <button onClick={() => playActionCard(false)}
                        className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-bold py-3 rounded-lg transition-colors">
                        スキップ
                      </button>
                    </div>
                  </>
                ) : <p className="text-gray-400 text-center py-2">読み込み中...</p>
              ) : (
                <p className="text-purple-400 text-center py-3 font-medium">✓ アクション決定済み</p>
              )}
              <p className="text-gray-500 text-xs text-center mt-3">{actionDecidedCount} / {participants.length} 人決定済み</p>
            </div>
          )}

          {/* ── 準備完了 ── */}
          {roundPhase === 'ready' && (
            <div className="bg-gray-800 border border-green-600 rounded-xl p-5 mb-4">
              <p className="text-green-400 text-center font-bold text-lg mb-4">全員準備完了！</p>
              {/* バトル修飾子サマリー */}
              {(() => {
                const lines = []
                if ((meta.life_event_modifier || 0) !== 0) {
                  lines.push(<p key="ev" className="text-red-400 text-sm">イベント: 全員開始ライフ{meta.life_event_modifier > 0 ? '+' : ''}{meta.life_event_modifier}</p>)
                }
                for (const gp of participants) {
                  const mods = meta.modifiers?.[gp.player_id] || {}
                  const tags = []
                  if (mods.life_bonus) tags.push(`ライフ+${mods.life_bonus}`)
                  if (mods.mana_bonus) tags.push(`マナ+${mods.mana_bonus}`)
                  if (mods.draw_bonus) tags.push(`ドロー+${mods.draw_bonus}`)
                  if (mods.go_first) tags.push('先攻')
                  if (tags.length) lines.push(
                    <p key={gp.player_id} className="text-sm">
                      <span className="text-gray-400">{gp.players?.username}: </span>
                      <span className="text-cyan-400">{tags.join(' / ')}</span>
                    </p>
                  )
                }
                return lines.length > 0 ? <div className="space-y-1 mb-4 bg-gray-900 rounded-lg p-3">{lines}</div> : null
              })()}
              {isHost ? (
                <button onClick={startBattle} disabled={starting}
                  className="w-full bg-green-600 hover:bg-green-500 disabled:bg-gray-600 text-white font-bold py-4 rounded-xl transition-colors text-lg">
                  {starting ? '準備中...' : `🎮 ラウンド ${game?.current_round} バトル開始`}
                </button>
              ) : (
                <p className="text-center text-gray-400">ホストがバトルを開始します...</p>
              )}
            </div>
          )}
        </div>
      </Layout>
    )
  }

  // ─── 待合室（waiting / 初回） ─────────────────────────────
  return (
    <Layout>
      {toastOverlay}
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
