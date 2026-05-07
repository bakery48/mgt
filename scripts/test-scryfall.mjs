// Scryfall でどのカードがマッチするか確認するだけのスクリプト
const CARD_NAMES = [
  '平野','島','沼','山','森',
  '清廉の天使','守護の衛兵','聖なる戦士','光の使者','命の光','守護の盾','神聖なる壁',
  '海の哨戒','嵐の精霊','水晶の幻影','幽霊の幻影','意思の断絶','神秘の潮流',
  '影の暗殺者','骸骨の戦士','死霊の騎士','怨念の騎兵','闇の消去','霊魂の呼び出し',
  'ゴブリンの突撃者','炎の精霊','爆炎の精','山の巨人','稲妻','炎の嵐',
  '回復の妖精','野生の猛者','森の守護者','大樹の精霊','巨大化','自然の加護',
  '知識の探求者',
]

async function fetchScryfallImage(name) {
  try {
    const url = `https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}&lang=ja`
    const res = await fetch(url)
    if (res.ok) {
      const data = await res.json()
      const img = data.image_uris?.art_crop ?? data.image_uris?.normal ?? null
      return { found: true, img, englishName: data.name }
    }
    return { found: false }
  } catch {
    return { found: false }
  }
}

const results = []
for (const name of CARD_NAMES) {
  await new Promise(r => setTimeout(r, 120))
  const r = await fetchScryfallImage(name)
  if (r.found) {
    console.log(`✅ ${name} → ${r.englishName}`)
    results.push({ name, img: r.img })
  } else {
    console.log(`❌ ${name}`)
  }
}

console.log('\n--- SQL更新文 ---')
for (const { name, img } of results) {
  console.log(`UPDATE cards SET art_url = '${img}' WHERE name = '${name}';`)
}
