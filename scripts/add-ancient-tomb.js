// ブラウザのコンソール（F12）に貼り付けて実行
// 古えの墓を cards テーブルに追加する

(async () => {
  const SUPABASE_URL = 'https://cnkxjnbpbypxevqagvqc.supabase.co'
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNua3hqbmJwYnlweGV2cWFndnFjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NjA5NDUsImV4cCI6MjA5MzUzNjk0NX0.6Vt1fGHuMkr5ZEY6He23X2wqq8hIpvsY_7XT1TeZ9Ew'

  const sessionRaw = localStorage.getItem('sb-cnkxjnbpbypxevqagvqc-auth-token')
  const accessToken = sessionRaw ? JSON.parse(sessionRaw)?.access_token : null
  const authToken = accessToken ?? SUPABASE_ANON_KEY

  async function sbFetch(path, options = {}) {
    const res = await fetch(SUPABASE_URL + path, {
      ...options,
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: 'Bearer ' + authToken,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
        ...options.headers,
      },
    })
    if (res.status === 204 || res.headers.get('content-length') === '0') return null
    return res.json()
  }

  const card = {
    name: '古えの墓',
    card_type: 'land',
    color: 'colorless',
    mana_cost: null,
    power: null,
    toughness: null,
    effect_text: '{T}：{C}{C}を加える。古えの墓はあなたに2点のダメージを与える。',
    keywords: [{ type: 'land_tap_config', mana_amount: 2, mana_color: 'C', self_damage: 2 }],
    price: 3000,
  }

  const result = await sbFetch('/rest/v1/cards', {
    method: 'POST',
    body: JSON.stringify(card),
  })

  console.log('結果:', result)
  if (result && !result[0]?.message) {
    console.log('✅ 古えの墓 を追加しました！')
  } else {
    console.warn('⚠️ 既に存在するか、エラーが発生しました:', result)
  }
})()
