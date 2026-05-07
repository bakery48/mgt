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
  main1: '戦闘前メイン', combat_begin: '戦闘開始',
  declare_attackers: '攻撃クリーチャー指定', declare_blockers: 'ブロッククリーチャー指定',
  first_strike_damage: '先制戦闘ダメージ', combat_damage: '戦闘ダメージ',
  combat_end: '戦闘終了', main2: '戦闘後メイン',
  end_step: '終了', cleanup: 'クリンナップ',
}

const COLOR_TO_MANA = {
  white: 'W', blue: 'U', black: 'B', red: 'R', green: 'G',
  colorless: 'C', multicolor: 'C',
}

// ─── ユーティリティ ─────────────────────────────────────────────

// 配列から指定 id の最初の1件だけ削除（同名カード複数枚対応）
function removeOne(arr, id) {
  const idx = arr.indexOf(id)
  if (idx === -1) return arr
  return [...arr.slice(0, idx), ...arr.slice(idx + 1)]
}

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
export function initGameState(playerOrder, deckMap, startingLife = 20) {
  const players = {}
  for (const pid of playerOrder) {
    const shuffled = shuffle(deckMap[pid] || [])
    players[pid] = {
      life: startingLife,
      mana_pool: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
      hand: shuffled.slice(0, 7),
      library: shuffled.slice(7),
      battlefield: [],
      graveyard: [],
      exile: [],
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
        hand: removeOne(ps.hand, cardId),
        battlefield: [...ps.battlefield, perm],
        land_played: true,
      },
    },
  }, `${card.name} をプレイ（土地）`)
}

// 呪文をスタックに積む（kicker / delve 対応）
export function castSpell(state, pid, cardId, card, kicker = false, delveCount = 0) {
  const ps = state.players[pid]
  if (!ps.hand.includes(cardId)) return state
  const isFlash = (card.keywords || []).some(k => k.type === 'flash')
  const hasDelve = (card.keywords || []).some(k => k.type === 'delve')
  const instant = card.card_type === 'instant' || isFlash
  if (instant ? !canPlayInstantSpeed(state, pid) : !canPlaySorcerySpeed(state, pid)) return state

  // 探査（delve）: 墓地のカードを追放してジェネリックコストを軽減
  let graveyard = [...ps.graveyard]
  let exile = [...(ps.exile || [])]
  let actualDelve = 0
  if (hasDelve && delveCount > 0) {
    actualDelve = Math.min(delveCount, graveyard.length)
    exile = [...exile, ...graveyard.slice(-actualDelve)]
    graveyard = graveyard.slice(0, -actualDelve)
  }

  // マナコスト計算（delve分だけジェネリック軽減）
  let newPool = { ...ps.mana_pool }
  if (card.mana_cost) {
    const cost = parseMana(card.mana_cost)
    cost.C = Math.max(0, (cost.C || 0) - actualDelve)
    if (!hasMana(newPool, cost)) return state
    newPool = spendMana(newPool, cost)
  }

  // キッカーコスト
  if (kicker) {
    const kickerKw = (card.keywords || []).find(k => k.type === 'kicker')
    if (kickerKw) {
      const kickerCostStr = `{${kickerKw.value || 1}}`
      if (!hasMana(newPool, kickerCostStr)) return state
      newPool = spendMana(newPool, kickerCostStr)
    }
  }

  const entry = { id: uuidv4(), type: 'spell', card_id: cardId, card, controller: pid, kicked: kicker }

  return log({
    ...state,
    priority_passed: [],
    stack: [...state.stack, entry],
    players: {
      ...state.players,
      [pid]: {
        ...ps,
        hand: removeOne(ps.hand, cardId),
        graveyard,
        exile,
        mana_pool: newPool,
      },
    },
  }, `${card.name} をスタックに積んだ${kicker ? '（キッカー）' : ''}${actualDelve > 0 ? `（探査×${actualDelve}）` : ''}`)
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
    if (top.kicked) perm.kicked = true
    newState.players = {
      ...newState.players,
      [top.controller]: {
        ...ps,
        battlefield: [...ps.battlefield, perm],
      },
    }
    newState = log(newState, `${card?.name} が戦場に出た${top.kicked ? '（キッカー済）' : ''}`)
  } else {
    // instant/sorcery → フラッシュバックなら追放、それ以外は墓地
    if (top.flashback) {
      newState.players = {
        ...newState.players,
        [top.controller]: { ...ps, exile: [...(ps.exile || []), top.card_id] },
      }
      newState = log(newState, `${card?.name} 解決 → 追放`)
    } else {
      newState.players = {
        ...newState.players,
        [top.controller]: { ...ps, graveyard: [...ps.graveyard, top.card_id] },
      }
      newState = log(newState, `${card?.name} 解決 → 墓地へ`)
    }
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
    } else {
      // ライブラリアウト
      s.library_out_player = ap
      s = log(s, `${ap} のライブラリが空になった！`)
    }
    s.priority = ap
  } else if (next === 'cleanup') {
    const ap = state.active_player
    // アンアース済みクリーチャーを全プレイヤーで追放
    for (const pid of order) {
      const ps = s.players[pid]
      const unearthed = ps.battlefield.filter(p => p.unearthed)
      if (unearthed.length > 0) {
        s.players = {
          ...s.players,
          [pid]: {
            ...ps,
            battlefield: ps.battlefield.filter(p => !p.unearthed),
            exile: [...(ps.exile || []), ...unearthed.map(p => p.card_id)],
          },
        }
      }
    }
    // 手札上限チェック（7枚）
    const ap2 = s.active_player
    const ps2 = s.players[ap2]
    const excess = (ps2.hand || []).length - 7
    if (excess > 0) {
      s.cleanup_discard = excess
      s.priority = ap2
      return s  // 手札整理待ち（クリーンアップ本体は後で）
    }
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

// 手札整理後にクリーンアップ本体を実行（GamePlayPage から呼ぶ）
export function finishCleanup(state) {
  const ap = state.active_player
  const ps = state.players[ap]
  const cleaned = {
    ...state,
    cleanup_discard: 0,
    players: {
      ...state.players,
      [ap]: {
        ...ps,
        mana_pool: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
        battlefield: ps.battlefield.map(p => ({ ...p, damage: 0 })),
      },
    },
  }
  // クリーンアップ完了後は自動的に次のターン（アンタップ）へ進む
  return advancePhase(cleaned)
}

// 攻撃宣言（防衛クリーチャーを除外）
export function declareAttackers(state, pid, attackerIids, cardData) {
  if (state.phase !== 'declare_attackers' || state.active_player !== pid) return state
  const ps = state.players[pid]
  // defender 持ちは攻撃不可
  const validIids = attackerIids.filter(iid => {
    const perm = ps.battlefield.find(p => p.instance_id === iid)
    if (!perm) return false
    const card = cardData[perm.card_id] || {}
    return !(card.keywords || []).some(k => k.type === 'defender')
  })
  const newBf = ps.battlefield.map(p => {
    if (!validIids.includes(p.instance_id)) return p
    const card = cardData[p.card_id] || {}
    const hasVigilance = (card.keywords || []).some(k => k.type === 'vigilance')
    return { ...p, attacking: true, tapped: !hasVigilance }
  })
  let next = log({
    ...state,
    combat: { ...state.combat, attackers: validIids },
    players: { ...state.players, [pid]: { ...ps, battlefield: newBf } },
    priority_passed: [],
    priority: pid,
  }, `${validIids.length} 体で攻撃`)

  // 攻撃者0体のとき戦闘フェーズ全体をスキップしてメイン2へ
  if (validIids.length === 0) {
    while (next.phase !== 'main2') next = advancePhase(next)
  }
  return next
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

// ─── 戦闘ダメージ共通ヘルパー ─────────────────────────────────────
// firstStrikePhase=true  → 先制攻撃フェーズ（先制/二段のみ）
// firstStrikePhase=false → 通常ダメージフェーズ（先制のみはスキップ、二段は含む）
function _resolveStrike(state, cardData, firstStrikePhase) {
  const ap  = state.active_player
  const def = getOpponent(state, ap)
  let aps = { ...state.players[ap] }
  let dps = { ...state.players[def] }
  let apBf = [...aps.battlefield]
  let dpBf = [...dps.battlefield]
  let defLife = dps.life
  let apLife  = aps.life

  for (const attIid of state.combat.attackers) {
    const attPerm = apBf.find(p => p.instance_id === attIid)
    if (!attPerm) continue
    const attCard = cardData[attPerm.card_id] || {}
    const attKws  = attCard.keywords || []
    const attKw   = attKws.map(k => k.type)
    const hasFS   = attKw.includes('first_strike')
    const hasDS   = attKw.includes('double_strike')

    // フェーズ別スキップ判定
    if (firstStrikePhase  && !hasFS && !hasDS) continue  // 先制/二段でない → 先制フェーズはスキップ
    if (!firstStrikePhase && hasFS  && !hasDS) continue  // 先制のみ → 通常フェーズはスキップ

    const attProtection = attKws.find(k => k.type === 'protection')?.value ?? null
    const blockerIids   = state.combat.blockers[attIid] || []
    const blockers      = blockerIids.map(biid => dpBf.find(p => p.instance_id === biid)).filter(Boolean)
    const { power }     = getEffectivePT(attPerm, attCard, apBf, cardData)

    if (blockers.length === 0) {
      defLife -= power
      if (attKw.includes('lifelink')) apLife += power
    } else {
      let rem = power
      for (const blk of blockers) {
        const blkCard = cardData[blk.card_id] || {}
        const blkKws  = blkCard.keywords || []
        const blkKw   = blkKws.map(k => k.type)
        const blkFS   = blkKw.includes('first_strike') || blkKw.includes('double_strike')
        const blkProt = blkKws.find(k => k.type === 'protection')?.value ?? null
        const blkImmuneToAtt = blkProt && attCard.color === blkProt
        const { power: blkPower, toughness: blkTough } = getEffectivePT(blk, blkCard, dpBf, cardData)

        const dmgToBlk = (blkKw.includes('indestructible') || blkImmuneToAtt)
          ? 0 : Math.min(rem, blkTough - blk.damage)
        rem -= Math.min(rem, blkTough - blk.damage)

        if (attKw.includes('deathtouch') && dmgToBlk > 0) {
          dpBf = dpBf.map(p => p.instance_id === blk.instance_id ? { ...p, damage: 9999 } : p)
        } else {
          dpBf = dpBf.map(p => p.instance_id === blk.instance_id ? { ...p, damage: p.damage + dmgToBlk } : p)
        }

        // ブロッカーの反撃: 先制フェーズは先制/二段のみ、通常フェーズは先制なし/二段のみ
        const blkDealsBack = firstStrikePhase
          ? blkFS
          : (!blkKw.includes('first_strike') || blkKw.includes('double_strike'))
        if (blkDealsBack) {
          const attImmuneToBlk = attProtection && blkCard.color === attProtection
          const dmgToAtt = attImmuneToBlk ? 0
            : (blkKw.includes('deathtouch') && blkPower > 0 ? 9999 : blkPower)
          if (!attKw.includes('indestructible')) {
            apBf = apBf.map(p => p.instance_id === attIid ? { ...p, damage: p.damage + dmgToAtt } : p)
          }
        }
        if (attKw.includes('lifelink')) apLife += dmgToBlk
      }
      if (attKw.includes('trample') && rem > 0) {
        defLife -= rem
        if (attKw.includes('lifelink')) apLife += rem
      }
    }
  }

  // 致死ダメージ処理（装備込みタフネス + 装備デタッチ）
  const filterLethal = (bf) => {
    const deadIids = []
    const graveyard = []
    const alive = bf.filter(p => {
      const card = cardData[p.card_id] || {}
      if (card.card_type !== 'creature') return true
      const kw = (card.keywords || []).map(k => k.type)
      const { toughness: effTough } = getEffectivePT(p, card, bf, cardData)
      if (!kw.includes('indestructible') && p.damage >= effTough) {
        deadIids.push(p.instance_id)
        graveyard.push(p.card_id)
        return false
      }
      return true
    })
    return {
      alive: alive.map(p =>
        p.attached_to && deadIids.includes(p.attached_to) ? { ...p, attached_to: null } : p
      ),
      graveyard,
    }
  }

  const { alive: apAlive, graveyard: apDead } = filterLethal(apBf)
  const { alive: dpAlive, graveyard: dpDead } = filterLethal(dpBf)

  const clearCombat = !firstStrikePhase
  let s = {
    ...state,
    ...(clearCombat ? { combat: { attackers: [], blockers: {} } } : {}),
    players: {
      ...state.players,
      [ap]: {
        ...aps, life: apLife,
        battlefield: apAlive.map(p => clearCombat ? { ...p, attacking: false } : p),
        graveyard: [...aps.graveyard, ...apDead],
      },
      [def]: {
        ...dps, life: defLife,
        battlefield: dpAlive.map(p => clearCombat ? { ...p, blocking: null } : p),
        graveyard: [...dps.graveyard, ...dpDead],
      },
    },
  }
  const label = firstStrikePhase ? '先制ダメージ' : '戦闘ダメージ'
  return log(s, `${label}: ${apDead.length + dpDead.length} 体が破壊された`)
}

// 先制攻撃フェーズのダメージ解決
export function resolveFirstStrikeDamage(state, cardData) {
  return _resolveStrike(state, cardData, true)
}

// 通常ダメージフェーズの解決
export function resolveCombatDamage(state, cardData) {
  return _resolveStrike(state, cardData, false)
}

// 手札を1枚捨てる（手札上限処理）
export function discardCard(state, pid, cardId) {
  const ps = state.players[pid]
  if (!(ps.hand || []).includes(cardId)) return state
  const newHand = removeOne(ps.hand, cardId)
  const remaining = Math.max(0, (state.cleanup_discard || 0) - 1)
  let s = {
    ...state,
    cleanup_discard: remaining,
    players: {
      ...state.players,
      [pid]: { ...ps, hand: newHand, graveyard: [...ps.graveyard, cardId] },
    },
  }
  return log(s, `手札を1枚捨てた（残り捨て枚数: ${remaining}）`)
}

// 状況起因処理（ライフ0チェック等）
export function checkStateBasedActions(state) {
  return state
}

// 装備品の有効P/T計算（同一プレイヤーの戦場の装備を参照）
export function getEffectivePT(perm, card, battlefield, cardData) {
  let power = perm.power ?? card?.power ?? 0
  let toughness = perm.toughness ?? card?.toughness ?? 1
  for (const eq of battlefield) {
    if (eq.attached_to !== perm.instance_id) continue
    const eqCard = cardData[eq.card_id] || {}
    const eqKw = (eqCard.keywords || []).find(k => k.type === 'equip')
    if (eqKw) {
      power += eqKw.power_bonus ?? 0
      toughness += eqKw.toughness_bonus ?? 0
    }
  }
  return { power, toughness }
}

// 装備（アーティファクトをクリーチャーに付ける）
export function equipArtifact(state, pid, equipIid, targetIid, cardData) {
  if (!canPlaySorcerySpeed(state, pid)) return state
  const ps = state.players[pid]
  const equipPerm = ps.battlefield.find(p => p.instance_id === equipIid)
  if (!equipPerm) return state
  const equipCard = cardData[equipPerm.card_id] || {}
  const equipKw = (equipCard.keywords || []).find(k => k.type === 'equip')
  if (!equipKw) return state
  const costStr = `{${equipKw.value ?? 1}}`
  if (!hasMana(ps.mana_pool, costStr)) return state
  const target = ps.battlefield.find(p => p.instance_id === targetIid)
  if (!target) return state
  const targetCard = cardData[target.card_id] || {}
  if (targetCard.card_type !== 'creature') return state
  const newPool = spendMana(ps.mana_pool, costStr)
  return log({
    ...state,
    players: {
      ...state.players,
      [pid]: {
        ...ps,
        mana_pool: newPool,
        battlefield: ps.battlefield.map(p =>
          p.instance_id === equipIid ? { ...p, attached_to: targetIid } : p
        ),
      },
    },
  }, `${equipCard.name} を装備（${targetCard.name}）`)
}

// フラッシュバック（墓地から詠唱→追放）
export function castFlashback(state, pid, cardId, card) {
  const ps = state.players[pid]
  if (!(ps.graveyard || []).includes(cardId)) return state
  const fbKw = (card?.keywords || []).find(k => k.type === 'flashback')
  if (!fbKw?.value) return state
  const isInstant = card.card_type === 'instant'
  if (isInstant ? !canPlayInstantSpeed(state, pid) : !canPlaySorcerySpeed(state, pid)) return state
  if (!hasMana(ps.mana_pool, fbKw.value)) return state
  const newPool = spendMana(ps.mana_pool, fbKw.value)
  const entry = { id: uuidv4(), type: 'spell', card_id: cardId, card, controller: pid, flashback: true }
  return log({
    ...state,
    stack: [...state.stack, entry],
    priority_passed: [],
    players: {
      ...state.players,
      [pid]: {
        ...ps,
        graveyard: ps.graveyard.filter(id => id !== cardId),
        mana_pool: newPool,
      },
    },
  }, `${card.name} をフラッシュバックで詠唱`)
}

// アンアース（墓地からクリーチャーを戦場へ、クリーンアップ時に追放）
export function unearthCreature(state, pid, cardId, card) {
  const ps = state.players[pid]
  if (!(ps.graveyard || []).includes(cardId)) return state
  const unearthKw = (card?.keywords || []).find(k => k.type === 'unearth')
  if (!unearthKw?.value) return state
  if (!canPlaySorcerySpeed(state, pid)) return state
  if (!hasMana(ps.mana_pool, unearthKw.value)) return state
  const newPool = spendMana(ps.mana_pool, unearthKw.value)
  const perm = mkPermanent(cardId, card)
  perm.summoning_sick = false  // 速攻を持つ扱い
  perm.unearthed = true
  return log({
    ...state,
    players: {
      ...state.players,
      [pid]: {
        ...ps,
        graveyard: ps.graveyard.filter(id => id !== cardId),
        battlefield: [...ps.battlefield, perm],
        mana_pool: newPool,
      },
    },
  }, `${card.name} をアンアースで戦場へ`)
}

// サイクリング（手札から捨てて1ドロー）
export function cycleCard(state, pid, cardId, card) {
  const ps = state.players[pid]
  if (!ps.hand.includes(cardId)) return state
  const cycleKw = (card?.keywords || []).find(k => k.type === 'cycling')
  if (!cycleKw) return state
  const costStr = `{${cycleKw.value ?? 1}}`
  if (!hasMana(ps.mana_pool, costStr)) return state
  const newPool = spendMana(ps.mana_pool, costStr)
  const newHand = removeOne(ps.hand, cardId)
  const drawn = ps.library[0] ?? null
  return log({
    ...state,
    players: {
      ...state.players,
      [pid]: {
        ...ps,
        hand: drawn ? [...newHand, drawn] : newHand,
        library: ps.library.slice(1),
        graveyard: [...ps.graveyard, cardId],
        mana_pool: newPool,
      },
    },
  }, `${card.name} をサイクリング → 1枚ドロー`)
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
    const attKws = attCard.keywords || []
    const attKwTypes = attKws.map(k => k.type)
    const attFlying = attKwTypes.includes('flying')
    // protection from X: attacker cannot be blocked by X-colored creatures
    const attProtection = attKws.find(k => k.type === 'protection')?.value ?? null

    result[att.instance_id] = defenderPerms
      .filter(blk => {
        const blkCard = cardData[blk.card_id] || {}
        const blkKwTypes = (blkCard.keywords || []).map(k => k.type)
        if (attFlying && !blkKwTypes.includes('flying') && !blkKwTypes.includes('reach')) return false
        if (attProtection && blkCard.color === attProtection) return false
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
