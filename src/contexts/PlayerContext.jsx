import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const PlayerContext = createContext(null)

const STORAGE_KEY = 'mtg_player_id'

// ── スターターデッキ定義（各40枚: 土地17〜18 / クリーチャー〜16 / 呪文〜7）──
// 参考: MTG Arena starter deck archetypes + Wizards 40-card deck guidelines
// 単色5デッキ + 2色5デッキ = 計10デッキからランダム配布
const STARTER_DECKS = [
  // ── 単色デッキ ───────────────────────────────────────────────
  {
    name: '聖堂の守護者（白）',
    cards: [
      { name: '平野',         qty: 17 },
      { name: '守護の衛兵',   qty: 4  },
      { name: '聖なる戦士',   qty: 4  },
      { name: '清廉の天使',   qty: 3  },
      { name: '光の使者',     qty: 2  },
      { name: '護法の騎士',   qty: 2  },
      { name: '命の光',       qty: 4  },
      { name: '祝福の光輪',   qty: 4  },
    ],
  },
  {
    name: '蒼空の支配者（青）',
    cards: [
      { name: '島',           qty: 18 },
      { name: '幽霊の幻影',   qty: 4  },
      { name: '海の哨戒',     qty: 4  },
      { name: '知識の探求者', qty: 4  },
      { name: '水晶の幻影',   qty: 3  },
      { name: '嵐の精霊',     qty: 3  },
      { name: '意思の断絶',   qty: 4  },
    ],
  },
  {
    name: '死霊の軍団（黒）',
    cards: [
      { name: '沼',             qty: 17 },
      { name: '骸骨の戦士',     qty: 4  },
      { name: '影の暗殺者',     qty: 4  },
      { name: '死霊の騎士',     qty: 4  },
      { name: '吸血の悪魔',     qty: 2  },
      { name: '呪われた収穫者', qty: 2  },
      { name: '闇の消去',       qty: 4  },
      { name: '闇の霧',         qty: 3  },
    ],
  },
  {
    name: '炎の急襲（赤）',
    cards: [
      { name: '山',               qty: 16 },
      { name: 'ゴブリンの突撃者', qty: 4  },
      { name: '炎の精霊',         qty: 4  },
      { name: '爆炎の精',         qty: 4  },
      { name: 'キッカー魔道士',   qty: 3  },
      { name: '山の巨人',         qty: 2  },
      { name: '稲妻',             qty: 4  },
      { name: '炎の嵐',           qty: 3  },
    ],
  },
  {
    name: '大地の守護者（緑）',
    cards: [
      { name: '森',         qty: 17 },
      { name: '回復の妖精', qty: 4  },
      { name: '蔦の壁',     qty: 4  },
      { name: '森の守護者', qty: 4  },
      { name: '野生の猛者', qty: 3  },
      { name: '大樹の精霊', qty: 2  },
      { name: '再生の儀式', qty: 3  },
      { name: '自然の加護', qty: 3  },
    ],
  },

  // ── 2色デッキ ────────────────────────────────────────────────
  {
    name: '聖なる簒奪者（白黒）',
    // W/B (Orzhov): 飛行+絆魂でライフ差をつけ、VP奪取で勝利
    cards: [
      { name: '平野',         qty: 9  }, // 白呪文多め → 平野を多く
      { name: '沼',           qty: 8  },
      { name: '聖なる戦士',   qty: 3  }, // 2/2 先制・警戒
      { name: '守護の衛兵',   qty: 3  }, // 1/4 防衛で序盤守る
      { name: '影の暗殺者',   qty: 3  }, // 1/1 接死・威迫 — 除去耐性
      { name: '骸骨の戦士',   qty: 2  }, // 2/2 威迫
      { name: '吸血の悪魔',   qty: 2  }, // 3/3 飛行・絆魂 — フィニッシャー
      { name: '簒奪の女王',   qty: 2  }, // 3/3 飛行 + VP奪取 — 切り札
      { name: '命の光',       qty: 3  }, // インスタント ライフ+4
      { name: '闇の消去',     qty: 3  }, // インスタント 除去
      { name: '祝福の光輪',   qty: 2  }, // エンチャント 全体絆魂
    ],
  },
  {
    name: '荒野の猛者（赤緑）',
    // R/G (Gruul): 速攻で序盤を制し、トランプル大型で押し切るアグロ
    cards: [
      { name: '山',               qty: 9  }, // 赤1マナ呪文多め
      { name: '森',               qty: 8  },
      { name: 'ゴブリンの突撃者', qty: 4  }, // 1/1 速攻・威迫 — 1ターン目
      { name: '炎の精霊',         qty: 3  }, // 2/1 速攻
      { name: '回復の妖精',       qty: 3  }, // 1/2 絆魂・到達 — ライフ回復
      { name: '爆炎の精',         qty: 3  }, // 3/2 速攻
      { name: '森の守護者',       qty: 3  }, // 3/3 トランプル
      { name: '野生の猛者',       qty: 2  }, // 4/3 トランプル・速攻
      { name: '稲妻',             qty: 3  }, // 3点バーン
      { name: '自然の加護',       qty: 2  }, // 全体トランプル付与
    ],
  },
  {
    name: '知識の略奪者（青黒）',
    // U/B (Dimir): 打消し+除去でリソース差をつけ飛行で削り切るコントロール
    cards: [
      { name: '島',             qty: 9  }, // UU打消しに青多め
      { name: '沼',             qty: 8  },
      { name: '幽霊の幻影',     qty: 4  }, // 2/1 飛行・瞬速
      { name: '海の哨戒',       qty: 3  }, // 2/2 飛行・瞬速
      { name: '影の暗殺者',     qty: 3  }, // 1/1 接死・威迫
      { name: '死霊の騎士',     qty: 2  }, // 2/2 アンアース — 粘り
      { name: '呪われた収穫者', qty: 2  }, // 5/4 探査 — 大型フィニッシャー
      { name: '意思の断絶',     qty: 4  }, // 打消し — コントロールの核
      { name: '闇の消去',       qty: 3  }, // 除去
      { name: '闇の霧',         qty: 2  }, // エンチャント — ドロー妨害
    ],
  },
  {
    name: '命の循環（白緑）',
    // W/G (Selesnya): ライフゲインと堅固な壁で序盤を凌ぎ大型で勝つ
    cards: [
      { name: '平野',       qty: 9  },
      { name: '森',         qty: 8  },
      { name: '守護の衛兵', qty: 4  }, // 1/4 防衛 — 序盤の壁
      { name: '回復の妖精', qty: 4  }, // 1/2 絆魂・到達
      { name: '蔦の壁',     qty: 3  }, // 1/6 防衛・到達 — 鉄壁
      { name: '聖なる戦士', qty: 3  }, // 2/2 先制・警戒
      { name: '森の守護者', qty: 3  }, // 3/3 トランプル
      { name: '大樹の精霊', qty: 2  }, // 4/4 トランプル・到達
      { name: '命の光',     qty: 3  }, // ライフ回復
      { name: '祝福の光輪', qty: 1  }, // 全体絆魂付与
    ],
  },
  {
    name: '破滅の軍団（黒赤）',
    // B/R (Rakdos): 威迫+速攻の総攻撃にバーン除去を合わせる最速アグロ
    cards: [
      { name: '山',               qty: 9  }, // 赤1マナ多め
      { name: '沼',               qty: 8  },
      { name: 'ゴブリンの突撃者', qty: 4  }, // 1/1 速攻・威迫
      { name: '骸骨の戦士',       qty: 3  }, // 2/2 威迫
      { name: '影の暗殺者',       qty: 3  }, // 1/1 接死・威迫
      { name: '炎の精霊',         qty: 3  }, // 2/1 速攻
      { name: '爆炎の精',         qty: 2  }, // 3/2 速攻
      { name: '吸血の悪魔',       qty: 2  }, // 3/3 飛行・絆魂
      { name: '稲妻',             qty: 4  }, // 3点バーン
      { name: '闇の消去',         qty: 2  }, // 除去
    ],
  },
]

export function PlayerProvider({ children }) {
  const [player, setPlayer] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const restore = async () => {
      const savedId = localStorage.getItem(STORAGE_KEY)
      if (savedId) {
        const { data } = await supabase
          .from('players')
          .select('*')
          .eq('id', savedId)
          .single()
        if (data) {
          setPlayer(data)
          setLoading(false)
          return
        }
        localStorage.removeItem(STORAGE_KEY)
      }
      setLoading(false)
    }
    restore()
  }, [])

  const createPlayer = async (username) => {
    const { data, error } = await supabase
      .from('players')
      .insert({ username, balance: 10000 })
      .select()
      .single()
    if (error) throw error
    localStorage.setItem(STORAGE_KEY, data.id)
    setPlayer(data)

    // ランダムにスターターデッキを1つ選択
    const deck = STARTER_DECKS[Math.floor(Math.random() * STARTER_DECKS.length)]
    const allNames = deck.cards.map(c => c.name)

    const { data: cardRows } = await supabase
      .from('cards').select('id, name').in('name', allNames)

    if (cardRows?.length) {
      // コレクションに追加
      const collectionInserts = []
      for (const { name, qty } of deck.cards) {
        const card = cardRows.find(c => c.name === name)
        if (card) collectionInserts.push({ player_id: data.id, card_id: card.id, quantity: qty })
      }
      if (collectionInserts.length) {
        await supabase.from('player_collection').insert(collectionInserts)
      }

      // デッキを作成
      const { data: newDeck } = await supabase
        .from('decks')
        .insert({ name: deck.name, player_id: data.id })
        .select()
        .single()

      if (newDeck) {
        const deckCardInserts = []
        for (const { name, qty } of deck.cards) {
          const card = cardRows.find(c => c.name === name)
          if (card) deckCardInserts.push({ deck_id: newDeck.id, card_id: card.id, quantity: qty })
        }
        if (deckCardInserts.length) {
          await supabase.from('deck_cards').insert(deckCardInserts)
        }
      }
    }

    return data
  }

  const refreshPlayer = async () => {
    if (!player) return
    const { data } = await supabase
      .from('players')
      .select('*')
      .eq('id', player.id)
      .single()
    if (data) setPlayer(data)
  }

  const clearPlayer = () => {
    localStorage.removeItem(STORAGE_KEY)
    setPlayer(null)
  }

  return (
    <PlayerContext.Provider value={{ player, loading, createPlayer, refreshPlayer, clearPlayer }}>
      {children}
    </PlayerContext.Provider>
  )
}

export const usePlayer = () => useContext(PlayerContext)
