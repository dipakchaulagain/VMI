import { useLocation } from 'react-router-dom';
import { Bell, Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import './Header.css';

const pageTitles = {
    '/': 'Dashboard',
    '/vms': 'VM Inventory',
    '/networks': 'Networks',
    '/changes': 'Change History',
    '/owners': 'Owners',
    '/users': 'User Management',
    '/sync': 'Sync Management',
};

export default function Header() {
    const location = useLocation();
    const { theme, toggleTheme } = useTheme();

    const getTitle = () => {
        if (location.pathname.startsWith('/vms/')) {
            return 'VM Details';
        }
        return pageTitles[location.pathname] || 'VMI';
    };

    return (
        <header className="header">
            <div className="header-left">
                <h1 className="page-title">{getTitle()}</h1>
            </div>
            <div className="header-right">
                <button
                    className="header-icon-btn theme-toggle"
                    onClick={toggleTheme}
                    title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                >
                    {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
                </button>
                <button className="header-icon-btn">
                    <Bell size={20} />
                </button>
            </div>
        </header>
    );
}

