// ブラウザのコンソール（F12）に貼り付けて実行
// アプリのSupabaseクライアントと同じドメインから動くため制限なし

(async () => {
  // アプリ内の supabase クライアントを使用
  // ※ window.__supabase__ が undefined の場合は手動でSupabase URLとkeyを設定
  const SUPABASE_URL = 'https://cnkxjnbpbypxevqagvqc.supabase.co'
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNua3hqbmJwYnlweGV2cWFndnFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NjA5NDUsImV4cCI6MjA5MzUzNjk0NX0.6Vt1fGHuMkr5ZEY6He23X2wqq8hIpvsY_7XT1TeZ9Ew'

  async function sbFetch(path, options = {}) {
    const res = await fetch(SUPABASE_URL + path, {
      ...options,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
    return res.json()
  }

  async function getScryfallArt(name) {
    try {
      const res = await fetch(
        `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}&lang=ja`
      )
      if (!res.ok) return null
      const data = await res.json()
      return data.image_uris?.art_crop ?? data.image_uris?.normal ?? null
    } catch {
      return null
    }
  }

  // DB からカード一覧取得
  const cards = await sbFetch('/rest/v1/cards?select=id,name,art_url&art_url=is.null')
  console.log(`${cards.length} 枚のカード（画像なし）を処理中...`)

  let updated = 0, notFound = 0
  for (const card of cards) {
    await new Promise(r => setTimeout(r, 120)) // Scryfall rate limit
    const artUrl = await getScryfallArt(card.name)
    if (artUrl) {
      await sbFetch(`/rest/v1/cards?id=eq.${card.id}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ art_url: artUrl }),
      })
      console.log(`✅ ${card.name}`)
      updated++
    } else {
      console.log(`❌ ${card.name} (Scryfallに未登録)`)
      notFound++
    }
  }
  console.log(`\n完了: ${updated}枚更新, ${notFound}枚は手動で画像URLが必要`)
})()
