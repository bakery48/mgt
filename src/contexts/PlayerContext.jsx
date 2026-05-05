import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const PlayerContext = createContext(null)

const STORAGE_KEY = 'mtg_player_id'

// ── スターターデッキ定義（各40枚: 土地17〜18 / クリーチャー〜16 / 呪文〜7）──
// 研究元: MTG Arena starter deck archetypes + Wizards 40-card deck guidelines
const STARTER_DECKS = [
  {
    name: '聖堂の守護者（白）',
    // 白: ライフゲイン + 飛行フィニッシャー + 防衛コントロール
    cards: [
      { name: '平野',         qty: 17 },
      { name: '守護の衛兵',   qty: 4  }, // 1/4 防衛 — 序盤の壁
      { name: '聖なる戦士',   qty: 4  }, // 2/2 先制・警戒 — 効率的なアタッカー
      { name: '清廉の天使',   qty: 3  }, // 2/2 飛行・絆魂 — ライフゲインシナジー
      { name: '光の使者',     qty: 2  }, // 3/3 飛行 + ETBライフ3 — フィニッシャー
      { name: '護法の騎士',   qty: 2  }, // 2/3 護法2 — 粘り強い中堅
      { name: '命の光',       qty: 4  }, // インスタント ライフ+4
      { name: '祝福の光輪',   qty: 4  }, // エンチャント 全体+0/+1・絆魂付与
    ],
  },
  {
    name: '蒼空の支配者（青）',
    // 青: 飛行クリーチャー + 打消しコントロール + サイクリングで安定供給
    cards: [
      { name: '島',           qty: 18 }, // コントロールは土地多め
      { name: '幽霊の幻影',   qty: 4  }, // 2/1 飛行・瞬速 — フラッシュクロック
      { name: '海の哨戒',     qty: 4  }, // 2/2 飛行・瞬速 — コンバット優位
      { name: '知識の探求者', qty: 4  }, // 1/3 サイクリング2 — マナフラッド受け
      { name: '水晶の幻影',   qty: 3  }, // 0/4 防衛・呪禁 — 固い壁
      { name: '嵐の精霊',     qty: 3  }, // 3/3 飛行 — フィニッシャー
      { name: '意思の断絶',   qty: 4  }, // 打消し — コントロールの核
    ],
  },
  {
    name: '死霊の軍団（黒）',
    // 黒: 接死アグロ + 除去 + 墓地再利用 (Dredge/Zombie的アーキタイプ)
    cards: [
      { name: '沼',             qty: 17 },
      { name: '骸骨の戦士',     qty: 4  }, // 2/2 威迫 — 序盤の攻め手
      { name: '影の暗殺者',     qty: 4  }, // 1/1 接死・威迫 — 相手のアタックを止める
      { name: '死霊の騎士',     qty: 4  }, // 2/2 アンアース — 墓地から再登場
      { name: '吸血の悪魔',     qty: 2  }, // 3/3 飛行・絆魂 — フィニッシャー
      { name: '呪われた収穫者', qty: 2  }, // 5/4 探査 — 墓地を使う大型
      { name: '闇の消去',       qty: 4  }, // インスタント 破壊 — 除去
      { name: '闇の霧',         qty: 3  }, // エンチャント — ドロー妨害
    ],
  },
  {
    name: '炎の急襲（赤）',
    // 赤: 速攻バーンアグロ。曲線通りに展開して速攻で決める
    cards: [
      { name: '山',             qty: 16 }, // アグロは土地少なめ
      { name: 'ゴブリンの突撃者', qty: 4 }, // 1/1 速攻・威迫 — 1マナ先鋒
      { name: '炎の精霊',       qty: 4  }, // 2/1 速攻 — 2マナ
      { name: '爆炎の精',       qty: 4  }, // 3/2 速攻 — 3マナ
      { name: 'キッカー魔道士', qty: 3  }, // 2/2 キッカーで4/3速攻・トランプル
      { name: '山の巨人',       qty: 2  }, // 4/3 トランプル・速攻 — フィニッシャー
      { name: '稲妻',           qty: 4  }, // インスタント 3点ダメージ
      { name: '炎の嵐',         qty: 3  }, // ソーサリー 全体2点 — 小型一掃
    ],
  },
  {
    name: '大地の守護者（緑）',
    // 緑: 序盤を壁で凌ぎ中大型トランプルで押し切るミッドレンジ
    cards: [
      { name: '森',           qty: 17 },
      { name: '回復の妖精',   qty: 4  }, // 1/2 絆魂・到達 — ライフ稼ぎ
      { name: '蔦の壁',       qty: 4  }, // 1/6 防衛・到達 — 強固な壁
      { name: '森の守護者',   qty: 4  }, // 3/3 トランプル — 中堅
      { name: '野生の猛者',   qty: 3  }, // 4/3 トランプル・速攻 — 奇襲フィニッシャー
      { name: '大樹の精霊',   qty: 2  }, // 4/4 トランプル・到達 — 大型フィニッシャー
      { name: '再生の儀式',   qty: 3  }, // ソーサリー カード3枚引く — リソース補充
      { name: '自然の加護',   qty: 3  }, // エンチャント 全クリーチャーにトランプル
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
