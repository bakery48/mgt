import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { supabase } from '../lib/supabase'

const CARD_TYPES = ['creature', 'instant', 'sorcery', 'enchantment', 'artifact', 'land']
const CARD_TYPE_LABELS = {
  creature: 'クリーチャー',
  instant: 'インスタント',
  sorcery: 'ソーサリー',
  enchantment: 'エンチャント',
  artifact: 'アーティファクト',
  land: '土地',
}

const COLORS = ['white', 'blue', 'black', 'red', 'green', 'colorless', 'multicolor']
const COLOR_LABELS = {
  white: '白',
  blue: '青',
  black: '黒',
  red: '赤',
  green: '緑',
  colorless: '無色',
  multicolor: '多色',
}
const COLOR_STYLES = {
  white: 'bg-yellow-50 border-yellow-200 text-yellow-900',
  blue: 'bg-blue-600 border-blue-400 text-white',
  black: 'bg-gray-900 border-gray-600 text-white',
  red: 'bg-red-600 border-red-400 text-white',
  green: 'bg-green-700 border-green-500 text-white',
  colorless: 'bg-gray-500 border-gray-400 text-white',
  multicolor: 'bg-gradient-to-r from-yellow-400 to-purple-500 border-purple-400 text-white',
}

const MTG_KEYWORDS = [
  'flying', 'haste', 'vigilance', 'trample', 'reach',
  'first_strike', 'double_strike', 'lifelink', 'deathtouch', 'menace',
  'defender', 'indestructible', 'hexproof', 'shroud', 'flash',
  'ward', 'protection', 'cycling', 'kicker', 'flashback',
  'equip', 'morph', 'unearth', 'delve',
]
const MTG_KEYWORD_LABELS = {
  flying: '飛行', haste: '速攻', vigilance: '警戒', trample: 'トランプル', reach: '到達',
  first_strike: '先制攻撃', double_strike: '二段攻撃', lifelink: '絆魂', deathtouch: '接死', menace: '威迫',
  defender: '防衛', indestructible: '破壊不能', hexproof: '呪禁', shroud: '被覆', flash: '瞬速',
  ward: '護法', protection: 'プロテクション', cycling: 'サイクリング', kicker: 'キッカー', flashback: 'フラッシュバック',
  equip: '装備', morph: '変異', unearth: '発掘', delve: '探査',
}

const ORIGINAL_KEYWORDS = ['拝金', '徴収', '栄光', '簒奪']
const TRIGGERS = ['etb', 'upkeep', 'attack', 'damage']
const TRIGGER_LABELS = { etb: '戦場に出た時', upkeep: 'アップキープ', attack: '攻撃時', damage: 'ダメージ時' }

export default function CardCreatePage() {
  const navigate = useNavigate()
  const { register, handleSubmit, watch, formState: { errors } } = useForm({
    defaultValues: { type: 'creature', color: 'colorless' },
  })

  const [selectedMtgKeywords, setSelectedMtgKeywords] = useState([])
  const [originalKeywords, setOriginalKeywords] = useState(
    ORIGINAL_KEYWORDS.reduce((acc, k) => ({ ...acc, [k]: { enabled: false, value: '', trigger: 'etb' } }), {})
  )
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const cardType = watch('type')

  const toggleMtgKeyword = (kw) => {
    setSelectedMtgKeywords(prev =>
      prev.includes(kw) ? prev.filter(k => k !== kw) : [...prev, kw]
    )
  }

  const toggleOriginalKeyword = (kw) => {
    setOriginalKeywords(prev => ({
      ...prev,
      [kw]: { ...prev[kw], enabled: !prev[kw].enabled },
    }))
  }

  const updateOriginalKeyword = (kw, field, value) => {
    setOriginalKeywords(prev => ({
      ...prev,
      [kw]: { ...prev[kw], [field]: value },
    }))
  }

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const buildKeywords = () => {
    const mtg = selectedMtgKeywords.map(type => ({ type }))
    const original = ORIGINAL_KEYWORDS
      .filter(k => originalKeywords[k].enabled)
      .map(k => ({
        type: k,
        value: parseInt(originalKeywords[k].value, 10) || 0,
        trigger: originalKeywords[k].trigger,
      }))
    return [...mtg, ...original]
  }

  const onSubmit = async (data) => {
    setSubmitting(true)
    setError('')

    try {
      let imageUrl = null

      if (imageFile) {
        const ext = imageFile.name.split('.').pop()
        const fileName = `shared/${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage
          .from('card-images')
          .upload(fileName, imageFile)

        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage
          .from('card-images')
          .getPublicUrl(fileName)
        imageUrl = urlData.publicUrl
      }

      const keywords = buildKeywords()

      const cardData = {
        name: data.name,
        type: data.type,
        color: data.color,
        mana_cost: data.mana_cost || null,
        power: cardType === 'creature' ? (parseInt(data.power, 10) ?? null) : null,
        toughness: cardType === 'creature' ? (parseInt(data.toughness, 10) ?? null) : null,
        effect_text: data.effect_text || null,
        keywords,
        image_url: imageUrl,
      }

      const { error: insertError } = await supabase.from('cards').insert(cardData)
      if (insertError) throw insertError

      navigate('/cards')
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-white">カード作成</h1>
        <button
          onClick={() => navigate('/cards')}
          className="text-gray-400 hover:text-white text-sm transition-colors"
        >
          ← カード一覧へ
        </button>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* 基本情報 */}
        <section className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-lg font-semibold text-purple-400 mb-4">基本情報</h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">カード名 *</label>
              <input
                {...register('name', { required: 'カード名は必須です' })}
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-purple-500"
                placeholder="カード名を入力"
              />
              {errors.name && <p className="text-red-400 text-sm mt-1">{errors.name.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">タイプ *</label>
              <div className="flex flex-wrap gap-2">
                {CARD_TYPES.map(t => (
                  <label key={t} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="radio" value={t} {...register('type')} className="hidden" />
                    <span className={`px-3 py-1.5 rounded-lg text-sm border cursor-pointer transition-colors ${
                      cardType === t
                        ? 'bg-purple-600 border-purple-500 text-white'
                        : 'bg-gray-900 border-gray-600 text-gray-300 hover:border-gray-400'
                    }`}>
                      {CARD_TYPE_LABELS[t]}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">色 *</label>
              <div className="flex flex-wrap gap-2">
                {COLORS.map(c => {
                  const currentColor = watch('color')
                  return (
                    <label key={c} className="cursor-pointer">
                      <input type="radio" value={c} {...register('color')} className="hidden" />
                      <span className={`px-3 py-1.5 rounded-lg text-sm border-2 cursor-pointer transition-all ${
                        currentColor === c
                          ? `${COLOR_STYLES[c]} ring-2 ring-white ring-offset-1 ring-offset-gray-800`
                          : `${COLOR_STYLES[c]} opacity-60`
                      }`}>
                        {COLOR_LABELS[c]}
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">マナコスト</label>
                <input
                  {...register('mana_cost')}
                  className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-purple-500"
                  placeholder="{2}{W}{U}"
                />
              </div>
              {cardType === 'creature' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">パワー</label>
                    <input
                      type="number"
                      {...register('power')}
                      className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-purple-500"
                      placeholder="2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">タフネス</label>
                    <input
                      type="number"
                      {...register('toughness')}
                      className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-purple-500"
                      placeholder="3"
                    />
                  </div>
                </>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">効果テキスト</label>
              <textarea
                {...register('effect_text')}
                rows={4}
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-purple-500 resize-none"
                placeholder="カードの効果を記述..."
              />
            </div>
          </div>
        </section>

        {/* キーワード能力 - MTG既存 */}
        <section className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-lg font-semibold text-purple-400 mb-4">MTGキーワード能力</h2>
          <div className="flex flex-wrap gap-2">
            {MTG_KEYWORDS.map(kw => (
              <button
                key={kw}
                type="button"
                onClick={() => toggleMtgKeyword(kw)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  selectedMtgKeywords.includes(kw)
                    ? 'bg-purple-600 border-purple-500 text-white'
                    : 'bg-gray-900 border-gray-600 text-gray-300 hover:border-gray-400'
                }`}
              >
                {MTG_KEYWORD_LABELS[kw]}
              </button>
            ))}
          </div>
        </section>

        {/* キーワード能力 - 独自 */}
        <section className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-lg font-semibold text-purple-400 mb-4">独自キーワード能力</h2>
          <div className="space-y-4">
            {ORIGINAL_KEYWORDS.map(kw => (
              <div key={kw} className={`rounded-lg border p-4 transition-colors ${
                originalKeywords[kw].enabled
                  ? 'border-purple-500 bg-purple-900/20'
                  : 'border-gray-700 bg-gray-900/40'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <button
                    type="button"
                    onClick={() => toggleOriginalKeyword(kw)}
                    className="flex items-center gap-2"
                  >
                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                      originalKeywords[kw].enabled
                        ? 'bg-purple-600 border-purple-500'
                        : 'border-gray-500'
                    }`}>
                      {originalKeywords[kw].enabled && (
                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <span className={`font-medium ${originalKeywords[kw].enabled ? 'text-white' : 'text-gray-400'}`}>
                      {kw}
                    </span>
                  </button>
                </div>

                {originalKeywords[kw].enabled && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">値（整数）</label>
                      <input
                        type="number"
                        value={originalKeywords[kw].value}
                        onChange={(e) => updateOriginalKeyword(kw, 'value', e.target.value)}
                        className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                        placeholder="100"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">トリガー</label>
                      <select
                        value={originalKeywords[kw].trigger}
                        onChange={(e) => updateOriginalKeyword(kw, 'trigger', e.target.value)}
                        className="w-full bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-purple-500"
                      >
                        {TRIGGERS.map(t => (
                          <option key={t} value={t}>{TRIGGER_LABELS[t]}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* 画像アップロード */}
        <section className="bg-gray-800 rounded-xl p-6 border border-gray-700">
          <h2 className="text-lg font-semibold text-purple-400 mb-4">カード画像（任意）</h2>
          <div className="flex gap-6 items-start">
            {imagePreview ? (
              <div className="relative">
                <img
                  src={imagePreview}
                  alt="プレビュー"
                  className="w-32 h-44 object-cover rounded-lg border border-gray-600"
                />
                <button
                  type="button"
                  onClick={() => { setImageFile(null); setImagePreview(null) }}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-600 rounded-full text-white text-xs flex items-center justify-center hover:bg-red-700"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="w-32 h-44 border-2 border-dashed border-gray-600 rounded-lg flex items-center justify-center text-gray-500 text-xs text-center">
                プレビュー
              </div>
            )}
            <div className="flex-1">
              <label className="block cursor-pointer">
                <div className="bg-gray-900 border border-gray-600 rounded-lg px-4 py-3 text-gray-300 text-sm hover:border-gray-400 transition-colors text-center">
                  画像を選択
                </div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="hidden"
                />
              </label>
              <p className="text-gray-500 text-xs mt-2">PNG, JPG, GIF (最大 5MB)</p>
            </div>
          </div>
        </section>

        {error && (
          <div className="bg-red-900/50 border border-red-700 rounded-lg px-4 py-3 text-red-300 text-sm">
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => navigate('/cards')}
            className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 rounded-lg transition-colors"
          >
            キャンセル
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:cursor-not-allowed text-white font-medium py-3 rounded-lg transition-colors"
          >
            {submitting ? '作成中...' : 'カード作成'}
          </button>
        </div>
      </form>
    </div>
  )
}
