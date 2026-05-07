import { useEffect } from 'react'

const TYPE_LABELS = {
  creature: 'クリーチャー', instant: 'インスタント', sorcery: 'ソーサリー',
  enchantment: 'エンチャント', artifact: 'アーティファクト', land: '土地',
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
  '拝金':        '指定タイミングにGを獲得する',
  '徴収':        '攻撃するたびに対戦相手からGを奪う',
  '栄光':        'ダメージを与えるたびVPを獲得する',
  '簒奪':        'ダメージを与えるたびに対戦相手からVPを奪う',
}
const ORIG_KW = new Set(['拝金', '徴収', '栄光', '簒奪'])
const TRIGGER_LABELS = { etb: '戦場に出た時', upkeep: 'アップキープ', attack: '攻撃時', damage: 'ダメージ時' }

const SUBTYPE_LABELS = {
  subtype_vampire: '吸血鬼', subtype_angel: '天使', subtype_dragon: 'ドラゴン',
  subtype_elf: 'エルフ', subtype_goblin: 'ゴブリン', subtype_zombie: 'ゾンビ',
  subtype_human: '人間', subtype_knight: '騎士', subtype_wizard: 'ウィザード',
  subtype_warrior: '戦士', subtype_merfolk: '人魚', subtype_beast: '野獣',
  subtype_spirit: '精霊', subtype_bird: '鳥', subtype_cat: '猫',
  subtype_soldier: '兵士', subtype_noble: '貴族', subtype_rabbit: '兎',
  subtype_cleric: 'クレリック', subtype_rogue: 'ならず者', subtype_scout: 'スカウト',
  subtype_shaman: 'シャーマン', subtype_warlock: '邪術師', subtype_skeleton: 'スケルトン',
  subtype_phyrexian: 'ファイレクシアン', subtype_worm: 'ワーム', subtype_pirate: '海賊',
  subtype_horse: '馬', subtype_sphinx: 'スフィンクス', subtype_faerie: 'フェアリー',
  subtype_turtle: '亀', subtype_construct: '構築物', subtype_wall: '壁',
  subtype_djinn: 'ジン', subtype_shark: 'サメ', subtype_lizard: 'トカゲ',
  subtype_dwarf: 'ドワーフ', subtype_berserker: '狂戦士', subtype_elder: 'エルダー',
  subtype_dinosaur: '恐竜', subtype_druid: 'ドルイド', subtype_archer: '射手',
  subtype_snake: '蛇', subtype_giant: '巨人', subtype_elemental: 'エレメンタル',
  subtype_spider: '蜘蛛', subtype_treefolk: 'ツリーフォーク', subtype_ninja: '忍者',
  subtype_demon: '悪魔',
}

// カード色ごとのフレームスタイル
const FRAME = {
  white:     { outer: 'bg-gradient-to-b from-yellow-100 to-yellow-200 border-yellow-300',    header: 'bg-gradient-to-r from-yellow-50 to-yellow-100 text-gray-900',   typebar: 'bg-gradient-to-r from-yellow-50 to-yellow-100 text-gray-800', textbox: 'bg-amber-50 text-gray-800',    pt: 'bg-yellow-100 text-gray-900 border-yellow-400' },
  blue:      { outer: 'bg-gradient-to-b from-blue-300 to-blue-500 border-blue-600',          header: 'bg-gradient-to-r from-blue-200 to-blue-300 text-gray-900',      typebar: 'bg-gradient-to-r from-blue-200 to-blue-300 text-gray-800',   textbox: 'bg-blue-50 text-gray-800',     pt: 'bg-blue-200 text-gray-900 border-blue-400' },
  black:     { outer: 'bg-gradient-to-b from-gray-600 to-gray-800 border-gray-900',          header: 'bg-gradient-to-r from-gray-700 to-gray-800 text-gray-100',      typebar: 'bg-gradient-to-r from-gray-700 to-gray-800 text-gray-200',   textbox: 'bg-gray-900 text-gray-200',    pt: 'bg-gray-700 text-gray-100 border-gray-500' },
  red:       { outer: 'bg-gradient-to-b from-red-400 to-red-600 border-red-700',             header: 'bg-gradient-to-r from-red-200 to-red-300 text-gray-900',        typebar: 'bg-gradient-to-r from-red-200 to-red-300 text-gray-800',     textbox: 'bg-red-50 text-gray-800',      pt: 'bg-red-200 text-gray-900 border-red-400' },
  green:     { outer: 'bg-gradient-to-b from-green-400 to-green-700 border-green-800',       header: 'bg-gradient-to-r from-green-200 to-green-300 text-gray-900',    typebar: 'bg-gradient-to-r from-green-200 to-green-300 text-gray-800', textbox: 'bg-green-50 text-gray-800',    pt: 'bg-green-200 text-gray-900 border-green-400' },
  colorless: { outer: 'bg-gradient-to-b from-gray-300 to-gray-400 border-gray-500',          header: 'bg-gradient-to-r from-gray-200 to-gray-300 text-gray-900',      typebar: 'bg-gradient-to-r from-gray-200 to-gray-300 text-gray-800',   textbox: 'bg-gray-100 text-gray-800',    pt: 'bg-gray-200 text-gray-900 border-gray-400' },
  multicolor:{ outer: 'bg-gradient-to-b from-yellow-300 via-amber-400 to-yellow-500 border-yellow-600', header: 'bg-gradient-to-r from-yellow-100 to-amber-200 text-gray-900', typebar: 'bg-gradient-to-r from-yellow-100 to-amber-200 text-gray-800', textbox: 'bg-amber-50 text-gray-800', pt: 'bg-yellow-200 text-gray-900 border-yellow-500' },
}
const DEFAULT_FRAME = FRAME.colorless

function getSubtypeLabel(keywords) {
  const subtypes = (keywords || []).map(kw => SUBTYPE_LABELS[kw.type]).filter(Boolean)
  return subtypes.length ? subtypes.join('・') : null
}

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

// 効果テキスト内のキーワードをツールチップ付きspanにする
const KW_JP_TOOLTIPS = {
  'トランプル': 'ブロッカーへの超過ダメージがプレイヤーに通る',
  'フラッシュバック': '墓地からコストを払って唱えられる（その後追放）',
  '先制攻撃': '通常クリーチャーより先にダメージを与える',
  '二段攻撃': '先制攻撃と通常攻撃の両方を行う',
  '破壊不能': '破壊されない',
  '飛行': '飛行持ちかリーチ持ちのクリーチャーにしかブロックされない',
  '速攻': '召喚酔いなし。出たターンから攻撃・能力使用が可能',
  '警戒': '攻撃してもタップしない',
  '到達': '飛行クリーチャーをブロックできる',
  '絆魂': '与えたダメージ分だけライフを得る',
  '接死': '与えたダメージは致死ダメージとして扱われる',
  '威迫': '2体以上でしかブロックできない',
  '防衛': '攻撃できない',
  '呪禁': '対戦相手の呪文・能力の対象にならない',
  '被覆': '呪文・能力の対象にならない',
  '瞬速': 'インスタントのタイミングで唱えられる',
  '護法': '対戦相手が対象にするには追加コストが必要',
  'キッカー': '追加コストを払うことで強化効果を得る',
  '発掘': '墓地からコストを払って戦場に戻す（次の終了ステップに追放）',
  '探査': '墓地のカードを除外してマナコストを軽減できる',
  '装備': 'コストを払ってクリーチャーに装備する',
  '拝金': '指定タイミングにGを獲得する',
  '徴収': '攻撃するたびに対戦相手からGを奪う',
  '栄光': 'ダメージを与えるたびVPを獲得する',
  '簒奪': 'ダメージを与えるたびに対戦相手からVPを奪う',
}
const KW_PATTERN = new RegExp(
  `(${Object.keys(KW_JP_TOOLTIPS).sort((a, b) => b.length - a.length).join('|')})`, 'g'
)
function renderWithTooltips(text) {
  if (!text) return null
  return text.replace(/\\n/g, '\n').split(KW_PATTERN).map((part, i) => {
    const tip = KW_JP_TOOLTIPS[part]
    return tip
      ? <span key={i} title={tip} className="underline decoration-dotted cursor-help">{part}</span>
      : part
  })
}

// card: DBのカードオブジェクト
// perm: ゲーム中のpermanentオブジェクト（任意）
// effectivePower / effectiveToughness: 装備込みP/T（任意）
export default function CardDetailModal({ card, perm, effectivePower, effectiveToughness, onClose, onActivateAbility, canActivateAbility }) {
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
  const frame = FRAME[card.color] || DEFAULT_FRAME
  const subtypeLabel = getSubtypeLabel(keywords)
  // 起動型能力ラベル
  const ability = keywords.find(k => k.type === 'activated_ability')
  let abilityLabel = null
  if (ability) {
    const costStr = ability.cost_str || (ability.cost != null ? `{${ability.cost}}` : '')
    const costs = [costStr]
    if (ability.tap_self) costs.push('Ｔ')
    if (ability.sacrifice_self) costs.push('生け贄')
    const costPart = costs.filter(Boolean).join('、')
    if (ability.effect === 'draw_cards') {
      abilityLabel = `${costPart}：カードを${ability.value ?? 1}枚引く`
    } else if (ability.effect === 'put_counter_target') {
      abilityLabel = `${costPart}：クリーチャー1体の上に+1/+1カウンターを1個置く`
    } else if (ability.cost === 'discard_card') {
      abilityLabel = `カードを1枚捨てる、Ｔ：このクリーチャーは破壊不能を得る`
    } else {
      abilityLabel = `${costPart}：+${ability.power ?? 0}/+${ability.toughness ?? 0}（ターン終了時まで）`
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      {/* カード本体：縦長・実物比率に近い */}
      <div
        className={`relative rounded-2xl border-4 ${frame.outer} shadow-2xl`}
        style={{ width: '340px', maxHeight: '95vh', overflowY: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        {/* 閉じるボタン */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 z-10 w-7 h-7 bg-black/50 hover:bg-black/80 text-white rounded-full flex items-center justify-center text-base leading-none transition-colors"
        >
          ×
        </button>

        <div className="p-2 flex flex-col gap-1.5">

          {/* ① 名前バー + マナコスト */}
          <div className={`flex items-center justify-between px-3 py-1.5 rounded-lg border border-black/10 ${frame.header}`}>
            <span className="font-bold text-base leading-tight pr-2">{card.name}</span>
            {card.mana_cost && (
              <span className="font-mono text-sm font-bold shrink-0 tracking-wide">{card.mana_cost}</span>
            )}
          </div>

          {/* ② アート */}
          <div className="rounded-lg overflow-hidden border-2 border-black/20" style={{ height: '180px' }}>
            {card.art_url ? (
              <img src={card.art_url} alt={card.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                <span className="text-7xl opacity-20">🃏</span>
              </div>
            )}
          </div>

          {/* ③ タイプ行 */}
          <div className={`flex items-center px-3 py-1 rounded-lg border border-black/10 text-sm font-semibold ${frame.typebar}`}>
            <span>
              {TYPE_LABELS[card.card_type] || card.card_type}
              {subtypeLabel && <span className="font-normal"> — {subtypeLabel}</span>}
            </span>
          </div>

          {/* ④ テキストボックス */}
          <div className={`rounded-lg border border-black/10 px-3 py-2.5 min-h-[100px] ${frame.textbox}`}>

            {/* ゲーム内状態バッジ */}
            {perm && (
              <div className="flex flex-wrap gap-1 mb-2">
                {perm.tapped && <span className="text-xs bg-yellow-200 text-yellow-900 border border-yellow-400 px-1.5 py-0.5 rounded">タップ済</span>}
                {perm.summoning_sick && <span className="text-xs bg-gray-200 text-gray-700 border border-gray-400 px-1.5 py-0.5 rounded">召喚酔い</span>}
                {perm.attacking && <span className="text-xs bg-red-200 text-red-900 border border-red-400 px-1.5 py-0.5 rounded">攻撃中</span>}
                {perm.blocking && <span className="text-xs bg-blue-200 text-blue-900 border border-blue-400 px-1.5 py-0.5 rounded">ブロック中</span>}
                {perm.damage > 0 && <span className="text-xs bg-red-100 text-red-800 border border-red-300 px-1.5 py-0.5 rounded">ダメージ {perm.damage}</span>}
                {perm.kicked && <span className="text-xs bg-purple-100 text-purple-800 border border-purple-300 px-1.5 py-0.5 rounded">⚡キッカー済</span>}
                {perm.unearthed && <span className="text-xs bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.5 rounded">アンアース済</span>}
              </div>
            )}

            {/* 起動型能力テキスト */}
            {abilityLabel && (
              <p className="text-sm mb-2 leading-snug">{abilityLabel}</p>
            )}

            {/* 効果テキスト（キーワードにツールチップ付き） */}
            {card.effect_text && (
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {renderWithTooltips(card.effect_text)}
              </p>
            )}

            {!card.effect_text && !abilityLabel && (
              <p className="text-sm opacity-40 italic">（効果なし）</p>
            )}

            {/* P/T（クリーチャーのみ） */}
            {isCrea && dispPower != null && dispTough != null && (
              <div className="flex justify-end mt-3">
                <span className={`font-mono font-bold text-base px-3 py-0.5 rounded border-2 ${frame.pt}`}>
                  {dispPower}/{dispTough}
                  {effectivePower != null && effectivePower !== card.power && (
                    <span className="text-green-700 text-xs ml-1">*</span>
                  )}
                </span>
              </div>
            )}
          </div>

          {/* ⑤ 起動型能力ボタン（ゲーム内のみ） */}
          {onActivateAbility && ability && (
            <button
              onClick={() => { onActivateAbility() }}
              disabled={!canActivateAbility}
              className="w-full py-2 rounded-lg text-sm font-bold transition-colors
                disabled:opacity-40 disabled:cursor-not-allowed
                bg-indigo-700 hover:bg-indigo-600 text-white"
            >
              起動型能力を使う
            </button>
          )}

        </div>
      </div>
    </div>
  )
}
