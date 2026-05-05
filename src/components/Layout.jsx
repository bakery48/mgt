import { NavLink, useNavigate } from 'react-router-dom'
import { usePlayer } from '../contexts/PlayerContext'

export default function Layout({ children }) {
  const { player, clearPlayer } = usePlayer()
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-900">
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto flex items-center gap-4">
          <span className="text-lg font-bold text-purple-400 shrink-0">MTG BG</span>

          <nav className="flex gap-1">
            {[
              { to: '/cards', label: 'カード' },
              { to: '/market', label: 'マーケット' },
              { to: '/collection', label: 'コレクション' },
              { to: '/decks', label: 'デッキ' },
              { to: '/game', label: 'ゲーム' },
            ].map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `px-3 py-1.5 rounded-lg text-sm transition-colors ${
                    isActive
                      ? 'bg-purple-600 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-700'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3 ml-auto">
            <div className="text-right hidden sm:block">
              <div className="text-white text-sm font-medium">{player?.username}</div>
              <div className="text-yellow-400 text-xs font-mono">{player?.balance?.toLocaleString()}G</div>
            </div>
            <button
              onClick={() => navigate('/cards/create')}
              className="bg-purple-600 hover:bg-purple-700 text-white text-sm px-3 py-1.5 rounded-lg transition-colors shrink-0"
            >
              + カード作成
            </button>
            <button
              onClick={clearPlayer}
              className="text-gray-500 hover:text-gray-300 text-xs px-2 py-1.5 rounded transition-colors"
              title="プレイヤー変更"
            >
              退出
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
