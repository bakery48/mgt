import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { usePlayer } from '../contexts/PlayerContext'
import {
  PHASES, PHASE_LABELS,
  initGameState, tapForMana, playLand, castSpell, castSpellTargeted, cycleCard, passPriority,
  advancePhase, declareAttackers, declareBlockers,
  resolveFirstStrikeDamage, resolveCombatDamage,
  canPlaySorcerySpeed, canPlayInstantSpeed, hasMana, getOpponent, getValidBlockers,
  castFlashback, unearthCreature, equipArtifact, getEffectivePT, getEffectiveKeywords,
  discardCard, finishCleanup, spellNeedsTarget, getSpellTargetingType,
  activateAbility, activateAbilityTargeted,
} from '../lib/gameEngine'
import {
  processETB, processUpkeep, processAttack, processDamage,
} from '../lib/keywordEffects'
import CardDetailModal from '../components/CardDetailModal'
import { CPU_USERNAME, cpuTakeTurn, cpuDeclareBlockers } from '../lib/cpuPlayer'

// ─── カードコンポーネント ───────────────────────────────────────
const TYPE_LABELS_JP = {
  creature: 'クリーチャー', instant: 'インスタント', sorcery: 'ソーサリー',
  enchantment: 'エンチャント', artifact: 'アーティファクト', land: '土地',
}
const KEYWORD_LABELS = {
  flying: '飛行', trample: 'トランプル', haste: '速攻', first_strike: '先制攻撃',
  double_strike: '二段攻撃', deathtouch: '接死', lifelink: '絆魂', vigilance: '警戒',
  reach: '到達', defender: '防衛', menace: '威迫', indestructible: '破壊不能',
  flash: '瞬速', hexproof: '呪禁', shroud: '被覆', cycling: 'サイクリング',
  flashback: 'フラッシュバック', kicker: 'キッカー', unearth: 'アンアース',
  equip: '装備', delve: '探査',
}
// バッジ非表示の内部用キーワードタイプ
const INTERNAL_KEYWORD_TYPES = new Set([
  'subtype_dragon', 'subtype_angel', 'on_cast_trigger', 'conditional_keyword',
  'protection', 'spell_effect', 'lord_effect', // 効果系は effect_text で説明
])

const COLOR_BG = {
  white: 'bg-yellow-50 text-gray-900', blue: 'bg-blue-700 text-white',
  black: 'bg-gray-900 text-white border-gray-600', red: 'bg-red-700 text-white',
  green: 'bg-green-800 text-white', colorless: 'bg-gray-600 text-white',
  multicolor: 'bg-gradient-to-br from-yellow-600 to-purple-700 text-white',
}

function HoverCardTooltip({ card, perm }) {
  if (!card) return null
  const kws = card.keywords || []
  return (
    <div className="fixed bottom-4 left-4 z-30 bg-gray-900 border border-gray-600 rounded-xl p-3 w-56 shadow-2xl pointer-events-none">
      <div className={`rounded-lg p-2 mb-2 ${COLOR_BG[card.color] || 'bg-gray-700 text-white'}`}>
        <div className="flex items-center justify-between gap-1">
          <p className="text-sm font-bold leading-tight">{card.name}</p>
          {card.mana_cost && <p className="text-xs font-mono shrink-0">{card.mana_cost}</p>}
        </div>
        {card.card_type === 'creature' && (
          <p className="text-xs font-mono mt-1">
            {perm?.power ?? card.power}/{perm?.toughness ?? card.toughness}
            {perm?.damage > 0 && <span className="text-red-300"> -{perm.damage}</span>}
          </p>
        )}
      </div>
      <p className="text-gray-400 text-xs">{TYPE_LABELS_JP[card.card_type] || card.card_type}</p>
      {kws.filter(k => !INTERNAL_KEYWORD_TYPES.has(k.type) && KEYWORD_LABELS[k.type]).length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {kws.filter(k => !INTERNAL_KEYWORD_TYPES.has(k.type) && KEYWORD_LABELS[k.type]).map((k, i) => (
            <span key={i} className="text-xs bg-gray-700 text-gray-300 px-1.5 py-0.5 rounded">
              {KEYWORD_LABELS[k.type]}
            </span>
          ))}
        </div>
      )}
      {card.effect_text && (
        <p className="text-gray-400 text-xs mt-2 leading-relaxed">{card.effect_text}</p>
      )}
      <p className="text-gray-600 text-xs mt-2 italic">右クリックで詳細</p>
    </div>
  )
}

function MiniCard({ card, perm, selected, onClick, onDetail, onHover, disabled, dimmed, equipped, effectiveKwTypes }) {
  const kws = effectiveKwTypes ?? (card?.keywords || []).map(k => k.type)
  const isTapped = perm?.tapped
  return (
    <button
      onClick={onClick}
      onContextMenu={onDetail ? (e) => { e.preventDefault(); onDetail() } : undefined}
      onMouseEnter={onHover ? () => onHover(card, perm) : undefined}
      onMouseLeave={onHover ? () => onHover(null, null) : undefined}
      disabled={disabled}
      className={`
        relative border-2 rounded-lg transition-all select-none
        ${isTapped ? 'rotate-90 origin-center' : ''}
        ${selected ? 'border-yellow-400 ring-2 ring-yellow-300' : 'border-transparent'}
        ${dimmed ? 'opacity-40' : ''}
        ${disabled ? 'cursor-default' : 'cursor-pointer hover:border-white'}
        ${COLOR_BG[card?.color] || 'bg-gray-700 text-white'}
        w-20 h-28 flex flex-col p-1.5 text-left shrink-0
      `}
      style={isTapped ? { marginInline: '14px' } : {}}
    >
      {card?.art_url && (
        <img src={card.art_url} alt="" className="w-full h-12 object-cover rounded mb-1" />
      )}
      <p className="text-xs font-bold leading-tight line-clamp-2">{card?.name || '?'}</p>
      {card?.card_type === 'creature' && (
        <p className="text-xs font-mono mt-auto">
          {(perm?.power ?? card?.power ?? '?')}/{(perm?.toughness ?? card?.toughness ?? '?')}
          {perm?.damage > 0 && <span className="text-red-300"> 🩸{perm.damage}</span>}
        </p>
      )}
      {perm?.summoning_sick && <span className="absolute top-0.5 right-0.5 text-xs">😴</span>}
      {perm?.attacking && <span className="absolute bottom-0.5 right-0.5 text-xs">⚔</span>}
      {perm?.blocking && <span className="absolute bottom-0.5 right-0.5 text-xs">🛡</span>}
      {kws.includes('flying') && <span className="absolute top-0.5 left-0.5 text-xs">✈</span>}
      {equipped && <span className="absolute bottom-0.5 left-0.5 text-xs bg-yellow-700/80 rounded px-0.5">⚙</span>}
    </button>
  )
}

function HandCard({ card, onClick, onDetail, onHover, disabled, highlight }) {
  return (
    <div
      onMouseEnter={onHover ? () => onHover(card, null) : undefined}
      onMouseLeave={onHover ? () => onHover(null, null) : undefined}
      className="shrink-0"
    >
    <button
      onClick={onClick}
      onContextMenu={onDetail ? (e) => { e.preventDefault(); onDetail() } : undefined}
      disabled={disabled}
      className={`
        border-2 rounded-lg p-2 transition-all shrink-0 w-20 h-28 flex flex-col text-left
        ${highlight ? 'border-purple-400 ring-2 ring-purple-300 -translate-y-2' : 'border-transparent hover:-translate-y-1'}
        ${disabled ? 'opacity-50 cursor-default' : 'cursor-pointer'}
        ${COLOR_BG[card?.color] || 'bg-gray-700 text-white'}
      `}
    >
      {card?.art_url && (
        <img src={card.art_url} alt="" className="w-full h-11 object-cover rounded mb-1" />
      )}
      <p className="text-xs font-bold leading-tight line-clamp-2">{card?.name}</p>
      <div className="mt-auto flex items-center gap-1">
        {card?.mana_cost && <p className="text-xs font-mono opacity-80">{card.mana_cost}</p>}
        {(card?.keywords || []).some(k => k.type === 'cycling') && (
          <span className="text-xs opacity-70" title="サイクリング">♻</span>
        )}
        {(card?.keywords || []).some(k => k.type === 'kicker') && (
          <span className="text-xs opacity-70" title="キッカー">⚡</span>
        )}
      </div>
    </button>
    </div>
  )
}

// ─── フェーズバー ───────────────────────────────────────────────
function PhaseBar({ phase, isActive }) {
  const mainPhases = ['main1', 'declare_attackers', 'declare_blockers', 'combat_damage', 'main2', 'end_step']
  return (
    <div className="flex items-center gap-1 overflow-x-auto">
      {PHASES.map(p => (
        <div
          key={p}
          className={`px-2 py-1 rounded text-xs shrink-0 transition-colors ${
            p === phase
              ? isActive ? 'bg-purple-600 text-white font-bold' : 'bg-blue-700 text-white font-bold'
              : mainPhases.includes(p) ? 'bg-gray-700 text-gray-400' : 'bg-gray-800 text-gray-600'
          }`}
        >
          {PHASE_LABELS[p]}
        </div>
      ))}
    </div>
  )
}

// ─── マナプール表示 ─────────────────────────────────────────────
const MANA_COLORS = { W: 'bg-yellow-100 text-yellow-900', U: 'bg-blue-600 text-white', B: 'bg-gray-800 text-white border border-gray-500', R: 'bg-red-600 text-white', G: 'bg-green-700 text-white', C: 'bg-gray-500 text-white' }
function ManaPool({ pool }) {
  const entries = Object.entries(pool).filter(([, v]) => v > 0)
  if (entries.length === 0) return <span className="text-gray-600 text-xs">マナなし</span>
  return (
    <div className="flex gap-1 flex-wrap">
      {entries.map(([col, val]) => (
        <span key={col} className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${MANA_COLORS[col]}`}>
          {val > 1 ? val : col}
        </span>
      ))}
    </div>
  )
}

// ─── メインページ ───────────────────────────────────────────────
export default function GamePlayPage() {
  const { id: gameId } = useParams()
  const navigate = useNavigate()
  const { player } = usePlayer()
  const chanRef = useRef(null)
  const cpuBlockersDeclaredRef = useRef(false)

  const [gs, setGs] = useState(null)          // game state
  const [cardData, setCardData] = useState({}) // card_id → card object
  const [game, setGame] = useState(null)
  const [participants, setParticipants] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedHandCard, setSelectedHandCard] = useState(null)
  const [kickerPaid, setKickerPaid] = useState(false)
  const [delveCount, setDelveCount] = useState(0)
  const [pendingEquip, setPendingEquip] = useState(null)   // equipment instance_id
  const [selectedAttackers, setSelectedAttackers] = useState([])
  const [pendingBlocker, setPendingBlocker] = useState(null)
  const [blockingAssignments, setBlockingAssignments] = useState({})
  const [savingGs, setSavingGs] = useState(false)
  const [roundResult, setRoundResult] = useState(null)
  const [detailCard, setDetailCard] = useState(null)
  const [detailPerm, setDetailPerm] = useState(null)
  const [hoverCard, setHoverCard] = useState(null)
  const [hoverPerm, setHoverPerm] = useState(null)
  const [surrendering, setSurrendering] = useState(false)
  const [targetingMode, setTargetingMode] = useState(null)
  // { cardId, card, kickerPaid, targetingType }
  const [reanimateMode, setReanimateMode] = useState(null)
  const [activatedAbilityMode, setActivatedAbilityMode] = useState(null)
  // { instanceId, card, ability }
  // { cardId, card }

  const myId = player?.id
  const isActive = gs?.active_player === myId
  const hasPrio = gs?.priority === myId
  const oppId = gs ? getOpponent(gs, myId) : null
  const cpuParticipant = participants.find(p => p.players?.username === CPU_USERNAME)
  const cpuId = cpuParticipant?.player_id ?? null
  const isCpuGame = !!cpuId

  // ─── ゲーム状態をDBに保存 ──────────────────────────────────
  const saveGs = useCallback(async (newGs) => {
    if (savingGs) return
    setSavingGs(true)
    setGs(newGs)
    await supabase.from('games').update({ game_state: newGs }).eq('id', gameId)
    setSavingGs(false)
  }, [gameId, savingGs])

  // ─── カードデータをまとめてロード ──────────────────────────
  const loadCardData = useCallback(async (cardIds) => {
    const unique = [...new Set(cardIds)].filter(Boolean)
    if (unique.length === 0) return {}
    const { data } = await supabase.from('cards').select('*').in('id', unique)
    const map = {}
    for (const c of (data || [])) map[c.id] = c
    return map
  }, [])

  // ─── 初期化 ────────────────────────────────────────────────
  useEffect(() => {
    if (!player) return
    const init = async () => {
      setLoading(true)
      const [{ data: gameData }, { data: gpData }] = await Promise.all([
        supabase.from('games').select('*').eq('id', gameId).single(),
        supabase.from('game_players').select('*, players(username)').eq('game_id', gameId).order('turn_order'),
      ])
      setGame(gameData)
      setParticipants(gpData || [])

      let currentGs = gameData?.game_state
      // ゲーム状態が未初期化ならホスト（turn_order=1）が初期化
      if (!currentGs?.players) {
        const isHost = gpData?.[0]?.player_id === player.id
        if (isHost) {
          const playerOrder = gpData.map(gp => gp.player_id)
          // 各プレイヤーのデッキをロード
          const deckMap = {}
          for (const gp of gpData) {
            const { data: dcData } = await supabase
              .from('deck_cards')
              .select('card_id, quantity')
              .eq('deck_id', gp.deck_id)
            const expanded = []
            for (const dc of (dcData || [])) {
              for (let i = 0; i < dc.quantity; i++) expanded.push(dc.card_id)
            }
            deckMap[gp.player_id] = expanded
          }
          const startingLife = gameData?.game_state?.starting_life ?? gameData?.starting_life ?? 20
          currentGs = initGameState(playerOrder, deckMap, startingLife)
          await supabase.from('games').update({ game_state: currentGs }).eq('id', gameId)
        } else {
          // 非ホストは少し待って再取得
          await new Promise(r => setTimeout(r, 2000))
          const { data: g2 } = await supabase.from('games').select('game_state').eq('id', gameId).single()
          currentGs = g2?.game_state
        }
      }

      // カードデータロード
      const allCardIds = []
      if (currentGs?.players) {
        for (const ps of Object.values(currentGs.players)) {
          allCardIds.push(...(ps.hand || []), ...(ps.library || []),
            ...(ps.graveyard || []),
            ...(ps.battlefield || []).map(p => p.card_id))
        }
      }
      const cMap = await loadCardData(allCardIds)
      setCardData(cMap)
      setGs(currentGs)
      setLoading(false)
    }
    init()

    // Realtime
    chanRef.current = supabase.channel(`game_play_${gameId}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'games',
        filter: `id=eq.${gameId}`,
      }, async ({ new: newGame }) => {
        if (!newGame.game_state?.players) return
        // カード追加ロード
        const ids = []
        if (newGame.game_state?.players) {
          for (const ps of Object.values(newGame.game_state.players)) {
            ids.push(...(ps.hand || []), ...(ps.battlefield || []).map(p => p.card_id))
          }
        }
        setCardData(prev => {
          const missing = [...new Set(ids)].filter(id => !prev[id])
          if (missing.length > 0) {
            loadCardData(missing).then(m => setCardData(p => ({ ...p, ...m })))
          }
          return prev
        })
        setGs(newGame.game_state)
      })
      .subscribe()

    return () => chanRef.current?.unsubscribe()
  }, [gameId, player])

  // ─── CPU自動プレイ ─────────────────────────────────────────
  useEffect(() => {
    if (!isCpuGame || !cpuId || !gs || !cardData || Object.keys(cardData).length === 0 || savingGs) return
    if (roundResult) return

    const isCpuTurn = gs.active_player === cpuId
    const isCpuBlock = gs.phase === 'declare_blockers' && gs.active_player === myId &&
      (gs.combat.attackers?.length ?? 0) > 0 && !cpuBlockersDeclaredRef.current
    const cpuHasPriority = gs.priority === cpuId && !isCpuTurn

    if (!isCpuTurn && !isCpuBlock && !cpuHasPriority) return

    const t = setTimeout(() => {
      if (cpuHasPriority) {
        const newGs = passPriority(gs, cpuId, cardData)
        if (newGs && newGs !== gs) { dispatch(newGs); checkForRoundEnd(newGs) }
      } else if (isCpuTurn) {
        cpuBlockersDeclaredRef.current = false
        const newGs = cpuTakeTurn(gs, cpuId, cardData)
        if (newGs && newGs !== gs) { dispatch(newGs); checkForRoundEnd(newGs) }
      } else if (isCpuBlock) {
        cpuBlockersDeclaredRef.current = true
        const newGs = cpuDeclareBlockers(gs, cpuId, cardData)
        if (newGs && newGs !== gs) { dispatch(newGs); checkForRoundEnd(newGs) }
      }
    }, 400)

    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gs?.phase, gs?.active_player, gs?.priority, cpuId, isCpuGame, savingGs, roundResult])

  // ─── ブロック宣言フェーズを抜けたら CPU ブロック済みフラグをリセット ──
  useEffect(() => {
    if (gs?.phase !== 'declare_blockers') cpuBlockersDeclaredRef.current = false
  }, [gs?.phase])

  // ─── 非インタラクティブフェーズの自動優先権パス ────────────
  const AUTO_PASS_PHASES = ['untap', 'upkeep', 'draw', 'combat_begin', 'combat_end', 'end_step']
  useEffect(() => {
    if (!gs || !myId || roundResult || savingGs) return
    if (gs.priority !== myId) return
    if (!AUTO_PASS_PHASES.includes(gs.phase)) return
    const t = setTimeout(() => {
      const newGs = passPriority(gs, myId, cardData)
      if (newGs !== gs) { dispatch(newGs); checkForRoundEnd(newGs) }
    }, 150)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gs?.phase, gs?.priority, roundResult, savingGs])

  // ─── 自分のターンのメインフェーズでスタックに積まれたら自動パス ──
  useEffect(() => {
    if (!gs || !myId || roundResult || savingGs) return
    if (gs.priority !== myId) return
    if (!['main1', 'main2'].includes(gs.phase)) return
    if (gs.active_player !== myId) return
    if ((gs.stack || []).length === 0) return
    const t = setTimeout(() => {
      const newGs = passPriority(gs, myId, cardData)
      if (newGs !== gs) { dispatch(newGs); checkForRoundEnd(newGs) }
    }, 600)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gs?.stack?.length, gs?.priority, roundResult, savingGs])

  // ─── 攻撃可能クリーチャーが0体なら自動で攻撃宣言スキップ ──
  useEffect(() => {
    if (!gs || !myId || roundResult || savingGs) return
    if (gs.phase !== 'declare_attackers' || gs.active_player !== myId) return
    if (!cardData || Object.keys(cardData).length === 0) return
    const canAttack = (gs.players[myId]?.battlefield || []).some(perm => {
      const card = cardData[perm.card_id]
      return card?.card_type === 'creature'
        && !perm.summoning_sick && !perm.tapped
        && !(card.keywords || []).some(k => k.type === 'defender')
    })
    if (canAttack) return
    const t = setTimeout(() => {
      const newGs = declareAttackers(gs, myId, [], cardData)
      if (newGs !== gs) { dispatch(newGs); checkForRoundEnd(newGs) }
    }, 150)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gs?.phase, gs?.active_player, roundResult, savingGs])

  const handleHover = useCallback((card, perm) => {
    setHoverCard(card || null)
    setHoverPerm(perm || null)
  }, [])

  const dispatch = useCallback((newGs) => {
    saveGs(newGs)
    setSelectedHandCard(null)
    setKickerPaid(false)
    setDelveCount(0)
    setPendingEquip(null)
    setSelectedAttackers([])
    setPendingBlocker(null)
    setBlockingAssignments({})
    setTargetingMode(null)
    setReanimateMode(null)
    setActivatedAbilityMode(null)
  }, [saveGs])

  const handleHandCardClick = (cardId) => {
    const card = cardData[cardId]
    if (!card || !gs) return

    if (card.card_type === 'land') {
      const newGs = playLand(gs, myId, cardId, card, cardData)
      if (newGs !== gs) dispatch(newGs)
      return
    }

    // 目標が必要な呪文はターゲットモードに入る
    if (spellNeedsTarget(card) && hasPrio) {
      const isFlash = (card.keywords || []).some(k => k.type === 'flash')
      const canPlay = card.card_type === 'instant' || isFlash
        ? canPlayInstantSpeed(gs, myId)
        : canPlaySorcerySpeed(gs, myId)
      if (!canPlay) return
      if (card.mana_cost && !hasMana(myPs.mana_pool, card.mana_cost)) return

      const targetingType = getSpellTargetingType(card)
      if (targetingType === 'own_graveyard_creature') {
        setReanimateMode({ cardId, card })
        setSelectedHandCard(null)
        return
      }
      setTargetingMode({ cardId, card, kickerPaid: false, targetingType })
      setSelectedHandCard(null)
      return
    }

    if (selectedHandCard === cardId) {
      setSelectedHandCard(null)
      setKickerPaid(false)
    } else {
      setSelectedHandCard(cardId)
      setKickerPaid(false)
    }
  }

  // 目標選択（クリーチャー）
  const handleTargetCreature = (instanceId) => {
    if (!targetingMode) return
    const { cardId, card, kickerPaid } = targetingMode
    const target = { type: 'creature', id: instanceId }
    const newGs = castSpellTargeted(gs, myId, cardId, card, target, kickerPaid, 0, cardData)
    if (newGs !== gs) dispatch(newGs)
    else setTargetingMode(null)
  }

  // 目標選択（プレイヤー）
  const handleTargetPlayer = (playerId) => {
    if (!targetingMode) return
    const { cardId, card, kickerPaid } = targetingMode
    const target = { type: 'player', id: playerId }
    const newGs = castSpellTargeted(gs, myId, cardId, card, target, kickerPaid, 0, cardData)
    if (newGs !== gs) dispatch(newGs)
    else setTargetingMode(null)
  }

  // 再アニメイト：墓地クリーチャー選択
  const handleReanimateSelect = (graveyardCardId) => {
    if (!reanimateMode) return
    const { cardId, card } = reanimateMode
    const target = { type: 'graveyard_card', id: graveyardCardId }
    const newGs = castSpellTargeted(gs, myId, cardId, card, target, false, 0, cardData)
    if (newGs !== gs) dispatch(newGs)
    else setReanimateMode(null)
  }

  const handleCastSpell = () => {
    if (!selectedHandCard) return
    const card = cardData[selectedHandCard]
    const newGs = castSpell(gs, myId, selectedHandCard, card, kickerPaid, delveCount, cardData)
    if (newGs !== gs) dispatch(newGs)
  }

  // 起動型能力の対象選択
  const handleActivatedAbilityTarget = (instanceId) => {
    if (!activatedAbilityMode) return
    const { instanceId: abilityInstanceId } = activatedAbilityMode
    const target = { type: 'permanent', id: instanceId }
    const newGs = activateAbilityTargeted(gs, myId, abilityInstanceId, cardData, target)
    if (newGs !== gs) dispatch(newGs)
    else setActivatedAbilityMode(null)
  }

  const handleCycleCard = (cardId) => {
    const card = cardData[cardId]
    if (!card || !gs) return
    const newGs = cycleCard(gs, myId, cardId, card)
    if (newGs !== gs) dispatch(newGs)
  }

  const handleFlashback = (cardId) => {
    const card = cardData[cardId]
    if (!card || !gs) return
    const newGs = castFlashback(gs, myId, cardId, card)
    if (newGs !== gs) dispatch(newGs)
  }

  const handleUnearth = (cardId) => {
    const card = cardData[cardId]
    if (!card || !gs) return
    const newGs = unearthCreature(gs, myId, cardId, card)
    if (newGs !== gs) dispatch(newGs)
  }

  const handleEquipClick = (instanceId) => {
    // 装備品をクリック → 装備モード開始/解除
    if (pendingEquip === instanceId) {
      setPendingEquip(null)
    } else {
      setPendingEquip(instanceId)
    }
  }

  const handleEquipTarget = (targetIid) => {
    if (!pendingEquip) return
    const newGs = equipArtifact(gs, myId, pendingEquip, targetIid, cardData)
    if (newGs !== gs) dispatch(newGs)
    else setPendingEquip(null)
  }

  const handleTapLand = (instanceId) => {
    const perm = gs.players[myId]?.battlefield.find(p => p.instance_id === instanceId)
    if (!perm) return
    const card = cardData[perm.card_id]
    if (!card || card.card_type !== 'land') return
    const newGs = tapForMana(gs, myId, instanceId, card)
    if (newGs !== gs) dispatch(newGs)
  }

  const handleToggleAttacker = (instanceId) => {
    if (gs.phase !== 'declare_attackers' || !isActive) return
    const perm = gs.players[myId]?.battlefield.find(p => p.instance_id === instanceId)
    if (!perm) return
    const card = cardData[perm.card_id]
    if (!card || card.card_type !== 'creature') return
    if (perm.summoning_sick || perm.tapped) return
    setSelectedAttackers(prev =>
      prev.includes(instanceId) ? prev.filter(id => id !== instanceId) : [...prev, instanceId]
    )
  }

  const handleSelectBlocker = (myCreatureIid) => {
    if (gs.phase !== 'declare_blockers' || isActive) return
    setPendingBlocker(prev => prev === myCreatureIid ? null : myCreatureIid)
  }

  const handleAssignBlocker = (attackerIid) => {
    if (!pendingBlocker) return
    const validMap = getValidBlockers(gs, myId, cardData)
    if (!(validMap[attackerIid] || []).includes(pendingBlocker)) return
    setBlockingAssignments(prev => ({
      ...prev,
      [attackerIid]: prev[attackerIid] === pendingBlocker ? undefined : pendingBlocker,
    }))
    setPendingBlocker(null)
  }

  const handleConfirmBlockers = () => {
    const blockerMap = {}
    for (const [attIid, blkIid] of Object.entries(blockingAssignments)) {
      if (blkIid) blockerMap[attIid] = [blkIid]
    }
    const newGs = declareBlockers(gs, myId, blockerMap)
    dispatch(newGs)
  }

  const handleConfirmAttackers = async () => {
    const newGs = declareAttackers(gs, myId, selectedAttackers, cardData)
    dispatch(newGs)
    if (selectedAttackers.length > 0) {
      const attackerPerms = selectedAttackers
        .map(iid => gs.players[myId]?.battlefield.find(p => p.instance_id === iid))
        .filter(Boolean)
      const msgs = await processAttack(attackerPerms, cardData, myId, oppId, gameId)
      if (msgs.length > 0) console.log('[attack triggers]', msgs)
    }
  }

  const handleResolveFirstStrike = () => {
    const newGs = resolveFirstStrikeDamage(gs, cardData)
    dispatch(advancePhase(newGs))
  }

  const handleResolveCombat = async () => {
    const prevGS = gs
    const newGs = resolveCombatDamage(gs, cardData)
    const didDamage = (newGs.players[oppId]?.life ?? 0) < (prevGS.players[oppId]?.life ?? 0)
    const attackerPerms = gs.combat.attackers
      .map(iid => gs.players[myId]?.battlefield.find(p => p.instance_id === iid))
      .filter(Boolean)
    const advanced = advancePhase(newGs)
    dispatch(advanced)
    const msgs = await processDamage(attackerPerms, cardData, myId, oppId, gameId, didDamage)
    if (msgs.length > 0) console.log('[damage triggers]', msgs)
    checkForRoundEnd(advanced)
  }

  const handleDiscard = (cardId) => {
    if (!gs || (gs.cleanup_discard ?? 0) <= 0) return
    const newGs = discardCard(gs, myId, cardId)
    if ((newGs.cleanup_discard ?? 0) === 0) {
      dispatch(finishCleanup(newGs))
    } else {
      dispatch(newGs)
    }
  }

  const handlePassPriority = async () => {
    const prevStack = [...(gs.stack || [])]
    const prevPhase = gs.phase
    const newGs = passPriority(gs, myId, cardData)
    if (newGs === gs) return
    // Detect ETB: stack top resolved to battlefield
    if (prevStack.length > 0 && newGs.stack.length < prevStack.length) {
      const resolved = prevStack[prevStack.length - 1]
      const card = resolved.card || cardData[resolved.card_id]
      if (['creature', 'enchantment', 'artifact'].includes(card?.card_type)) {
        const etbOpp = getOpponent(newGs, resolved.controller)
        const msgs = await processETB(card, resolved.controller, etbOpp, gameId)
        if (msgs.length > 0) console.log('[ETB triggers]', msgs)
      }
    }
    // Detect upkeep entry
    if (newGs.phase === 'upkeep' && prevPhase !== 'upkeep') {
      const ap = newGs.active_player
      const apOpp = getOpponent(newGs, ap)
      const msgs = await processUpkeep(
        newGs.players[ap]?.battlefield || [], cardData, ap, apOpp, gameId
      )
      if (msgs.length > 0) console.log('[upkeep triggers]', msgs)
    }
    dispatch(newGs)
    checkForRoundEnd(newGs)
  }

  const handlePassPhase = async () => {
    if (!isActive) return
    const prevPhase = gs.phase
    const newGs = advancePhase(gs)
    if (newGs.phase === 'upkeep' && prevPhase !== 'upkeep') {
      const ap = newGs.active_player
      const apOpp = getOpponent(newGs, ap)
      const msgs = await processUpkeep(
        newGs.players[ap]?.battlefield || [], cardData, ap, apOpp, gameId
      )
      if (msgs.length > 0) console.log('[upkeep triggers]', msgs)
    }
    dispatch(newGs)
  }

  // ─── ラウンド終了チェック ──────────────────────────────────
  function checkForRoundEnd(state) {
    if (!state?.players || !myId || !oppId) return
    const myL = state.players[myId]?.life ?? 20
    const oppL = state.players[oppId]?.life ?? 20
    // ライフ0
    if (myL <= 0 || oppL <= 0) {
      setRoundResult({ winner: myL > 0 ? myId : oppId, loser: myL <= 0 ? myId : oppId })
      return
    }
    // ライブラリアウト
    if (state.library_out_player) {
      const loser = state.library_out_player
      const winner = loser === myId ? oppId : myId
      setRoundResult({ winner, loser })
    }
  }

  const isBattleMode = game?.game_state?.game_type === 'battle'

  const handleRoundEnd = async () => {
    if (isBattleMode) {
      navigate('/battle')
    } else {
      await supabase.rpc('process_round_end', {
        p_game_id: gameId,
        p_winner_id: roundResult.winner,
        p_loser_id: roundResult.loser,
      })
      navigate(`/game/${gameId}`)
    }
  }

  const myLife = gs?.players?.[myId]?.life ?? 20
  const oppLife = gs?.players?.[oppId]?.life ?? 20

  // ─── レンダリング ──────────────────────────────────────────
  if (loading || !gs) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400">ゲームを読み込み中...</div>
      </div>
    )
  }

  const myPs = gs.players[myId] || {}
  const oppPs = gs.players[oppId] || {}
  const oppInfo = participants.find(p => p.player_id === oppId)
  const myInfo = participants.find(p => p.player_id === myId)

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col select-none overflow-hidden">
      {/* ─── フェーズバー + ステータス ─── */}
      <div className="bg-gray-900 border-b border-gray-700 px-3 py-2 flex items-center gap-3 flex-wrap">
        <div className="shrink-0">
          <PhaseBar phase={gs.phase} isActive={isActive} />
        </div>
        <div className="ml-auto flex items-center gap-3 text-xs text-gray-400 shrink-0">
          <span>T{gs.turn_number}</span>
          <span className={hasPrio ? 'text-yellow-400 font-bold' : ''}>
            {hasPrio ? '⚡ あなたの優先権' : '相手の優先権'}
          </span>
          {savingGs && (
            <span className="flex items-center gap-1 text-gray-500 animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{animationDelay:'0ms'}} />
              <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{animationDelay:'150ms'}} />
              <span className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{animationDelay:'300ms'}} />
            </span>
          )}
        </div>
      </div>

      {/* ─── スタック ─── */}
      {gs.stack.length > 0 && (
        <div className="bg-indigo-950 border-b border-indigo-700 px-3 py-2">
          <p className="text-indigo-300 text-xs mb-1">スタック（{gs.stack.length}）</p>
          <div className="flex gap-2 overflow-x-auto">
            {[...gs.stack].reverse().map((entry, i) => {
              const card = entry.card || cardData[entry.card_id]
              return (
                <div key={entry.id} className={`shrink-0 bg-indigo-900 border rounded px-2 py-1 text-xs ${i === 0 ? 'border-yellow-400 text-yellow-300' : 'border-indigo-700 text-indigo-300'}`}>
                  {i === 0 && '⬆ '}{card?.name || '?'}
                </div>
              )
            })}
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* ─── 盤面 ─── */}
        <div className="flex-1 flex flex-col overflow-hidden">

          {/* 相手ゾーン */}
          <div className="flex-1 bg-gray-900 border-b border-gray-700 p-3">
            <div className="flex items-center gap-3 mb-2">
              <div className="text-red-400 font-bold text-xl">❤ {oppLife}</div>
              <div className="text-gray-400 text-sm">{oppInfo?.players?.username}</div>
              <div className="ml-2"><ManaPool pool={oppPs.mana_pool || {}} /></div>
              <div className="ml-auto text-gray-500 text-xs">
                手札{oppPs.hand?.length} / ライブラリ{oppPs.library?.length} / 墓地{oppPs.graveyard?.length}
              </div>
            </div>
            {/* 相手の手札（伏せ） */}
            <div className="flex gap-1 mb-2 overflow-x-auto pb-1">
              {(oppPs.hand || []).map((_, i) => (
                <div key={i} className="w-16 h-22 bg-blue-900 border-2 border-blue-700 rounded flex items-center justify-center shrink-0 text-blue-600 text-xl" style={{height:'5.5rem'}}>
                  🂠
                </div>
              ))}
            </div>
            {/* 相手の戦場 */}
            <div className="flex gap-2 overflow-x-auto pb-1 min-h-[7rem]">
              {(oppPs.battlefield || []).map(perm => {
                const card = cardData[perm.card_id]
                const isBlockPhase = gs.phase === 'declare_blockers' && !isActive
                const isAttacking = perm.attacking
                const assignedBlocker = blockingAssignments[perm.instance_id]
                const canAssign = isBlockPhase && isAttacking && pendingBlocker
                const isAssigned = isBlockPhase && isAttacking && !!assignedBlocker
                return (
                  <MiniCard
                    key={perm.instance_id}
                    card={card}
                    perm={{
                      ...perm,
                      blocking: isAssigned ? assignedBlocker : perm.blocking,
                    }}
                    selected={canAssign || isAssigned || (targetingMode && ['opp_creature','opp_creature_or_player','any_creature','any_permanent'].includes(targetingMode.targetingType)) || (activatedAbilityMode && ['artifact','enchantment'].includes(card?.card_type))}
                    onClick={() => {
                      if (canAssign) handleAssignBlocker(perm.instance_id)
                      else if (targetingMode && ['opp_creature','opp_creature_or_player','any_creature'].includes(targetingMode.targetingType) && card?.card_type === 'creature') handleTargetCreature(perm.instance_id)
                      else if (targetingMode?.targetingType === 'any_permanent') handleTargetCreature(perm.instance_id)
                      else if (activatedAbilityMode && ['artifact','enchantment'].includes(card?.card_type)) handleActivatedAbilityTarget(perm.instance_id)
                    }}
                    onDetail={() => { setDetailCard(card); setDetailPerm(perm) }}
                    onHover={handleHover}
                    dimmed={false}
                  />
                )
              })}
            </div>
          </div>

          {/* 自分ゾーン */}
          <div className="flex-1 bg-gray-800 p-3">
            {/* 自分の戦場 */}
            {(() => {
              const equippedSet = new Set(
                (myPs.battlefield || []).filter(p => p.attached_to).map(p => p.attached_to)
              )
              return (
                <div className="flex gap-2 overflow-x-auto pb-2 min-h-[7rem]">
                  {(myPs.battlefield || []).map(perm => {
                    const card = cardData[perm.card_id]
                    const isLand = card?.card_type === 'land'
                    const isCrea = card?.card_type === 'creature'
                    const isEquip = card?.card_type === 'artifact' &&
                      (card?.keywords || []).some(k => k.type === 'equip')
                    const hasDefender = (card?.keywords || []).some(k => k.type === 'defender')
                    const canAtt = gs.phase === 'declare_attackers' && isActive && isCrea && !perm.summoning_sick && !perm.tapped && !hasDefender
                    const inAttackPhase = gs.phase === 'declare_attackers' && isActive && isCrea
                    const isSelAtt = selectedAttackers.includes(perm.instance_id)
                    const isBlockPhase = gs.phase === 'declare_blockers' && !isActive
                    const canBlk = isBlockPhase && isCrea && !perm.tapped && !perm.summoning_sick
                    const isSelBlk = pendingBlocker === perm.instance_id
                    const isAssignedBlk = Object.values(blockingAssignments).includes(perm.instance_id)
                    const canEquipThis = isEquip && isActive && canPlaySorcerySpeed(gs, myId)
                    const isSelEquip = pendingEquip === perm.instance_id
                    const isEquipTarget = pendingEquip && isCrea
                    const effPT = isCrea ? getEffectivePT(perm, card, myPs.battlefield, cardData) : null
                    const effKws = isCrea ? getEffectiveKeywords(perm, card, myPs.battlefield, cardData) : null
                    return (
                      <MiniCard
                        key={perm.instance_id}
                        card={card}
                        perm={{
                          ...perm,
                          attacking: isSelAtt || perm.attacking,
                          power: effPT?.power ?? perm.power,
                          toughness: effPT?.toughness ?? perm.toughness,
                        }}
                        effectiveKwTypes={effKws}
                        selected={isSelAtt || isSelBlk || isAssignedBlk || isSelEquip || (isEquipTarget && !isEquip)}
                        dimmed={inAttackPhase && !canAtt && !isSelAtt}
                        onClick={() => {
                          if (targetingMode?.targetingType === 'own_creature' && isCrea) handleTargetCreature(perm.instance_id)
                          else if (targetingMode?.targetingType === 'any_creature' && isCrea) handleTargetCreature(perm.instance_id)
                          else if (targetingMode?.targetingType === 'any_permanent') handleTargetCreature(perm.instance_id)
                          else if (activatedAbilityMode && ['artifact','enchantment'].includes(card?.card_type)) handleActivatedAbilityTarget(perm.instance_id)
                          else if (isLand && !perm.tapped) handleTapLand(perm.instance_id)
                          else if (isCrea && !perm.tapped && !perm.summoning_sick && (card?.keywords || []).some(k => k.type === 'tap_for_mana')) {
                            const newGs = tapForMana(gs, myId, perm.instance_id, card)
                            if (newGs !== gs) dispatch(newGs)
                          }
                          else if (canAtt || inAttackPhase) handleToggleAttacker(perm.instance_id)
                          else if (canBlk) handleSelectBlocker(perm.instance_id)
                          else if (isEquipTarget && !isEquip) handleEquipTarget(perm.instance_id)
                          else if (canEquipThis) handleEquipClick(perm.instance_id)
                        }}
                        onDetail={() => {
                          const ep = isCrea ? getEffectivePT(perm, card, myPs.battlefield, cardData) : null
                          setDetailCard(card)
                          setDetailPerm({ ...perm, power: ep?.power ?? perm.power, toughness: ep?.toughness ?? perm.toughness })
                        }}
                        onHover={handleHover}
                        equipped={equippedSet.has(perm.instance_id)}
                        disabled={!isLand && !canAtt && !canBlk && !canEquipThis && !(isEquipTarget && !isEquip) && !inAttackPhase}
                      />
                    )
                  })}
                </div>
              )
            })()}

            {/* 自分のステータス */}
            <div className="flex items-center gap-3 mb-2">
              <div className="text-green-400 font-bold text-xl">❤ {myLife}</div>
              <div className="text-gray-300 text-sm">{myInfo?.players?.username}</div>
              <div className="ml-2"><ManaPool pool={myPs.mana_pool || {}} /></div>
              <div className="ml-auto text-gray-500 text-xs">
                ライブラリ{myPs.library?.length} / 墓地{myPs.graveyard?.length}
                {(myPs.exile?.length ?? 0) > 0 && ` / 追放${myPs.exile.length}`}
              </div>
            </div>

            {/* 手札 */}
            <div className="flex gap-1 overflow-x-auto pb-1">
              {(myPs.hand || []).map((cardId, idx) => {
                const card = cardData[cardId]
                const canPlay = card?.card_type === 'land'
                  ? !myPs.land_played && canPlaySorcerySpeed(gs, myId)
                  : hasPrio && (card?.mana_cost
                    ? hasMana(myPs.mana_pool, card.mana_cost)
                    : true)
                return (
                  <HandCard
                    key={`${cardId}-${idx}`}
                    card={card}
                    highlight={selectedHandCard === cardId}
                    disabled={!canPlay}
                    onClick={() => handleHandCardClick(cardId)}
                    onDetail={() => { setDetailCard(card); setDetailPerm(null) }}
                    onHover={handleHover}
                  />
                )
              })}
            </div>
          </div>
        </div>

        {/* ─── サイドパネル ─── */}
        <div className="w-48 bg-gray-900 border-l border-gray-700 flex flex-col p-3 gap-3 overflow-y-auto">
          {/* 選択中の手札 */}
          {selectedHandCard && (() => {
            const selCard = cardData[selectedHandCard]
            const kickerKw = (selCard?.keywords || []).find(k => k.type === 'kicker')
            const cycleKw = (selCard?.keywords || []).find(k => k.type === 'cycling')
            return (
              <div className="bg-gray-800 border border-purple-600 rounded-lg p-3">
                <p className="text-purple-300 text-xs font-bold mb-1">{selCard?.name}</p>
                {selCard?.mana_cost && (
                  <p className="text-gray-500 text-xs font-mono mb-1">{selCard.mana_cost}</p>
                )}
                <p className="text-gray-400 text-xs mb-3 leading-relaxed line-clamp-3">
                  {selCard?.effect_text || '効果なし'}
                </p>

                {/* キッカートグル */}
                {kickerKw && (
                  <label className="flex items-center gap-2 mb-2 cursor-pointer">
                    <input type="checkbox" checked={kickerPaid}
                      onChange={e => setKickerPaid(e.target.checked)}
                      className="accent-yellow-400" />
                    <span className="text-yellow-400 text-xs">
                      キッカー ({`{${kickerKw.value ?? 1}}`})
                    </span>
                  </label>
                )}

                {/* 探査スライダー */}
                {(selCard?.keywords || []).some(k => k.type === 'delve') && (
                  <div className="mb-2">
                    <p className="text-teal-400 text-xs mb-1">
                      探査: 墓地から {delveCount} 枚追放
                    </p>
                    <input type="range" min={0}
                      max={myPs.graveyard?.length ?? 0}
                      value={delveCount}
                      onChange={e => setDelveCount(+e.target.value)}
                      className="w-full accent-teal-400"
                    />
                  </div>
                )}

                <button
                  onClick={handleCastSpell}
                  className="w-full bg-purple-600 hover:bg-purple-700 text-white text-xs py-2 rounded mb-1"
                >
                  詠唱する{kickerPaid ? '（K）' : ''}{delveCount > 0 ? `（探査×${delveCount}）` : ''}
                </button>

                {/* サイクリング */}
                {cycleKw && hasPrio && (
                  <button
                    onClick={() => handleCycleCard(selectedHandCard)}
                    className="w-full bg-teal-700 hover:bg-teal-600 text-white text-xs py-1.5 rounded mb-1"
                  >
                    サイクリング ({`{${cycleKw.value ?? 1}}`})
                  </button>
                )}

                <button
                  onClick={() => { setSelectedHandCard(null); setKickerPaid(false); setDelveCount(0) }}
                  className="w-full text-gray-500 hover:text-gray-300 text-xs py-1"
                >
                  キャンセル
                </button>
              </div>
            )
          })()}

          {/* 攻撃宣言 */}
          {gs.phase === 'declare_attackers' && isActive && (
            <button
              onClick={handleConfirmAttackers}
              className="w-full bg-red-700 hover:bg-red-600 text-white text-sm py-2.5 rounded-lg font-medium"
            >
              ⚔ 攻撃宣言 ({selectedAttackers.length})
            </button>
          )}

          {/* ブロック宣言 */}
          {gs.phase === 'declare_blockers' && !isActive && (
            <div className="space-y-1">
              {pendingBlocker && (
                <p className="text-yellow-400 text-xs text-center">攻撃クリーチャーを選択</p>
              )}
              {!pendingBlocker && (
                <p className="text-gray-400 text-xs text-center">ブロッカーを選択</p>
              )}
              <button
                onClick={handleConfirmBlockers}
                className="w-full bg-blue-700 hover:bg-blue-600 text-white text-sm py-2.5 rounded-lg font-medium"
              >
                🛡 ブロック確定 ({Object.values(blockingAssignments).filter(Boolean).length})
              </button>
            </div>
          )}

          {/* 先制ダメージ解決 */}
          {gs.phase === 'first_strike_damage' && isActive && hasPrio && (
            <button
              onClick={handleResolveFirstStrike}
              className="w-full bg-yellow-700 hover:bg-yellow-600 text-white text-sm py-2.5 rounded-lg font-medium"
            >
              ⚡ 先制ダメージ解決
            </button>
          )}

          {/* 戦闘ダメージ解決 */}
          {gs.phase === 'combat_damage' && isActive && hasPrio && (
            <button
              onClick={handleResolveCombat}
              className="w-full bg-orange-700 hover:bg-orange-600 text-white text-sm py-2.5 rounded-lg font-medium"
            >
              💥 ダメージ解決
            </button>
          )}

          {/* 優先権パス */}
          {hasPrio && !['declare_attackers','first_strike_damage','combat_damage'].includes(gs.phase) && (
            <button
              onClick={handlePassPriority}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white text-sm py-2.5 rounded-lg"
            >
              優先権パス
            </button>
          )}

          {/* フェーズスキップ */}
          {isActive && ['main1', 'main2', 'end_step'].includes(gs.phase) && (
            <button
              onClick={handlePassPhase}
              className="w-full bg-gray-700 hover:bg-gray-600 text-blue-300 text-sm py-2 rounded-lg"
            >
              次のフェーズ →
            </button>
          )}

          {/* 装備モードヒント */}
          {pendingEquip && (
            <div className="bg-amber-900/40 border border-amber-600 rounded-lg px-2 py-1.5 text-amber-300 text-xs text-center">
              装備先のクリーチャーを選択
              <button onClick={() => setPendingEquip(null)} className="block w-full text-amber-500 hover:text-amber-300 mt-1">
                キャンセル
              </button>
            </div>
          )}

          {/* ターゲットモード */}
          {targetingMode && (
            <div className="bg-red-950/60 border border-red-500 rounded-lg px-2 py-2 text-red-300 text-xs">
              <p className="font-bold mb-1 text-center">🎯 {targetingMode.card?.name}</p>
              <p className="text-red-400 text-center mb-2">
                {targetingMode.targetingType === 'own_creature' && '自分のクリーチャーを選択'}
                {targetingMode.targetingType === 'opp_creature' && '相手のクリーチャーを選択'}
                {targetingMode.targetingType === 'opp_creature_or_player' && '相手のクリーチャーまたは'}
                {targetingMode.targetingType === 'any_creature' && '任意のクリーチャーを選択'}
                {targetingMode.targetingType === 'any_permanent' && 'パーマネントを選択'}
              </p>
              {/* キッカートグル */}
              {(targetingMode.card?.keywords || []).find(k => k.type === 'kicker') && (
                <label className="flex items-center gap-2 mb-2 cursor-pointer">
                  <input type="checkbox" checked={targetingMode.kickerPaid}
                    onChange={e => setTargetingMode(prev => ({ ...prev, kickerPaid: e.target.checked }))}
                    className="accent-yellow-400" />
                  <span className="text-yellow-400 text-xs">
                    キッカー ({`{${(targetingMode.card.keywords.find(k => k.type === 'kicker'))?.value ?? 1}}`})
                  </span>
                </label>
              )}
              {targetingMode.targetingType === 'opp_creature_or_player' && (
                <button
                  onClick={() => handleTargetPlayer(oppId)}
                  className="w-full bg-red-800 hover:bg-red-700 text-white text-xs py-1.5 rounded mb-1"
                >
                  プレイヤーを目標にする
                </button>
              )}
              <button onClick={() => setTargetingMode(null)} className="block w-full text-red-500 hover:text-red-300 text-xs py-1">
                キャンセル
              </button>
            </div>
          )}

          {/* 起動型能力ターゲット選択パネル */}
          {activatedAbilityMode && (
            <div className="bg-orange-950/60 border border-orange-500 rounded-lg px-2 py-2 text-orange-300 text-xs">
              <p className="font-bold mb-1 text-center">⚡ {activatedAbilityMode.card?.name}</p>
              <p className="text-orange-400 text-center mb-2">アーティファクト/エンチャントを選択</p>
              <button onClick={() => setActivatedAbilityMode(null)} className="block w-full text-orange-500 hover:text-orange-300 text-xs py-1">
                キャンセル
              </button>
            </div>
          )}

          {/* ログ */}
          <div className="flex-1 bg-gray-950 rounded-lg p-2 overflow-y-auto max-h-48">
            <p className="text-gray-600 text-xs mb-1">ログ</p>
            {[...(gs.log || [])].reverse().map((entry, i) => {
              const oppName = oppInfo?.players?.username || '相手'
              const msg = (entry.msg || '')
                .replace(new RegExp(myId, 'g'), 'あなた')
                .replace(new RegExp(oppId, 'g'), oppName)
              return (
                <p key={i} className="text-gray-400 text-xs leading-relaxed border-b border-gray-800 py-0.5">
                  {msg}
                </p>
              )
            })}
          </div>

          {/* 降参 */}
          {!roundResult && (
            surrendering ? (
              <div className="bg-red-950 border border-red-700 rounded-lg p-2 text-center">
                <p className="text-red-300 text-xs mb-2">本当に降参しますか？</p>
                <div className="flex gap-1">
                  <button
                    onClick={() => { setSurrendering(false) }}
                    className="flex-1 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs py-1.5 rounded"
                  >
                    戻る
                  </button>
                  <button
                    onClick={() => { setRoundResult({ winner: oppId, loser: myId }) }}
                    className="flex-1 bg-red-700 hover:bg-red-600 text-white text-xs py-1.5 rounded font-bold"
                  >
                    降参する
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setSurrendering(true)}
                className="w-full bg-gray-800 hover:bg-red-950 border border-gray-700 hover:border-red-700 text-gray-500 hover:text-red-400 text-xs py-1.5 rounded-lg transition-colors"
              >
                🏳 降参
              </button>
            )
          )}

          {/* 墓地（フラッシュバック/アンアース対応） */}
          {myPs.graveyard?.length > 0 && (
            <div>
              <p className="text-gray-500 text-xs mb-1">墓地 ({myPs.graveyard.length})</p>
              <div className="space-y-0.5 max-h-28 overflow-y-auto">
                {myPs.graveyard.map((cid, i) => {
                  const card = cardData[cid]
                  const fbKw = (card?.keywords || []).find(k => k.type === 'flashback')
                  const unKw = (card?.keywords || []).find(k => k.type === 'unearth')
                  const canFb = fbKw && hasPrio && hasMana(myPs.mana_pool, fbKw.value || '{0}')
                  const canUn = unKw && canPlaySorcerySpeed(gs, myId) && hasMana(myPs.mana_pool, unKw.value || '{0}')
                  return (
                    <div key={i} className="flex items-center gap-1">
                      <span
                        className="text-gray-400 text-xs flex-1 truncate cursor-pointer hover:text-gray-200"
                        onClick={() => { setDetailCard(card); setDetailPerm(null) }}
                      >{card?.name || '?'}</span>
                      {canFb && (
                        <button onClick={() => handleFlashback(cid)}
                          className="text-xs bg-indigo-700 hover:bg-indigo-600 text-white px-1 py-0.5 rounded shrink-0">
                          FB
                        </button>
                      )}
                      {canUn && (
                        <button onClick={() => handleUnearth(cid)}
                          className="text-xs bg-emerald-700 hover:bg-emerald-600 text-white px-1 py-0.5 rounded shrink-0">
                          UN
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ─── 手札整理モーダル（クリーンアップ時 手札>7枚）─── */}
      {(gs.cleanup_discard ?? 0) > 0 && isActive && (
        <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-40 pb-4">
          <div className="bg-gray-800 border border-yellow-600 rounded-xl p-4 w-full max-w-2xl mx-4">
            <p className="text-yellow-400 font-bold text-center mb-3">
              手札を {gs.cleanup_discard} 枚捨ててください
            </p>
            <div className="flex gap-2 overflow-x-auto justify-center pb-1">
              {(myPs.hand || []).map(cardId => {
                const card = cardData[cardId]
                return (
                  <button
                    key={cardId}
                    onClick={() => handleDiscard(cardId)}
                    className={`shrink-0 w-20 h-28 rounded-lg p-1.5 border-2 border-red-500 hover:border-red-300 text-left text-xs flex flex-col ${COLOR_BG[card?.color] || 'bg-gray-700 text-white'}`}
                  >
                    {card?.art_url && <img src={card.art_url} alt="" className="w-full h-12 object-cover rounded mb-1" />}
                    <p className="font-bold leading-tight line-clamp-2">{card?.name || '?'}</p>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── 再アニメイト：墓地選択モーダル ─── */}
      {reanimateMode && (
        <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-40 pb-4">
          <div className="bg-gray-800 border border-purple-600 rounded-xl p-4 w-full max-w-2xl mx-4">
            <p className="text-purple-300 font-bold text-center mb-1">{reanimateMode.card?.name}</p>
            <p className="text-gray-400 text-xs text-center mb-3">墓地から戦場に戻すクリーチャーを選択</p>
            <div className="flex gap-2 overflow-x-auto justify-center pb-1">
              {(myPs.graveyard || []).map((cid, i) => {
                const c = cardData[cid]
                if (c?.card_type !== 'creature') return null
                return (
                  <button
                    key={`${cid}-${i}`}
                    onClick={() => handleReanimateSelect(cid)}
                    className={`shrink-0 w-20 h-28 rounded-lg p-1.5 border-2 border-purple-500 hover:border-purple-300 text-left text-xs flex flex-col ${COLOR_BG[c?.color] || 'bg-gray-700 text-white'}`}
                  >
                    {c?.art_url && <img src={c.art_url} alt="" className="w-full h-12 object-cover rounded mb-1" />}
                    <p className="font-bold leading-tight line-clamp-2">{c?.name || '?'}</p>
                    <p className="text-xs mt-auto font-mono">{c?.power}/{c?.toughness}</p>
                  </button>
                )
              }).filter(Boolean)}
            </div>
            <button onClick={() => setReanimateMode(null)} className="block w-full text-gray-500 hover:text-gray-300 text-xs py-2 mt-2">
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* ─── ホバーカード詳細 ─── */}
      <HoverCardTooltip card={hoverCard} perm={hoverPerm} />

      {/* ─── カード詳細モーダル ─── */}
      <CardDetailModal
        card={detailCard}
        perm={detailPerm}
        onClose={() => { setDetailCard(null); setDetailPerm(null) }}
        onActivateAbility={
          detailPerm && gs && myPs?.battlefield.some(p => p.instance_id === detailPerm.instance_id)
            ? () => {
                const c = cardData[detailPerm.card_id] || {}
                const ability = (c.keywords || []).find(k => k.type === 'activated_ability')
                if (ability?.targeting) {
                  // ターゲット選択が必要 → モードをセットしてモーダルを閉じる
                  setActivatedAbilityMode({ instanceId: detailPerm.instance_id, card: c, ability })
                  setDetailCard(null); setDetailPerm(null)
                } else {
                  const newGs = activateAbility(gs, myId, detailPerm.instance_id, cardData)
                  if (newGs !== gs) dispatch(newGs)
                }
              }
            : undefined
        }
        canActivateAbility={
          detailPerm && gs
            ? (() => {
                const c = cardData[detailPerm?.card_id] || {}
                const ability = (c.keywords || []).find(k => k.type === 'activated_ability')
                if (!ability) return false
                return hasMana(myPs?.mana_pool || {}, `{${ability.cost}}`) &&
                  canPlayInstantSpeed(gs, myId)
              })()
            : false
        }
      />

      {/* ─── ラウンド終了モーダル ─── */}
      {roundResult && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-gray-800 border border-gray-600 rounded-xl p-8 text-center max-w-sm w-full mx-4 shadow-2xl">
            <div className="text-5xl mb-4">
              {roundResult.winner === myId ? '🏆' : '💀'}
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">
              {roundResult.winner === myId ? 'ラウンド勝利！' : 'ラウンド敗北...'}
            </h2>
            <p className="text-gray-400 mb-6">
              {participants.find(p => p.player_id === roundResult.winner)?.players?.username} の勝利
            </p>
            <button
              onClick={handleRoundEnd}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              結果を確定する
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
