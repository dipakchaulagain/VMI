import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
    LayoutDashboard,
    Server,
    Users,
    UserCircle,
    History,
    RefreshCw,
    LogOut,
    Settings,
    Network,
    HardDrive,
    Activity
} from 'lucide-react';
import './Sidebar.css';

export default function Sidebar() {
    const { user, isAdmin, logout } = useAuth();
    const location = useLocation();

    const navItems = [
        { path: '/', icon: LayoutDashboard, label: 'Dashboard' },
        { path: '/vms', icon: Server, label: 'VM Inventory' },
        { path: '/hypervisors', icon: HardDrive, label: 'Hypervisors' },
        { path: '/networks', icon: Network, label: 'Networks' },
        { path: '/changes', icon: History, label: 'Change History' },
        { path: '/owners', icon: UserCircle, label: 'Owners' },
    ];

    const adminItems = [
        { path: '/users', icon: Users, label: 'User Management' },
        { path: '/sync', icon: RefreshCw, label: 'Sync Management' },
        { path: '/activity', icon: Activity, label: 'Web Activity' },
        { path: '/settings', icon: Settings, label: 'Settings' },
    ];

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <div className="sidebar-logo">
                    <Server size={28} />
                    <span>VMI</span>
                </div>
                <p className="sidebar-subtitle">VM Inventory</p>
            </div>

            <nav className="sidebar-nav">
                <div className="nav-section">
                    <span className="nav-section-title">Main</span>
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                            end={item.path === '/'}
                        >
                            <item.icon size={20} />
                            <span>{item.label}</span>
                        </NavLink>
                    ))}
                </div>

                {isAdmin && (
                    <div className="nav-section">
                        <span className="nav-section-title">Administration</span>
                        {adminItems.map((item) => (
                            <NavLink
                                key={item.path}
                                to={item.path}
                                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                            >
                                <item.icon size={20} />
                                <span>{item.label}</span>
                            </NavLink>
                        ))}
                    </div>
                )}
            </nav>

            <div className="sidebar-footer">
                <div className="user-info">
                    <div className="user-avatar">
                        {user?.full_name?.charAt(0) || 'U'}
                    </div>
                    <div className="user-details">
                        <span className="user-name">{user?.full_name}</span>
                        <span className="user-role">{user?.role}</span>
                    </div>
                </div>
                <button className="logout-btn" onClick={logout} title="Logout">
                    <LogOut size={18} />
                </button>
            </div>
        </aside>
    );
}
