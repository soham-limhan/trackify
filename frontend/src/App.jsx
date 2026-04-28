import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Component } from 'react';
import Home from './components/Home';
import Login from './components/Login';
import Register from './components/Register';
import Dashboard from './components/Dashboard';
import ForgotPassword from './components/ForgotPassword';
import { ThemeProvider } from './contexts/ThemeContext';
import ThemeToggle from './components/ThemeToggle';

// ─── Error Boundary ──────────────────────────────────────────────────────────
// Catches any render-time JS error and shows a recovery screen instead of a
// blank page. Also logs the exact error so it can be fixed.
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary] Caught render error:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '24px',
          background: '#050914', color: '#fff', fontFamily: 'Inter, sans-serif',
          padding: '40px'
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: 20, background: '#ef444420',
            border: '1px solid #ef444440', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 32
          }}>⚠</div>
          <div style={{ textAlign: 'center', maxWidth: 560 }}>
            <h2 style={{ fontSize: 24, fontWeight: 900, marginBottom: 8 }}>
              Something went wrong
            </h2>
            <p style={{
              fontSize: 13, color: '#94a3b8', fontFamily: 'monospace',
              background: '#0f172a', padding: '16px 24px', borderRadius: 12,
              border: '1px solid #1e293b', textAlign: 'left', whiteSpace: 'pre-wrap',
              wordBreak: 'break-word', marginTop: 16
            }}>
              {this.state.error?.message || String(this.state.error)}
            </p>
          </div>
          <button
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
            style={{
              padding: '12px 32px', background: '#6366f1', color: '#fff',
              border: 'none', borderRadius: 12, fontWeight: 700, fontSize: 13,
              cursor: 'pointer', letterSpacing: '0.05em', textTransform: 'uppercase'
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Page transition wrapper ─────────────────────────────────────────────────
const PageWrapper = ({ children }) => (
  <motion.div
    initial={{ opacity: 0, filter: 'blur(8px)' }}
    animate={{ opacity: 1, filter: 'blur(0px)' }}
    exit={{ opacity: 0, filter: 'blur(8px)' }}
    transition={{ duration: 0.4, ease: "easeInOut" }}
    style={{ w: '100%', h: '100%' }}
  >
    {children}
  </motion.div>
);

const AnimatedRoutes = () => {
  const location = useLocation();
  return (
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<PageWrapper><Home /></PageWrapper>} />
        <Route path="/login" element={<PageWrapper><Login /></PageWrapper>} />
        <Route path="/register" element={<PageWrapper><Register /></PageWrapper>} />
        <Route path="/forgot-password" element={<PageWrapper><ForgotPassword /></PageWrapper>} />
        <Route path="/dashboard" element={
          <ErrorBoundary>
            <PageWrapper><Dashboard /></PageWrapper>
          </ErrorBoundary>
        } />
      </Routes>
    </AnimatePresence>
  );
};

function App() {
  return (
    <ThemeProvider>
      {/* Global animated CSS gradient background — sits behind everything */}
      <div className="fixed inset-0 z-[-10] animated-gradient-bg"></div>
      <BrowserRouter>
        <ThemeToggle />
        <AnimatedRoutes />
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;

