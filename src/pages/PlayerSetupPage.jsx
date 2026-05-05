import { useState } from 'react'
import { usePlayer } from '../contexts/PlayerContext'

export default function PlayerSetupPage() {
  const { createPlayer } = usePlayer()
  const [username, setUsername] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!username.trim()) return
    setLoading(true)
    setError('')
    try {
      await createPlayer(username.trim())
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-purple-400 mb-2">MTG Board Game</h1>
          <p className="text-gray-400">プレイヤー名を入力してください</p>
        </div>

        <div className="bg-gray-800 rounded-2xl p-8 shadow-2xl border border-gray-700">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-1">
                プレイヤー名
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                maxLength={20}
                autoFocus
                className="w-full bg-gray-900 border border-gray-600 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors"
                placeholder="名前を入力（最大20文字）"
              />
            </div>

            {error && (
              <div className="bg-red-900/50 border border-red-700 rounded-lg px-4 py-3 text-red-300 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !username.trim()}
              className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-colors"
            >
              {loading ? '作成中...' : 'ゲームを始める'}
            </button>
          </form>

          <p className="text-gray-500 text-xs text-center mt-4">
            初期所持金: 1,000G
          </p>
        </div>
      </div>
    </div>
  )
}
