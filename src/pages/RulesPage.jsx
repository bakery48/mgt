import Layout from '../components/Layout'
import { ACTION_CARDS } from '../data/actionCards'
import { EVENT_CARDS } from '../data/eventCards'

function Section({ title, children }) {
  return (
    <section className="bg-gray-800 border border-gray-700 rounded-xl p-6">
      <h2 className="text-xl font-bold text-purple-400 mb-4">{title}</h2>
      <div className="text-gray-300 text-sm leading-relaxed space-y-3">{children}</div>
    </section>
  )
}

function Term({ label, children }) {
  return (
    <div className="flex flex-col sm:flex-row gap-1 sm:gap-3 py-1.5 border-b border-gray-700/50 last:border-0">
      <div className="text-purple-300 font-semibold sm:w-40 shrink-0">{label}</div>
      <div className="text-gray-300">{children}</div>
    </div>
  )
}

function CardRow({ name, description }) {
  return (
    <div className="bg-gray-900/60 border border-gray-700 rounded-lg p-3">
      <div className="font-semibold text-white text-sm mb-1">{name}</div>
      <div className="text-gray-400 text-xs leading-relaxed">{description}</div>
    </div>
  )
}

export default function RulesPage() {
  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">ゲームルール</h1>
          <span className="text-xs text-gray-500">MGT — Magic Game Table</span>
        </div>

        <Section title="概要">
          <p>
            MGTは、MTG風のカードバトルと人生ゲーム要素を組み合わせたボードゲームです。
            プレイヤーは各ラウンドで <span className="text-yellow-400">イベント → アクション → バトル</span> を経て、
            <span className="text-yellow-400"> 勝利点（VP） </span>または<span className="text-yellow-400"> 所持金（G） </span>での勝利を目指します。
          </p>
        </Section>

        <Section title="用語集">
          <Term label="ゲーム">複数のラウンドで構成されるセッション全体</Term>
          <Term label="ラウンド">パート1〜3（イベント → アクション → バトル）の1サイクル</Term>
          <Term label="バトル">ラウンド内パート3で行うMTG形式の1対1カード対戦</Term>
          <Term label="勝利点 (VP)">ゲームの勝敗を決める主要スコア</Term>
          <Term label="所持金 (G)">ゲーム内通貨（ゴールド）。マーケットでカードを購入できる</Term>
          <Term label="イベントカード">そのラウンドに全員へ影響するランダムイベント</Term>
          <Term label="アクションカード">各プレイヤーが1枚ずつ持ち、使用するか捨てるか選ぶカード</Term>
          <Term label="ホスト">ゲームを作成したプレイヤー。フェーズ進行を管理する</Term>
        </Section>

        <Section title="ゲーム設定（作成時に変更可）">
          <Term label="ラウンド数">ゲーム全体のラウンド数（デフォルト 5、1〜20）</Term>
          <Term label="VP閾値">この値以上のVPを持つ人が出るとゲーム終了（デフォルト 15）</Term>
          <Term label="所持金閾値">この値以上の所持金を持つ人が出るとゲーム終了（デフォルト 5000G）</Term>
          <Term label="初期配布G">ゲーム開始時に配布される所持金</Term>
          <Term label="バトル初期LP">バトル開始時のライフポイント（デフォルト 20）</Term>
        </Section>

        <Section title="ゲームの流れ">
          <pre className="bg-gray-900 border border-gray-700 rounded-lg p-4 text-xs text-gray-300 overflow-x-auto">
{`ゲーム開始
  └─ ラウンド開始
       ├─ パート1: イベント   ← ランダムなイベントが全員に発生
       ├─ パート2: アクション ← 各自に配られたカードを使うか選ぶ
       ├─ パート3: バトル     ← MTG形式の1対1カード対戦
       └─ ラウンド終了 → 次のラウンドへ
            └─ 最終ラウンド後、または勝利条件達成でゲーム終了`}
          </pre>
        </Section>

        <Section title={`パート1: イベント（${EVENT_CARDS.length}種）`}>
          <p className="mb-3">
            ラウンドごとにランダムな <span className="text-yellow-400">イベントカード</span> が公開されます。
            全員が「確認」を押すと次へ進みます。サイコロ系イベントはホストが振ります。
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {EVENT_CARDS.map(card => (
              <CardRow key={card.id} name={card.name} description={card.description} />
            ))}
          </div>
        </Section>

        <Section title={`パート2: アクション（${ACTION_CARDS.length}種）`}>
          <p className="mb-3">
            各プレイヤーにランダムな <span className="text-yellow-400">アクションカード</span> が1枚配られます。
            「使用する」か「使用しない」かを選びます。全員が選ぶと次へ進みます。
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {ACTION_CARDS.map(card => (
              <CardRow key={card.id} name={card.name} description={card.description} />
            ))}
          </div>
        </Section>

        <Section title="パート3: バトル">
          <p>
            MTG（マジック：ザ・ギャザリング）形式の1対1カード対戦です。
            開始ライフ20、手札7枚で開始し、相手のライフを0にすれば勝利です。
            勝者にはVPが付与されます。
          </p>
          <p className="text-gray-500 text-xs mt-2">
            ※ バトルのカードプレイ・戦闘・能力の詳細ルールは別ドキュメントを参照
          </p>
        </Section>

        <Section title="スターターデッキ">
          <p>
            ゲーム参加時に、15種のスターターデッキからランダムに1つが自動付与されます。
            自前でデッキを用意する必要はありません（練習用のオリジナルデッキはゲームには持ち込めません）。
          </p>
        </Section>

        <Section title="勝利条件">
          <p>以下のいずれかが達成された時点でゲーム終了：</p>
          <ol className="list-decimal list-inside space-y-1 pl-2">
            <li><span className="text-yellow-400">VP閾値達成</span>：いずれかのプレイヤーのVPが設定値以上になる</li>
            <li><span className="text-yellow-400">所持金閾値達成</span>：いずれかのプレイヤーの所持金が設定値以上になる</li>
            <li><span className="text-yellow-400">最終ラウンド終了</span>：全ラウンド終了時、最多VP保持者が勝利</li>
          </ol>
        </Section>

        <Section title="CPU対戦について">
          <p>
            「🤖 CPUとゲーム開始」ボタンで、AIとのフルゲーム（複数ラウンド）を開始できます。
            CPUはイベント確認・アクション選択・バトルをすべて自動で行います。
          </p>
        </Section>
      </div>
    </Layout>
  )
}
