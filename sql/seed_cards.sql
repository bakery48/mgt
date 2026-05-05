-- デフォルトカードプール（約50枚）
-- Supabase SQL Editor（role: postgres）で実行

-- カラム型修正・追加
ALTER TABLE cards ADD COLUMN IF NOT EXISTS price integer NOT NULL DEFAULT 500;
ALTER TABLE cards ALTER COLUMN mana_cost TYPE text USING mana_cost::text;
ALTER TABLE cards ALTER COLUMN creator_id DROP NOT NULL;

INSERT INTO cards (name, card_type, color, mana_cost, power, toughness, effect_text, keywords, price) VALUES

-- ── 土地 ──────────────────────────────────────────────────────
('平野',   'land', 'white', null, null, null, 'タップ: 白マナ1点を加える。', '[]', 100),
('島',     'land', 'blue',  null, null, null, 'タップ: 青マナ1点を加える。', '[]', 100),
('沼',     'land', 'black', null, null, null, 'タップ: 黒マナ1点を加える。', '[]', 100),
('山',     'land', 'red',   null, null, null, 'タップ: 赤マナ1点を加える。', '[]', 100),
('森',     'land', 'green', null, null, null, 'タップ: 緑マナ1点を加える。', '[]', 100),

-- ── 白クリーチャー ───────────────────────────────────────────
('清廉の天使',   'creature', 'white', '{2}{W}', 2, 2,
 '飛行、絆魂を持つ。',
 '[{"type":"flying"},{"type":"lifelink"}]', 800),

('守護の衛兵',   'creature', 'white', '{1}{W}', 1, 4,
 '防衛を持つ。',
 '[{"type":"defender"}]', 300),

('聖なる戦士',   'creature', 'white', '{W}{W}', 2, 2,
 '先制攻撃、警戒を持つ。',
 '[{"type":"first_strike"},{"type":"vigilance"}]', 700),

('光の使者',     'creature', 'white', '{3}{W}', 3, 3,
 '飛行を持つ。光の使者が戦場に出た時、ライフ3点を得る。',
 '[{"type":"flying"}]', 700),

('護法の騎士',   'creature', 'white', '{2}{W}', 2, 3,
 '護法（2）を持つ。',
 '[{"type":"ward","value":2}]', 600),

-- ── 青クリーチャー ───────────────────────────────────────────
('海の哨戒',     'creature', 'blue', '{2}{U}', 2, 2,
 '飛行、瞬速を持つ。',
 '[{"type":"flying"},{"type":"flash"}]', 700),

('水晶の幻影',   'creature', 'blue', '{3}{U}', 0, 4,
 '防衛、呪禁を持つ。',
 '[{"type":"defender"},{"type":"hexproof"}]', 500),

('嵐の精霊',     'creature', 'blue', '{3}{U}', 3, 3,
 '飛行を持つ。',
 '[{"type":"flying"}]', 800),

('知識の探求者', 'creature', 'blue', '{2}{U}', 1, 3,
 'サイクリング（2）',
 '[{"type":"cycling","value":2}]', 500),

('幽霊の幻影',   'creature', 'blue', '{1}{U}', 2, 1,
 '飛行、瞬速を持つ。',
 '[{"type":"flying"},{"type":"flash"}]', 600),

-- ── 黒クリーチャー ───────────────────────────────────────────
('影の暗殺者',   'creature', 'black', '{1}{B}', 1, 1,
 '接死、威迫を持つ。',
 '[{"type":"deathtouch"},{"type":"menace"}]', 700),

('吸血の悪魔',   'creature', 'black', '{3}{B}', 3, 3,
 '飛行、絆魂を持つ。',
 '[{"type":"flying"},{"type":"lifelink"}]', 1000),

('骸骨の戦士',   'creature', 'black', '{1}{B}', 2, 2,
 '威迫を持つ。',
 '[{"type":"menace"}]', 400),

('死霊の騎士',   'creature', 'black', '{2}{B}', 2, 2,
 'アンアース（{1}{B}）',
 '[{"type":"unearth","value":"{1}{B}"}]', 700),

('呪われた収穫者', 'creature', 'black', '{5}{B}', 5, 4,
 '探査。このクリーチャーを唱える際、墓地のカード1枚につき{1}の代わりを払える。',
 '[{"type":"delve"}]', 900),

-- ── 赤クリーチャー ───────────────────────────────────────────
('炎の精霊',         'creature', 'red', '{1}{R}', 2, 1,
 '速攻を持つ。',
 '[{"type":"haste"}]', 400),

('ゴブリンの突撃者', 'creature', 'red', '{R}', 1, 1,
 '速攻、威迫を持つ。',
 '[{"type":"haste"},{"type":"menace"}]', 350),

('山の巨人',         'creature', 'red', '{3}{R}', 4, 3,
 'トランプル、速攻を持つ。',
 '[{"type":"trample"},{"type":"haste"}]', 1000),

('キッカー魔道士',   'creature', 'red', '{2}{R}', 2, 2,
 'キッカー（{2}{R}）\nキックされていた場合、速攻とトランプルを得て戦場に出る。',
 '[{"type":"kicker","value":"{2}{R}","power_bonus":2,"toughness_bonus":1}]', 700),

('爆炎の精',         'creature', 'red', '{2}{R}', 3, 2,
 '速攻を持つ。',
 '[{"type":"haste"}]', 600),

-- ── 緑クリーチャー ───────────────────────────────────────────
('森の守護者', 'creature', 'green', '{2}{G}', 3, 3,
 'トランプルを持つ。',
 '[{"type":"trample"}]', 600),

('大樹の精霊', 'creature', 'green', '{3}{G}', 4, 4,
 'トランプル、到達を持つ。',
 '[{"type":"trample"},{"type":"reach"}]', 1000),

('回復の妖精', 'creature', 'green', '{1}{G}', 1, 2,
 '絆魂、到達を持つ。',
 '[{"type":"lifelink"},{"type":"reach"}]', 500),

('蔦の壁',     'creature', 'green', '{2}{G}', 1, 6,
 '防衛、到達を持つ。',
 '[{"type":"defender"},{"type":"reach"}]', 400),

('野生の猛者', 'creature', 'green', '{3}{G}', 4, 3,
 'トランプル、速攻を持つ。',
 '[{"type":"trample"},{"type":"haste"}]', 900),

-- ── アーティファクト（装備品） ──────────────────────────────
('剣士の剣', 'artifact', 'colorless', '{1}', null, null,
 '装備（2）\n装備しているクリーチャーは+2/+0と先制攻撃を得る。',
 '[{"type":"equip","value":2,"power_bonus":2,"toughness_bonus":0}]', 1000),

('守護の盾', 'artifact', 'colorless', '{1}', null, null,
 '装備（1）\n装備しているクリーチャーは+0/+3を得る。',
 '[{"type":"equip","value":1,"power_bonus":0,"toughness_bonus":3}]', 700),

('英雄の鎧', 'artifact', 'colorless', '{2}', null, null,
 '装備（3）\n装備しているクリーチャーは+1/+2を得る。',
 '[{"type":"equip","value":3,"power_bonus":1,"toughness_bonus":2}]', 1200),

('鋼の番人', 'artifact', 'colorless', '{4}', 3, 4,
 '破壊不能を持つ。',
 '[{"type":"indestructible"}]', 1200),

-- ── インスタント ─────────────────────────────────────────────
('稲妻',       'instant', 'red',   '{R}',     null, null,
 'クリーチャーかプレイヤー1人を対象とする。稲妻はそれに3点のダメージを与える。',
 '[]', 900),

('命の光',     'instant', 'white', '{W}',     null, null,
 'あなたはライフ4点を得る。',
 '[]', 400),

('意思の断絶', 'instant', 'blue',  '{U}{U}',  null, null,
 '呪文1つを対象とし、それを打ち消す。',
 '[]', 1000),

('闇の消去',   'instant', 'black', '{2}{B}',  null, null,
 'クリーチャー1体を対象とし、それを破壊する。',
 '[]', 900),

-- ── ソーサリー ───────────────────────────────────────────────
('炎の嵐',       'sorcery', 'red',   '{3}{R}',   null, null,
 'すべてのクリーチャーに2点のダメージを与える。',
 '[]', 800),

('再生の儀式',   'sorcery', 'green', '{2}{G}',   null, null,
 'カードを3枚引く。',
 '[]', 700),

('霊魂の呼び出し', 'sorcery', 'black', '{3}{B}', null, null,
 'フラッシュバック（{4}{B}）\nあなたの墓地にあるクリーチャー・カード1枚を手札に戻す。',
 '[{"type":"flashback","value":"{4}{B}"}]', 900),

('大地の怒り',   'sorcery', 'green', '{4}{G}',   null, null,
 '探査。クリーチャー1体に5点のダメージを与える。',
 '[{"type":"delve"}]', 700),

-- ── エンチャント ─────────────────────────────────────────────
('祝福の光輪', 'enchantment', 'white', '{1}{W}', null, null,
 'あなたがコントロールするクリーチャーは+0/+1の修整と絆魂を得る。',
 '[]', 700),

('闇の霧',     'enchantment', 'black', '{2}{B}', null, null,
 '対戦相手はドロー・ステップに追加でカードを引くことができない。',
 '[]', 600),

('自然の加護', 'enchantment', 'green', '{G}',    null, null,
 'あなたがコントロールするクリーチャーはトランプルを得る。',
 '[]', 700),

-- ── 独自キーワードカード ─────────────────────────────────────
('貪欲な商人', 'creature', 'colorless', '{1}',       2, 2,
 '拝金 200G（戦場に出た時）\nこのクリーチャーが戦場に出た時、あなたは200G獲得する。',
 '[{"type":"拝金","value":200,"trigger":"etb"}]', 1500),

('税収の使者', 'creature', 'black',     '{2}{B}',    2, 3,
 '徴収 150G（攻撃時）\nこのクリーチャーが攻撃するたび、対戦相手から150Gを徴収する。',
 '[{"type":"徴収","value":150,"trigger":"attack"}]', 1800),

('栄光の勇者', 'creature', 'white',     '{2}{W}',    2, 2,
 '先制攻撃\n栄光 1（ダメージ時）\nこのクリーチャーがダメージを与えるたび、勝利点を1獲得する。',
 '[{"type":"first_strike"},{"type":"栄光","value":1,"trigger":"damage"}]', 2500),

('簒奪の女王', 'creature', 'multicolor', '{3}{B}{W}', 3, 3,
 '飛行\n簒奪 1（ダメージ時）\nこのクリーチャーがダメージを与えるたび、対戦相手から勝利点を1奪う。',
 '[{"type":"flying"},{"type":"簒奪","value":1,"trigger":"damage"}]', 3000);
