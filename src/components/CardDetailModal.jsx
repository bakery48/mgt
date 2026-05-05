import { useEffect } from 'react'

const TYPE_LABELS = {
  creature: 'クリーチャー', instant: 'インスタント', sorcery: 'ソーサリー',
  enchantment: 'エンチャント', artifact: 'アーティファクト', land: '土地',
}
const COLOR_LABELS = {
  white: '白', blue: '青', black: '黒', red: '赤', green: '緑', colorless: '無色', multicolor: '多色',
}
const COLOR_BG = {
  white: 'bg-yellow-50 text-gray-900', blue: 'bg-blue-700 text-white',
  black: 'bg-gray-900 text-white', red: 'bg-red-700 text-white',
  green: 'bg-green-800 text-white', colorless: 'bg-gray-600 text-white',
  multicolor: 'bg-gradient-to-br from-yellow-600 to-purple-700 text-white',
}
const MTG_KW_LABELS = {
  flying: '飛行', haste: '速攻', vigilance: '警戒', trample: 'トランプル', reach: '到達',
  first_strike: '先制攻撃', double_strike: '二段攻撃', lifelink: '絆魂', deathtouch: '接死', menace: '威迫',
  defender: '防衛', indestructible: '破壊不能', hexproof: '呪禁', shroud: '被覆', flash: '瞬速',
  ward: '護法', protection: 'プロテクション', cycling: 'サイクリング', kicker: 'キッカー',
  flashback: 'フラッシュバック', equip: '装備', morph: '変異', unearth: '発掘', delve: '探査',
}
const KW_TOOLTIPS = {
  flying:        '飛行持ちかリーチ持ちのクリーチャーにしかブロックされない',
  haste:         '召喚酔いなし。出たターンから攻撃・能力使用が可能',
  vigilance:     '攻撃してもタップしない',
  trample:       'ブロッカーへの超過ダメージがプレイヤーに通る',
  reach:         '飛行クリーチャーをブロックできる',
  first_strike:  '通常クリーチャーより先にダメージを与える',
  double_strike: '先制攻撃と通常攻撃の両方を行う',
  lifelink:      '与えたダメージ分だけライフを得る',
  deathtouch:    '与えたダメージは致死ダメージとして扱われる',
  menace:        '2体以上でしかブロックできない',
  defender:      '攻撃できない',
  indestructible:'破壊されない',
  hexproof:      '対戦相手の呪文・能力の対象にならない',
  shroud:        '呪文・能力の対象にならない',
  flash:         'インスタントのタイミングで唱えられる',
  ward:          '対戦相手が対象にするには追加コストが必要',
  cycling:       'コストを払ってこのカードを捨て、1枚引く',
  kicker:        '追加コストを払うことで強化効果を得る',
  flashback:     '墓地からコストを払って唱えられる（その後追放）',
  equip:         'コストを払ってクリーチャーに装備する',
  unearth:       '墓地からコストを払って戦場に戻す（次の終了ステップに追放）',
  delve:         '墓地のカードを除外してマナコストを軽減できる',
  拝金:          '指定タイミングにGを獲得する',
  徴収:          '攻撃するたびに対戦相手からGを奪う',
  栄光:          'ダメージを与えるたびVPを獲得する',
  簒奪:          'ダメージを与えるたびに対戦相手からVPを奪う',
}
const ORIG_KW = new Set(['拝金', '徴収', '栄光', '簒奪'])
const TRIGGER_LABELS = { etb: '戦場に出た時', upkeep: 'アップキープ', attack: '攻撃時', damage: 'ダメージ時' }

function kwLabel(kw) {
  if (ORIG_KW.has(kw.type)) {
    return `${kw.type} ${kw.value ?? ''}G（${TRIGGER_LABELS[kw.trigger] ?? kw.trigger}）`
  }
  const base = MTG_KW_LABELS[kw.type] || kw.type
  const extras = []
  if (kw.value != null) extras.push(typeof kw.value === 'string' ? kw.value : `{${kw.value}}`)
  if (kw.power_bonus != null) extras.push(`+${kw.power_bonus}/+${kw.toughness_bonus ?? 0}`)
  return extras.length ? `${base}（${extras.join('/')}）` : base
}

// card: DBのカードオブジェクト
// perm: ゲーム中のpermanentオブジェクト（任意）
// effectivePower / effectiveToughness: 装備込みP/T（任意）
export default function CardDetailModal({ card, perm, effectivePower, effectiveToughness, onClose }) {
  useEffect(() => {
    if (!card) return
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [card, onClose])
  if (!card) return null
  const keywords = Array.isArray(card.keywords) ? card.keywords : []
  const isCrea = card.card_type === 'creature'
  const dispPower = effectivePower ?? perm?.power ?? card.power
  const dispTough = effectiveToughness ?? perm?.toughness ?? card.toughness

  return (
    <div
      className="fixed inset-0 bg-black/75 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="relative bg-gray-900 border border-gray-600 rounded-2xl overflow-hidden shadow-2xl flex flex-col sm:flex-row max-w-xl w-full max-h-[90vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* 閉じるボタン */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-8 h-8 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center text-lg leading-none transition-colors"
        >
          ×
        </button>

        {/* 左: アート */}
        <div className={`sm:w-48 shrink-0 ${COLOR_BG[card.color] || 'bg-gray-800'}`}>
          {card.art_url ? (
            <img
              src={card.art_url}
              alt={card.name}
              className="w-full h-48 sm:h-full object-cover"
            />
          ) : (
            <div className="w-full h-48 sm:h-full flex items-center justify-center text-6xl opacity-30">
              🃏
            </div>
          )}
        </div>

        {/* 右: 詳細 */}
        <div className="flex-1 p-5 overflow-y-auto">
          {/* 名前 + マナコスト */}
          <div className="flex items-start justify-between gap-3 mb-3">
            <h2 className="text-white text-xl font-bold leading-tight">{card.name}</h2>
            {card.mana_cost && (
              <span className="text-gray-300 font-mono text-sm shrink-0 bg-gray-800 px-2 py-1 rounded">
                {card.mana_cost}
              </span>
            )}
          </div>

          {/* タイプ行 */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-gray-300 text-sm">
              {TYPE_LABELS[card.card_type] || card.card_type}
            </span>
            <span className="text-gray-600">·</span>
            <span className="text-gray-400 text-sm">{COLOR_LABELS[card.color] || card.color}</span>
            {isCrea && dispPower != null && dispTough != null && (
              <span className="ml-auto text-white font-mono font-bold bg-gray-700 px-3 py-1 rounded-lg text-sm">
                {dispPower}/{dispTough}
                {effectivePower != null && effectivePower !== card.power && (
                  <span className="text-green-400 text-xs ml-1">（装備込み）</span>
                )}
              </span>
            )}
          </div>

          {/* ゲーム内状態 */}
          {perm && (
            <div className="flex flex-wrap gap-2 mb-3">
              {perm.tapped && <span className="text-xs bg-yellow-900/40 text-yellow-400 border border-yellow-700 px-2 py-0.5 rounded">タップ済</span>}
              {perm.summoning_sick && <span className="text-xs bg-gray-700 text-gray-400 border border-gray-600 px-2 py-0.5 rounded">召喚酔い</span>}
              {perm.attacking && <span className="text-xs bg-red-900/40 text-red-400 border border-red-700 px-2 py-0.5 rounded">攻撃中</span>}
              {perm.blocking && <span className="text-xs bg-blue-900/40 text-blue-400 border border-blue-700 px-2 py-0.5 rounded">ブロック中</span>}
              {perm.damage > 0 && <span className="text-xs bg-red-950 text-red-300 border border-red-800 px-2 py-0.5 rounded">ダメージ {perm.damage}</span>}
              {perm.kicked && <span className="text-xs bg-yellow-900/40 text-yellow-400 border border-yellow-700 px-2 py-0.5 rounded">⚡キッカー済</span>}
              {perm.unearthed && <span className="text-xs bg-emerald-900/40 text-emerald-400 border border-emerald-700 px-2 py-0.5 rounded">アンアース済</span>}
            </div>
          )}

          {/* キーワード */}
          {keywords.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {keywords.map((kw, i) => (
                <span key={i} className="relative group">
                  <span className={`text-xs px-2 py-0.5 rounded border cursor-help ${
                    ORIG_KW.has(kw.type)
                      ? 'bg-amber-900/40 text-amber-300 border-amber-700'
                      : 'bg-gray-800 text-gray-300 border-gray-600'
                  }`}>
                    {kwLabel(kw)}
                  </span>
                  {KW_TOOLTIPS[kw.type] && (
                    <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-gray-950 text-gray-100 text-xs rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-20 border border-gray-600 shadow-lg">
                      {KW_TOOLTIPS[kw.type]}
                    </span>
                  )}
                </span>
              ))}
            </div>
          )}

          {/* 効果テキスト */}
          {card.effect_text && (
            <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap bg-gray-800/60 rounded-lg p-3">
              {card.effect_text}
            </p>
          )}
          {!card.effect_text && keywords.length === 0 && (
            <p className="text-gray-600 text-sm italic">効果なし</p>
          )}
        </div>
      </div>
    </div>
  )
}
