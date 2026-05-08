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
  {
    id: 'ac11', name: '逆転の一手',
    description: '自分と相手の勝利点を入れ替える。',
    effect_type: 'vp_swap', effect_params: {},
  },
  {
    id: 'ac12', name: '血の誓約',
    description: 'このバトルの開始ライフを5減らし、勝利点を3得る。',
    effect_type: 'life_for_vp', effect_params: { life_cost: 5, vp_gain: 3 },
  },
  {
    id: 'ac13', name: '愚者の賭け',
    description: 'サイコロを振る。1〜3: 勝利点-1 / 4〜6: 勝利点+2',
    effect_type: 'random_vp_self', effect_params: { bad: -1, good: 2, threshold: 3 },
  },
  {
    id: 'ac14', name: '魂の取引',
    description: '勝利点を1失い、1500Gを得る。',
    effect_type: 'vp_for_gold', effect_params: { vp_cost: 1, gold_gain: 1500 },
  },
  {
    id: 'ac15', name: '錬金術師の秘薬',
    description: '自分の所持金を1.5倍にする（増加分の上限は2000G）。',
    effect_type: 'gold_boost', effect_params: { multiplier: 1.5, max_gain: 2000 },
  },
]
