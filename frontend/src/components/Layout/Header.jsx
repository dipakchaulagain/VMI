import { useLocation } from 'react-router-dom';
import { Bell } from 'lucide-react';
import './Header.css';

const pageTitles = {
    '/': 'Dashboard',
    '/vms': 'VM Inventory',
    '/networks': 'Networks',
    '/changes': 'Change History',
    '/owners': 'Owners',
    '/users': 'User Management',
    '/sync': 'Sync Management',
    '/hypervisors': 'Hypervisors',
    '/settings': 'Settings',
};

export default function Header() {
    const location = useLocation();

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
                <div id="header-actions"></div>
                <button className="header-icon-btn">
                    <Bell size={20} />
                </button>
            </div>
        </header>
    );
}

