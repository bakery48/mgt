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
    temp_effects: [],
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

// 起動型能力（pump_self など）
export function activateAbility(state, pid, instanceId, cardData) {
  if (!canPlayInstantSpeed(state, pid)) return state
  const ps = state.players[pid]
  const perm = ps.battlefield.find(p => p.instance_id === instanceId)
  if (!perm) return state
  const card = cardData[perm.card_id] || {}
  const ability = (card.keywords || []).find(k => k.type === 'activated_ability')
  if (!ability) return state

  if (ability.tap_self && perm.tapped) return state
  const costStr = ability.cost_str || (ability.cost != null ? `{${ability.cost}}` : null)
  if (costStr && !hasMana(ps.mana_pool, costStr)) return state
  const newPool = costStr ? spendMana(ps.mana_pool, costStr) : { ...ps.mana_pool }

  if (ability.effect === 'pump_self') {
    const te = { power: ability.power ?? 0, toughness: ability.toughness ?? 0 }
    const newBf = ps.battlefield.map(p =>
      p.instance_id === instanceId
        ? { ...p, temp_effects: [...(p.temp_effects || []), te] }
        : p
    )
    return log(
      { ...state, players: { ...state.players, [pid]: { ...ps, battlefield: newBf, mana_pool: newPool } } },
      `${card.name} 起動型能力 → +${te.power}/+${te.toughness}`
    )
  }

  if (ability.effect === 'draw_cards') {
    // 条件チェック
    if (ability.condition === 'controls_5_lands') {
      const landCount = ps.battlefield.filter(p => (cardData[p.card_id] || {}).card_type === 'land').length
      if (landCount < 5) return state
    }
    // タップコスト
    if (ability.tap_self && perm.tapped) return state
    let newBf = ps.battlefield.map(p =>
      p.instance_id === instanceId ? { ...p, tapped: true } : p
    )
    // 生け贄コスト
    let newGy = [...ps.graveyard]
    if (ability.sacrifice_self) {
      newBf = newBf.filter(p => p.instance_id !== instanceId)
      newGy = [...newGy, perm.card_id]
    }
    // カードを引く
    const count = ability.value ?? 1
    const drawn = ps.library.slice(0, count)
    const newLibrary = ps.library.slice(count)
    const newHand = [...ps.hand, ...drawn]
    return log(
      { ...state, players: { ...state.players, [pid]: { ...ps, battlefield: newBf, graveyard: newGy, hand: newHand, library: newLibrary, mana_pool: newPool } } },
      `${card.name} 起動型能力 → カードを${count}枚引いた`
    )
  }
  if (ability.effect === 'drain_each_opp') {
    const dmg = ability.damage ?? 1
    const gain = ability.gain ?? 1
    const opponents = Object.keys(state.players).filter(id => id !== pid)
    let newBf = ps.battlefield.map(p => p.instance_id === instanceId ? { ...p, tapped: true } : p)
    let s = { ...state, players: { ...state.players, [pid]: { ...ps, battlefield: newBf, mana_pool: newPool } } }
    for (const oppId of opponents) {
      const oppPs = s.players[oppId]
      s = log(
        { ...s, players: { ...s.players, [oppId]: { ...oppPs, life: oppPs.life - dmg } } },
        `${card.name} 起動型能力 → 相手${dmg}点ライフ失う`
      )
    }
    const myPs2 = s.players[pid]
    s = log(
      { ...s, players: { ...s.players, [pid]: { ...myPs2, life: myPs2.life + gain } } },
      `${card.name} 起動型能力 → ライフを${gain}点得た`
    )
    return applyLifeGainTriggers(s, pid, cardData)
  }
  return state
}

// 対象が必要な起動型能力（生け贄コストを伴うものなど）
export function activateAbilityTargeted(state, pid, instanceId, cardData, target) {
  if (!canPlayInstantSpeed(state, pid)) return state
  const ps = state.players[pid]
  const perm = ps.battlefield.find(p => p.instance_id === instanceId)
  if (!perm) return state
  const card = cardData[perm.card_id] || {}
  const ability = (card.keywords || []).find(k => k.type === 'activated_ability' && k.targeting)
  if (!ability) return state

  // マナコスト支払い
  const costStr = ability.cost ? `{${ability.cost}}` : null
  let newPool = { ...ps.mana_pool }
  if (costStr) {
    if (!hasMana(newPool, costStr)) return state
    newPool = spendMana(newPool, costStr)
  }

  // 生け贄コスト：自身を墓地へ
  let newBf = ps.battlefield.filter(p => p.instance_id !== instanceId)
  let newGy = [...ps.graveyard, perm.card_id]
  let s = log(
    { ...state, players: { ...state.players, [pid]: { ...ps, battlefield: newBf, graveyard: newGy, mana_pool: newPool } } },
    `${card.name} を生け贄に捧げた`
  )

  // 対象への効果
  if (ability.effect === 'destroy_artifact_or_enchantment' && target) {
    s = _destroyPermanent(s, target.id, cardData)
  }
  return s
}

// 手札を捨てる起動型能力（不屈の古参兵など）
export function activateAbilityDiscard(state, pid, instanceId, discardCardId, cardData) {
  if (!canPlayInstantSpeed(state, pid)) return state
  const ps = state.players[pid]
  const perm = ps.battlefield.find(p => p.instance_id === instanceId)
  if (!perm) return state
  const card = cardData[perm.card_id] || {}
  const ability = (card.keywords || []).find(k => k.type === 'activated_ability' && k.cost === 'discard_card')
  if (!ability) return state
  if (!ps.hand.includes(discardCardId)) return state

  // コスト：手札1枚を捨てる
  const newHand = ps.hand.filter(id => id !== discardCardId)
  const discardCard2 = cardData[discardCardId] || {}
  const newGy = [...ps.graveyard, discardCardId]

  // 効果：自身をタップ + ターン終了時まで破壊不能
  const newBf = ps.battlefield.map(p => {
    if (p.instance_id !== instanceId) return p
    return {
      ...p,
      tapped: ability.tap_self ? true : p.tapped,
      temp_effects: [...(p.temp_effects || []), { grant_keywords: ['indestructible'] }],
    }
  })

  return log(
    { ...state, players: { ...state.players, [pid]: { ...ps, hand: newHand, graveyard: newGy, battlefield: newBf } } },
    `${card.name} 起動型能力 → ${discardCard2.name || '?'} を捨て、破壊不能を得た`
  )
}

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
export function playLand(state, pid, cardId, card, cardData = {}) {
  const ps = state.players[pid]
  if (!canPlaySorcerySpeed(state, pid)) return state
  if (ps.land_played) return state
  if (!ps.hand.includes(cardId)) return state
  const perm = mkPermanent(cardId, card)
  perm.summoning_sick = false
  const afterLand = log({
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
  return applyLandfallTriggers(afterLand, pid, cardData)
}

// 呪文をスタックに積む（kicker / delve 対応）
export function castSpell(state, pid, cardId, card, kicker = false, delveCount = 0, cardData = {}) {
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

  const afterCast = log({
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
  return applyOnCastTriggers(afterCast, pid, card, cardData)
}

// パーマネントが戦場に出たとき誘発する ETB 能力を処理する
function applyEtbTriggers(state, pid, card, cardData) {
  let s = state
  for (const kw of (card?.keywords || [])) {
    // 強襲ETB: このターン攻撃していた場合に誘発
    if (kw.type === 'etb_trigger' && kw.condition === 'raid') {
      if (!s.players[pid].has_attacked) continue
      if (kw.effect === 'raid_look_top') {
        const n = kw.n ?? 3
        const ps = s.players[pid]
        const topCards = ps.library.slice(0, n)
        if (topCards.length > 0) {
          s = { ...s, pending_raid_look: { pid, cards: topCards, keep: kw.keep ?? 1 } }
        }
      }
      continue
    }
    if (kw.type === 'etb_exile_target') {
      // 追放対象が必要 → pending_etb_exile をセットして UI に委譲
      const bf = s.players[pid].battlefield
      const instanceId = bf.length > 0 ? bf[bf.length - 1].instance_id : null
      s = { ...s, pending_etb_exile: { pid, instanceId, gain: kw.gain ?? 0, cardName: card.name } }
      continue
    }
    // オーラETB: エンチャント対象をタップ
    if (kw.type === 'etb_trigger' && kw.effect === 'tap_attached') {
      const bf = s.players[pid].battlefield
      const aura = bf[bf.length - 1]
      if (aura?.attached_to) {
        for (const [oppId, oppPs] of Object.entries(s.players)) {
          const idx = oppPs.battlefield.findIndex(p => p.instance_id === aura.attached_to)
          if (idx >= 0) {
            const newBf = oppPs.battlefield.map(p =>
              p.instance_id === aura.attached_to ? { ...p, tapped: true } : p
            )
            s = log({ ...s, players: { ...s.players, [oppId]: { ...oppPs, battlefield: newBf } } },
              `${card.name} ETB → ${cardData[oppPs.battlefield[idx].card_id]?.name ?? '対象'} をタップ`)
          }
        }
      }
      continue
    }
    if (kw.type !== 'etb_trigger') continue
    if (kw.effect === 'draw_cards') {
      const count = kw.value ?? 1
      const ps = s.players[pid]
      const drawn = ps.library.slice(0, count)
      s = log({
        ...s,
        players: {
          ...s.players,
          [pid]: { ...ps, hand: [...ps.hand, ...drawn], library: ps.library.slice(count) },
        },
      }, `${card.name} ETB → カードを${count}枚引いた`)
    }
    if (kw.effect === 'gain_life') {
      const amount = kw.value ?? 1
      const ps = s.players[pid]
      s = log(
        { ...s, players: { ...s.players, [pid]: { ...ps, life: ps.life + amount } } },
        `${card.name} ETB → ライフを${amount}点得た`
      )
      s = applyLifeGainTriggers(s, pid, cardData)
    }
    // カードを引いてから1枚捨てる（氷嵐の精霊など）
    if (kw.effect === 'draw_then_discard') {
      const count = kw.value ?? 1
      const ps = s.players[pid]
      const drawn = ps.library.slice(0, count)
      s = { ...s, players: { ...s.players, [pid]: { ...ps, hand: [...ps.hand, ...drawn], library: ps.library.slice(count) } } }
      s = log(s, `${card.name} ETB → カードを${count}枚引いた`)
      s = { ...s, pending_discard: { pid, count: (s.pending_discard?.count || 0) + count } }
    }
    // 各対戦相手がライフを失い、自分がライフを得る（吸血鬼の落とし子など）
    if (kw.effect === 'drain_each_opp') {
      const dmg = kw.damage ?? 2
      const gain = kw.life ?? 2
      const opponents = Object.keys(s.players).filter(id => id !== pid)
      for (const oppId of opponents) {
        const oppPs = s.players[oppId]
        s = log(
          { ...s, players: { ...s.players, [oppId]: { ...oppPs, life: oppPs.life - dmg } } },
          `${card.name} ETB → 相手${dmg}点ライフ失う`
        )
      }
      const myPs = s.players[pid]
      s = log(
        { ...s, players: { ...s.players, [pid]: { ...myPs, life: myPs.life + gain } } },
        `${card.name} ETB → ライフを${gain}点得た`
      )
      s = applyLifeGainTriggers(s, pid, cardData)
    }
    if (kw.effect === 'grant_all_allies_keyword_eot') {
      const keyword = kw.keyword
      const newBf = s.players[pid].battlefield.map(p => ({
        ...p,
        temp_effects: [...(p.temp_effects || []), { grant_keywords: [keyword] }],
      }))
      s = log(
        { ...s, players: { ...s.players, [pid]: { ...s.players[pid], battlefield: newBf } } },
        `${card.name} ETB → 全クリーチャーがターン終了時まで${keyword}を得た`
      )
    }
    if (kw.effect === 'minus_all_opp_creatures_eot') {
      const pw = kw.power ?? 0
      const tg = kw.toughness ?? 0
      const opp = getOpponent(s, pid)
      const newOppBf = s.players[opp].battlefield.map(p => {
        const c = cardData[p.card_id] || {}
        if (c.card_type !== 'creature') return p
        return { ...p, temp_effects: [...(p.temp_effects || []), { power: pw, toughness: tg }] }
      }).filter(p => {
        const c = cardData[p.card_id] || {}
        if (c.card_type !== 'creature') return true
        const { toughness: effT } = getEffectivePT(p, c, s.players[opp].battlefield, cardData)
        return effT > 0
      })
      s = log(
        { ...s, players: { ...s.players, [opp]: { ...s.players[opp], battlefield: newOppBf } } },
        `${card.name} ETB → 相手クリーチャー全体に${pw}/${tg}修整`
      )
    }
    if (kw.effect === 'grant_haste_if_power_gte') {
      const threshold = kw.threshold ?? 8
      const totalPower = s.players[pid].battlefield.reduce((sum, p) => {
        const c = cardData[p.card_id] || {}
        if (c.card_type !== 'creature') return sum
        return sum + getEffectivePT(p, c, s.players[pid].battlefield, cardData).power
      }, 0)
      if (totalPower >= threshold) {
        const newBf = s.players[pid].battlefield.map(p => ({
          ...p,
          temp_effects: [...(p.temp_effects || []), { grant_keywords: ['haste'] }],
          summoning_sick: false,
        }))
        s = log(
          { ...s, players: { ...s.players, [pid]: { ...s.players[pid], battlefield: newBf } } },
          `${card.name} ETB → 全クリーチャーがターン終了時まで速攻を得た`
        )
      }
    }
    if (kw.effect === 'pending_bounce_opp_creature') {
      s = { ...s, pending_etb_bounce_opp: { pid, cardName: card.name } }
    }
    if (kw.effect === 'pending_return_hand_from_gy') {
      s = { ...s, pending_etb_return_hand: { pid, cardName: card.name, restriction: kw.restriction ?? 'any' } }
    }
  }

  // ally_etb_trigger: 他のクリーチャーが戦場に出たとき誘発する能力（内陸の聖別者など）
  // 新しいクリーチャーは常に battlefield の末尾に追加されるため、それ以外を対象とする
  const isCreature = card?.card_type === 'creature'
  if (isCreature) {
    const bf = s.players[pid].battlefield
    const newPermIid = bf.length > 0 ? bf[bf.length - 1].instance_id : null
    for (const perm of bf) {
      if (perm.instance_id === newPermIid) continue // 今入ったクリーチャー自身はスキップ
      const permCard = cardData[perm.card_id] || {}
      for (const kw of (permCard.keywords || [])) {
        if (kw.type !== 'ally_etb_trigger') continue
        if (kw.condition === 'other_creature') {
          if (kw.effect === 'gain_life') {
            const amount = kw.value ?? 1
            const myPs = s.players[pid]
            s = log(
              { ...s, players: { ...s.players, [pid]: { ...myPs, life: myPs.life + amount } } },
              `${permCard.name} 誘発 → ライフを${amount}点得た`
            )
            s = applyLifeGainTriggers(s, pid, cardData)
          }
        }
      }
    }
  }
  return s
}

// ETB 追放効果の解決（束縛の祈り手など）
export function resolveEtbExile(state, pid, targetInstanceId, cardData) {
  const opp = getOpponent(state, pid)
  const oppPs = state.players[opp]
  const target = oppPs.battlefield.find(p => p.instance_id === targetInstanceId)
  if (!target) return state

  const newOppBf = oppPs.battlefield.filter(p => p.instance_id !== targetInstanceId)
  const newOppExile = [...(oppPs.exile || []), target.card_id]
  let s = log(
    { ...state, pending_etb_exile: null, players: { ...state.players, [opp]: { ...oppPs, battlefield: newOppBf, exile: newOppExile } } },
    `${state.pending_etb_exile?.cardName || '呪文'} ETB → ${(cardData[target.card_id] || {}).name || 'パーマネント'} を追放した`
  )

  const gain = state.pending_etb_exile?.gain ?? 0
  if (gain > 0) {
    const myPs = s.players[pid]
    s = log(
      { ...s, players: { ...s.players, [pid]: { ...myPs, life: myPs.life + gain } } },
      `${state.pending_etb_exile?.cardName || '呪文'} → ライフを${gain}点得た`
    )
    s = applyLifeGainTriggers(s, pid, cardData)
  }
  return s
}

// ETB バウンス（相手クリーチャーを手札に戻す）
export function resolveEtbBounce(state, pid, targetInstanceId, cardData) {
  const opp = getOpponent(state, pid)
  const oppPs = state.players[opp]
  const target = oppPs.battlefield.find(p => p.instance_id === targetInstanceId)
  if (!target) return state
  const targetCard = cardData[target.card_id] || {}
  const newOppBf = oppPs.battlefield.filter(p => p.instance_id !== targetInstanceId)
  const newOppHand = [...oppPs.hand, target.card_id]
  return log(
    { ...state, pending_etb_bounce_opp: null, players: { ...state.players, [opp]: { ...oppPs, battlefield: newOppBf, hand: newOppHand } } },
    `${state.pending_etb_bounce_opp?.cardName} ETB → ${targetCard.name || 'クリーチャー'} を手札に戻した`
  )
}

// ETB 墓地から手札へ（エルフの再生家、吸血鬼の魂呼びなど）
export function resolveEtbReturnHand(state, pid, cardId, cardData) {
  const ps = state.players[pid]
  if (!ps.graveyard.includes(cardId)) return state
  const returnCard = cardData[cardId] || {}
  const newGy = ps.graveyard.filter(id => id !== cardId)
  const newHand = [...ps.hand, cardId]
  return log(
    { ...state, pending_etb_return_hand: null, players: { ...state.players, [pid]: { ...ps, graveyard: newGy, hand: newHand } } },
    `${state.pending_etb_return_hand?.cardName} ETB → ${returnCard.name || 'カード'} を手札に戻した`
  )
}

// 強襲ETB: ライブラリートップN枚確認 → 1枚をトップに残し残りを墓地へ
export function resolveRaidLook(state, pid, keepCardId, cardData) {
  const prl = state.pending_raid_look
  if (!prl || prl.pid !== pid) return state
  const ps = state.players[pid]
  const { cards } = prl
  const milled = cards.filter(id => id !== keepCardId)
  // library から最初のN枚を取り除き、keep をトップに戻す
  const newLibrary = [keepCardId, ...ps.library.slice(cards.length)]
  const newGy = [...ps.graveyard, ...milled]
  return log({
    ...state,
    pending_raid_look: null,
    players: { ...state.players, [pid]: { ...ps, library: newLibrary, graveyard: newGy } },
  }, `ライブラリートップを確認 → ${cardData[keepCardId]?.name ?? keepCardId} を残し${milled.length}枚を墓地へ`)
}

// 墓地回収スペル：カードを1枚ずつ選択して手札に戻す
export function resolveReturnFromGy(state, pid, cardId, cardData) {
  const prfg = state.pending_return_from_gy
  if (!prfg || prfg.pid !== pid) return state
  const ps = state.players[pid]
  if (!ps.graveyard.includes(cardId)) return state
  const returnCard = cardData[cardId] || {}
  const newGy = ps.graveyard.filter(id => id !== cardId)
  const newHand = [...ps.hand, cardId]
  const remaining = prfg.remaining - 1
  let s = log({
    ...state,
    players: { ...state.players, [pid]: { ...ps, graveyard: newGy, hand: newHand } },
    pending_return_from_gy: remaining > 0 ? { ...prfg, remaining } : null,
  }, `${returnCard.name || 'カード'} を墓地から手札に戻した`)
  // 選択完了または残り0枚になったら捨てフェーズへ
  if (remaining <= 0 && prfg.then_discard > 0) {
    s = { ...s, pending_discard: { pid, count: prfg.then_discard } }
  }
  return s
}

// 墓地回収スペル：選択を早期終了（対象なし or スキップ）
export function finishReturnFromGy(state, pid) {
  const prfg = state.pending_return_from_gy
  if (!prfg || prfg.pid !== pid) return state
  let s = { ...state, pending_return_from_gy: null }
  if (prfg.then_discard > 0) {
    s = { ...s, pending_discard: { pid, count: prfg.then_discard } }
  }
  return s
}

// ライフを得たとき誘発する能力を処理する
function applyLifeGainTriggers(state, gainerId, cardData) {
  let s = state
  for (const perm of s.players[gainerId].battlefield) {
    const card = cardData[perm.card_id] || {}
    for (const kw of (card.keywords || [])) {
      if (kw.type !== 'gain_life_trigger') continue
      if (kw.effect === 'counter_p1p1') {
        const count = kw.value ?? 1
        const newBf = s.players[gainerId].battlefield.map(p =>
          p.instance_id === perm.instance_id
            ? { ...p, counters: { ...(p.counters || {}), p1p1: ((p.counters?.p1p1) ?? 0) + count } }
            : p
        )
        s = log(
          { ...s, players: { ...s.players, [gainerId]: { ...s.players[gainerId], battlefield: newBf } } },
          `${card.name} 誘発 → +1/+1カウンターを${count}個置いた`
        )
        // カウンターが置かれたとき誘発する能力をチェック
        s = applyOnCounterTriggers(s, gainerId, perm.instance_id, card, cardData)
      }
    }
  }
  return s
}

// カウンターが置かれたとき誘発する能力を処理する
function applyOnCounterTriggers(state, pid, permInstanceId, card, cardData) {
  let s = state
  for (const kw of (card.keywords || [])) {
    if (kw.type !== 'on_counter_trigger') continue
    if (kw.effect === 'draw_cards') {
      const count = kw.value ?? 1
      const ps = s.players[pid]
      const drawn = ps.library.slice(0, count)
      s = log({
        ...s,
        players: { ...s.players, [pid]: { ...ps, hand: [...ps.hand, ...drawn], library: ps.library.slice(count) } },
      }, `${card.name} 誘発 → カードを${count}枚引いた`)
    }
  }
  return s
}

// 土地が戦場に出たとき誘発する上陸能力を処理する
function applyLandfallTriggers(state, pid, cardData) {
  let s = state
  const opponents = Object.keys(s.players).filter(id => id !== pid)

  for (const perm of s.players[pid].battlefield) {
    const card = cardData[perm.card_id] || {}
    for (const kw of (card.keywords || [])) {
      if (kw.type !== 'landfall_trigger') continue
      if (kw.effect === 'deal_each_opp') {
        const dmg = kw.value || 1
        for (const oppId of opponents) {
          const oppPs = s.players[oppId]
          s = log(
            { ...s, players: { ...s.players, [oppId]: { ...oppPs, life: oppPs.life - dmg } } },
            `${card.name} 上陸誘発 → 相手に${dmg}点ダメージ`
          )
        }
      }
    }
  }
  return s
}

// 呪文を唱えたとき誘発する能力を処理する
function applyOnCastTriggers(state, castingPid, castCard, cardData) {
  let s = state
  const ps = s.players[castingPid]
  const opponents = Object.keys(s.players).filter(id => id !== castingPid)

  for (const perm of ps.battlefield) {
    const permCard = cardData[perm.card_id] || {}
    for (const kw of (permCard.keywords || [])) {
      if (kw.type !== 'on_cast_trigger') continue

      let conditionMet = false
      if (kw.condition === 'noncreature_or_dragon') {
        const isNonCreature = castCard.card_type !== 'creature'
        const isDragon = (castCard.keywords || []).some(k => k.type === 'subtype_dragon')
        conditionMet = isNonCreature || isDragon
      }
      if (kw.condition === 'chosen_color_spell') {
        conditionMet = perm.chosen_color != null && castCard.color === perm.chosen_color
      }
      if (!conditionMet) continue

      if (kw.effect === 'deal_each_opp') {
        const dmg = kw.value || 1
        for (const oppId of opponents) {
          const oppPs = s.players[oppId]
          s = log(
            { ...s, players: { ...s.players, [oppId]: { ...oppPs, life: oppPs.life - dmg } } },
            `${permCard.name} 誘発 → 相手に${dmg}点ダメージ`
          )
        }
      }
      if (kw.effect === 'gain_life') {
        const amount = kw.value || 1
        const myPs2 = s.players[castingPid]
        s = log(
          { ...s, players: { ...s.players, [castingPid]: { ...myPs2, life: myPs2.life + amount } } },
          `${permCard.name} 誘発 → ライフを${amount}点得た`
        )
        s = applyLifeGainTriggers(s, castingPid, cardData)
      }
    }
  }
  return s
}

// ETBで選んだ色を永続に保存（金剛牝馬など）
export function setChosenColor(state, pid, instanceId, color) {
  const ps = state.players[pid]
  const newBf = ps.battlefield.map(p =>
    p.instance_id === instanceId ? { ...p, chosen_color: color } : p
  )
  const card = (ps.battlefield.find(p => p.instance_id === instanceId) || {})
  const cardName = card.card_id ? '金剛牝馬' : 'クリーチャー'
  return log(
    { ...state, players: { ...state.players, [pid]: { ...ps, battlefield: newBf } } },
    `${cardName} → ${color} を選んだ`
  )
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
    // オーラ：対象クリーチャーに attached_to をセット
    const isAura = card?.card_type === 'enchantment' && (card?.keywords || []).some(k => k.type === 'aura')
    if (isAura && top.target?.type === 'creature') {
      perm.attached_to = top.target.id
    }
    newState.players = {
      ...newState.players,
      [top.controller]: {
        ...ps,
        battlefield: [...ps.battlefield, perm],
      },
    }
    newState = log(newState, `${card?.name} が戦場に出た${top.kicked ? '（キッカー済）' : ''}${isAura && top.target ? '（エンチャント）' : ''}`)
    // ETB 誘発能力を処理
    newState = applyEtbTriggers(newState, top.controller, card, cardData)
  } else {
    // instant/sorcery: 呪文効果を適用
    for (const effect of (card?.keywords || [])) {
      if (SPELL_EFFECT_TYPES.includes(effect.type)) {
        newState = applySpellEffect(newState, top.controller, effect, top.target, top.kicked, cardData)
      }
    }
    // フラッシュバックなら追放、それ以外は墓地
    const ctrl = newState.players[top.controller]
    if (top.flashback) {
      newState.players = {
        ...newState.players,
        [top.controller]: { ...ctrl, exile: [...(ctrl.exile || []), top.card_id] },
      }
      newState = log(newState, `${card?.name} 解決 → 追放`)
    } else {
      newState.players = {
        ...newState.players,
        [top.controller]: { ...ctrl, graveyard: [...ctrl.graveyard, top.card_id] },
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
    return advancePhase({ ...state, priority_passed: [] }, cardData)
  }
  const next = order[(order.indexOf(pid) + 1) % order.length]
  return { ...state, priority: next, priority_passed: passed }
}

// フェーズ進行
export function advancePhase(state, cardData = {}) {
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
        has_attacked: false,
        mana_pool: { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 },
        battlefield: ps.battlefield.map(p => {
          // prevent_untap オーラが付いているクリーチャーはアンタップしない
          const hasPreventUntap = Object.values(state.players).some(anyPs =>
            anyPs.battlefield.some(aura =>
              aura.attached_to === p.instance_id &&
              (cardData[aura.card_id]?.keywords || []).some(k => k.type === 'prevent_untap')
            )
          )
          return { ...p, tapped: hasPreventUntap ? p.tapped : false, damage: 0, attacking: false, blocking: null, summoning_sick: false, unblockable_this_turn: false }
        }),
      },
    }
    // このターンの開始時ライフを記録（エンドステップ誘発の条件チェック用）
    s.life_at_turn_start = {}
    for (const [p, pState] of Object.entries(state.players)) {
      s.life_at_turn_start[p] = pState.life
    }
    s = log(s, `ターン ${s.turn_number}: ${nextAP} のターン`)
  } else if (next === 'end_step') {
    const ap = state.active_player
    s.priority = ap
    const apPs = s.players[ap]
    const opp = getOpponent(state, ap)
    const oppCurrentLife = s.players[opp].life
    const oppStartLife = (s.life_at_turn_start || {})[opp] ?? oppCurrentLife
    const oppLostLife = oppCurrentLife < oppStartLife
    // エンドステップ誘発チェック
    for (const perm of apPs.battlefield) {
      const permCard = cardData[perm.card_id] || {}
      for (const kw of (permCard.keywords || [])) {
        if (kw.type !== 'end_step_trigger') continue
        if (kw.condition === 'opp_lost_life' && !oppLostLife) continue
        if (kw.effect === 'counter_on_vampire') {
          const vampires = apPs.battlefield.filter(v =>
            (cardData[v.card_id]?.keywords || []).some(vk => vk.type === 'subtype_vampire')
          )
          if (vampires.length === 0) continue
          const counter = kw.counter || { p: 1, t: 1 }
          if (vampires.length === 1) {
            const target = vampires[0]
            const targetCard = cardData[target.card_id] || {}
            s = log({
              ...s,
              players: {
                ...s.players,
                [ap]: {
                  ...apPs,
                  battlefield: apPs.battlefield.map(v =>
                    v.instance_id === target.instance_id
                      ? { ...v, power: (v.power ?? targetCard.power ?? 0) + counter.p, toughness: (v.toughness ?? targetCard.toughness ?? 0) + counter.t }
                      : v
                  ),
                },
              },
            }, `${permCard.name} 誘発 → ${targetCard.name} に+${counter.p}/+${counter.t}カウンター`)
          } else {
            s = { ...s, pending_vampire_counter: { pid: ap, counter, triggerName: permCard.name } }
          }
        }
      }
    }
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
        battlefield: ps.battlefield.map(p => ({ ...p, damage: 0, temp_effects: [] })),
      },
    }
  } else {
    s.priority = state.active_player
  }
  return s
}

// 手札整理後にクリーンアップ本体を実行（GamePlayPage から呼ぶ）
export function finishCleanup(state, cardData = {}) {
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
        battlefield: ps.battlefield.map(p => ({ ...p, damage: 0, temp_effects: [] })),
      },
    },
  }
  // クリーンアップ完了後は自動的に次のターン（アンタップ）へ進む
  return advancePhase(cleaned, cardData)
}

// 攻撃宣言（防衛クリーチャーを除外）
// 攻撃誘発能力を処理（攻撃クリーチャー指定直後に発火）
function applyAttackTriggers(state, attackingPid, attackerIids, cardData) {
  let s = state
  const opp = getOpponent(s, attackingPid)
  const apBf = s.players[attackingPid].battlefield

  for (const iid of attackerIids) {
    const perm = apBf.find(p => p.instance_id === iid)
    if (!perm) continue
    const card = cardData[perm.card_id] || {}

    for (const kw of (card.keywords || [])) {
      if (kw.type !== 'attack_trigger') continue

      if (kw.effect === 'deal_each_opp') {
        const dmg = kw.value ?? 1
        const opponents = Object.keys(s.players).filter(id => id !== attackingPid)
        for (const oppId of opponents) {
          const oppPs = s.players[oppId]
          s = log(
            { ...s, players: { ...s.players, [oppId]: { ...oppPs, life: oppPs.life - dmg } } },
            `${card.name} 攻撃誘発 → 相手に${dmg}点ダメージ`
          )
        }
      }
      if (kw.effect === 'drain_each_opp') {
        const dmg = kw.value ?? 1
        const opponents = Object.keys(s.players).filter(id => id !== attackingPid)
        for (const oppId of opponents) {
          const oppPs = s.players[oppId]
          s = log(
            { ...s, players: { ...s.players, [oppId]: { ...oppPs, life: oppPs.life - dmg } } },
            `${card.name} 攻撃誘発 → 相手${dmg}点ライフ失う`
          )
        }
        const myPs = s.players[attackingPid]
        s = log(
          { ...s, players: { ...s.players, [attackingPid]: { ...myPs, life: myPs.life + dmg } } },
          `${card.name} 攻撃誘発 → ライフを${dmg}点得た`
        )
        s = applyLifeGainTriggers(s, attackingPid, cardData)
      }
      if (kw.effect === 'gain_life') {
        const amount = kw.value ?? 2
        const myPs = s.players[attackingPid]
        s = log(
          { ...s, players: { ...s.players, [attackingPid]: { ...myPs, life: myPs.life + amount } } },
          `${card.name} 攻撃誘発 → ライフを${amount}点得た`
        )
        s = applyLifeGainTriggers(s, attackingPid, cardData)
      }

      // 任意生け贄 → カードを引く ＋ ブロックされない（吸血鬼の大食家など）
      if (kw.effect === 'optional_sacrifice_draw_unblockable') {
        s = { ...s, pending_attack_sacrifice: { pid: attackingPid, attackerInstanceId: iid, cardName: card.name } }
      }

      if (kw.effect === 'drakuseth_damage') {
        const primaryDmg   = kw.primary_dmg   ?? 4
        const secondaryDmg = kw.secondary_dmg ?? 3
        const secondaryMax = kw.secondary_count ?? 2

        // 1) 相手プレイヤーに primary_dmg
        const oppPs0 = s.players[opp]
        s = log(
          { ...s, players: { ...s.players, [opp]: { ...oppPs0, life: oppPs0.life - primaryDmg } } },
          `${card.name} 攻撃誘発 → 相手プレイヤーに${primaryDmg}点ダメージ`
        )

        // 2) 相手クリーチャー最大 secondaryMax 体に secondary_dmg（タフネス降順で選択）
        const oppCreatures = s.players[opp].battlefield
          .filter(p => (cardData[p.card_id] || {}).card_type === 'creature')
          .sort((a, b) => {
            const ta = getEffectivePT(a, cardData[a.card_id] || {}, s.players[opp].battlefield, cardData).toughness
            const tb = getEffectivePT(b, cardData[b.card_id] || {}, s.players[opp].battlefield, cardData).toughness
            return tb - ta
          })
          .slice(0, secondaryMax)

        for (const target of oppCreatures) {
          s = _damageCreature(s, target.instance_id, secondaryDmg, cardData)
        }
        if (oppCreatures.length > 0) {
          s = log(s, `${card.name} 攻撃誘発 → 相手クリーチャー${oppCreatures.length}体に${secondaryDmg}点ダメージ`)
        }
      }
    }
  }

  // ally_attack_trigger: 攻撃側の全クリーチャーを参照して発動（リンデンなど）
  for (const perm of s.players[attackingPid].battlefield) {
    const card = cardData[perm.card_id] || {}
    for (const kw of (card.keywords || [])) {
      if (kw.type !== 'ally_attack_trigger') continue
      // 条件に合う攻撃クリーチャー数をカウント
      let count = 0
      for (const iid of attackerIids) {
        const attPerm = s.players[attackingPid].battlefield.find(p => p.instance_id === iid)
        if (!attPerm) continue
        const attCard = cardData[attPerm.card_id] || {}
        if (kw.condition === 'white_creature' && attCard.color === 'white') count++
      }
      if (count === 0) continue
      if (kw.effect === 'gain_life') {
        const amount = (kw.value ?? 1) * count
        const myPs = s.players[attackingPid]
        s = log(
          { ...s, players: { ...s.players, [attackingPid]: { ...myPs, life: myPs.life + amount } } },
          `${card.name} 攻撃誘発 → ライフを${amount}点得た`
        )
        s = applyLifeGainTriggers(s, attackingPid, cardData)
      }
    }
  }
  return s
}

export function declareAttackers(state, pid, attackerIids, cardData) {
  if (state.phase !== 'declare_attackers' || state.active_player !== pid) return state
  const ps = state.players[pid]
  // defender・prevent_combat 持ちは攻撃不可
  const validIids = attackerIids.filter(iid => {
    const perm = ps.battlefield.find(p => p.instance_id === iid)
    if (!perm) return false
    const card = cardData[perm.card_id] || {}
    if ((card.keywords || []).some(k => k.type === 'defender')) return false
    if (hasPacifism(perm, ps.battlefield, cardData)) return false
    return true
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
    players: { ...state.players, [pid]: { ...ps, battlefield: newBf, has_attacked: validIids.length > 0 } },
    priority_passed: [],
    priority: pid,
  }, `${validIids.length} 体で攻撃`)

  // 攻撃誘発能力を処理（ドラクセスなど）
  next = applyAttackTriggers(next, pid, validIids, cardData)

  if (validIids.length === 0) {
    // 攻撃者0体のとき戦闘フェーズ全体をスキップしてメイン2へ
    while (next.phase !== 'main2') next = advancePhase(next)
  } else {
    // 攻撃者ありのときはブロック宣言フェーズへ進む
    next = advancePhase(next)
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
    const attKw   = getEffectiveKeywords(attPerm, attCard, apBf, cardData)
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
        const blkKw   = getEffectiveKeywords(blk, blkCard, dpBf, cardData)
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
  let result = log(s, `${label}: ${apDead.length + dpDead.length} 体が破壊された`)
  // ライフリンクによるライフ獲得でトリガー発火
  const lifelinkGained = apLife - aps.life
  if (lifelinkGained > 0) result = applyLifeGainTriggers(result, ap, cardData)
  // 吸血鬼死亡誘発
  if (apDead.length > 0) result = checkVampireDeathTriggers(result, ap, apDead, cardData)
  if (dpDead.length > 0) result = checkVampireDeathTriggers(result, def, dpDead, cardData)
  return result
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

// 即時捨て（draw_then_discard 解決時など）
export function resolvePendingDiscard(state, pid, cardId) {
  const pd = state.pending_discard
  if (!pd || pd.pid !== pid || pd.count <= 0) return state
  const ps = state.players[pid]
  if (!(ps.hand || []).includes(cardId)) return state
  const newHand = removeOne(ps.hand, cardId)
  const remaining = pd.count - 1
  return log({
    ...state,
    pending_discard: remaining > 0 ? { pid, count: remaining } : null,
    players: { ...state.players, [pid]: { ...ps, hand: newHand, graveyard: [...ps.graveyard, cardId] } },
  }, `カードを1枚捨てた`)
}

// 状況起因処理（ライフ0チェック等）
export function checkStateBasedActions(state) {
  return state
}

// prevent_combat オーラが付いているか（平和な心など）
function hasPacifism(perm, battlefield, cardData) {
  return battlefield.some(a => {
    if (a.attached_to !== perm.instance_id) return false
    const ac = cardData[a.card_id] || {}
    return (ac.keywords || []).some(k => k.type === 'prevent_combat')
  })
}

// 装備品・オーラの有効P/T計算（同一プレイヤーの戦場を参照）
export function getEffectivePT(perm, card, battlefield, cardData) {
  let power = perm.power ?? card?.power ?? 0
  let toughness = perm.toughness ?? card?.toughness ?? 1

  // pt_equals_count：P/T をコントロールするクリーチャー数に置き換え
  const ptCount = (card?.keywords || []).find(k => k.type === 'pt_equals_count')
  if (ptCount?.effect === 'creatures_controlled') {
    const count = battlefield.filter(p => {
      const c = cardData[p.card_id] || {}
      return c.card_type === 'creature'
    }).length
    power = count
    toughness = count
  }

  // power_per_count：特定の土地枚数分パワーが上がる（大嵐のジンなど）
  const pwCount = (card?.keywords || []).find(k => k.type === 'power_per_count')
  if (pwCount?.effect === 'basic_island_count') {
    const count = battlefield.filter(p => {
      const c = cardData[p.card_id] || {}
      return c.card_type === 'land' && c.color === 'blue'
    }).length
    power += count
  }

  // +1/+1 カウンター
  const p1p1 = perm.counters?.p1p1 ?? 0
  power += p1p1
  toughness += p1p1
  for (const attached of battlefield) {
    if (attached.attached_to !== perm.instance_id) continue
    const aCard = cardData[attached.card_id] || {}
    // 装備品
    const eqKw = (aCard.keywords || []).find(k => k.type === 'equip')
    if (eqKw) {
      power += eqKw.power_bonus ?? 0
      toughness += eqKw.toughness_bonus ?? 0
    }
    // オーラ（pump_per_count）
    const pumpKw = (aCard.keywords || []).find(k => k.type === 'pump_per_count')
    if (pumpKw) {
      let count = 0
      if (pumpKw.effect === 'forest_count') {
        count = battlefield.filter(p => {
          const c = cardData[p.card_id] || {}
          return c.card_type === 'land' && c.color === 'green'
        }).length
      }
      power += (pumpKw.power ?? 0) * count
      toughness += (pumpKw.toughness ?? 0) * count
    }
  }
  // lord_effect: 他の味方クリーチャーへのP/T修整
  const myCard = card
  const mySubtypes = (myCard?.keywords || []).filter(k => k.type.startsWith('subtype_')).map(k => k.type)
  for (const ally of battlefield) {
    if (ally.instance_id === perm.instance_id) continue
    const allyCard = cardData[ally.card_id] || {}
    for (const kw of (allyCard.keywords || [])) {
      if (kw.type !== 'lord_effect') continue
      const targetSubtype = 'subtype_' + kw.subtype
      if (mySubtypes.includes(targetSubtype)) {
        power += kw.power_bonus ?? 0
        toughness += kw.toughness_bonus ?? 0
      }
    }
  }
  for (const te of (perm.temp_effects || [])) {
    power += te.power ?? 0
    toughness += te.toughness ?? 0
  }
  return { power, toughness }
}

// クリーチャーの実効キーワード一覧（条件付きキーワード・装備・temp_effects を含む）
export function getEffectiveKeywords(perm, card, alliedBattlefield, cardData) {
  const base = (card.keywords || []).map(k => k.type)

  // conditional_keyword: 戦場の状態に応じてキーワードを付与
  for (const kw of (card.keywords || [])) {
    if (kw.type !== 'conditional_keyword') continue
    if (kw.condition === 'controls_dragon') {
      const hasDragon = alliedBattlefield.some(p => {
        const c = cardData[p.card_id] || {}
        return (c.keywords || []).some(k => k.type === 'subtype_dragon')
      })
      if (hasDragon) base.push(kw.grant)
    }
    if (kw.condition === 'self_attacking' && perm.attacking) {
      base.push(kw.grant)
    }
  }

  // lord_effect: 他の味方クリーチャーへのキーワード付与
  const mySubtypes2 = (card.keywords || []).filter(k => k.type.startsWith('subtype_')).map(k => k.type)
  for (const ally of alliedBattlefield) {
    if (ally.instance_id === perm.instance_id) continue
    const allyCard = cardData[ally.card_id] || {}
    for (const kw of (allyCard.keywords || [])) {
      if (kw.type !== 'lord_effect') continue
      const targetSubtype = 'subtype_' + kw.subtype
      if (!mySubtypes2.includes(targetSubtype)) continue
      if (kw.condition === 'attacking' && !perm.attacking) continue
      if (kw.grant_keywords) base.push(...kw.grant_keywords)
    }
  }

  // temp_effects で付与されたキーワード
  for (const te of (perm.temp_effects || [])) {
    if (te.grant_keywords) base.push(...te.grant_keywords)
  }

  return base
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

// 攻撃誘発：任意生け贄 → ドロー ＋ ブロックされない
export function resolveAttackSacrifice(state, pid, sacrificeInstanceId, cardData) {
  const pas = state.pending_attack_sacrifice
  if (!pas || pas.pid !== pid) return state
  const ps = state.players[pid]
  const sacPerm = ps.battlefield.find(p => p.instance_id === sacrificeInstanceId)
  if (!sacPerm || sacrificeInstanceId === pas.attackerInstanceId) return state
  // 生け贄
  const newBf = ps.battlefield.map(p =>
    p.instance_id === pas.attackerInstanceId ? { ...p, unblockable_this_turn: true } : p
  ).filter(p => p.instance_id !== sacrificeInstanceId)
  const newGy = [...ps.graveyard, sacPerm.card_id]
  // カードを1枚引く
  const drawn = ps.library.slice(0, 1)
  const newLib = ps.library.slice(1)
  let s = log({
    ...state,
    pending_attack_sacrifice: null,
    players: { ...state.players, [pid]: { ...ps, battlefield: newBf, graveyard: newGy, hand: [...ps.hand, ...drawn], library: newLib } },
  }, `${pas.cardName} 攻撃誘発 → ${cardData[sacPerm.card_id]?.name} を生け贄、カード1枚引き、ブロックされない`)
  s = checkVampireDeathTriggers(s, pid, [sacPerm.card_id], cardData)
  return s
}

export function declineAttackSacrifice(state, pid) {
  if (!state.pending_attack_sacrifice || state.pending_attack_sacrifice.pid !== pid) return state
  return { ...state, pending_attack_sacrifice: null }
}

// エンドステップ誘発：吸血鬼にカウンターを乗せる（複数いる場合のみ選択）
export function resolveVampireCounter(state, pid, instanceId, cardData) {
  const pvc = state.pending_vampire_counter
  if (!pvc || pvc.pid !== pid) return state
  const ps = state.players[pid]
  const perm = ps.battlefield.find(p => p.instance_id === instanceId)
  if (!perm) return state
  const permCard = cardData[perm.card_id] || {}
  const counter = pvc.counter
  return log({
    ...state,
    pending_vampire_counter: null,
    players: {
      ...state.players,
      [pid]: {
        ...ps,
        battlefield: ps.battlefield.map(p =>
          p.instance_id === instanceId
            ? { ...p, power: (p.power ?? permCard.power ?? 0) + counter.p, toughness: (p.toughness ?? permCard.toughness ?? 0) + counter.t }
            : p
        ),
      },
    },
  }, `${pvc.triggerName} 誘発 → ${permCard.name} に+${counter.p}/+${counter.t}カウンター`)
}

// 吸血鬼死亡誘発：2点ライフ支払い→カード1枚引き
export function resolveVampireDeathPay(state, pid, cardData) {
  const pvdp = state.pending_vampire_death_pay
  if (!pvdp || pvdp.pid !== pid) return state
  const ps = state.players[pid]
  const lifeCost = pvdp.life_cost ?? 2
  const drawCount = pvdp.draw ?? 1
  if (ps.life <= lifeCost) return log(state, 'ライフが不足しているため支払えない')
  const remaining = pvdp.count - 1
  const drawn = ps.library.slice(0, drawCount)
  return log({
    ...state,
    pending_vampire_death_pay: remaining > 0 ? { ...pvdp, count: remaining } : null,
    players: {
      ...state.players,
      [pid]: { ...ps, life: ps.life - lifeCost, hand: [...ps.hand, ...drawn], library: ps.library.slice(drawCount) },
    },
  }, `吸血鬼死亡誘発 → ${lifeCost}点ライフ支払い、カード${drawCount}枚引き`)
}

export function declineVampireDeathPay(state, pid) {
  const pvdp = state.pending_vampire_death_pay
  if (!pvdp || pvdp.pid !== pid) return state
  const remaining = pvdp.count - 1
  return log({ ...state, pending_vampire_death_pay: remaining > 0 ? { ...pvdp, count: remaining } : null }, '吸血鬼死亡誘発 → スキップ')
}

// 吸血鬼死亡誘発：マナ支払い → ドレイン（カラストリアの貴人）
export function resolveVampireDrain(state, pid) {
  const pvd = state.pending_vampire_drain
  if (!pvd || pvd.pid !== pid) return state
  const ps = state.players[pid]
  const cost = pvd.cost ?? '{B}'
  if (!hasMana(ps.mana_pool, cost)) return log(state, 'マナが不足しているため支払えない')
  const newPool = spendMana(ps.mana_pool, cost)
  const opp = getOpponent(state, pid)
  const oppPs = state.players[opp]
  const remaining = pvd.count - 1
  return log({
    ...state,
    pending_vampire_drain: remaining > 0 ? { ...pvd, count: remaining } : null,
    players: {
      ...state.players,
      [pid]: { ...ps, mana_pool: newPool, life: ps.life + (pvd.gain ?? 2) },
      [opp]: { ...oppPs, life: oppPs.life - (pvd.damage ?? 2) },
    },
  }, `吸血鬼死亡誘発 → 対戦相手${pvd.damage ?? 2}点ロス、${pvd.gain ?? 2}点ライフ獲得`)
}

export function declineVampireDrain(state, pid) {
  const pvd = state.pending_vampire_drain
  if (!pvd || pvd.pid !== pid) return state
  const remaining = pvd.count - 1
  return log({ ...state, pending_vampire_drain: remaining > 0 ? { ...pvd, count: remaining } : null }, '吸血鬼死亡誘発 → スキップ')
}

export function hasAdditionalCost(card) {
  return (card?.keywords || []).some(k => k.type === 'additional_cost')
}

// 追加コスト付きキャスト（踊り食いなど）
// 生け贄パス：自クリーチャーを生け贄 + 対象を追放
export function castSpellSacrificeAndExile(state, pid, cardId, card, sacrificeInstanceId, exileTarget, cardData) {
  if (!canPlaySorcerySpeed(state, pid)) return state
  const ps = state.players[pid]
  if (!hasMana(ps.mana_pool, card.mana_cost)) return state
  const sacrificePerm = ps.battlefield.find(p => p.instance_id === sacrificeInstanceId)
  if (!sacrificePerm) return state
  const newPool = spendMana(ps.mana_pool, card.mana_cost)
  const newBf = ps.battlefield.filter(p => p.instance_id !== sacrificeInstanceId)
  const newGy = [...ps.graveyard, sacrificePerm.card_id, cardId]
  let s = log({
    ...state,
    players: { ...state.players, [pid]: { ...ps, hand: removeOne(ps.hand, cardId), battlefield: newBf, graveyard: newGy, mana_pool: newPool } },
  }, `${card.name} 詠唱（生け贄コスト）`)
  if (exileTarget) {
    s = applySpellEffect(s, pid, { type: 'exile_creature' }, exileTarget, false, cardData)
  }
  return s
}

// 追加マナパス：{3}{B} 追加支払い + 対象を追放
export function castSpellPayExtraAndExile(state, pid, cardId, card, extraCost, exileTarget, cardData) {
  if (!canPlaySorcerySpeed(state, pid)) return state
  const ps = state.players[pid]
  const totalCost = card.mana_cost + extraCost // 文字列結合でまとめてチェック
  if (!hasMana(ps.mana_pool, card.mana_cost)) return state
  if (!hasMana(ps.mana_pool, extraCost)) return state
  let newPool = spendMana(ps.mana_pool, card.mana_cost)
  newPool = spendMana(newPool, extraCost)
  const newGy = [...ps.graveyard, cardId]
  let s = log({
    ...state,
    players: { ...state.players, [pid]: { ...ps, hand: removeOne(ps.hand, cardId), graveyard: newGy, mana_pool: newPool } },
  }, `${card.name} 詠唱（追加マナ支払い）`)
  if (exileTarget) {
    s = applySpellEffect(s, pid, { type: 'exile_creature' }, exileTarget, false, cardData)
  }
  return s
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

  const defBf = state.players[defId]?.battlefield || []
  const defenderPerms = defBf.filter(p => {
    const card = cardData[p.card_id] || {}
    if (card.card_type !== 'creature' || p.tapped || p.summoning_sick) return false
    if (hasPacifism(p, defBf, cardData)) return false
    if ((card.keywords || []).some(k => k.type === 'cant_block')) return false
    return true
  })

  const result = {}
  for (const att of attackerPerms) {
    const attCard = cardData[att.card_id] || {}
    const attKws = attCard.keywords || []
    const attKwTypes = getEffectiveKeywords(att, attCard, state.players[ap].battlefield, cardData)
    const attFlying = attKwTypes.includes('flying')
    // このターンブロックされない（吸血鬼の大食家など）
    if (att.unblockable_this_turn) { result[att.instance_id] = []; continue }
    // protection from X: attacker cannot be blocked by X-colored creatures
    const attProtection = attKws.find(k => k.type === 'protection')?.value ?? null

    result[att.instance_id] = defenderPerms
      .filter(blk => {
        const blkCard = cardData[blk.card_id] || {}
        const blkKwTypes = getEffectiveKeywords(blk, blkCard, state.players[defId].battlefield, cardData)
        if (attFlying && !blkKwTypes.includes('flying') && !blkKwTypes.includes('reach')) return false
        if (attProtection && blkCard.color === attProtection) return false
        return true
      })
      .map(p => p.instance_id)
  }
  return result
}

// ─── 呪文効果システム ─────────────────────────────────────────────

export const SPELL_EFFECT_TYPES = [
  'draw_cards', 'gain_life', 'deal_damage', 'deal_damage_all',
  'destroy_creature', 'destroy_permanent',
  'bounce_creature', 'bounce_permanent', 'bounce_all_attackers',
  'pump_creature', 'reanimate', 'counter_spell', 'draw_then_discard', 'exile_creature',
  'return_from_gy',
]

const TARGETED_EFFECTS = [
  'deal_damage', 'destroy_creature', 'destroy_permanent',
  'bounce_creature', 'bounce_permanent', 'pump_creature', 'reanimate', 'exile_creature',
]

export function spellNeedsTarget(card) {
  if ((card?.keywords || []).some(k => TARGETED_EFFECTS.includes(k.type))) return true
  if ((card?.keywords || []).some(k => k.type === 'counter_spell')) return true
  // オーラ（エンチャント呪文でクリーチャーを対象にとる）
  if (card?.card_type === 'enchantment' && (card?.keywords || []).some(k => k.type === 'aura')) return true
  return false
}

export function getSpellTargetingType(card) {
  for (const kw of (card?.keywords || [])) {
    if (kw.type === 'counter_spell') return 'opp_stack_spell'
    if (kw.type === 'exile_creature') return 'opp_creature'
    if (kw.type === 'deal_damage') return 'opp_creature_or_player'
    if (kw.type === 'destroy_creature') return 'opp_creature'
    if (kw.type === 'destroy_permanent') return 'any_permanent'
    if (kw.type === 'bounce_creature') return 'opp_creature'
    if (kw.type === 'bounce_permanent') return 'any_permanent'
    if (kw.type === 'pump_creature') return (kw.power ?? 0) < 0 ? 'opp_creature' : 'own_creature'
    if (kw.type === 'reanimate') return 'own_graveyard_creature'
    if (kw.type === 'aura' && kw.enchant === 'creature') return 'own_creature'
    if (kw.type === 'aura' && kw.enchant === 'opp_creature') return 'opp_creature'
  }
  return null
}

// target: { type: 'player'|'creature'|'graveyard_card', id: string }
function applySpellEffect(state, controllerId, effect, target, kicked, cardData) {
  const opp = getOpponent(state, controllerId)

  switch (effect.type) {
    case 'draw_cards': {
      const count = (kicked && effect.kicked_value != null) ? effect.kicked_value : (effect.value || 1)
      const ps = state.players[controllerId]
      const drawn = ps.library.slice(0, count)
      return log({
        ...state,
        players: {
          ...state.players,
          [controllerId]: { ...ps, hand: [...ps.hand, ...drawn], library: ps.library.slice(count) },
        },
      }, `カードを${count}枚引いた`)
    }

    case 'gain_life': {
      const amount = effect.value || 0
      const ps = state.players[controllerId]
      const s = log({
        ...state,
        players: { ...state.players, [controllerId]: { ...ps, life: ps.life + amount } },
      }, `ライフを${amount}点得た`)
      return applyLifeGainTriggers(s, controllerId, cardData)
    }

    case 'deal_damage': {
      if (!target) return state
      const dmg = (kicked && effect.kicked_value != null) ? effect.kicked_value : (effect.value || 1)
      if (target.type === 'player') {
        const tPs = state.players[target.id]
        if (!tPs) return state
        return log({
          ...state,
          players: { ...state.players, [target.id]: { ...tPs, life: tPs.life - dmg } },
        }, `プレイヤーに${dmg}点のダメージ`)
      }
      if (target.type === 'creature') {
        return _damageCreature(state, target.id, dmg, cardData)
      }
      return state
    }

    case 'deal_damage_all': {
      const dmg = effect.value || 2
      let s = { ...state }
      // 相手プレイヤーへのダメージ
      const oppPs = s.players[opp]
      s = { ...s, players: { ...s.players, [opp]: { ...oppPs, life: oppPs.life - dmg } } }
      // 相手のクリーチャーへのダメージ
      const newOppPs = s.players[opp]
      const alive = []
      const dead = []
      for (const perm of newOppPs.battlefield) {
        const card = cardData[perm.card_id] || {}
        if (card.card_type !== 'creature') { alive.push(perm); continue }
        const kw = (card.keywords || []).map(k => k.type)
        if (kw.includes('indestructible')) { alive.push(perm); continue }
        const newDmg = perm.damage + dmg
        const { toughness } = getEffectivePT(perm, card, newOppPs.battlefield, cardData)
        if (newDmg >= toughness) { dead.push(perm.card_id) }
        else { alive.push({ ...perm, damage: newDmg }) }
      }
      return log({
        ...s,
        players: { ...s.players, [opp]: { ...newOppPs, battlefield: alive, graveyard: [...newOppPs.graveyard, ...dead] } },
      }, `全体に${dmg}点ダメージ（${dead.length}体破壊）`)
    }

    case 'destroy_creature': {
      if (!target || target.type !== 'creature') return state
      return _destroyPermanent(state, target.id, cardData, effect.restriction)
    }

    case 'destroy_permanent': {
      if (!target) return state
      return _destroyPermanent(state, target.id, cardData, effect.restriction)
    }

    case 'bounce_creature':
    case 'bounce_permanent': {
      if (!target) return state
      const tid = target.type === 'creature' || target.type === 'permanent' ? target.id : target.id
      return _bouncePermanent(state, tid, cardData)
    }

    case 'bounce_all_attackers': {
      const ap = state.active_player
      const apPs = state.players[ap]
      const attackers = apPs.battlefield.filter(p => p.attacking)
      if (attackers.length === 0) return log(state, '攻撃クリーチャーなし')
      const returnedIds = attackers.map(p => p.card_id)
      return log({
        ...state,
        combat: { attackers: [], blockers: {} },
        players: {
          ...state.players,
          [ap]: {
            ...apPs,
            battlefield: apPs.battlefield.filter(p => !p.attacking),
            hand: [...apPs.hand, ...returnedIds],
          },
        },
      }, `攻撃クリーチャー${attackers.length}体を手札に戻した`)
    }

    case 'pump_creature': {
      if (!target || target.type !== 'creature') return state
      const tid = target.id
      for (const [pid, ps] of Object.entries(state.players)) {
        const idx = ps.battlefield.findIndex(p => p.instance_id === tid)
        if (idx === -1) continue
        const perm = ps.battlefield[idx]
        const card = cardData[perm.card_id] || {}
        const te = {
          power: effect.power ?? 0,
          toughness: effect.toughness ?? 0,
          grant_keywords: effect.grant_keywords || [],
        }
        const grantsHaste = te.grant_keywords.includes('haste')
        const newBf = ps.battlefield.map((p, i) =>
          i === idx ? {
            ...p,
            temp_effects: [...(p.temp_effects || []), te],
            summoning_sick: grantsHaste ? false : p.summoning_sick,
          } : p
        )
        const sign = v => v >= 0 ? `+${v}` : `${v}`
        return log({
          ...state,
          players: { ...state.players, [pid]: { ...ps, battlefield: newBf } },
        }, `${card.name} は${sign(te.power)}/${sign(te.toughness)}の修整を受けた`)
      }
      return state
    }

    case 'exile_creature': {
      if (!target || target.type !== 'creature') return state
      for (const [tPid, tPs] of Object.entries(state.players)) {
        const perm = tPs.battlefield.find(p => p.instance_id === target.id)
        if (perm) {
          const newBf = tPs.battlefield.filter(p => p.instance_id !== target.id)
          return log({
            ...state,
            players: {
              ...state.players,
              [tPid]: { ...tPs, battlefield: newBf, exile: [...(tPs.exile || []), perm.card_id] },
            },
          }, `${cardData[perm.card_id]?.name ?? 'クリーチャー'} を追放した`)
        }
      }
      return state
    }

    case 'reanimate': {
      if (!target || target.type !== 'graveyard_card') return state
      const ps = state.players[controllerId]
      const cardId = target.id
      if (!ps.graveyard.includes(cardId)) return state
      const card = cardData[cardId] || {}
      if (card.card_type !== 'creature') return state
      const perm = mkPermanent(cardId, card)
      perm.summoning_sick = true
      return log({
        ...state,
        players: {
          ...state.players,
          [controllerId]: {
            ...ps,
            graveyard: removeOne(ps.graveyard, cardId),
            battlefield: [...ps.battlefield, perm],
          },
        },
      }, `${card.name} を墓地から戦場に戻した`)
    }

    case 'counter_spell': {
      // target: { type: 'stack_spell', id: stackEntryId }
      if (!target || target.type !== 'stack_spell') return state
      const entry = state.stack.find(e => e.id === target.id)
      if (!entry) return log(state, '対象の呪文がスタック上にない（立ち消え）')
      const unlessPay = effect.unless_pay ?? null
      const affectedPlayer = entry.controller
      const affectedPs = state.players[affectedPlayer]
      // unless_pay がなければ無条件カウンター
      if (!unlessPay || !hasMana(affectedPs.mana_pool, unlessPay)) {
        const entryCard = entry.card || cardData[entry.card_id] || {}
        const newStack = state.stack.filter(e => e.id !== entry.id)
        const newGy = [...affectedPs.graveyard, entry.card_id]
        return log({
          ...state,
          stack: newStack,
          players: { ...state.players, [affectedPlayer]: { ...affectedPs, graveyard: newGy } },
        }, `${entryCard.name} を打ち消した`)
      }
      // 支払いの選択を要求
      const entryCard = entry.card || cardData[entry.card_id] || {}
      return log({
        ...state,
        pending_counter_response: {
          stack_entry_id: entry.id,
          cost: unlessPay,
          affected_player: affectedPlayer,
          spell_name: entryCard.name,
        },
      }, `${entryCard.name} を対象に波の消去。${affectedPlayer} は${unlessPay}を支払うか選択`)
    }

    case 'draw_then_discard': {
      const count = effect.value ?? 1
      const ps = state.players[controllerId]
      const drawn = ps.library.slice(0, count)
      return log({
        ...state,
        players: { ...state.players, [controllerId]: { ...ps, hand: [...ps.hand, ...drawn], library: ps.library.slice(count) } },
        pending_discard: { pid: controllerId, count: (state.pending_discard?.count || 0) + count },
      }, `カードを${count}枚引き、その後${count}枚捨てる`)
    }

    case 'return_from_gy': {
      // 墓地から最大 count 枚をUIで選んで手札に戻す → その後 then_discard 枚捨てる
      return log({
        ...state,
        pending_return_from_gy: {
          pid: controllerId,
          remaining: effect.count ?? 1,
          restriction: effect.restriction ?? 'creature',
          then_discard: effect.then_discard ?? 0,
        },
      }, `墓地から最大${effect.count ?? 1}枚選んで手札に戻す`)
    }

    default:
      return state
  }
}

// カウンター呪文への応答（支払うか否か）
export function respondToCounter(state, pid, pay, cardData) {
  const pcr = state.pending_counter_response
  if (!pcr || pcr.affected_player !== pid) return state
  const ps = state.players[pid]
  if (pay) {
    if (!hasMana(ps.mana_pool, pcr.cost)) return state
    const newPool = spendMana(ps.mana_pool, pcr.cost)
    return log({
      ...state,
      pending_counter_response: null,
      players: { ...state.players, [pid]: { ...ps, mana_pool: newPool } },
    }, `${pcr.spell_name} → ${pcr.cost} を支払い打ち消しを回避`)
  } else {
    const entry = state.stack.find(e => e.id === pcr.stack_entry_id)
    let s = { ...state, pending_counter_response: null }
    if (entry) {
      const newStack = s.stack.filter(e => e.id !== pcr.stack_entry_id)
      const affectedPs = s.players[pid]
      const newGy = [...affectedPs.graveyard, entry.card_id]
      s = log({
        ...s,
        stack: newStack,
        players: { ...s.players, [pid]: { ...affectedPs, graveyard: newGy } },
      }, `${pcr.spell_name} を打ち消した（支払い拒否）`)
    }
    return s
  }
}

function _damageCreature(state, instanceId, dmg, cardData) {
  for (const [pid, ps] of Object.entries(state.players)) {
    const idx = ps.battlefield.findIndex(p => p.instance_id === instanceId)
    if (idx === -1) continue
    const perm = ps.battlefield[idx]
    const card = cardData[perm.card_id] || {}
    const kw = (card.keywords || []).map(k => k.type)
    if (kw.includes('indestructible')) return log(state, `${card.name} は破壊不能`)
    const newDmg = perm.damage + dmg
    const { toughness: effTough } = getEffectivePT(perm, card, ps.battlefield, cardData)
    let newBf = ps.battlefield.map((p, i) => i === idx ? { ...p, damage: newDmg } : p)
    let newGy = [...ps.graveyard]
    if (newDmg >= effTough) {
      newBf = newBf.filter(p => p.instance_id !== instanceId)
        .map(p => p.attached_to === instanceId ? { ...p, attached_to: null } : p)
      newGy = [...newGy, perm.card_id]
      return log({ ...state, players: { ...state.players, [pid]: { ...ps, battlefield: newBf, graveyard: newGy } } },
        `${card.name} に${dmg}点ダメージ → 破壊`)
    }
    return log({ ...state, players: { ...state.players, [pid]: { ...ps, battlefield: newBf } } },
      `${card.name} に${dmg}点ダメージ`)
  }
  return state
}

function checkVampireDeathTriggers(state, pid, deadCardIds, cardData) {
  if (!deadCardIds || deadCardIds.length === 0) return state
  const vampireDeaths = deadCardIds.filter(cid =>
    (cardData[cid]?.keywords || []).some(k => k.type === 'subtype_vampire')
  ).length
  if (vampireDeaths === 0) return state
  const ps = state.players[pid]
  // 生存中と死亡したカード両方からトリガーを探す（自己死亡にも対応）
  const allSourceCards = [
    ...ps.battlefield.map(p => cardData[p.card_id] || {}),
    ...deadCardIds.map(cid => cardData[cid] || {}),
  ]
  let s = state
  // pay_life_draw （交叉路の騒動屋）
  const lifeDrawKw = allSourceCards.flatMap(c => c.keywords || []).find(k =>
    k.type === 'death_trigger' && k.subtype === 'vampire' && k.effect === 'pay_life_draw'
  )
  if (lifeDrawKw) {
    const existing = s.pending_vampire_death_pay?.count || 0
    s = { ...s, pending_vampire_death_pay: { pid, count: existing + vampireDeaths, life_cost: lifeDrawKw.life_cost ?? 2, draw: lifeDrawKw.draw ?? 1 } }
  }
  // pay_mana_drain （カラストリアの貴人）
  const drainKw = allSourceCards.flatMap(c => c.keywords || []).find(k =>
    k.type === 'death_trigger' && k.subtype === 'vampire' && k.effect === 'pay_mana_drain'
  )
  if (drainKw) {
    const existing = s.pending_vampire_drain?.count || 0
    s = { ...s, pending_vampire_drain: { pid, count: existing + vampireDeaths, cost: drainKw.cost ?? '{B}', damage: drainKw.damage ?? 2, gain: drainKw.gain ?? 2 } }
  }
  return s
}

function _destroyPermanent(state, instanceId, cardData, restriction) {
  for (const [pid, ps] of Object.entries(state.players)) {
    const idx = ps.battlefield.findIndex(p => p.instance_id === instanceId)
    if (idx === -1) continue
    const perm = ps.battlefield[idx]
    const card = cardData[perm.card_id] || {}
    const kw = (card.keywords || []).map(k => k.type)
    if (kw.includes('indestructible')) return log(state, `${card.name} は破壊不能`)
    if (restriction === 'non_black' && card.color === 'black') return log(state, `${card.name} は黒のためターゲット不可`)
    const newBf = ps.battlefield.filter((p, i) => i !== idx)
      .map(p => p.attached_to === instanceId ? { ...p, attached_to: null } : p)
    let s = log({
      ...state,
      players: { ...state.players, [pid]: { ...ps, battlefield: newBf, graveyard: [...ps.graveyard, perm.card_id] } },
    }, `${card.name} を破壊した`)
    if (card.card_type === 'creature') s = checkVampireDeathTriggers(s, pid, [perm.card_id], cardData)
    return s
  }
  return state
}

function _bouncePermanent(state, instanceId, cardData) {
  for (const [pid, ps] of Object.entries(state.players)) {
    const idx = ps.battlefield.findIndex(p => p.instance_id === instanceId)
    if (idx === -1) continue
    const perm = ps.battlefield[idx]
    const card = cardData[perm.card_id] || {}
    const newBf = ps.battlefield.filter((p, i) => i !== idx)
      .map(p => p.attached_to === instanceId ? { ...p, attached_to: null } : p)
    return log({
      ...state,
      players: { ...state.players, [pid]: { ...ps, battlefield: newBf, hand: [...ps.hand, perm.card_id] } },
    }, `${card.name} を手札に戻した`)
  }
  return state
}

// 目標付き呪文詠唱
export function castSpellTargeted(state, pid, cardId, card, target, kicker = false, delveCount = 0, cardData = {}) {
  const ps = state.players[pid]
  if (!ps.hand.includes(cardId)) return state
  const isFlash = (card.keywords || []).some(k => k.type === 'flash')
  const instant = card.card_type === 'instant' || isFlash
  if (instant ? !canPlayInstantSpeed(state, pid) : !canPlaySorcerySpeed(state, pid)) return state

  let newPool = { ...ps.mana_pool }
  if (card.mana_cost) {
    const cost = parseMana(card.mana_cost)
    if (!hasMana(newPool, cost)) return state
    newPool = spendMana(newPool, cost)
  }
  if (kicker) {
    const kickerKw = (card.keywords || []).find(k => k.type === 'kicker')
    if (kickerKw) {
      const kickerCostStr = `{${kickerKw.value || 1}}`
      if (!hasMana(newPool, kickerCostStr)) return state
      newPool = spendMana(newPool, kickerCostStr)
    }
  }

  const entry = { id: uuidv4(), type: 'spell', card_id: cardId, card, controller: pid, kicked: kicker, target }
  const afterCast = log({
    ...state,
    priority_passed: [],
    stack: [...state.stack, entry],
    players: {
      ...state.players,
      [pid]: { ...ps, hand: removeOne(ps.hand, cardId), mana_pool: newPool },
    },
  }, `${card.name} をスタックに積んだ（目標: ${target?.type}）`)
  return applyOnCastTriggers(afterCast, pid, card, cardData)
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
