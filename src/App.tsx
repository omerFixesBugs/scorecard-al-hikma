import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { DataProvider } from './lib/data';
import Scoreboard from './pages/Scoreboard';
import TournamentPage from './pages/TournamentPage';
import MatchPage from './pages/MatchPage';
import AdminLayout from './pages/admin/AdminLayout';
import MatchControl from './pages/admin/MatchControl';
import Matches from './pages/admin/Matches';
import Tournaments from './pages/admin/Tournaments';
import Teams from './pages/admin/Teams';

export default function App() {
  return (
    <DataProvider>
      <BrowserRouter basename={import.meta.env.BASE_URL}>
        <Routes>
          <Route path="/" element={<TournamentPage />} />
          <Route path="/t/:slug" element={<TournamentPage />} />
          <Route path="/match/:id" element={<MatchPage />} />
          <Route path="/scoreboard" element={<Scoreboard />} />
          <Route path="/scoreboard/:matchId" element={<Scoreboard />} />
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<MatchControl />} />
            <Route path="matches" element={<Matches />} />
            <Route path="tournaments" element={<Tournaments />} />
            <Route path="teams" element={<Teams />} />
          </Route>
          <Route path="*" element={<TournamentPage />} />
        </Routes>
      </BrowserRouter>
    </DataProvider>
  );
}
