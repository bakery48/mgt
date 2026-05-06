-- カードプール追加（各色5種 計25枚）
-- Supabase SQL Editor（role: postgres）で実行

ALTER TABLE cards DISABLE TRIGGER USER;

INSERT INTO cards (name, card_type, color, mana_cost, power, toughness, effect_text, keywords, price) VALUES

-- ── 白クリーチャー・呪文 ──────────────────────────────────────
('聖堂の護衛',   'creature', 'white', '{W}',       1, 2,
 '先制攻撃を持つ。',
 '[{"type":"first_strike"}]', 350),

('正義の騎士',   'creature', 'white', '{3}{W}{W}', 4, 3,
 '警戒、先制攻撃を持つ。',
 '[{"type":"vigilance"},{"type":"first_strike"}]', 1100),

('神聖なる壁',   'creature', 'white', '{2}{W}',    0, 6,
 '防衛、絆魂を持つ。',
 '[{"type":"defender"},{"type":"lifelink"}]', 500),

('聖なる光',     'sorcery',  'white', '{2}{W}',    null, null,
 'フラッシュバック（{3}{W}）\nライフ6点を得る。',
 '[{"type":"flashback","value":"{3}{W}"}]', 500),

('光の加護',     'enchantment', 'white', '{1}{W}', null, null,
 'あなたがコントロールするクリーチャーは先制攻撃を得る。',
 '[]', 800),

-- ── 青クリーチャー・呪文 ──────────────────────────────────────
('潮の精霊',     'creature', 'blue', '{2}{U}',    2, 3,
 '飛行を持つ。',
 '[{"type":"flying"}]', 600),

('霜の守護者',   'creature', 'blue', '{1}{U}{U}', 2, 2,
 '飛行、呪禁を持つ。',
 '[{"type":"flying"},{"type":"hexproof"}]', 750),

('幻影の壁',     'creature', 'blue', '{3}{U}',    0, 5,
 '防衛を持つ。',
 '[{"type":"defender"}]', 300),

('神秘の潮流',   'instant',  'blue', '{U}',       null, null,
 'カードを1枚引く。',
 '[]', 300),

('時間の罠',     'instant',  'blue', '{2}{U}',    null, null,
 'クリーチャー1体を対象とし、それをオーナーの手札に戻す。',
 '[]', 600),

-- ── 黒クリーチャー・呪文 ──────────────────────────────────────
('腐食の刃',     'creature', 'black', '{B}',      1, 1,
 '接死を持つ。',
 '[{"type":"deathtouch"}]', 300),

('怨念の騎兵',   'creature', 'black', '{2}{B}',   3, 2,
 '威迫、速攻を持つ。',
 '[{"type":"menace"},{"type":"haste"}]', 700),

('不死の亡霊',   'creature', 'black', '{2}{B}{B}', 3, 3,
 'アンアース（{1}{B}）',
 '[{"type":"unearth","value":"{1}{B}"}]', 800),

('暗黒の誓い',   'creature', 'black', '{3}{B}',   2, 4,
 '絆魂を持つ。',
 '[{"type":"lifelink"}]', 600),

('虚無の嵐',     'sorcery',  'black', '{4}{B}',   null, null,
 '探査。すべてのクリーチャーに2点のダメージを与える。',
 '[{"type":"delve"}]', 700),

-- ── 赤クリーチャー・呪文 ──────────────────────────────────────
('熱狂の戦士',   'creature', 'red', '{1}{R}',   2, 1,
 '速攻、威迫を持つ。',
 '[{"type":"haste"},{"type":"menace"}]', 450),

('火山の巨人',   'creature', 'red', '{4}{R}{R}', 6, 4,
 'トランプルを持つ。',
 '[{"type":"trample"}]', 1400),

('竜の息吹',     'enchantment', 'red', '{R}',   null, null,
 'あなたがコントロールするクリーチャーは速攻を得る。',
 '[]', 700),

('火球',         'instant',  'red', '{3}{R}',   null, null,
 'クリーチャー1体かプレイヤー1人を対象とする。火球はそれに4点のダメージを与える。',
 '[]', 700),

('溶岩の噴出',   'sorcery',  'red', '{1}{R}',   null, null,
 'すべてのクリーチャーに1点のダメージを与える。',
 '[]', 500),

-- ── 緑クリーチャー・呪文 ──────────────────────────────────────
('巨大化',       'instant',  'green', '{G}',     null, null,
 'クリーチャー1体を対象とする。それはターン終了時まで+3/+3の修整を受ける。',
 '[]', 400),

('森の猛虎',     'creature', 'green', '{2}{G}',  3, 3,
 'トランプルを持つ。',
 '[{"type":"trample"}]', 700),

('根の壁',       'creature', 'green', '{1}{G}',  0, 5,
 '防衛、到達を持つ。',
 '[{"type":"defender"},{"type":"reach"}]', 350),

('自然の怒り',   'creature', 'green', '{4}{G}{G}', 5, 5,
 'トランプル、到達を持つ。',
 '[{"type":"trample"},{"type":"reach"}]', 1300),

('エルフの使い走り', 'creature', 'green', '{G}', 1, 1,
 'サイクリング（1）',
 '[{"type":"cycling","value":1}]', 250);

ALTER TABLE cards ENABLE TRIGGER USER;
