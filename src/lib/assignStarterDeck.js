import { supabase } from './supabase'
import { STARTER_DECKS } from '../data/starterDecks'

// 既存のスターターデッキからランダムに1つ選んで deck_id を返す
// 存在しない場合はフォールバックで1つ作成する
export async function assignStarterDeck(playerId) {
  const starterNames = STARTER_DECKS.map(d => d.name)

  // 既存スターターデッキを検索
  const { data: existingDecks } = await supabase
    .from('decks')
    .select('id, name')
    .eq('player_id', playerId)
    .in('name', starterNames)

  if (existingDecks?.length > 0) {
    const pick = existingDecks[Math.floor(Math.random() * existingDecks.length)]
    return pick.id
  }

  // フォールバック: デッキが未作成の場合は1つ作成
  const template = STARTER_DECKS[Math.floor(Math.random() * STARTER_DECKS.length)]
  const cardNames = template.cards.map(c => c.name)

  const { data: cardRows, error: cardErr } = await supabase
    .from('cards').select('id, name').in('name', cardNames)
  if (cardErr) throw new Error('カード取得失敗: ' + cardErr.message)

  const nameToId = {}
  for (const row of cardRows) nameToId[row.name] = row.id

  const { data: deck, error: deckErr } = await supabase
    .from('decks')
    .insert({ player_id: playerId, name: template.name, format: 'magic_league' })
    .select('id')
    .single()
  if (deckErr) throw new Error('デッキ作成失敗: ' + deckErr.message)

  const rows = template.cards
    .filter(c => nameToId[c.name])
    .map(c => ({ deck_id: deck.id, card_id: nameToId[c.name], quantity: c.quantity }))
  if (rows.length > 0) {
    const { error: dcErr } = await supabase.from('deck_cards').insert(rows)
    if (dcErr) throw new Error('デッキカード挿入失敗: ' + dcErr.message)
  }

  return deck.id
}
