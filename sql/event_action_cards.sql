-- ── イベントカード / アクションカード テーブル ──────────────────

CREATE TABLE IF NOT EXISTS event_cards (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name        text NOT NULL,
  description text,
  effect_type text NOT NULL,
  effect_params jsonb DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS action_cards (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name        text NOT NULL,
  description text,
  effect_type text NOT NULL,
  effect_params jsonb DEFAULT '{}'
);

-- ── イベントカード シード ──────────────────────────────────────
-- effect_type 一覧:
--   vp_all            {amount}              全員VP変動
--   gold_all          {amount}              全員資産変動（最低0）
--   life_modifier     {amount}              バトル開始ライフ変動（game_stateに格納）
--   vp_last_bonus     {amount}              VP最下位に加算
--   gold_last_bonus   {amount}              資産最下位に加算
--   price_cheap_surge {multiplier,threshold} price<=threshold のカード価格変動
--   price_expensive_crash {multiplier,threshold} price>=threshold のカード価格変動
--   price_expensive_surge {multiplier,threshold} price>=threshold のカード価格変動
--   pack_all          {}                    全員にランダムカード3枚
--   dice_random       {results:[{min,max,sub_type,amount}]}  サイコロ判定

INSERT INTO event_cards (name, description, effect_type, effect_params) VALUES
  ('豊作の時代',
   '全員の勝利点が1増加する。',
   'vp_all', '{"amount": 1}'),

  ('疫病の蔓延',
   '今ラウンドのバトル開始ライフが2減少する。',
   'life_modifier', '{"amount": -2}'),

  ('救済の手',
   '勝利点が最も少ないプレイヤーが3VP獲得する。',
   'vp_last_bonus', '{"amount": 3}'),

  ('義援金',
   '資産が最も少ないプレイヤーが1000G獲得する。',
   'gold_last_bonus', '{"amount": 1000}'),

  ('市場の暴騰',
   '価格500G以下のカードが全て3倍の価格になる。',
   'price_cheap_surge', '{"multiplier": 3, "threshold": 500}'),

  ('大暴落',
   '価格2000G以上のカードが全て半額になる。',
   'price_expensive_crash', '{"multiplier": 0.5, "threshold": 2000}'),

  ('バブル景気',
   '価格2000G以上のカードの価格が1.5倍になる。',
   'price_expensive_surge', '{"multiplier": 1.5, "threshold": 2000}'),

  ('全員プレゼント',
   '全員がランダムなカードを3枚入手する。',
   'pack_all', '{}'),

  ('経済危機',
   '全員の資産が500G減少する（最低0G）。',
   'gold_all', '{"amount": -500}'),

  ('運命のサイコロ',
   'サイコロを振る。1〜3: 全員VP-1 / 4〜6: 全員VP+2',
   'dice_random', '{"results": [{"min": 1, "max": 3, "sub_type": "vp_all", "amount": -1}, {"min": 4, "max": 6, "sub_type": "vp_all", "amount": 2}]}');

-- ── アクションカード シード ────────────────────────────────────
-- effect_type 一覧（バトル修飾は game_state.modifiers に格納）:
--   mana_bonus    {amount}        バトル開始時 無色マナ追加
--   life_bonus    {amount}        バトル開始ライフ加算
--   go_first      {}              先攻確定
--   draw_bonus    {amount}        バトル開始時 追加ドロー
--   vp_self       {amount}        即時 自分VP変動
--   gold_self     {amount}        即時 自分資産変動
--   vp_target     {amount}        即時 相手VP変動
--   gold_steal    {amount}        即時 相手→自分 資産移動
--   vp_random     {amount}        即時 ランダム相手VP変動
--   pack_self     {}              即時 ランダムカード3枚入手

INSERT INTO action_cards (name, description, effect_type, effect_params) VALUES
  ('魔力の泉',
   'バトル開始時、無色マナ1つを追加で得る。',
   'mana_bonus', '{"amount": 1}'),

  ('生命力の覚醒',
   'バトル開始ライフが3増加する。',
   'life_bonus', '{"amount": 3}'),

  ('先手必勝',
   'このラウンドのバトルで先攻を取る。',
   'go_first', '{}'),

  ('研究の成果',
   'バトル開始時、カードを1枚追加でドローする。',
   'draw_bonus', '{"amount": 1}'),

  ('名声の報酬',
   '勝利点を1獲得する。',
   'vp_self', '{"amount": 1}'),

  ('臨時収入',
   '500Gを獲得する。',
   'gold_self', '{"amount": 500}'),

  ('呪いの標的',
   '相手の勝利点を1減らす。',
   'vp_target', '{"amount": -1}'),

  ('略奪',
   '相手から300Gを奪う（相手-300G、自分+300G）。',
   'gold_steal', '{"amount": 300}'),

  ('ランダム呪縛',
   'ランダムな相手の勝利点を1減らす。',
   'vp_random', '{"amount": -1}'),

  ('幸運の袋',
   'ランダムなカードを3枚入手する。',
   'pack_self', '{}');
