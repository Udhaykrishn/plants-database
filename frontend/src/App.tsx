import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { TaxonomyManager } from './components/taxonomy/TaxonomyManager';
import { PlantManager } from './components/plants/PlantManager';
import { PlantDetails } from './components/plants/PlantDetails';
import { ProjectManager } from './components/projects/ProjectManager';
import { ProjectDetails } from './components/projects/ProjectDetails';
import './App.css';

const queryClient = new QueryClient();

import { Dashboard } from './components/common/Dashboard';

function Layout() {
  return (
    <div className="app-container">
      <nav className="sidebar">
        <h1>Landschaft</h1>
        <ul>
          <li><NavLink to="/" end>Dashboard</NavLink></li>
          <li><NavLink to="/taxonomy">Taxonomy</NavLink></li>
          <li><NavLink to="/plants">Plants</NavLink></li>
          <li><NavLink to="/projects">Projects</NavLink></li>
        </ul>
      </nav>
      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/taxonomy" element={<TaxonomyManager />} />
          <Route path="/plants" element={<PlantManager />} />
          <Route path="/plants/:id" element={<PlantDetails />} />
          <Route path="/projects" element={<ProjectManager />} />
          <Route path="/projects/:id" element={<ProjectDetails />} />
        </Routes>
      </main>
    </div>
  );
}

import { AlertProvider } from './contexts/AlertContext';
import { ConfirmProvider } from './contexts/ConfirmContext';

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AlertProvider>
          <ConfirmProvider>
            <Layout />
          </ConfirmProvider>
        </AlertProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
