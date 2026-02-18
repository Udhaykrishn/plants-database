import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { TaxonomyManager } from './components/taxonomy/TaxonomyManager';
import { PlantManager } from './components/plants/PlantManager';
import { ProjectManager } from './components/projects/ProjectManager';
import { ProjectDetails } from './components/projects/ProjectDetails';
import './App.css';

const queryClient = new QueryClient();

import { Dashboard } from './components/common/Dashboard';

function Layout() {
  return (
    <div className="app-container">
      <nav className="sidebar">
        <h1>Landshaft</h1>
        <ul>
          <li><Link to="/">Dashboard</Link></li>
          <li><Link to="/taxonomy">Taxonomy</Link></li>
          <li><Link to="/plants">Plants</Link></li>
          <li><Link to="/projects">Projects</Link></li>
        </ul>
      </nav>
      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/taxonomy" element={<TaxonomyManager />} />
          <Route path="/plants" element={<PlantManager />} />
          <Route path="/projects" element={<ProjectManager />} />
          <Route path="/projects/:id" element={<ProjectDetails />} />
        </Routes>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Layout />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
