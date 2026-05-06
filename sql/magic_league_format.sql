-- マジックリーグ・フォーマット対応
-- Supabase SQL Editor（role: postgres）で実行

-- deck_cards の枚数上限を 4 → 20 に引き上げ（基本土地12枚対応）
ALTER TABLE deck_cards DROP CONSTRAINT IF EXISTS deck_cards_quantity_check;
ALTER TABLE deck_cards ADD CONSTRAINT deck_cards_quantity_check
  CHECK (quantity >= 1 AND quantity <= 20);

-- decks テーブルにフォーマット列を追加
ALTER TABLE decks ADD COLUMN IF NOT EXISTS format text NOT NULL DEFAULT 'standard';

-- 確認
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'decks' AND column_name = 'format';
