import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { PlayerProvider, usePlayer } from './contexts/PlayerContext'
import PlayerSetupPage from './pages/PlayerSetupPage'
import CardsPage from './pages/CardsPage'
import CardCreatePage from './pages/CardCreatePage'
import MarketPage from './pages/MarketPage'
import CollectionPage from './pages/CollectionPage'
import DecksPage from './pages/DecksPage'
import DeckEditPage from './pages/DeckEditPage'

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
      <Route path="/market" element={<PlayerRoute><MarketPage /></PlayerRoute>} />
      <Route path="/collection" element={<PlayerRoute><CollectionPage /></PlayerRoute>} />
      <Route path="/decks" element={<PlayerRoute><DecksPage /></PlayerRoute>} />
      <Route path="/decks/:id" element={<PlayerRoute><DeckEditPage /></PlayerRoute>} />
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
