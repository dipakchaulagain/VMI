import { createContext, useContext, useState, useEffect } from 'react';
import { authApi } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [mustResetPassword, setMustResetPassword] = useState(false);

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        const token = localStorage.getItem('token');
        if (!token) {
            setLoading(false);
            return;
        }

        try {
            const response = await authApi.me();
            setUser(response.data.user);
            setMustResetPassword(response.data.must_reset_password);
        } catch (error) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
        } finally {
            setLoading(false);
        }
    };

    const login = async (username, password) => {
        const response = await authApi.login(username, password);
        const { token, user, must_reset_password } = response.data;

        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        setUser(user);
        setMustResetPassword(must_reset_password);

        return { user, must_reset_password };
    };

    const logout = async () => {
        try {
            await authApi.logout();
        } catch (error) {
            // Ignore logout errors
        }
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        setMustResetPassword(false);
    };

    const resetPassword = async (currentPassword, newPassword, confirmPassword) => {
        const response = await authApi.resetPassword(currentPassword, newPassword, confirmPassword);
        setUser(response.data.user);
        setMustResetPassword(false);
        return response.data;
    };

    const isAdmin = user?.role === 'admin';

    return (
        <AuthContext.Provider value={{
            user,
            loading,
            mustResetPassword,
            isAdmin,
            login,
            logout,
            resetPassword,
            checkAuth
        }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
}
