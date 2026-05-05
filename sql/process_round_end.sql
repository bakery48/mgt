-- games テーブルに winner_id カラムがなければ追加
ALTER TABLE games ADD COLUMN IF NOT EXISTS winner_id uuid REFERENCES players(id);

-- process_round_end RPC
-- ラウンド終了処理: VP加算 → ゲーム終了判定 → 状態遷移
CREATE OR REPLACE FUNCTION process_round_end(
  p_game_id  uuid,
  p_winner_id uuid,
  p_loser_id  uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_game         games%ROWTYPE;
  v_winner_vp    int;
  v_winner_bal   numeric;
  v_game_over    boolean := false;
  v_final_winner uuid    := null;
BEGIN
  -- ゲーム情報取得
  SELECT * INTO v_game FROM games WHERE id = p_game_id;

  -- 勝者の VP を +1
  UPDATE game_players
  SET victory_points = victory_points + 1
  WHERE game_id = p_game_id AND player_id = p_winner_id;

  -- 最新VP・残高を取得
  SELECT gp.victory_points INTO v_winner_vp
  FROM game_players gp
  WHERE gp.game_id = p_game_id AND gp.player_id = p_winner_id;

  SELECT p.balance INTO v_winner_bal
  FROM players p
  WHERE p.id = p_winner_id;

  -- ゲーム終了判定 1: VP閾値
  IF v_game.vp_threshold IS NOT NULL AND v_winner_vp >= v_game.vp_threshold THEN
    v_game_over    := true;
    v_final_winner := p_winner_id;
  END IF;

  -- ゲーム終了判定 2: 現金閾値
  IF NOT v_game_over
     AND v_game.cash_threshold IS NOT NULL
     AND v_winner_bal >= v_game.cash_threshold
  THEN
    v_game_over    := true;
    v_final_winner := p_winner_id;
  END IF;

  -- ゲーム終了判定 3: ラウンド数上限
  IF NOT v_game_over
     AND v_game.total_rounds IS NOT NULL
     AND v_game.current_round >= v_game.total_rounds
  THEN
    v_game_over := true;
    -- 最多VPのプレイヤーが勝者（同点は先着順）
    SELECT player_id INTO v_final_winner
    FROM game_players
    WHERE game_id = p_game_id
    ORDER BY victory_points DESC, turn_order ASC
    LIMIT 1;
  END IF;

  -- 状態遷移
  IF v_game_over THEN
    UPDATE games
    SET status    = 'finished',
        winner_id = v_final_winner
    WHERE id = p_game_id;
  ELSE
    UPDATE games
    SET status       = 'between_rounds',
        current_round = current_round + 1,
        game_state   = '{}'::jsonb
    WHERE id = p_game_id;
  END IF;

  RETURN jsonb_build_object(
    'game_over',        v_game_over,
    'final_winner_id',  v_final_winner,
    'round_winner_id',  p_winner_id,
    'round_winner_vp',  v_winner_vp
  );
END;
$$;
