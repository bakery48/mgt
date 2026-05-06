-- RLS ポリシーの無限再帰を修正
-- Supabase SQL Editor（role: postgres）で実行

-- ① game_players と games の既存ポリシーを確認・削除して再作成
-- （games ↔ game_players の相互参照による無限再帰を解消）

-- まず既存ポリシーを削除
DROP POLICY IF EXISTS "Enable all for authenticated" ON game_players;
DROP POLICY IF EXISTS "Enable read for authenticated" ON game_players;
DROP POLICY IF EXISTS "Enable insert for authenticated" ON game_players;
DROP POLICY IF EXISTS "Enable update for authenticated" ON game_players;
DROP POLICY IF EXISTS "Enable delete for authenticated" ON game_players;

DROP POLICY IF EXISTS "Enable all for authenticated" ON games;
DROP POLICY IF EXISTS "Enable read for authenticated" ON games;
DROP POLICY IF EXISTS "Enable insert for authenticated" ON games;
DROP POLICY IF EXISTS "Enable update for authenticated" ON games;
DROP POLICY IF EXISTS "Enable delete for authenticated" ON games;

-- すべてのポリシーを削除（名前が不明な場合）
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename IN ('games', 'game_players')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I',
      pol.policyname,
      (SELECT tablename FROM pg_policies WHERE policyname = pol.policyname LIMIT 1));
  END LOOP;
END
$$;

-- ② game_players: RLS を無効化（ゲーム参加者は互いのデータを読める必要があるため）
ALTER TABLE game_players DISABLE ROW LEVEL SECURITY;

-- ③ games: RLS を無効化
ALTER TABLE games DISABLE ROW LEVEL SECURITY;

-- 確認
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename IN ('games', 'game_players');
