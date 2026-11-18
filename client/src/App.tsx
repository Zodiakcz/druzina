import { Route, Routes } from 'react-router-dom'
import { Home } from './pages/Home'
import { CampaignLayout, GmCharacter, GmEdit, GmHome, GmImport, GmNew, PartyHome, PlayerEdit, PlayerHome } from './pages/Campaign'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/pj/:key" element={<CampaignLayout prefix="pj" />}>
        <Route index element={<GmHome />} />
        <Route path="nova" element={<GmNew />} />
        <Route path="import" element={<GmImport />} />
        <Route path="postava/:id" element={<GmCharacter />} />
        <Route path="postava/:id/upravit" element={<GmEdit />} />
      </Route>
      <Route path="/k/:key" element={<CampaignLayout prefix="k" />}>
        <Route index element={<PartyHome />} />
      </Route>
      <Route path="/p/:key" element={<CampaignLayout prefix="p" />}>
        <Route index element={<PlayerHome />} />
        <Route path="upravit" element={<PlayerEdit />} />
      </Route>
      <Route path="*" element={<Home />} />
    </Routes>
  )
}
