import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { KeyRound, Eye, EyeOff, AlertTriangle } from 'lucide-react';
import './Login.css';

export default function ResetPassword() {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPasswords, setShowPasswords] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { resetPassword } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (newPassword !== confirmPassword) {
            setError('New passwords do not match');
            return;
        }

        if (newPassword.length < 8) {
            setError('New password must be at least 8 characters');
            return;
        }

        setLoading(true);

        try {
            await resetPassword(currentPassword, newPassword, confirmPassword);
            navigate('/');
        } catch (err) {
            setError(err.response?.data?.error || 'Password reset failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-page">
            <div className="login-container">
                <div className="login-card">
                    <div className="login-header">
                        <div className="login-logo" style={{ background: 'linear-gradient(135deg, #f59e0b, #ef4444)' }}>
                            <KeyRound size={40} />
                        </div>
                        <h1>Reset Password</h1>
                        <p>You must reset your password before continuing</p>
                    </div>

                    <div className="alert alert-warning" style={{ marginBottom: '20px' }}>
                        <AlertTriangle size={20} />
                        <span>Password reset required for security</span>
                    </div>

                    <form onSubmit={handleSubmit} className="login-form">
                        {error && (
                            <div className="alert alert-error">
                                {error}
                            </div>
                        )}

                        <div className="form-group">
                            <label className="form-label">Current Password</label>
                            <div className="password-input">
                                <input
                                    type={showPasswords ? 'text' : 'password'}
                                    className="form-input"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    placeholder="Enter current password"
                                    required
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">New Password</label>
                            <div className="password-input">
                                <input
                                    type={showPasswords ? 'text' : 'password'}
                                    className="form-input"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Enter new password (min 8 characters)"
                                    required
                                    minLength={8}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Confirm New Password</label>
                            <div className="password-input">
                                <input
                                    type={showPasswords ? 'text' : 'password'}
                                    className="form-input"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Confirm new password"
                                    required
                                />
                                <button
                                    type="button"
                                    className="password-toggle"
                                    onClick={() => setShowPasswords(!showPasswords)}
                                >
                                    {showPasswords ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        <button
                            type="submit"
                            className="btn btn-primary login-btn"
                            disabled={loading}
                        >
                            {loading ? <span className="loading-spinner" /> : 'Reset Password'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
