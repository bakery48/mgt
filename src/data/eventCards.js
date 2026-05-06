export const EVENT_CARDS = [
  {
    id: 'ev1', name: '豊作の時代',
    description: '全員の勝利点が1増加する。',
    effect_type: 'vp_all', effect_params: { amount: 1 },
  },
  {
    id: 'ev2', name: '疫病の蔓延',
    description: '今ラウンドのバトル開始ライフが2減少する。',
    effect_type: 'life_modifier', effect_params: { amount: -2 },
  },
  {
    id: 'ev3', name: '救済の手',
    description: '勝利点が最も少ないプレイヤーが3VP獲得する。',
    effect_type: 'vp_last_bonus', effect_params: { amount: 3 },
  },
  {
    id: 'ev4', name: '義援金',
    description: '資産が最も少ないプレイヤーが1000G獲得する。',
    effect_type: 'gold_last_bonus', effect_params: { amount: 1000 },
  },
  {
    id: 'ev5', name: '市場の暴騰',
    description: '価格500G以下のカードが全て3倍の価格になる。',
    effect_type: 'price_cheap_surge', effect_params: { multiplier: 3, threshold: 500 },
  },
  {
    id: 'ev6', name: '大暴落',
    description: '価格2000G以上のカードが全て半額になる。',
    effect_type: 'price_expensive_crash', effect_params: { multiplier: 0.5, threshold: 2000 },
  },
  {
    id: 'ev7', name: 'バブル景気',
    description: '価格2000G以上のカードの価格が1.5倍になる。',
    effect_type: 'price_expensive_surge', effect_params: { multiplier: 1.5, threshold: 2000 },
  },
  {
    id: 'ev8', name: '全員プレゼント',
    description: '全員がランダムなカードを3枚入手する。',
    effect_type: 'pack_all', effect_params: {},
  },
  {
    id: 'ev9', name: '経済危機',
    description: '全員の資産が500G減少する（最低0G）。',
    effect_type: 'gold_all', effect_params: { amount: -500 },
  },
  {
    id: 'ev10', name: '運命のサイコロ',
    description: 'サイコロを振る。1〜3: 全員VP-1 / 4〜6: 全員VP+2',
    effect_type: 'dice_random',
    effect_params: {
      results: [
        { min: 1, max: 3, sub_type: 'vp_all', amount: -1 },
        { min: 4, max: 6, sub_type: 'vp_all', amount: 2 },
      ],
    },
  },
]
