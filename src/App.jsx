import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { PlayerProvider, usePlayer } from './contexts/PlayerContext'
import PlayerSetupPage from './pages/PlayerSetupPage'
import CardsPage from './pages/CardsPage'
import CardCreatePage from './pages/CardCreatePage'

function PlayerRoute({ children }) {
  const { player, loading } = usePlayer()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-gray-400">読み込み中...</div>
      </div>
    )
  }
  return player ? children : <Navigate to="/setup" replace />
}

function AppRoutes() {
  const { player, loading } = usePlayer()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-gray-400">読み込み中...</div>
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/setup" element={
        player ? <Navigate to="/cards" replace /> : <PlayerSetupPage />
      } />
      <Route path="/cards" element={<PlayerRoute><CardsPage /></PlayerRoute>} />
      <Route path="/cards/create" element={<PlayerRoute><CardCreatePage /></PlayerRoute>} />
      <Route path="*" element={<Navigate to={player ? '/cards' : '/setup'} replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <PlayerProvider>
        <AppRoutes />
      </PlayerProvider>
    </BrowserRouter>
  )
}
