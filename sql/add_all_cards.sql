-- 全カード追加（白・青・黒・赤・緑・追加カードプール）
-- 呪文エフェクトキーワード込み。Supabase SQL Editor で一括実行。

ALTER TABLE cards DISABLE TRIGGER USER;

-- name カラムに UNIQUE 制約がなければ追加（DO ブロックで既存時はスキップ）
DO $$BEGIN
  -- 重複行を先に削除（name ごとに1行残す）
  DELETE FROM cards WHERE id NOT IN (
    SELECT DISTINCT ON (name) id FROM cards ORDER BY name
  );
  ALTER TABLE cards ADD CONSTRAINT cards_name_key UNIQUE (name);
EXCEPTION WHEN duplicate_object OR duplicate_table THEN NULL;
END $$;

INSERT INTO cards (name, card_type, color, mana_cost, power, toughness, effect_text, keywords, price) VALUES

-- ════════════════════════════════════════════════════════════════
-- 白単デッキ
-- ════════════════════════════════════════════════════════════════

-- ── 白クリーチャー ───────────────────────────────────────────
('癒し手の鷹',       'creature', 'white', '{W}',       1, 1,
 '飛行、絆魂を持つ。',
 '[{"type":"flying"},{"type":"lifelink"}]', 400),

('アジャニの群れ仲間', 'creature', 'white', '{1}{W}',   2, 2,
 'あなたがライフを得るたび、アジャニの群れ仲間の上に＋1/＋1カウンターを1個置く。',
 '[{"type":"gain_life_trigger","effect":"counter_p1p1","value":1}]', 800),

('お手伝いする狩人', 'creature', 'white', '{1}{W}',    1, 1,
 '警戒を持つ。お手伝いする狩人が戦場に出たとき、カードを1枚引く。',
 '[{"type":"vigilance"},{"type":"etb_trigger","effect":"draw_cards","value":1}]', 500),

('司教の兵士',       'creature', 'white', '{1}{W}',    2, 2,
 '絆魂を持つ。',
 '[{"type":"lifelink"}]', 400),

('聖戦士の奇襲兵',   'creature', 'white', '{1}{W}',    2, 1,
 '瞬速を持つ。（1）、このクリーチャーを生け贄に捧げる：アーティファクトかエンチャント1つを破壊する。',
 '[{"type":"flash"},{"type":"activated_ability","cost":"1","sacrifice_self":true,"effect":"destroy_artifact_or_enchantment","targeting":"any_artifact_or_enchantment"}]', 600),

('不屈の古参兵',     'creature', 'white', '{1}{W}',    3, 1,
 'カードを1枚捨てる：不屈の古参兵をタップする。それはターン終了時まで破壊不能を得る。',
 '[{"type":"activated_ability","cost":"discard_card","tap_self":true,"effect":"grant_indestructible_eot"}]', 700),

('鼓舞する監視者',   'creature', 'white', '{2}{W}',    2, 1,
 '飛行、絆魂を持つ。鼓舞する監視者が戦場に出たとき、ライフを1点得てカードを1枚引く。',
 '[{"type":"flying"},{"type":"lifelink"},{"type":"etb_trigger","effect":"gain_life","value":1},{"type":"etb_trigger","effect":"draw_cards","value":1}]', 700),

('オドリックの十字軍','creature', 'white', '{2}{W}',    2, 2,
 '警戒を持つ。このクリーチャーのパワーとタフネスはそれぞれあなたがコントロールするクリーチャーの数に等しい。',
 '[{"type":"vigilance"},{"type":"pt_equals_count","effect":"creatures_controlled"}]', 700),

('絢爛たる天使',     'creature', 'white', '{2}{W}',    2, 3,
 '飛行を持つ。他のクリーチャーが自分のコントロール下で戦場に出るたび、ライフを1点得る。',
 '[{"type":"flying"},{"type":"subtype_angel"},{"type":"ally_etb_trigger","condition":"other_creature","effect":"gain_life","value":1}]', 700),

('セラの天使',       'creature', 'white', '{3}{W}{W}', 4, 4,
 '飛行、警戒を持つ。',
 '[{"type":"flying"},{"type":"vigilance"}]', 1400),

('信仰の伝令',       'creature', 'white', '{3}{W}{W}', 4, 3,
 '飛行、絆魂を持つ。信仰の伝令が攻撃するたび、ライフを2点得る。',
 '[{"type":"flying"},{"type":"lifelink"},{"type":"attack_trigger","effect":"gain_life","value":2}]', 1200),

('光の模範',         'creature', 'white', '{2}{W}{W}', 3, 3,
 '飛行を持つ。ライフを得るたびこのクリーチャーの上に＋1/＋1カウンターを置く。このクリーチャーにカウンターが置かれるたびカードを引く。',
 '[{"type":"flying"},{"type":"gain_life_trigger","effect":"counter_p1p1","value":1},{"type":"on_counter_trigger","effect":"draw_cards","value":1}]', 1100),

('黎明をもたらす者ライラ', 'creature', 'white', '{3}{W}{W}', 5, 5,
 '伝説のクリーチャー。飛行、先制攻撃、絆魂を持つ。あなたのコントロールする他の天使は＋1/＋1の修整を受けるとともに絆魂を持つ。',
 '[{"type":"flying"},{"type":"first_strike"},{"type":"lifelink"},{"type":"subtype_angel"},{"type":"lord_effect","subtype":"angel","power_bonus":1,"toughness_bonus":1,"grant_keywords":["lifelink"]}]', 2500),

('不動の女王、リンデン', 'creature', 'white', '{W}{W}{W}', 3, 3,
 '伝説のクリーチャー。警戒、絆魂を持つ。あなたのコントロールする白のクリーチャーが攻撃するたび、ライフを1点得る。',
 '[{"type":"vigilance"},{"type":"lifelink"},{"type":"ally_attack_trigger","condition":"white_creature","effect":"gain_life","value":1}]', 2000),

('金剛牝馬',         'creature', 'white', '{2}',       1, 3,
 'アーティファクト・クリーチャー。金剛牝馬が戦場に出るとき、色を1色選ぶ。その色の呪文を唱えるたびライフを1点得る。',
 '[{"type":"etb_choose_color"},{"type":"on_cast_trigger","condition":"chosen_color_spell","effect":"gain_life","value":1}]', 500),

('内陸の聖別者',     'creature', 'white', '{W}',       1, 1,
 '警戒を持つ。他のクリーチャーが自分のコントロール下で戦場に出るたびライフを1点得る。',
 '[{"type":"vigilance"},{"type":"ally_etb_trigger","condition":"other_creature","effect":"gain_life","value":1}]', 400),

-- ── 白インスタント ───────────────────────────────────────────
('突き通し',         'instant',  'white', '{1}{W}',   null, null,
 'クリーチャー1体を対象とし、ターン終了時までそれは＋2/＋0の修整を受け先制攻撃を得る。',
 '[{"type":"pump_creature","power":2,"toughness":0,"grant_keywords":["first_strike"]}]', 500),

('制覇の時',         'instant',  'white', '{W}',      null, null,
 'クリーチャー1体を対象とし、ターン終了時までそれは＋2/＋2の修整を受ける。あなたはライフを2点得る。',
 '[{"type":"pump_creature","power":2,"toughness":2},{"type":"gain_life","value":2}]', 500),

-- ── 白エンチャント ───────────────────────────────────────────
('平和な心',         'enchantment', 'white', '{1}{W}', null, null,
 'エンチャント（クリーチャー）。エンチャントされているクリーチャーは攻撃もブロックもできない。',
 '[{"type":"aura","enchant":"creature"},{"type":"prevent_combat"}]', 500),

('払拭の光',         'enchantment', 'white', '{2}{W}', null, null,
 '瞬速を持つ。戦場に出たとき、対戦相手のコントロールする土地でないパーマネント1つを追放する。',
 '[{"type":"flash"},{"type":"etb_exile_target","target":"opp_permanent","gain":0}]', 800),

('束縛の祈り手',     'enchantment', 'white', '{3}{W}', null, null,
 '瞬速を持つ。戦場に出たとき、対戦相手のパーマネント1つを追放してライフ2点を得る。',
 '[{"type":"flash"},{"type":"etb_exile_target","target":"opp_permanent","gain":2}]', 900),

-- ── 土地 ─────────────────────────────────────────────────────
('謎めいた洞窟',     'land', 'colorless', null, null, null,
 'タップ：無色マナ（{C}）を1点加える。{1}、タップ、謎めいた洞窟を生け贄に捧げる：カードを1枚引く。この能力は土地を5枚以上コントロールしている場合にのみ起動できる。',
 '[{"type":"activated_ability","cost":"1","tap_self":true,"sacrifice_self":true,"effect":"draw_cards","value":1,"condition":"controls_5_lands"}]', 300),

-- ════════════════════════════════════════════════════════════════
-- 青単デッキ
-- ════════════════════════════════════════════════════════════════

-- ── 青クリーチャー ───────────────────────────────────────────
('帆凧の海賊',       'creature', 'blue', '{1}{U}',       2, 1,
 '帆凧の海賊が攻撃しているかぎり、これは飛行を持つ。',
 '[{"type":"conditional_keyword","condition":"self_attacking","grant":"flying"}]', 400),

('幽体の船乗り',     'creature', 'blue', '{U}',           1, 1,
 '瞬速、飛行を持つ。（4）（青）：カードを1枚引く。',
 '[{"type":"flash"},{"type":"flying"},{"type":"activated_ability","cost_str":"{4}{U}","effect":"draw_cards","value":1}]', 500),

('終止符のスフィンクス', 'creature', 'blue', '{5}{U}{U}', 5, 5,
 '終止符のスフィンクスは打ち消されない。飛行、呪禁を持つ。あなたがコントロールするインスタントとソーサリーは打ち消されない。（呪文保護は現在未実装）',
 '[{"type":"flying"},{"type":"hexproof"}]', 3000),

('氷嵐の精霊',       'creature', 'blue', '{4}{U}',       3, 4,
 '飛行を持つ。氷嵐の精霊が戦場に出たとき、カードを1枚引き、その後カードを1枚捨てる。',
 '[{"type":"flying"},{"type":"etb_trigger","effect":"draw_then_discard","value":1}]', 500),

('風雲艦隊のスパイ', 'creature', 'blue', '{2}{U}',       2, 2,
 '強襲 ― 風雲艦隊のスパイが戦場に出たとき、あなたがこのターンに攻撃していた場合、カードを1枚引く。（強襲ETBは現在未実装）',
 '[]', 400),

('大ヒレの用心棒',   'creature', 'blue', '{3}{U}',       3, 2,
 '大ヒレの用心棒が戦場に出たとき、対戦相手がコントロールするクリーチャー1体を対象とし、それをオーナーの手札に戻す。',
 '[{"type":"etb_trigger","effect":"pending_bounce_opp_creature"}]', 600),

('ルーン封じの壁',   'creature', 'blue', '{2}{U}',       0, 6,
 'アーティファクト・クリーチャー。防衛を持つ。タップ：諜報1を行う。（諜報は現在未実装）',
 '[{"type":"defender"}]', 400),

('大嵐のジン',       'creature', 'blue', '{U}{U}{U}',    0, 4,
 '飛行を持つ。大嵐のジンはあなたがコントロールする基本島1枚につき＋1/＋0の修整を受ける。',
 '[{"type":"flying"},{"type":"power_per_count","effect":"basic_island_count"}]', 1000),

('全能なる者アルカニス', 'creature', 'blue', '{3}{U}{U}{U}', 3, 4,
 '伝説のクリーチャー。タップ：カードを3枚引く。',
 '[{"type":"activated_ability","cost":null,"tap_self":true,"effect":"draw_cards","value":3}]', 2500),

('嘲笑するスプライト', 'creature', 'blue', '{2}{U}',     2, 2,
 '飛行を持つ。あなたがインスタントやソーサリーである呪文を唱えるためのコストは（1）少なくなる。（コスト軽減は現在未実装）',
 '[{"type":"flying"}]', 500),

('大梟の見張り',     'creature', 'blue', '{1}{U}',       1, 2,
 '飛行、警戒を持つ。（1）（青）、タップ：カードを1枚引き、その後カードを1枚捨てる。',
 '[{"type":"flying"},{"type":"vigilance"},{"type":"activated_ability","cost_str":"{1}{U}","tap_self":true,"effect":"draw_then_discard","value":1}]', 400),

('神盾の海亀',       'creature', 'blue', '{U}',           0, 5,
 '',
 '[]', 200),

-- ── 青インスタント ───────────────────────────────────────────
('論破',             'instant',  'blue', '{1}{U}{U}',   null, null,
 '呪文1つを対象とし、それを打ち消す。カードを1枚引き、その後カードを1枚捨てる。',
 '[{"type":"counter_spell"},{"type":"draw_then_discard","value":1}]', 500),

('熟慮',             'instant',  'blue', '{1}{U}',       null, null,
 'カードを1枚引く。フラッシュバック（2）（青）',
 '[{"type":"draw_cards","value":1},{"type":"flashback","value":"{2}{U}"}]', 300),

('未知なる航海',     'instant',  'blue', '{3}{U}',       null, null,
 'クリーチャー1体を対象とし、そのオーナーはそれをライブラリーの一番上か一番下に置く。諜報1を行う。（効果は現在未実装）',
 '[]', 500),

('霊気化',           'instant',  'blue', '{3}{U}',       null, null,
 '攻撃しているクリーチャーをすべてオーナーの手札に戻す。',
 '[{"type":"bounce_all_attackers"}]', 600),

('送還',             'instant',  'blue', '{U}',           null, null,
 'クリーチャー1体を対象とし、それをオーナーの手札に戻す。',
 '[{"type":"bounce_creature"}]', 300),

('速足の学び',       'instant',  'blue', '{2}{U}',       null, null,
 'カードを2枚引く。',
 '[{"type":"draw_cards","value":2}]', 500),

-- ── 青エンチャント ───────────────────────────────────────────
('星明かりの罠',     'enchantment', 'blue', '{2}{U}',   null, null,
 'エンチャント（クリーチャー）。星明かりの罠が戦場に出たとき、エンチャントされているクリーチャーをタップする。エンチャントされているクリーチャーはそのコントローラーのアンタップ・ステップにアンタップしない。',
 '[{"type":"aura","enchant":"opp_creature"},{"type":"etb_trigger","effect":"tap_attached"},{"type":"prevent_untap"}]', 400),

-- ════════════════════════════════════════════════════════════════
-- 黒単デッキ
-- ════════════════════════════════════════════════════════════════

-- ── 黒クリーチャー ───────────────────────────────────────────
('吸血鬼の侵入者',     'creature', 'black', '{1}{B}',       2, 1,
 '飛行を持つ。吸血鬼の侵入者はブロックに参加できない。',
 '[{"type":"flying"},{"type":"cant_block"}]', 400),

('腑抜けの略奪者',     'creature', 'black', '{2}{B}',       2, 2,
 '接死を持つ。強襲 ― 腑抜けの略奪者が戦場に出たとき、あなたがこのターンに攻撃していた場合、あなたのライブラリーの上から3枚を見る。そのうち1枚をライブラリーの一番上に置き、残りを墓地に置く。',
 '[{"type":"deathtouch"},{"type":"etb_trigger","condition":"raid","effect":"raid_look_top","n":3,"keep":1}]', 400),

('吸血鬼の新生子',     'creature', 'black', '{B}',           0, 3,
 '（2）、タップ：各対戦相手は1点のライフを失い、あなたは1点のライフを得る。',
 '[{"type":"activated_ability","cost":"2","tap_self":true,"effect":"drain_each_opp","damage":1,"gain":1}]', 300),

('吸血鬼の大食家',     'creature', 'black', '{1}{B}',       2, 2,
 '吸血鬼の大食家が攻撃するたび、あなたは他のクリーチャー1体を生け贄に捧げてもよい。そうしたなら、カードを1枚引き、吸血鬼の大食家はこのターンブロックされない。（攻撃誘発は現在未実装）',
 '[]', 500),

('流城の血泥棒',       'creature', 'black', '{2}{B}',       2, 2,
 'あなたのエンドステップの開始時に、対戦相手がこのターンにライフを失っていた場合、あなたのコントロールする吸血鬼1体の上に＋1/＋1カウンターを1個置く。（誘発型能力は現在未実装）',
 '[]', 500),

('吸血鬼の魂呼び',     'creature', 'black', '{4}{B}',       3, 2,
 '飛行を持つ。吸血鬼の魂呼びはブロックに参加できない。吸血鬼の魂呼びが戦場に出たとき、あなたの墓地にあるクリーチャー・カード1枚を対象とし、それをオーナーの手札に戻す。',
 '[{"type":"flying"},{"type":"cant_block"},{"type":"etb_trigger","effect":"pending_return_hand_from_gy","restriction":"creature"}]', 600),

('交叉路の騒動屋',     'creature', 'black', '{5}{B}',       5, 5,
 'あなたがコントロールする攻撃している吸血鬼はすべて接死と絆魂を持つ。あなたがコントロールする吸血鬼1体が死亡するたび、あなたは2点のライフを支払ってもよい。そうしたなら、カードを1枚引く。（ロード/誘発型能力は現在未実装）',
 '[]', 1500),

('吸血鬼の夜鷲',       'creature', 'black', '{1}{B}{B}',   2, 3,
 '飛行、接死、絆魂を持つ。',
 '[{"type":"flying"},{"type":"deathtouch"},{"type":"lifelink"}]', 1200),

('カラストリアの貴人', 'creature', 'black', '{B}{B}',       2, 2,
 'このクリーチャーか他の吸血鬼があなたのコントロール下で墓地に置かれるたび、あなたは（黒）を支払ってもよい。そうしたなら、対戦相手1人は2点のライフを失い、あなたは2点のライフを得る。（誘発型能力は現在未実装）',
 '[]', 1000),

('復讐に燃えた血術師', 'creature', 'black', '{1}{B}',       1, 1,
 'このクリーチャーか他のクリーチャーがあなたのコントロール下で死亡するたび、対戦相手1人は1点のライフを失い、あなたは1点のライフを得る。（誘発型能力は現在未実装）',
 '[]', 700),

('吸血鬼の落とし子',   'creature', 'black', '{2}{B}',       2, 2,
 '吸血鬼の落とし子が戦場に出たとき、各対戦相手は2点のライフを失い、あなたは2点のライフを得る。',
 '[{"type":"etb_trigger","effect":"drain_each_opp","damage":2,"life":2}]', 600),

('虐殺のワーム',       'creature', 'black', '{3}{B}{B}{B}', 6, 5,
 '虐殺のワームが戦場に出たとき、ターン終了時まで、対戦相手がコントロールするすべてのクリーチャーは－2/－2の修整を受ける。',
 '[{"type":"etb_trigger","effect":"minus_all_opp_creatures_eot","power":-2,"toughness":-2}]', 2000),

('税血の徴収者',       'creature', 'black', '{4}{B}',       3, 4,
 '飛行を持つ。税血の徴収者が戦場に出たとき、このターンに対戦相手がライフを失っていた場合、各対戦相手はカードを1枚捨てる。（ETB効果は現在未実装）',
 '[{"type":"flying"}]', 800),

('マラキールの門番',   'creature', 'black', '{B}{B}',       2, 2,
 'キッカー（黒）。マラキールの門番が戦場に出たとき、それがキッカーされていた場合、プレイヤー1人を対象とする。そのプレイヤーはクリーチャーを1体生け贄に捧げる。（キッカー/ETB効果は現在未実装）',
 '[]', 800),

('血なまぐさい吸血者', 'creature', 'black', '{1}{B}',       1, 3,
 '血なまぐさい吸血者が攻撃するたび、各対戦相手は1点のライフを失い、あなたは1点のライフを得る。',
 '[{"type":"attack_trigger","effect":"drain_each_opp","value":1}]', 400),

('鼓動の追跡者',       'creature', 'black', '{B}',           1, 1,
 '鼓動の追跡者が攻撃するたび、各対戦相手は1点のライフを失う。',
 '[{"type":"attack_trigger","effect":"deal_each_opp","value":1}]', 300),

-- ── 黒インスタント ───────────────────────────────────────────
('英雄の破滅',         'instant',  'black', '{1}{B}{B}',   null, null,
 'クリーチャー1体かプレインズウォーカー1体を対象とし、それを破壊する。',
 '[{"type":"destroy_creature"}]', 1000),

-- ── 黒ソーサリー ─────────────────────────────────────────────
('踊り食い',           'sorcery',  'black', '{B}',           null, null,
 '追加コストとして、クリーチャー1体を生け贄に捧げるか{3}{B}を支払う。クリーチャー1体を対象とし、それを追放する。',
 '[{"type":"additional_cost","pay_mana":"{3}{B}"},{"type":"exile_creature"}]', 500),

('ゾンビ化',           'sorcery',  'black', '{3}{B}',       null, null,
 'あなたの墓地にあるクリーチャー・カード1枚を対象とし、それを戦場に戻す。',
 '[{"type":"reanimate"}]', 800),

('死の円舞曲',         'sorcery',  'black', '{1}{B}',       null, null,
 'あなたの墓地にあるクリーチャー・カードを最大2枚まで対象とし、それらをオーナーの手札に戻す。その後、カードを1枚捨てる。',
 '[{"type":"return_from_gy","count":2,"restriction":"creature","then_discard":1}]', 500),

-- ── 土地 ─────────────────────────────────────────────────────
('ならず者の道',       'land', 'colorless', null, null, null,
 'タップ：無色マナ（{C}）を1点加える。（4）、タップ：あなたがコントロールするクリーチャー1体を対象とする。それはターン終了時までブロックされない。（起動型能力は現在未実装）',
 '[]', 400),

-- ════════════════════════════════════════════════════════════════
-- 赤単デッキ
-- ════════════════════════════════════════════════════════════════

-- ── 赤クリーチャー ───────────────────────────────────────────
('炎吐きの仔竜',       'creature', 'red', '{2}{R}',       2, 2,
 '飛行を持つ。あなたがクリーチャーでない呪文かドラゴン呪文を唱えるたび、炎吐きの仔竜は各対戦相手に1点のダメージを与える。',
 '[{"type":"flying"},{"type":"subtype_dragon"},{"type":"on_cast_trigger","condition":"noncreature_or_dragon","effect":"deal_each_opp","value":1}]', 400),

('カルガの竜騎兵',     'creature', 'red', '{1}{R}',       2, 2,
 'あなたがドラゴンをコントロールしているかぎり、カルガの竜騎兵は飛行を持つ。',
 '[{"type":"conditional_keyword","condition":"controls_dragon","grant":"flying"}]', 500),

('炎の大口、ドラクセス', 'creature', 'red', '{4}{R}{R}{R}', 7, 7,
 '伝説のクリーチャー。飛行を持つ。炎の大口、ドラクセスが攻撃するたび、それは相手プレイヤーに4点のダメージを与え、相手クリーチャー最大2体にそれぞれ3点のダメージを与える。',
 '[{"type":"flying"},{"type":"subtype_dragon"},{"type":"attack_trigger","effect":"drakuseth_damage","primary_dmg":4,"secondary_dmg":3,"secondary_count":2}]', 1500),

('火吹きラガーク',     'creature', 'red', '{3}{R}',       3, 4,
 '上陸 ― あなたのコントロール下で土地が戦場に出るたび、火吹きラガークは各対戦相手に1点のダメージを与える。',
 '[{"type":"landfall_trigger","effect":"deal_each_opp","value":1}]', 400),

('龍王の召使い',       'creature', 'red', '{1}{R}',       1, 3,
 'あなたがドラゴン呪文を唱えるためのコストは（1）少なくなる。（コスト軽減は現在未実装）',
 '[]', 600),

('アクスガルドの騎兵', 'creature', 'red', '{1}{R}',       2, 2,
 'タップ：クリーチャー1体を対象とする。それはターン終了時まで速攻を得る。（起動型能力は現在未実装）',
 '[]', 400),

('ヴェリュス山の恐怖', 'creature', 'red', '{5}{R}{R}',   5, 5,
 '飛行、二段攻撃を持つ。ヴェリュス山の恐怖が戦場に出たとき、あなたがコントロールするクリーチャーはターン終了時まで二段攻撃を得る。',
 '[{"type":"flying"},{"type":"double_strike"},{"type":"etb_trigger","effect":"grant_all_allies_keyword_eot","keyword":"double_strike"}]', 1500),

('真鎖の炎い魔',       'creature', 'red', '{1}{R}{R}',   3, 3,
 '速攻を持つ。',
 '[{"type":"haste"}]', 400),

('原初の嵐、エターリ', 'creature', 'red', '{4}{R}{R}',   6, 6,
 '伝説のクリーチャー。原初の嵐、エターリが攻撃するたび、各プレイヤーのライブラリーの一番上のカードを追放する。あなたはそれらのカードの中から望む枚数の呪文をマナ・コストを支払わずに唱えてもよい。（攻撃誘発は現在未実装）',
 '[]', 2000),

('空荒らしの巨人',     'creature', 'red', '{2}{R}{R}',   4, 3,
 '到達を持つ。',
 '[{"type":"reach"}]', 500),

('シヴ山のドラゴン',   'creature', 'red', '{4}{R}{R}',   5, 5,
 '飛行を持つ。（赤）：ターン終了時まで、シヴ山のドラゴンは＋1/＋0の修整を受ける。',
 '[{"type":"flying"},{"type":"subtype_dragon"},{"type":"activated_ability","cost":"R","effect":"pump_self","power":1,"toughness":0}]', 1000),

('狂信的扇動者',       'creature', 'red', '{R}',           1, 1,
 '速攻を持つ。タップ、狂信的扇動者を生け贄に捧げる：任意の対象1つに1点のダメージを与える。（起動型能力は現在未実装）',
 '[{"type":"haste"}]', 300),

-- ── 赤アーティファクト ───────────────────────────────────────
('カーネリアン・オーブ・オヴ・ドラゴンカインド', 'artifact', 'colorless', '{2}{R}', null, null,
 'タップ：（赤）を加える。このマナがドラゴン・クリーチャー呪文を唱えるために使われた場合、そのクリーチャーはターン終了時まで速攻を得る。（マナ能力は現在未実装）',
 '[]', 600),

-- ── 赤インスタント ───────────────────────────────────────────
('噴出の稲妻',         'instant',  'red', '{R}',           null, null,
 'キッカー（4）。クリーチャー1体かプレインズウォーカー1体かプレイヤー1人を対象とする。噴出の稲妻はそれに2点のダメージを与える。キッカーされていた場合、代わりに4点のダメージを与える。',
 '[{"type":"deal_damage","value":2,"kicked_value":4},{"type":"kicker","value":"4"}]', 400),

('焦熱の竜火',         'instant',  'red', '{1}{R}',       null, null,
 'クリーチャーかプレインズウォーカー1体を対象とする。それに3点のダメージを与える。このターン、それが死亡するなら、代わりにそれを追放する。（追放効果は現在未実装）',
 '[{"type":"deal_damage","value":3}]', 400),

-- ── 赤ソーサリー ─────────────────────────────────────────────
('焼却破',             'sorcery',  'red', '{4}{R}',       null, null,
 'クリーチャー1体を対象とし、それに6点のダメージを与える。あなたはカードを1枚捨ててもよい。そうしたなら、カードを1枚引く。（ドロー効果は現在未実装）',
 '[{"type":"deal_damage","value":6}]', 400),

-- ════════════════════════════════════════════════════════════════
-- 緑単デッキ
-- ════════════════════════════════════════════════════════════════

-- ── 緑クリーチャー ───────────────────────────────────────────
('ラノワールのエルフ',     'creature', 'green', '{G}',           1, 1,
 'タップ：（緑）を加える。',
 '[{"type":"tap_for_mana","mana":"G"}]', 300),

('打ち壊すブロントドン',   'creature', 'green', '{1}{G}{G}',     3, 4,
 '（1）、打ち壊すブロントドンを生け贄に捧げる：アーティファクト1つかエンチャント1つを対象とし、それを破壊する。',
 '[{"type":"activated_ability","cost":"1","sacrifice_self":true,"effect":"destroy_artifact_or_enchantment","targeting":"any_artifact_or_enchantment"}]', 500),

('温厚な司書',             'creature', 'green', '{G}',           1, 1,
 '夜明け（あなたのターンに呪文を唱えなかった場合、次のターンに夜になる）。（2）：あなたのライブラリーの上から3枚を見る。そのうち1枚を手札に加え、残りを好きな順でライブラリーの一番下に置く。（昼夜変身・起動型能力は現在未実装）',
 '[]', 400),

('マグニゴスの歩哨',       'creature', 'green', '{3}{G}',        4, 4,
 '到達を持つ。',
 '[{"type":"reach"}]', 500),

('春花のドルイド',         'creature', 'green', '{2}{G}',        1, 1,
 '春花のドルイドが戦場に出たとき、土地1枚を生け贄に捧げてもよい。そうしたなら、あなたのライブラリーから基本土地カードを最大2枚まで探し、それらをタップ状態で戦場に出し、その後ライブラリーを切り直す。（ETB効果は現在未実装）',
 '[]', 500),

('ソーンウィールドの射手', 'creature', 'green', '{1}{G}',        2, 1,
 '到達、接死を持つ。',
 '[{"type":"reach"},{"type":"deathtouch"}]', 600),

('野心の発動者',           'creature', 'green', '{2}{G}{G}',     4, 3,
 '（8）：クリーチャー1体を対象とする。それはターン終了時まで＋5/＋5の修整を受けるとともにトランプルを持つ。（起動型能力は現在未実装）',
 '[]', 500),

('用心深い演劇役者',       'creature', 'green', '{1}{G}',        3, 1,
 '用心深い演劇役者が戦場に出るか死亡するたび、諜報1を行う。（諜報/誘発型能力は現在未実装）',
 '[]', 400),

('エルフの再生家',         'creature', 'green', '{2}{G}{G}',     4, 3,
 'エルフの再生家が戦場に出たとき、あなたの墓地にあるパーマネント・カード1枚を対象とし、それをオーナーの手札に戻す。',
 '[{"type":"etb_trigger","effect":"pending_return_hand_from_gy","restriction":"any"}]', 600),

('狩猟の統率者、スーラク', 'creature', 'green', '{2}{G}{G}',     5, 4,
 '伝説のクリーチャー。狩猟の統率者、スーラクが戦場に出たとき、あなたのコントロールするクリーチャーのパワーの合計が8以上であれば、あなたのコントロールするクリーチャーはターン終了時まで速攻を得る。',
 '[{"type":"etb_trigger","effect":"grant_haste_if_power_gte","threshold":8}]', 800),

('優しいインドリク',       'creature', 'green', '{5}{G}',        6, 6,
 '優しいインドリクが戦場に出たとき、対戦相手がコントロールするクリーチャー1体を対象とするファイトを選んでもよい。（ETB格闘は現在未実装）',
 '[]', 700),

('生類の侍臣',             'creature', 'green', '{3}{G}',        3, 4,
 'あなたはいつでもあなたのライブラリーの一番上のカードを見ることができる。あなたはあなたのライブラリーの一番上からクリーチャー呪文を唱えてもよい。あなたはクリーチャー呪文を唱えるために任意の色のマナを使用できる。（起動型能力は現在未実装）',
 '[]', 1500),

('樹上の罠紡ぎ',           'creature', 'green', '{3}{G}',        1, 4,
 '到達、接死を持つ。（2）（緑）：あなたのコントロールするクリーチャー1体の上に＋1/＋1カウンターを1個置く。この能力はソーサリーとしてのみ起動できる。（起動型能力は現在未実装）',
 '[{"type":"reach"},{"type":"deathtouch"}]', 500),

-- ── 緑インスタント ───────────────────────────────────────────
('噛み締め',               'instant',  'green', '{1}{G}',        null, null,
 'あなたのコントロールするクリーチャー1体を対象とする。それはあなたがコントロールしないクリーチャーかプレインズウォーカー1体を対象とし、それにパワーに等しい点数のダメージを与える。（格闘効果は現在未実装）',
 '[]', 400),

('壊れた翼',               'instant',  'green', '{2}{G}',        null, null,
 'アーティファクト1つ、エンチャント1つ、または飛行を持つクリーチャー1体を対象とし、それを破壊する。',
 '[{"type":"destroy_permanent","restriction":"artifact_enchantment_or_flying"}]', 400),

-- ── 緑ソーサリー ─────────────────────────────────────────────
('薮打ち',                 'sorcery',  'green', '{G}',           null, null,
 '以下から1つを選ぶ。「あなたの手札にある基本土地カード1枚をタップ状態で戦場に出す。」「あなたのコントロールするクリーチャー1体を対象とし、対戦相手がコントロールするクリーチャー1体を対象とするファイトを行う。」（効果は現在未実装）',
 '[]', 300),

('原初の力',               'sorcery',  'green', '{X}{G}',        null, null,
 'あなたのコントロールするクリーチャー1体を対象とする。それはターン終了時まで＋X/＋Xの修整を受ける。その後、最大1体の対戦相手がコントロールするクリーチャーとファイトを行う。（格闘効果は現在未実装）',
 '[]', 500),

-- ── 緑エンチャント ───────────────────────────────────────────
('ブランチウッドの鎧',     'enchantment', 'green', '{2}{G}',     null, null,
 'エンチャント（クリーチャー）。エンチャントされているクリーチャーは、あなたがコントロールする森1枚につき＋1/＋1の修整を受ける。',
 '[{"type":"aura","enchant":"creature"},{"type":"pump_per_count","effect":"forest_count","power":1,"toughness":1}]', 400),

-- ════════════════════════════════════════════════════════════════
-- 追加カードプール v2
-- ════════════════════════════════════════════════════════════════

-- ── 白クリーチャー ───────────────────────────────────────────
('鉄壁の騎士',   'creature', 'white', '{2}{W}{W}', 4, 4,
 '破壊不能を持つ。',
 '[{"type":"indestructible"}]', 1400),

('聖別の精霊',   'creature', 'white', '{4}{W}',    3, 3,
 '飛行、絆魂を持つ。',
 '[{"type":"flying"},{"type":"lifelink"}]', 900),

('光輝の護衛',   'creature', 'white', '{W}',       1, 2,
 '警戒を持つ。',
 '[{"type":"vigilance"}]', 350),

('二段の聖騎士', 'creature', 'white', '{2}{W}',    2, 2,
 '二段攻撃を持つ。',
 '[{"type":"double_strike"}]', 1000),

('神の守護者',   'creature', 'white', '{3}{W}{W}', 4, 5,
 '飛行、警戒、破壊不能を持つ。',
 '[{"type":"flying"},{"type":"vigilance"},{"type":"indestructible"}]', 2200),

-- ── 白スペル ────────────────────────────────────────────────
('復活の儀式',   'sorcery',  'white', '{2}{W}',    null, null,
 'あなたの墓地にあるクリーチャー1体を戦場に戻す。',
 '[{"type":"reanimate"}]', 1000),

('輝かしき一撃', 'instant',  'white', '{W}',       null, null,
 'クリーチャー1体を対象とし、ターン終了時までそれは+2/+2の修整を受ける。',
 '[{"type":"pump_creature","power":2,"toughness":2}]', 500),

('浄化の光',     'instant',  'white', '{1}{W}',    null, null,
 'エンチャントかアーティファクト1つを対象とし、それを破壊する。',
 '[{"type":"destroy_permanent","restriction":"artifact_or_enchantment"}]', 600),

-- ── 青クリーチャー ───────────────────────────────────────────
('深海の番人',   'creature', 'blue',  '{3}{U}',    1, 6,
 '防衛、呪禁、飛行を持つ。',
 '[{"type":"defender"},{"type":"hexproof"},{"type":"flying"}]', 900),

('時の賢者',     'creature', 'blue',  '{2}{U}',    2, 2,
 '時の賢者が戦場に出た時、カードを1枚引く。',
 '[]', 700),

('波紋の精霊',   'creature', 'blue',  '{3}{U}{U}', 4, 4,
 '飛行、二段攻撃を持つ。',
 '[{"type":"flying"},{"type":"double_strike"}]', 1800),

('霧の忍者',     'creature', 'blue',  '{1}{U}',    2, 1,
 '瞬速、被覆を持つ。',
 '[{"type":"flash"},{"type":"shroud"}]', 700),

-- ── 青スペル ────────────────────────────────────────────────
('時間の逆行',   'sorcery',  'blue',  '{3}{U}',    null, null,
 'パーマネント1つを対象とし、それをオーナーの手札に戻す。',
 '[{"type":"bounce_permanent"}]', 900),

('知識の泉',     'sorcery',  'blue',  '{4}{U}',    null, null,
 'カードを3枚引く。',
 '[{"type":"draw_cards","value":3}]', 1000),

('波の消去',     'instant',  'blue',  '{1}{U}',    null, null,
 '呪文1つを対象とし、そのコントローラーが{3}を支払わないかぎり、それを打ち消す。',
 '[{"type":"counter_spell","unless_pay":"{3}"}]', 800),

-- ── 黒クリーチャー ───────────────────────────────────────────
('疫病の騎士',   'creature', 'black', '{B}{B}',    2, 2,
 '速攻、接死を持つ。',
 '[{"type":"haste"},{"type":"deathtouch"}]', 900),

('死の収穫者',   'creature', 'black', '{3}{B}{B}', 5, 3,
 '威迫、接死を持つ。',
 '[{"type":"menace"},{"type":"deathtouch"}]', 1200),

('暗黒の吸血鬼', 'creature', 'black', '{3}{B}',    3, 3,
 '飛行、絆魂を持つ。',
 '[{"type":"flying"},{"type":"lifelink"}]', 1100),

('墓掘りの亡者', 'creature', 'black', '{2}{B}',    3, 1,
 '速攻を持つ。アンアース（{2}{B}）',
 '[{"type":"haste"},{"type":"unearth","value":"{2}{B}"}]', 700),

-- ── 黒スペル ────────────────────────────────────────────────
('魂の吸収',     'instant',  'black', '{1}{B}',    null, null,
 'クリーチャー1体を対象とし、ターン終了時までそれは-2/-2の修整を受ける。',
 '[{"type":"pump_creature","power":-2,"toughness":-2}]', 600),

('骨の嵐',       'sorcery',  'black', '{2}{B}',    null, null,
 '黒でないクリーチャー1体を対象とし、それを破壊する。',
 '[{"type":"destroy_creature","restriction":"non_black"}]', 900),

-- ── 赤クリーチャー ───────────────────────────────────────────
('二段攻撃の戦士','creature', 'red',   '{2}{R}',   2, 2,
 '二段攻撃を持つ。',
 '[{"type":"double_strike"}]', 900),

('炎の竜',       'creature', 'red',   '{4}{R}{R}', 5, 4,
 '飛行、速攻を持つ。',
 '[{"type":"flying"},{"type":"haste"}]', 1500),

('爆走のゴブリン','creature', 'red',   '{R}',      1, 1,
 '速攻を持つ。',
 '[{"type":"haste"}]', 350),

('荒ぶる巨人',   'creature', 'red',   '{3}{R}',    4, 3,
 'トランプル、速攻を持つ。',
 '[{"type":"trample"},{"type":"haste"}]', 1000),

-- ── 赤スペル ────────────────────────────────────────────────
('急速攻撃',     'instant',  'red',   '{R}',       null, null,
 'クリーチャー1体を対象とし、ターン終了時までそれは+2/+0の修整を受け速攻を得る。',
 '[{"type":"pump_creature","power":2,"toughness":0,"grant_keywords":["haste"]}]', 500),

('山崩し',       'sorcery',  'red',   '{3}{R}',    null, null,
 '各対戦相手とそのコントロールする各クリーチャーに2点のダメージを与える。',
 '[{"type":"deal_damage_all","value":2}]', 800),

('炎の矢',       'instant',  'red',   '{1}{R}',    null, null,
 'クリーチャーかプレイヤー1人を対象とし、それに3点のダメージを与える。フラッシュバック（{3}{R}）',
 '[{"type":"deal_damage","value":3},{"type":"flashback","value":"{3}{R}"}]', 700),

-- ── 緑クリーチャー ───────────────────────────────────────────
('古代の巨木',   'creature', 'green', '{4}{G}{G}', 7, 7,
 'トランプルを持つ。',
 '[{"type":"trample"}]', 1300),

('到達の射手',   'creature', 'green', '{2}{G}',    2, 3,
 '到達を持つ。',
 '[{"type":"reach"}]', 500),

('毒の蜘蛛',     'creature', 'green', '{1}{G}',    1, 2,
 '到達、接死を持つ。',
 '[{"type":"reach"},{"type":"deathtouch"}]', 600),

('森の暴君',     'creature', 'green', '{3}{G}',    4, 4,
 'トランプルを持つ。',
 '[{"type":"trample"}]', 900),

-- ── 緑スペル ────────────────────────────────────────────────
('命の結束',     'instant',  'green', '{2}{G}',    null, null,
 'クリーチャー1体を対象とし、ターン終了時までそれは+4/+4の修整を受ける。',
 '[{"type":"pump_creature","power":4,"toughness":4}]', 800),

('森の恵み',     'sorcery',  'green', '{2}{G}',    null, null,
 'キッカー（{G}）\nカードを2枚引く。キッカーを支払った場合、カードをさらに1枚引く。',
 '[{"type":"draw_cards","value":2,"kicked_value":3},{"type":"kicker","value":"G"}]', 700),

-- ── アーティファクト ─────────────────────────────────────────
('鋼鉄の鎧',     'artifact', 'colorless', '{2}',   null, null,
 '装備しているクリーチャーは+2/+2の修整を受ける。\n装備（{2}）',
 '[{"type":"equip","value":2}]', 700),

('破壊の剣',     'artifact', 'colorless', '{3}',   null, null,
 '装備しているクリーチャーは+3/+1の修整を受け先制攻撃を持つ。\n装備（{3}）',
 '[{"type":"equip","value":3},{"type":"first_strike"}]', 1200),

('速度の輪',     'artifact', 'colorless', '{1}',   null, null,
 '装備しているクリーチャーは速攻を得る。\n装備（{1}）',
 '[{"type":"equip","value":1},{"type":"haste"}]', 600),

-- ── 多色 ────────────────────────────────────────────────────
('炎と氷の精',   'creature', 'multicolor', '{2}{R}{U}', 3, 3,
 '飛行、二段攻撃を持つ。',
 '[{"type":"flying"},{"type":"double_strike"}]', 1800),

('緑白の守護者', 'creature', 'multicolor', '{2}{G}{W}', 4, 4,
 '警戒、トランプルを持つ。',
 '[{"type":"vigilance"},{"type":"trample"}]', 1600),

('黒赤の略奪者', 'creature', 'multicolor', '{2}{B}{R}', 3, 2,
 '速攻、接死、威迫を持つ。',
 '[{"type":"haste"},{"type":"deathtouch"},{"type":"menace"}]', 2000),

('青緑の探求者', 'creature', 'multicolor', '{1}{U}{G}', 2, 3,
 '瞬速、到達を持つ。青緑の探求者が戦場に出た時、カードを1枚引く。',
 '[{"type":"flash"},{"type":"reach"}]', 1400)

ON CONFLICT (name) DO NOTHING;

-- 既存行のラノワールのエルフを更新（タップマナ能力追加）
UPDATE cards SET
  effect_text = 'タップ：（緑）を加える。',
  keywords = '[{"type":"tap_for_mana","mana":"G"}]'::jsonb
WHERE name = 'ラノワールのエルフ';

-- 既存行の光の模範を更新
UPDATE cards SET
  effect_text = '飛行を持つ。ライフを得るたびこのクリーチャーの上に＋1/＋1カウンターを置く。このクリーチャーにカウンターが置かれるたびカードを引く。',
  keywords = '[{"type":"flying"},{"type":"gain_life_trigger","effect":"counter_p1p1","value":1},{"type":"on_counter_trigger","effect":"draw_cards","value":1}]'::jsonb
WHERE name = '光の模範';

-- 既存行のオドリックの十字軍を更新（動的P/T追加）
UPDATE cards SET
  effect_text = '警戒を持つ。このクリーチャーのパワーとタフネスはそれぞれあなたがコントロールするクリーチャーの数に等しい。',
  keywords = '[{"type":"vigilance"},{"type":"pt_equals_count","effect":"creatures_controlled"}]'::jsonb
WHERE name = 'オドリックの十字軍';

-- 既存行の聖戦士の奇襲兵を更新（起動型能力追加）
UPDATE cards SET
  effect_text = '瞬速を持つ。（1）、このクリーチャーを生け贄に捧げる：アーティファクトかエンチャント1つを破壊する。',
  keywords = '[{"type":"flash"},{"type":"activated_ability","cost":"1","sacrifice_self":true,"effect":"destroy_artifact_or_enchantment","targeting":"any_artifact_or_enchantment"}]'::jsonb
WHERE name = '聖戦士の奇襲兵';

-- 既存行の信仰の伝令を更新（攻撃誘発追加）
UPDATE cards SET
  effect_text = '飛行、絆魂を持つ。信仰の伝令が攻撃するたび、ライフを2点得る。',
  keywords = '[{"type":"flying"},{"type":"lifelink"},{"type":"attack_trigger","effect":"gain_life","value":2}]'::jsonb
WHERE name = '信仰の伝令';

-- 既存行の ETB 実装カードを更新
UPDATE cards SET effect_text='警戒を持つ。お手伝いする狩人が戦場に出たとき、カードを1枚引く。',
  keywords='[{"type":"vigilance"},{"type":"etb_trigger","effect":"draw_cards","value":1}]'::jsonb WHERE name='お手伝いする狩人';
UPDATE cards SET effect_text='飛行、絆魂を持つ。鼓舞する監視者が戦場に出たとき、ライフを1点得てカードを1枚引く。',
  keywords='[{"type":"flying"},{"type":"lifelink"},{"type":"etb_trigger","effect":"gain_life","value":1},{"type":"etb_trigger","effect":"draw_cards","value":1}]'::jsonb WHERE name='鼓舞する監視者';
UPDATE cards SET effect_text='飛行を持つ。氷嵐の精霊が戦場に出たとき、カードを1枚引き、その後カードを1枚捨てる。',
  keywords='[{"type":"flying"},{"type":"etb_trigger","effect":"draw_then_discard","value":1}]'::jsonb WHERE name='氷嵐の精霊';
UPDATE cards SET effect_text='吸血鬼の落とし子が戦場に出たとき、各対戦相手は2点のライフを失い、あなたは2点のライフを得る。',
  keywords='[{"type":"etb_trigger","effect":"drain_each_opp","damage":2,"life":2}]'::jsonb WHERE name='吸血鬼の落とし子';

-- 既存行のアジャニの群れ仲間を更新（gain_life_trigger追加）
UPDATE cards SET
  effect_text = 'あなたがライフを得るたび、アジャニの群れ仲間の上に＋1/＋1カウンターを1個置く。',
  keywords = '[{"type":"gain_life_trigger","effect":"counter_p1p1","value":1}]'::jsonb
WHERE name = 'アジャニの群れ仲間';

-- 既存行のブランチウッドの鎧を更新（オーラ実装）
UPDATE cards SET
  effect_text = 'エンチャント（クリーチャー）。エンチャントされているクリーチャーは、あなたがコントロールする森1枚につき＋1/＋1の修整を受ける。',
  keywords = '[{"type":"aura","enchant":"creature"},{"type":"pump_per_count","effect":"forest_count","power":1,"toughness":1}]'::jsonb
WHERE name = 'ブランチウッドの鎧';

-- 既存行のシヴ山のドラゴンを更新（起動型能力を追加）
UPDATE cards SET
  effect_text = '飛行を持つ。（赤）：ターン終了時まで、シヴ山のドラゴンは＋1/＋0の修整を受ける。',
  keywords = '[{"type":"flying"},{"type":"subtype_dragon"},{"type":"activated_ability","cost":"R","effect":"pump_self","power":1,"toughness":0}]'::jsonb
WHERE name = 'シヴ山のドラゴン';

-- 既存行の火吹きラガークを更新（上陸誘発を追加）
UPDATE cards SET
  effect_text = '上陸 ― あなたのコントロール下で土地が戦場に出るたび、火吹きラガークは各対戦相手に1点のダメージを与える。',
  keywords = '[{"type":"landfall_trigger","effect":"deal_each_opp","value":1}]'::jsonb
WHERE name = '火吹きラガーク';

-- 既存行の炎の大口、ドラクセスを更新（攻撃誘発を追加）
UPDATE cards SET
  effect_text = '伝説のクリーチャー。飛行を持つ。炎の大口、ドラクセスが攻撃するたび、それは相手プレイヤーに4点のダメージを与え、相手クリーチャー最大2体にそれぞれ3点のダメージを与える。',
  keywords = '[{"type":"flying"},{"type":"subtype_dragon"},{"type":"attack_trigger","effect":"drakuseth_damage","primary_dmg":4,"secondary_dmg":3,"secondary_count":2}]'::jsonb
WHERE name = '炎の大口、ドラクセス';

-- 既存行のカルガの竜騎兵を更新（条件付き飛行を追加）
UPDATE cards SET
  effect_text = 'あなたがドラゴンをコントロールしているかぎり、カルガの竜騎兵は飛行を持つ。',
  keywords = '[{"type":"conditional_keyword","condition":"controls_dragon","grant":"flying"}]'::jsonb
WHERE name = 'カルガの竜騎兵';

-- 既存行の炎吐きの仔竜を更新（誘発型能力を追加）
UPDATE cards SET
  effect_text = '飛行を持つ。あなたがクリーチャーでない呪文かドラゴン呪文を唱えるたび、炎吐きの仔竜は各対戦相手に1点のダメージを与える。',
  keywords = '[{"type":"flying"},{"type":"subtype_dragon"},{"type":"on_cast_trigger","condition":"noncreature_or_dragon","effect":"deal_each_opp","value":1}]'::jsonb
WHERE name = '炎吐きの仔竜';

-- 既存行の帆凧の海賊を更新（攻撃時飛行実装）
UPDATE cards SET
  effect_text = '帆凧の海賊が攻撃しているかぎり、これは飛行を持つ。',
  keywords = '[{"type":"conditional_keyword","condition":"self_attacking","grant":"flying"}]'::jsonb
WHERE name = '帆凧の海賊';

-- 既存行の謎めいた洞窟を更新（起動型能力実装）
UPDATE cards SET
  effect_text = 'タップ：無色マナ（{C}）を1点加える。{1}、タップ、謎めいた洞窟を生け贄に捧げる：カードを1枚引く。この能力は土地を5枚以上コントロールしている場合にのみ起動できる。',
  keywords = '[{"type":"activated_ability","cost":"1","tap_self":true,"sacrifice_self":true,"effect":"draw_cards","value":1,"condition":"controls_5_lands"}]'::jsonb
WHERE name = '謎めいた洞窟';

-- 既存行の平和な心を更新（攻撃・ブロック禁止実装）
UPDATE cards SET
  effect_text = 'エンチャント（クリーチャー）。エンチャントされているクリーチャーは攻撃もブロックもできない。',
  keywords = '[{"type":"aura","enchant":"creature"},{"type":"prevent_combat"}]'::jsonb
WHERE name = '平和な心';

-- 既存行の束縛の祈り手を更新（ETB追放実装）
UPDATE cards SET
  effect_text = '瞬速を持つ。戦場に出たとき、対戦相手のパーマネント1つを追放してライフ2点を得る。',
  keywords = '[{"type":"flash"},{"type":"etb_exile_target","target":"opp_permanent","gain":2}]'::jsonb
WHERE name = '束縛の祈り手';

-- 既存行の絢爛たる天使を更新（他クリーチャーETB誘発実装）
UPDATE cards SET
  effect_text = '飛行を持つ。他のクリーチャーが自分のコントロール下で戦場に出るたび、ライフを1点得る。',
  keywords = '[{"type":"flying"},{"type":"subtype_angel"},{"type":"ally_etb_trigger","condition":"other_creature","effect":"gain_life","value":1}]'::jsonb
WHERE name = '絢爛たる天使';

-- 既存行の内陸の聖別者を更新（他クリーチャーETB誘発実装）
UPDATE cards SET
  effect_text = '警戒を持つ。他のクリーチャーが自分のコントロール下で戦場に出るたびライフを1点得る。',
  keywords = '[{"type":"vigilance"},{"type":"ally_etb_trigger","condition":"other_creature","effect":"gain_life","value":1}]'::jsonb
WHERE name = '内陸の聖別者';

-- 既存行の金剛牝馬を更新（ETB色選択・呪文誘発実装）
UPDATE cards SET
  effect_text = 'アーティファクト・クリーチャー。金剛牝馬が戦場に出るとき、色を1色選ぶ。その色の呪文を唱えるたびライフを1点得る。',
  keywords = '[{"type":"etb_choose_color"},{"type":"on_cast_trigger","condition":"chosen_color_spell","effect":"gain_life","value":1}]'::jsonb
WHERE name = '金剛牝馬';

-- 既存行の不屈の古参兵を更新（起動型能力実装）
UPDATE cards SET
  effect_text = 'カードを1枚捨てる：不屈の古参兵をタップする。それはターン終了時まで破壊不能を得る。',
  keywords = '[{"type":"activated_ability","cost":"discard_card","tap_self":true,"effect":"grant_indestructible_eot"}]'::jsonb
WHERE name = '不屈の古参兵';

-- 既存行の不動の女王、リンデンを更新（攻撃誘発実装）
UPDATE cards SET
  effect_text = '伝説のクリーチャー。警戒、絆魂を持つ。あなたのコントロールする白のクリーチャーが攻撃するたび、ライフを1点得る。',
  keywords = '[{"type":"vigilance"},{"type":"lifelink"},{"type":"ally_attack_trigger","condition":"white_creature","effect":"gain_life","value":1}]'::jsonb
WHERE name = '不動の女王、リンデン';

-- 既存行の黎明をもたらす者ライラを更新（ロード効果実装）
UPDATE cards SET
  effect_text = '伝説のクリーチャー。飛行、先制攻撃、絆魂を持つ。あなたのコントロールする他の天使は＋1/＋1の修整を受けるとともに絆魂を持つ。',
  keywords = '[{"type":"flying"},{"type":"first_strike"},{"type":"lifelink"},{"type":"subtype_angel"},{"type":"lord_effect","subtype":"angel","power_bonus":1,"toughness_bonus":1,"grant_keywords":["lifelink"]}]'::jsonb
WHERE name = '黎明をもたらす者ライラ';

-- 一括未実装対応
UPDATE cards SET effect_text='瞬速、飛行を持つ。（4）（青）：カードを1枚引く。', keywords='[{"type":"flash"},{"type":"flying"},{"type":"activated_ability","cost_str":"{4}{U}","effect":"draw_cards","value":1}]'::jsonb WHERE name='幽体の船乗り';
UPDATE cards SET effect_text='飛行を持つ。大嵐のジンはあなたがコントロールする基本島1枚につき＋1/＋0の修整を受ける。', keywords='[{"type":"flying"},{"type":"power_per_count","effect":"basic_island_count"}]'::jsonb WHERE name='大嵐のジン';
UPDATE cards SET effect_text='伝説のクリーチャー。タップ：カードを3枚引く。', keywords='[{"type":"activated_ability","cost":null,"tap_self":true,"effect":"draw_cards","value":3}]'::jsonb WHERE name='全能なる者アルカニス';
UPDATE cards SET effect_text='飛行、警戒を持つ。（1）（青）、タップ：カードを1枚引き、その後カードを1枚捨てる。', keywords='[{"type":"flying"},{"type":"vigilance"},{"type":"activated_ability","cost_str":"{1}{U}","tap_self":true,"effect":"draw_then_discard","value":1}]'::jsonb WHERE name='大梟の見張り';
UPDATE cards SET effect_text='大ヒレの用心棒が戦場に出たとき、対戦相手がコントロールするクリーチャー1体を対象とし、それをオーナーの手札に戻す。', keywords='[{"type":"etb_trigger","effect":"pending_bounce_opp_creature"}]'::jsonb WHERE name='大ヒレの用心棒';
UPDATE cards SET effect_text='飛行を持つ。吸血鬼の侵入者はブロックに参加できない。', keywords='[{"type":"flying"},{"type":"cant_block"}]'::jsonb WHERE name='吸血鬼の侵入者';
UPDATE cards SET effect_text='（2）、タップ：各対戦相手は1点のライフを失い、あなたは1点のライフを得る。', keywords='[{"type":"activated_ability","cost":"2","tap_self":true,"effect":"drain_each_opp","damage":1,"gain":1}]'::jsonb WHERE name='吸血鬼の新生子';
UPDATE cards SET effect_text='飛行を持つ。吸血鬼の魂呼びはブロックに参加できない。吸血鬼の魂呼びが戦場に出たとき、あなたの墓地にあるクリーチャー・カード1枚を対象とし、それをオーナーの手札に戻す。', keywords='[{"type":"flying"},{"type":"cant_block"},{"type":"etb_trigger","effect":"pending_return_hand_from_gy","restriction":"creature"}]'::jsonb WHERE name='吸血鬼の魂呼び';
UPDATE cards SET effect_text='虐殺のワームが戦場に出たとき、ターン終了時まで、対戦相手がコントロールするすべてのクリーチャーは－2/－2の修整を受ける。', keywords='[{"type":"etb_trigger","effect":"minus_all_opp_creatures_eot","power":-2,"toughness":-2}]'::jsonb WHERE name='虐殺のワーム';
UPDATE cards SET effect_text='血なまぐさい吸血者が攻撃するたび、各対戦相手は1点のライフを失い、あなたは1点のライフを得る。', keywords='[{"type":"attack_trigger","effect":"drain_each_opp","value":1}]'::jsonb WHERE name='血なまぐさい吸血者';
UPDATE cards SET effect_text='鼓動の追跡者が攻撃するたび、各対戦相手は1点のライフを失う。', keywords='[{"type":"attack_trigger","effect":"deal_each_opp","value":1}]'::jsonb WHERE name='鼓動の追跡者';
UPDATE cards SET effect_text='飛行、二段攻撃を持つ。ヴェリュス山の恐怖が戦場に出たとき、あなたがコントロールするクリーチャーはターン終了時まで二段攻撃を得る。', keywords='[{"type":"flying"},{"type":"double_strike"},{"type":"etb_trigger","effect":"grant_all_allies_keyword_eot","keyword":"double_strike"}]'::jsonb WHERE name='ヴェリュス山の恐怖';
UPDATE cards SET effect_text='（1）、打ち壊すブロントドンを生け贄に捧げる：アーティファクト1つかエンチャント1つを対象とし、それを破壊する。', keywords='[{"type":"activated_ability","cost":"1","sacrifice_self":true,"effect":"destroy_artifact_or_enchantment","targeting":"any_artifact_or_enchantment"}]'::jsonb WHERE name='打ち壊すブロントドン';
UPDATE cards SET effect_text='エルフの再生家が戦場に出たとき、あなたの墓地にあるパーマネント・カード1枚を対象とし、それをオーナーの手札に戻す。', keywords='[{"type":"etb_trigger","effect":"pending_return_hand_from_gy","restriction":"any"}]'::jsonb WHERE name='エルフの再生家';
UPDATE cards SET effect_text='伝説のクリーチャー。狩猟の統率者、スーラクが戦場に出たとき、あなたのコントロールするクリーチャーのパワーの合計が8以上であれば、あなたのコントロールするクリーチャーはターン終了時まで速攻を得る。', keywords='[{"type":"etb_trigger","effect":"grant_haste_if_power_gte","threshold":8}]'::jsonb WHERE name='狩猟の統率者、スーラク';
UPDATE cards SET effect_text='瞬速を持つ。戦場に出たとき、対戦相手のコントロールする土地でないパーマネント1つを追放する。', keywords='[{"type":"flash"},{"type":"etb_exile_target","target":"opp_permanent","gain":0}]'::jsonb WHERE name='払拭の光';

ALTER TABLE cards ENABLE TRIGGER USER;

UPDATE cards SET effect_text='呪文1つを対象とし、そのコントローラーが{3}を支払わないかぎり、それを打ち消す。', keywords='[{"type":"counter_spell","unless_pay":"{3}"}]'::jsonb WHERE name='波の消去';
UPDATE cards SET effect_text='呪文1つを対象とし、それを打ち消す。カードを1枚引き、その後カードを1枚捨てる。', keywords='[{"type":"counter_spell"},{"type":"draw_then_discard","value":1}]'::jsonb WHERE name='論破';
UPDATE cards SET effect_text='エンチャント（クリーチャー）。星明かりの罠が戦場に出たとき、エンチャントされているクリーチャーをタップする。エンチャントされているクリーチャーはそのコントローラーのアンタップ・ステップにアンタップしない。', keywords='[{"type":"aura","enchant":"opp_creature"},{"type":"etb_trigger","effect":"tap_attached"},{"type":"prevent_untap"}]'::jsonb WHERE name='星明かりの罠';
UPDATE cards SET effect_text='追加コストとして、クリーチャー1体を生け贄に捧げるか{3}{B}を支払う。クリーチャー1体を対象とし、それを追放する。', keywords='[{"type":"additional_cost","pay_mana":"{3}{B}"},{"type":"exile_creature"}]'::jsonb WHERE name='踊り食い';
UPDATE cards SET effect_text='あなたの墓地にあるクリーチャー・カードを最大2枚まで対象とし、それらをオーナーの手札に戻す。その後、カードを1枚捨てる。', keywords='[{"type":"return_from_gy","count":2,"restriction":"creature","then_discard":1}]'::jsonb WHERE name='死の円舞曲';
UPDATE cards SET effect_text='接死を持つ。強襲 ― 腑抜けの略奪者が戦場に出たとき、あなたがこのターンに攻撃していた場合、あなたのライブラリーの上から3枚を見る。そのうち1枚をライブラリーの一番上に置き、残りを墓地に置く。', keywords='[{"type":"deathtouch"},{"type":"etb_trigger","condition":"raid","effect":"raid_look_top","n":3,"keep":1}]'::jsonb WHERE name='腑抜けの略奪者';
