import { v4 as uuidv4 } from 'uuid'

// ─── フェーズ定義 ───────────────────────────────────────────────
export const PHASES = [
  'untap', 'upkeep', 'draw', 'main1',
  'combat_begin', 'declare_attackers', 'declare_blockers',
  'first_strike_damage', 'combat_damage', 'combat_end',
  'main2', 'end_step', 'cleanup',
]
export const PHASE_LABELS = {
  untap: 'アンタップ', upkeep: 'アップキープ', draw: 'ドロー',
  main1: 'メイン1', combat_begin: '戦闘開始',
  declare_attackers: '攻撃宣言', declare_blockers: 'ブロック宣言',
  first_strike_damage: '先制ダメージ', combat_damage: '戦闘ダメージ',
  combat_end: '戦闘終了', main2: 'メイン2',
  end_step: 'エンドステップ', cleanup: 'クリーンアップ',
}

const COLOR_TO_MANA = {
  white: 'W', blue: 'U', black: 'B', red: 'R', green: 'G',
  colorless: 'C', multicolor: 'C',
}

// ─── ユーティリティ ─────────────────────────────────────────────
function shuffle(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function log(state, msg) {
  return { ...state, log: [...(state.log || []).slice(-29), { msg, ts: Date.now() }] }
}

export function parseMana(cost) {
  if (!cost) return { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, total: 0 }
  const r = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, total: 0 }
  for (const m of cost.matchAll(/\{([^}]+)\}/g)) {
    const v = m[1]
    if (/^\d+$/.test(v)) { r.C += +v; r.total += +v }
    else if (r[v] !== undefined) { r[v]++; r.total++ }
    else { r.C++; r.total++ }
  }
  return r
}

export function hasMana(pool, cost) {
  const c = typeof cost === 'string' ? parseMana(cost) : cost
  const p = { ...pool }
  for (const col of ['W', 'U', 'B', 'R', 'G']) {
    if ((p[col] || 0) < (c[col] || 0)) return false
    p[col] = (p[col] || 0) - (c[col] || 0)
  }
  const rem = Object.values(p).reduce((s, v) => s + Math.max(0, v), 0)
  return rem >= (c.C || 0)
}

export function spendMana(pool, cost) {
  const c = typeof cost === 'string' ? parseMana(cost) : cost
  const p = { ...pool }
  for (const col of ['W', 'U', 'B', 'R', 'G']) {
    p[col] = Math.max(0, (p[col] || 0) - (c[col] || 0))
  }
  let colorless = c.C || 0
  for (const col of ['C', 'W', 'U', 'B', 'R', 'G']) {
    if (colorless <= 0) break
    const pay = Math.min(colorless, p[col] || 0)
    p[col] = (p[col] || 0) - pay
    colorless -= pay
  }
  return p
}

export function getOpponent(state, playerId) {
  return Object.keys(state.players).find(id => id !== playerId)
}

function mkPermanent(cardId, card) {
  return {
    instance_id: uuidv4(),
    card_id: cardId,
    tapped: false,
    damage: 0,
    summoning_sick: card?.card_type === 'creature' &&
      !(card.keywords || []).some(k => k.type === 'haste'),
    attacking: false,
    blocking: null,
    counters: {},
    power: card?.power ?? null,
    toughness: card?.toughness ?? null,
  }
}

// ─── 初期化 ─────────────────────────────────────────────────────
// playerOrder: [player_id, ...]
// deckMap: { player_id: [card_id, ...] }  ← card_idが重複含む配列
export function initGameState(playerOrder, deckMap) {
  const players = {}
  for (const pid of playerOrder) {
    const shuffled = shuffle(deckMap[pid] || [])
    players[pid] = {
      life: 20,
      mana_pool: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
      hand: shuffled.slice(0, 7),
      library: shuffled.slice(7),
      battlefield: [],
      graveyard: [],
      land_played: false,
    }
  }
  const ap = playerOrder[0]
  return {
    phase: 'main1',
    active_player: ap,
    priority: ap,
    turn_number: 1,
    player_order: playerOrder,
    stack: [],
    players,
    combat: { attackers: [], blockers: {} },
    priority_passed: [],
    log: [{ msg: 'ゲーム開始', ts: Date.now() }],
  }
}

// ─── 優先権・フェーズ判定 ────────────────────────────────────────
export function canPlaySorcerySpeed(state, pid) {
  return state.active_player === pid &&
    (state.phase === 'main1' || state.phase === 'main2') &&
    state.stack.length === 0
}

export function canPlayInstantSpeed(state, pid) {
  return state.priority === pid
}

// ─── アクション ─────────────────────────────────────────────────

// 土地タップ（マナ生成）
export function tapForMana(state, pid, instanceId, card) {
  const ps = state.players[pid]
  const perm = ps.battlefield.find(p => p.instance_id === instanceId)
  if (!perm || perm.tapped) return state
  const col = COLOR_TO_MANA[card.color] || 'C'
  return log({
    ...state,
    players: {
      ...state.players,
      [pid]: {
        ...ps,
        battlefield: ps.battlefield.map(p =>
          p.instance_id === instanceId ? { ...p, tapped: true } : p
        ),
        mana_pool: { ...ps.mana_pool, [col]: (ps.mana_pool[col] || 0) + 1 },
      },
    },
  }, `${card.name} をタップ → {${col}}`)
}

// 土地プレイ
export function playLand(state, pid, cardId, card) {
  const ps = state.players[pid]
  if (!canPlaySorcerySpeed(state, pid)) return state
  if (ps.land_played) return state
  if (!ps.hand.includes(cardId)) return state
  const perm = mkPermanent(cardId, card)
  perm.summoning_sick = false
  return log({
    ...state,
    players: {
      ...state.players,
      [pid]: {
        ...ps,
        hand: ps.hand.filter(id => id !== cardId),
        battlefield: [...ps.battlefield, perm],
        land_played: true,
      },
    },
  }, `${card.name} をプレイ（土地）`)
}

// 呪文をスタックに積む
export function castSpell(state, pid, cardId, card) {
  const ps = state.players[pid]
  if (!ps.hand.includes(cardId)) return state
  const isFlash = (card.keywords || []).some(k => k.type === 'flash')
  const instant = card.card_type === 'instant' || isFlash
  if (instant ? !canPlayInstantSpeed(state, pid) : !canPlaySorcerySpeed(state, pid)) return state
  if (card.mana_cost && !hasMana(ps.mana_pool, card.mana_cost)) return state

  const newPool = card.mana_cost ? spendMana(ps.mana_pool, card.mana_cost) : ps.mana_pool
  const entry = { id: uuidv4(), type: 'spell', card_id: cardId, card, controller: pid }

  return log({
    ...state,
    priority_passed: [],
    stack: [...state.stack, entry],
    players: {
      ...state.players,
      [pid]: { ...ps, hand: ps.hand.filter(id => id !== cardId), mana_pool: newPool },
    },
  }, `${card.name} をスタックに積んだ`)
}

// スタック最上位を解決
function resolveStack(state, cardData) {
  if (state.stack.length === 0) return state
  const top = state.stack[state.stack.length - 1]
  const card = top.card || cardData[top.card_id]
  const ps = state.players[top.controller]
  let newState = { ...state, stack: state.stack.slice(0, -1), priority_passed: [] }

  if (['creature', 'enchantment', 'artifact'].includes(card?.card_type)) {
    const perm = mkPermanent(top.card_id, card)
    newState.players = {
      ...newState.players,
      [top.controller]: {
        ...ps,
        battlefield: [...ps.battlefield, perm],
      },
    }
    newState = log(newState, `${card?.name} が戦場に出た`)
  } else {
    // instant/sorcery → 墓地
    newState.players = {
      ...newState.players,
      [top.controller]: { ...ps, graveyard: [...ps.graveyard, top.card_id] },
    }
    newState = log(newState, `${card?.name} 解決 → 墓地へ`)
  }
  newState.priority = newState.active_player
  return newState
}

// 優先権パス
export function passPriority(state, pid, cardData) {
  if (state.priority !== pid) return state
  const order = state.player_order
  const passed = [...(state.priority_passed || []), pid]

  if (passed.length >= order.length) {
    if (state.stack.length > 0) {
      return resolveStack({ ...state, priority_passed: [] }, cardData)
    }
    return advancePhase({ ...state, priority_passed: [] })
  }
  const next = order[(order.indexOf(pid) + 1) % order.length]
  return { ...state, priority: next, priority_passed: passed }
}

// フェーズ進行
export function advancePhase(state) {
  const order = state.player_order
  const idx = PHASES.indexOf(state.phase)
  const next = PHASES[(idx + 1) % PHASES.length]
  let s = { ...state, phase: next, priority_passed: [], stack: [], combat: state.combat }

  if (next === 'untap') {
    const nextAP = order[(order.indexOf(state.active_player) + 1) % order.length]
    const ps = state.players[nextAP]
    s.active_player = nextAP
    s.priority = nextAP
    s.turn_number = state.turn_number + 1
    s.combat = { attackers: [], blockers: {} }
    s.players = {
      ...state.players,
      [nextAP]: {
        ...ps,
        land_played: false,
        mana_pool: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
        battlefield: ps.battlefield.map(p => ({
          ...p, tapped: false, damage: 0, attacking: false, blocking: null,
          summoning_sick: false,
        })),
      },
    }
    s = log(s, `ターン ${s.turn_number}: ${nextAP} のターン`)
  } else if (next === 'draw') {
    const ap = state.active_player
    const ps = state.players[ap]
    if (ps.library.length > 0) {
      s.players = {
        ...state.players,
        [ap]: { ...ps, hand: [...ps.hand, ps.library[0]], library: ps.library.slice(1) },
      }
    }
    s.priority = ap
  } else if (next === 'cleanup') {
    const ap = state.active_player
    const ps = s.players[ap]
    s.players = {
      ...s.players,
      [ap]: {
        ...ps,
        mana_pool: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
        battlefield: ps.battlefield.map(p => ({ ...p, damage: 0 })),
      },
    }
  } else {
    s.priority = state.active_player
  }
  return s
}

// 攻撃宣言
export function declareAttackers(state, pid, attackerIids, cardData) {
  if (state.phase !== 'declare_attackers' || state.active_player !== pid) return state
  const ps = state.players[pid]
  const newBf = ps.battlefield.map(p => {
    if (!attackerIids.includes(p.instance_id)) return p
    const card = cardData[p.card_id] || {}
    const hasVigilance = (card.keywords || []).some(k => k.type === 'vigilance')
    return { ...p, attacking: true, tapped: !hasVigilance }
  })
  return log({
    ...state,
    combat: { ...state.combat, attackers: attackerIids },
    players: { ...state.players, [pid]: { ...ps, battlefield: newBf } },
    priority_passed: [],
    priority: pid,
  }, `${attackerIids.length} 体で攻撃`)
}

// ブロック宣言
export function declareBlockers(state, pid, blockerMap) {
  if (state.phase !== 'declare_blockers') return state
  const ps = state.players[pid]
  const newBf = ps.battlefield.map(p => {
    const att = Object.entries(blockerMap).find(([, bs]) => bs.includes(p.instance_id))?.[0]
    return { ...p, blocking: att || null }
  })
  return log({
    ...state,
    combat: { ...state.combat, blockers: blockerMap },
    players: { ...state.players, [pid]: { ...ps, battlefield: newBf } },
    priority_passed: [],
    priority: state.active_player,
  }, 'ブロック宣言')
}

// 戦闘ダメージ解決
export function resolveCombatDamage(state, cardData) {
  const ap = state.active_player
  const def = getOpponent(state, ap)
  let aps = { ...state.players[ap] }
  let dps = { ...state.players[def] }
  let apBf = [...aps.battlefield]
  let dpBf = [...dps.battlefield]
  let defLife = dps.life
  let apLife = aps.life

  for (const attIid of state.combat.attackers) {
    const attPerm = apBf.find(p => p.instance_id === attIid)
    if (!attPerm) continue
    const attCard = cardData[attPerm.card_id] || {}
    const attKw = (attCard.keywords || []).map(k => k.type)
    const power = attPerm.power ?? attCard.power ?? 0
    const blockerIids = state.combat.blockers[attIid] || []
    const blockers = blockerIids.map(biid => dpBf.find(p => p.instance_id === biid)).filter(Boolean)

    if (blockers.length === 0) {
      defLife -= power
      if (attKw.includes('lifelink')) apLife += power
    } else {
      let rem = power
      for (const blk of blockers) {
        const blkCard = cardData[blk.card_id] || {}
        const blkKw = (blkCard.keywords || []).map(k => k.type)
        const blkPower = blk.power ?? blkCard.power ?? 0
        const blkTough = blk.toughness ?? blkCard.toughness ?? 1
        const dmgToBlk = blkKw.includes('indestructible') ? 0 : Math.min(rem, blkTough - blk.damage)
        rem -= dmgToBlk
        if (attKw.includes('deathtouch') && dmgToBlk > 0) {
          dpBf = dpBf.map(p => p.instance_id === blk.instance_id ? { ...p, damage: 9999 } : p)
        } else {
          dpBf = dpBf.map(p => p.instance_id === blk.instance_id ? { ...p, damage: p.damage + dmgToBlk } : p)
        }
        const dmgToAtt = blkKw.includes('deathtouch') && blkPower > 0 ? 9999 : blkPower
        if (!attKw.includes('indestructible')) {
          apBf = apBf.map(p => p.instance_id === attIid ? { ...p, damage: p.damage + dmgToAtt } : p)
        }
        if (attKw.includes('lifelink')) apLife += dmgToBlk
      }
      if (attKw.includes('trample') && rem > 0) {
        defLife -= rem
        if (attKw.includes('lifelink')) apLife += rem
      }
    }
  }

  // 致死ダメージ処理
  const filterLethal = (bf, pid, isAP) => {
    const graveyard = []
    const alive = bf.filter(p => {
      const card = cardData[p.card_id] || {}
      const kw = (card.keywords || []).map(k => k.type)
      const tough = p.toughness ?? card.toughness ?? 1
      if (!kw.includes('indestructible') && p.damage >= tough) {
        graveyard.push(p.card_id)
        return false
      }
      return true
    })
    return { alive, graveyard }
  }

  const { alive: apAlive, graveyard: apDead } = filterLethal(apBf, ap, true)
  const { alive: dpAlive, graveyard: dpDead } = filterLethal(dpBf, def, false)

  let s = {
    ...state,
    combat: { attackers: [], blockers: {} },
    players: {
      ...state.players,
      [ap]: {
        ...aps,
        life: apLife,
        battlefield: apAlive.map(p => ({ ...p, attacking: false })),
        graveyard: [...aps.graveyard, ...apDead],
      },
      [def]: {
        ...dps,
        life: defLife,
        battlefield: dpAlive.map(p => ({ ...p, blocking: null })),
        graveyard: [...dps.graveyard, ...dpDead],
      },
    },
  }
  return log(s, `戦闘ダメージ: ${apDead.length + dpDead.length} 体が破壊された`)
}

// 状況起因処理（ライフ0チェック等）
export function checkStateBasedActions(state) {
  return state
}

// 飛行/到達/威迫ルールを考慮した有効ブロッカーマップを返す
// 戻り値: { [attackerIid]: blockerIid[] } — 各攻撃クリーチャーをブロックできる防御側のinstance_id一覧
export function getValidBlockers(state, defId, cardData) {
  const ap = state.active_player
  const attackerPerms = state.combat.attackers
    .map(iid => state.players[ap].battlefield.find(p => p.instance_id === iid))
    .filter(Boolean)

  const defenderPerms = (state.players[defId]?.battlefield || []).filter(p => {
    const card = cardData[p.card_id] || {}
    return card.card_type === 'creature' && !p.tapped && !p.summoning_sick
  })

  const result = {}
  for (const att of attackerPerms) {
    const attCard = cardData[att.card_id] || {}
    const attKw = (attCard.keywords || []).map(k => k.type)
    const attFlying = attKw.includes('flying')

    result[att.instance_id] = defenderPerms
      .filter(blk => {
        const blkCard = cardData[blk.card_id] || {}
        const blkKw = (blkCard.keywords || []).map(k => k.type)
        if (attFlying && !blkKw.includes('flying') && !blkKw.includes('reach')) return false
        return true
      })
      .map(p => p.instance_id)
  }
  return result
}

// 威迫（menace）チェック: 威迫クリーチャーは2体未満でブロックできない
// blockerMap: { [attackerIid]: blockerIid[] }
// 戻り値: 無効なブロック割り当てがあれば false
export function validateBlockers(state, blockerMap, cardData) {
  const ap = state.active_player
  for (const [attIid, blkIids] of Object.entries(blockerMap)) {
    if (!blkIids || blkIids.length === 0) continue
    const attPerm = state.players[ap].battlefield.find(p => p.instance_id === attIid)
    if (!attPerm) continue
    const attCard = cardData[attPerm.card_id] || {}
    const attKw = (attCard.keywords || []).map(k => k.type)
    if (attKw.includes('menace') && blkIids.length < 2) return false
  }
  return true
}
