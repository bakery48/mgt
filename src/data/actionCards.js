export const ACTION_CARDS = [
  {
    id: 'ac1', name: '魔力の泉',
    description: 'バトル開始時、無色マナ1つを追加で得る。',
    effect_type: 'mana_bonus', effect_params: { amount: 1 },
  },
  {
    id: 'ac2', name: '生命力の覚醒',
    description: 'バトル開始ライフが3増加する。',
    effect_type: 'life_bonus', effect_params: { amount: 3 },
  },
  {
    id: 'ac3', name: '先手必勝',
    description: 'このラウンドのバトルで先攻を取る。',
    effect_type: 'go_first', effect_params: {},
  },
  {
    id: 'ac4', name: '研究の成果',
    description: 'バトル開始時、カードを1枚追加でドローする。',
    effect_type: 'draw_bonus', effect_params: { amount: 1 },
  },
  {
    id: 'ac5', name: '名声の報酬',
    description: '勝利点を1獲得する。',
    effect_type: 'vp_self', effect_params: { amount: 1 },
  },
  {
    id: 'ac6', name: '臨時収入',
    description: '500Gを獲得する。',
    effect_type: 'gold_self', effect_params: { amount: 500 },
  },
  {
    id: 'ac7', name: '呪いの標的',
    description: '相手の勝利点を1減らす。',
    effect_type: 'vp_target', effect_params: { amount: -1 },
  },
  {
    id: 'ac8', name: '略奪',
    description: '相手から300Gを奪う（相手-300G、自分+300G）。',
    effect_type: 'gold_steal', effect_params: { amount: 300 },
  },
  {
    id: 'ac9', name: 'ランダム呪縛',
    description: 'ランダムな相手の勝利点を1減らす。',
    effect_type: 'vp_random', effect_params: { amount: -1 },
  },
  {
    id: 'ac10', name: '幸運の袋',
    description: 'ランダムなカードを3枚入手する。',
    effect_type: 'pack_self', effect_params: {},
  },
]
