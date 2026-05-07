// Scryfall から日本語カード名で画像URLを取得して Supabase の art_url を更新するスクリプト
// 実行: node scripts/fetch-card-images.mjs

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://cnkxjnbpbypxevqagvqc.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNua3hqbmJwYnlweGV2cWFndnFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NjA5NDUsImV4cCI6MjA5MzUzNjk0NX0.6Vt1fGHuMkr5ZEY6He23X2wqq8hIpvsY_7XT1TeZ9Ew'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function fetchScryfallImage(japaneseName) {
  try {
    // まずfuzzy検索（日本語printed_name）
    const url = `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(japaneseName)}&lang=ja`
    const res = await fetch(url)
    if (res.ok) {
      const data = await res.json()
      // art_crop（イラスト部分のみ）を優先、なければnormal
      return data.image_uris?.art_crop ?? data.image_uris?.normal ?? null
    }

    // fuzzyで見つからなければ lang=ja で検索
    const searchUrl = `https://api.scryfall.com/cards/search?q=lang%3Aja+%22${encodeURIComponent(japaneseName)}%22&unique=cards`
    const res2 = await fetch(searchUrl)
    if (res2.ok) {
      const data2 = await res2.json()
      if (data2.data?.length > 0) {
        const card = data2.data[0]
        return card.image_uris?.art_crop ?? card.image_uris?.normal ?? null
      }
    }
    return null
  } catch {
    return null
  }
}

async function main() {
  // DB から全カード取得
  const { data: cards, error } = await supabase.from('cards').select('id, name, art_url')
  if (error) { console.error('DB取得エラー:', error); process.exit(1) }

  console.log(`${cards.length} 枚のカードを処理します...\n`)

  let updated = 0
  let notFound = 0

  for (const card of cards) {
    if (card.art_url) {
      console.log(`✅ スキップ（既に画像あり）: ${card.name}`)
      continue
    }

    // Scryfallへのリクエスト間隔（API利用規約: 50-100ms以上）
    await new Promise(r => setTimeout(r, 120))

    const imageUrl = await fetchScryfallImage(card.name)
    if (imageUrl) {
      const { error: updateErr } = await supabase
        .from('cards')
        .update({ art_url: imageUrl })
        .eq('id', card.id)
      if (updateErr) {
        console.error(`❌ 更新失敗: ${card.name}`, updateErr.message)
      } else {
        console.log(`🖼  更新成功: ${card.name}`)
        updated++
      }
    } else {
      console.log(`⚠️  見つからず: ${card.name}`)
      notFound++
    }
  }

  console.log(`\n完了: ${updated} 枚更新, ${notFound} 枚は未マッチ`)
}

main()
