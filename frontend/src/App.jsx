import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/Layout/Layout';
import Login from './pages/Login';
import ResetPassword from './pages/ResetPassword';
import Dashboard from './pages/Dashboard';
import VMInventory from './pages/VMInventory';
import VMDetail from './pages/VMDetail';
import UserManagement from './pages/UserManagement';
import OwnerManagement from './pages/OwnerManagement';
import ChangeHistory from './pages/ChangeHistory';
import SyncManagement from './pages/SyncManagement';
import NetworkManagement from './pages/NetworkManagement';

function PrivateRoute({ children, adminOnly = false }) {
    const { user, loading, mustResetPassword, isAdmin } = useAuth();

    if (loading) {
        return (
            <div className="loading-overlay">
                <div className="loading-spinner" />
            </div>
        );
    }

    if (!user) {
        return <Navigate to="/login" />;
    }

    if (mustResetPassword && window.location.pathname !== '/reset-password') {
        return <Navigate to="/reset-password" />;
    }

    if (adminOnly && !isAdmin) {
        return <Navigate to="/" />;
    }

    return children;
}

function AppRoutes() {
    return (
        <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={
                <PrivateRoute>
                    <ResetPassword />
                </PrivateRoute>
            } />
            <Route path="/" element={
                <PrivateRoute>
                    <Layout />
                </PrivateRoute>
            }>
                <Route index element={<Dashboard />} />
                <Route path="vms" element={<VMInventory />} />
                <Route path="vms/:id" element={<VMDetail />} />
                <Route path="changes" element={<ChangeHistory />} />
                <Route path="networks" element={<NetworkManagement />} />
                <Route path="users" element={
                    <PrivateRoute adminOnly>
                        <UserManagement />
                    </PrivateRoute>
                } />
                <Route path="owners" element={<OwnerManagement />} />
                <Route path="sync" element={
                    <PrivateRoute adminOnly>
                        <SyncManagement />
                    </PrivateRoute>
                } />
            </Route>
        </Routes>
    );
}

export default function App() {
    return (
        <Router>
            <ThemeProvider>
                <AuthProvider>
                    <AppRoutes />
                </AuthProvider>
            </ThemeProvider>
        </Router>
    );
}

