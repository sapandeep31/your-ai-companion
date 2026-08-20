import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { Dashboard } from './components/Dashboard.jsx'
import { CompanionRoute } from './components/CompanionRoute.jsx'

const rawPath = window.location.pathname.replace(/^\/+|\/+$/g, '');
const slug = rawPath.toLowerCase();

function RootRouter() {
  if (!slug || slug === 'home' || slug === 'dashboard') {
    return <Dashboard />;
  }
  if (slug === 'studio') {
    return <App />;
  }
  return <CompanionRoute slug={slug} />;
}

createRoot(document.getElementById('root')).render(<RootRouter />);

