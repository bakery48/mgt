import { supabase } from './supabase'
import { STARTER_DECKS } from '../data/starterDecks'

// プレイヤーにランダムなスターターデッキを割り当て、deck_id を返す
export async function assignStarterDeck(playerId) {
  const template = STARTER_DECKS[Math.floor(Math.random() * STARTER_DECKS.length)]

  // カード名 → ID のマップを取得
  const cardNames = template.cards.map(c => c.name)
  const { data: cardRows, error: cardErr } = await supabase
    .from('cards')
    .select('id, name')
    .in('name', cardNames)
  if (cardErr) throw new Error('カード取得失敗: ' + cardErr.message)

  const nameToId = {}
  for (const row of cardRows) nameToId[row.name] = row.id

  // decks テーブルにデッキを作成
  const { data: deck, error: deckErr } = await supabase
    .from('decks')
    .insert({ player_id: playerId, name: `スターターデッキ：${template.name}` })
    .select('id')
    .single()
  if (deckErr) throw new Error('デッキ作成失敗: ' + deckErr.message)

  // deck_cards を挿入（名前が解決できたカードのみ）
  const rows = template.cards
    .filter(c => nameToId[c.name])
    .map(c => ({ deck_id: deck.id, card_id: nameToId[c.name], quantity: c.quantity }))
  if (rows.length > 0) {
    const { error: dcErr } = await supabase.from('deck_cards').insert(rows)
    if (dcErr) throw new Error('デッキカード挿入失敗: ' + dcErr.message)
  }

  return deck.id
}
