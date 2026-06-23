import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import Callback from './pages/Callback'
import Checkpoint from './pages/Checkpoint'
import Admin from './pages/Admin'
import KeyLookup from './pages/KeyLookup'

export default function App() {
  return (
    <Routes>
      <Route path="/"           element={<Home />} />
      <Route path="/callback"   element={<Callback />} />
      <Route path="/checkpoint" element={<Checkpoint />} />
      <Route path="/admin"      element={<Admin />} />
      <Route path="/key"        element={<KeyLookup />} />
    </Routes>
  )
}
