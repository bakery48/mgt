import {
  advancePhase, playLand, tapForMana, castSpell,
  declareAttackers, declareBlockers,
  resolveFirstStrikeDamage, resolveCombatDamage,
  getOpponent, hasMana, parseMana, canPlaySorcerySpeed, getValidBlockers,
  finishCleanup, discardCard, passPriority,
} from './gameEngine'

export const CPU_USERNAME = '__CPU__'

// Called each time it's the CPU's turn for the current phase.
// Returns the next game state, or null if nothing to do.
export function cpuTakeTurn(gs, cpuId, cardData) {
  const phase = gs.phase

  if (['untap', 'upkeep', 'draw', 'combat_begin', 'combat_end', 'end_step'].includes(phase)) {
    return advancePhase(gs)
  }

  if (phase === 'main1' || phase === 'main2') {
    return cpuMainPhase(gs, cpuId, cardData)
  }

  if (phase === 'declare_attackers') {
    return cpuDeclareAttackers(gs, cpuId, cardData)
  }

  if (phase === 'first_strike_damage') {
    return advancePhase(resolveFirstStrikeDamage(gs, cardData))
  }

  if (phase === 'combat_damage') {
    return advancePhase(resolveCombatDamage(gs, cardData))
  }

  if (phase === 'cleanup') {
    let cur = gs
    while ((cur.cleanup_discard ?? 0) > 0) {
      const hand = cur.players[cpuId]?.hand ?? []
      if (hand.length === 0) break
      cur = discardCard(cur, cpuId, hand[hand.length - 1])
    }
    return finishCleanup(cur)
  }

  return null
}

function cpuMainPhase(gs, cpuId, cardData) {
  let cur = gs
  const oppId = getOpponent(cur, cpuId)

  // Play a land if possible
  if (!cur.players[cpuId].land_played && canPlaySorcerySpeed(cur, cpuId)) {
    const landId = cur.players[cpuId].hand.find(cid => cardData[cid]?.card_type === 'land')
    if (landId) cur = playLand(cur, cpuId, landId, cardData[landId])
  }

  // Tap all untapped lands for mana
  for (const perm of [...cur.players[cpuId].battlefield]) {
    const card = cardData[perm.card_id]
    if (card?.card_type === 'land' && !perm.tapped) {
      cur = tapForMana(cur, cpuId, perm.instance_id, card)
    }
  }

  // Cast spells (greedy: biggest creature first, then sorceries)
  let progress = true
  while (progress && canPlaySorcerySpeed(cur, cpuId)) {
    progress = false
    const manaPool = cur.players[cpuId].mana_pool
    const hand = cur.players[cpuId].hand

    const castable = hand
      .filter(cid => {
        const card = cardData[cid]
        if (!card || card.card_type === 'land' || card.card_type === 'instant') return false
        return hasMana(manaPool, card.mana_cost || '')
      })
      .sort((a, b) => {
        const ca = cardData[a], cb = cardData[b]
        // prefer creatures
        const aScore = ca.card_type === 'creature' ? 1 : 0
        const bScore = cb.card_type === 'creature' ? 1 : 0
        if (aScore !== bScore) return bScore - aScore
        // then by total mana cost descending
        return (parseMana(cb.mana_cost).total || 0) - (parseMana(ca.mana_cost).total || 0)
      })

    if (castable.length > 0) {
      const cardId = castable[0]
      const card = cardData[cardId]
      cur = castSpell(cur, cpuId, cardId, card, false, 0)
      // Simulate both players passing to immediately resolve the spell
      cur = passPriority(cur, cpuId, cardData)
      if (cur.priority === oppId) {
        cur = passPriority(cur, oppId, cardData)
      }
      progress = true
    }
  }

  return advancePhase(cur)
}

function cpuDeclareAttackers(gs, cpuId, cardData) {
  const bf = gs.players[cpuId]?.battlefield ?? []
  const attackers = bf
    .filter(perm => {
      const card = cardData[perm.card_id]
      if (!card || card.card_type !== 'creature') return false
      if (perm.summoning_sick || perm.tapped) return false
      if ((card.keywords || []).some(k => k.type === 'defender')) return false
      return true
    })
    .map(p => p.instance_id)
  return declareAttackers(gs, cpuId, attackers, cardData)
}

// Called when human is attacking and CPU is the defender.
export function cpuDeclareBlockers(gs, cpuId, cardData) {
  const validMap = getValidBlockers(gs, cpuId, cardData)
  const used = new Set()
  const blockerMap = {}

  // Assign one blocker per attacker (simplest strategy)
  for (const [attIid, blkIids] of Object.entries(validMap)) {
    const blocker = blkIids.find(b => !used.has(b))
    if (blocker) {
      blockerMap[attIid] = [blocker]
      used.add(blocker)
    }
  }

  return declareBlockers(gs, cpuId, blockerMap)
}
