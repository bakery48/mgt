import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import AuthPage from './pages/AuthPage'
import CardsPage from './pages/CardsPage'
import CardCreatePage from './pages/CardCreatePage'

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-gray-400">読み込み中...</div>
      </div>
    )
  }
  return user ? children : <Navigate to="/auth" replace />
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? <Navigate to="/cards" replace /> : children
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/auth" element={
        <PublicRoute><AuthPage /></PublicRoute>
      } />
      <Route path="/cards" element={
        <ProtectedRoute><CardsPage /></ProtectedRoute>
      } />
      <Route path="/cards/new" element={
        <ProtectedRoute><CardCreatePage /></ProtectedRoute>
      } />
      <Route path="*" element={<Navigate to="/cards" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  )
}
