-- 呪文エフェクトキーワード追加（未実装効果の実装対応）
-- Supabase SQL Editor で実行

-- ── 白スペル ──────────────────────────────────────────────────────
UPDATE cards SET keywords = '[{"type":"pump_creature","power":2,"toughness":0,"grant_keywords":["first_strike"]}]'
WHERE name = '突き通し';

UPDATE cards SET keywords = '[{"type":"pump_creature","power":2,"toughness":2},{"type":"gain_life","value":2}]'
WHERE name = '制覇の時';

UPDATE cards SET keywords = '[{"type":"pump_creature","power":2,"toughness":2}]'
WHERE name = '輝かしき一撃';

UPDATE cards SET keywords = '[{"type":"destroy_permanent","restriction":"artifact_or_enchantment"}]'
WHERE name = '浄化の光';

UPDATE cards SET keywords = '[{"type":"reanimate"}]'
WHERE name = '復活の儀式';

-- ── 青スペル ──────────────────────────────────────────────────────
UPDATE cards SET keywords = '[{"type":"draw_cards","value":1},{"type":"flashback","value":"{2}{U}"}]'
WHERE name = '熟慮';

UPDATE cards SET keywords = '[{"type":"draw_cards","value":2}]'
WHERE name = '速足の学び';

UPDATE cards SET keywords = '[{"type":"draw_cards","value":3}]'
WHERE name = '知識の泉';

UPDATE cards SET keywords = '[{"type":"bounce_all_attackers"}]'
WHERE name = '霊気化';

UPDATE cards SET keywords = '[{"type":"bounce_creature"}]'
WHERE name = '送還';

UPDATE cards SET keywords = '[{"type":"bounce_permanent"}]'
WHERE name = '時間の逆行';

-- ── 黒スペル ──────────────────────────────────────────────────────
UPDATE cards SET keywords = '[{"type":"destroy_creature"}]'
WHERE name = '英雄の破滅';

UPDATE cards SET keywords = '[{"type":"destroy_creature","restriction":"non_black"}]'
WHERE name = '骨の嵐';

UPDATE cards SET keywords = '[{"type":"pump_creature","power":-2,"toughness":-2}]'
WHERE name = '魂の吸収';

UPDATE cards SET keywords = '[{"type":"reanimate"}]'
WHERE name = 'ゾンビ化';

-- ── 赤スペル ──────────────────────────────────────────────────────
UPDATE cards SET keywords = '[{"type":"deal_damage","value":2,"kicked_value":4},{"type":"kicker","value":"4"}]'
WHERE name = '噴出の稲妻';

UPDATE cards SET keywords = '[{"type":"deal_damage","value":3}]'
WHERE name = '焦熱の竜火';

UPDATE cards SET keywords = '[{"type":"deal_damage","value":6}]'
WHERE name = '焼却破';

UPDATE cards SET keywords = '[{"type":"deal_damage_all","value":2}]'
WHERE name = '山崩し';

UPDATE cards SET keywords = '[{"type":"deal_damage","value":3},{"type":"flashback","value":"{3}{R}"}]'
WHERE name = '炎の矢';

UPDATE cards SET keywords = '[{"type":"pump_creature","power":2,"toughness":0,"grant_keywords":["haste"]}]'
WHERE name = '急速攻撃';

-- ── 緑スペル ──────────────────────────────────────────────────────
UPDATE cards SET keywords = '[{"type":"destroy_permanent","restriction":"artifact_enchantment_or_flying"}]'
WHERE name = '壊れた翼';

UPDATE cards SET keywords = '[{"type":"pump_creature","power":4,"toughness":4}]'
WHERE name = '命の結束';

UPDATE cards SET keywords = '[{"type":"draw_cards","value":2,"kicked_value":3},{"type":"kicker","value":"G"}]'
WHERE name = '森の恵み';
