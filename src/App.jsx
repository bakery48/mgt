import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import CardsPage from './pages/CardsPage'
import CardCreatePage from './pages/CardCreatePage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/cards" element={<CardsPage />} />
        <Route path="/cards/new" element={<CardCreatePage />} />
        <Route path="*" element={<Navigate to="/cards" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
