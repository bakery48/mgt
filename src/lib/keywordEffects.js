import { supabase } from './supabase'

// 独自キーワード効果の適用（DB更新）
async function applyEffect(type, value, playerId, opponentId, gameId) {
  if (type === '拝金') {
    const { data } = await supabase.from('players').select('balance').eq('id', playerId).single()
    await supabase.from('players').update({ balance: (data?.balance || 0) + value }).eq('id', playerId)
    return `${playerId} が ${value}G 獲得`

  } else if (type === '徴収') {
    const { data } = await supabase.from('players').select('balance').eq('id', opponentId).single()
    const take = Math.min(value, data?.balance || 0)
    if (take > 0) {
      const [{ data: oppD }, { data: myD }] = await Promise.all([
        supabase.from('players').select('balance').eq('id', opponentId).single(),
        supabase.from('players').select('balance').eq('id', playerId).single(),
      ])
      await Promise.all([
        supabase.from('players').update({ balance: Math.max(0, (oppD?.balance || 0) - take) }).eq('id', opponentId),
        supabase.from('players').update({ balance: (myD?.balance || 0) + take }).eq('id', playerId),
      ])
    }
    return `相手から ${take}G 徴収`

  } else if (type === '栄光') {
    const { data } = await supabase.from('game_players')
      .select('victory_points').eq('game_id', gameId).eq('player_id', playerId).single()
    await supabase.from('game_players')
      .update({ victory_points: (data?.victory_points || 0) + value })
      .eq('game_id', gameId).eq('player_id', playerId)
    return `勝利点 +${value}`

  } else if (type === '簒奪') {
    const { data } = await supabase.from('game_players')
      .select('victory_points').eq('game_id', gameId).eq('player_id', opponentId).single()
    const take = Math.min(value, data?.victory_points || 0)
    if (take > 0) {
      const [{ data: oppD }, { data: myD }] = await Promise.all([
        supabase.from('game_players').select('victory_points').eq('game_id', gameId).eq('player_id', opponentId).single(),
        supabase.from('game_players').select('victory_points').eq('game_id', gameId).eq('player_id', playerId).single(),
      ])
      await Promise.all([
        supabase.from('game_players').update({ victory_points: Math.max(0, (oppD?.victory_points || 0) - take) })
          .eq('game_id', gameId).eq('player_id', opponentId),
        supabase.from('game_players').update({ victory_points: (myD?.victory_points || 0) + take })
          .eq('game_id', gameId).eq('player_id', playerId),
      ])
    }
    return `相手から勝利点 ${take} 簒奪`
  }
  return null
}

const ORIGINAL_TYPES = ['拝金', '徴収', '栄光', '簒奪']

// トリガーに該当するキーワード効果を処理
async function processTrigger(keywords, trigger, playerId, opponentId, gameId) {
  const results = []
  for (const kw of (keywords || [])) {
    if (!ORIGINAL_TYPES.includes(kw.type)) continue
    if (kw.trigger !== trigger) continue
    const msg = await applyEffect(kw.type, kw.value || 0, playerId, opponentId, gameId)
    if (msg) results.push(`【${kw.type}】${msg}`)
  }
  return results
}

// ETBトリガー（戦場に出たとき）
export async function processETB(card, playerId, opponentId, gameId) {
  return processTrigger(card?.keywords, 'etb', playerId, opponentId, gameId)
}

// アップキープトリガー（各ターン開始時）
export async function processUpkeep(battlefield, cardData, playerId, opponentId, gameId) {
  const msgs = []
  for (const perm of battlefield) {
    const card = cardData[perm.card_id]
    const results = await processTrigger(card?.keywords, 'upkeep', playerId, opponentId, gameId)
    msgs.push(...results.map(m => `${card?.name}: ${m}`))
  }
  return msgs
}

// 攻撃トリガー（攻撃したとき）
export async function processAttack(attackerPerms, cardData, playerId, opponentId, gameId) {
  const msgs = []
  for (const perm of attackerPerms) {
    const card = cardData[perm.card_id]
    const results = await processTrigger(card?.keywords, 'attack', playerId, opponentId, gameId)
    msgs.push(...results.map(m => `${card?.name}: ${m}`))
  }
  return msgs
}

// ダメージトリガー（ダメージを与えたとき）
export async function processDamage(attackerPerms, cardData, playerId, opponentId, gameId, didDealDamage) {
  if (!didDealDamage) return []
  const msgs = []
  for (const perm of attackerPerms) {
    const card = cardData[perm.card_id]
    const results = await processTrigger(card?.keywords, 'damage', playerId, opponentId, gameId)
    msgs.push(...results.map(m => `${card?.name}: ${m}`))
  }
  return msgs
}
