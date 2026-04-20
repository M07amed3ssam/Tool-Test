import { Toaster } from 'react-hot-toast';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { SidebarProvider } from './context/SidebarContext';
import ProtectedRoute from './components/ProtectedRoute';
import LayoutWrapper from './layouts/LayoutWrapper';
import { UserRole } from './types/roles';

// Auth Pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import ForgotPassword from './pages/auth/ForgotPassword';

// Main Pages (will be implemented later)
import Dashboard from './pages/Dashboard';
import ActiveScans from './pages/ActiveScans';
import CompletedScans from './pages/CompletedScans';
import Scans from './pages/Scans';
import Reports from './pages/Reports';
import FinalReport from './pages/FinalReport';
import Settings from './pages/Settings';
import AdminPanel from './pages/AdminPanel';
import NewScan from './pages/NewScan';
import StyleDemo from './pages/StyleDemo';
import ScanDetails from './pages/ScanDetails';

function App() {
  return (
    <Router>
      <AuthProvider>
        <ThemeProvider>
          <SidebarProvider>
            <Toaster position="top-right" />
            <Routes>
          {/* Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          
          {/* Protected Routes */}
          <Route path="/" element={
            <ProtectedRoute>
              <LayoutWrapper />
            </ProtectedRoute>
          }>
            <Route index element={<Dashboard />} />
            <Route path="active-scans" element={<ActiveScans />} />
            <Route path="completed-scans" element={<CompletedScans />} />
            <Route path="new-scan" element={<NewScan />} />
            <Route path="scans" element={<Scans />} />
            <Route path="scans/:id" element={<ScanDetails />} />
            <Route path="reports" element={<Reports />} />
            <Route path="reports/:id" element={<FinalReport />} />
            <Route path="settings" element={<Settings />} />
            <Route path="style-demo" element={<StyleDemo />} />
            
            {/* Admin Routes */}
            <Route path="admin" element={
              <ProtectedRoute requiredRole={UserRole.ADMIN}>
                <AdminPanel />
              </ProtectedRoute>
            } />
          </Route>
          
          {/* Catch all route */}
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </SidebarProvider>
        </ThemeProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
