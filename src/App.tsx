import { Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'

function DetailPlaceholder() {
  return <div className="p-8 text-stone-500">Detail page (coming next)</div>
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Dashboard />} />
      <Route path="/detail/:repo" element={<DetailPlaceholder />} />
    </Routes>
  )
}
