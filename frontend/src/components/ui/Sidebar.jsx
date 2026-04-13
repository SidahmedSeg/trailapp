import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  LayoutDashboard,
  ScanLine,
  ClipboardList,
  Users,
  Settings,
  Ticket,
  LogOut,
} from 'lucide-react';

const navItems = [
  { to: '/admin', icon: LayoutDashboard, label: 'Tableau de bord' },
  { to: '/admin/scan', icon: ScanLine, label: 'Scanner' },
  { to: '/admin/bibs', icon: Ticket, label: 'Dossards' },
  { to: '/admin/activity', icon: ClipboardList, label: 'Activité' },
  { to: '/admin/users', icon: Users, label: 'Utilisateurs', superOnly: true },
  { to: '/admin/settings', icon: Settings, label: 'Paramètres' },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/admin/login', { replace: true });
  };

  return (
    <aside className="fixed inset-y-0 left-0 w-60 bg-white border-r border-gray-200 flex flex-col">
      <div className="px-5 py-6 border-b border-gray-200">
        <h1 className="text-lg font-bold text-[#C42826]">Trail Admin</h1>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          if (item.superOnly && user?.role !== 'super_admin') return null;
          const active = location.pathname === item.to;
          const Icon = item.icon;
          return (
            <button
              key={item.to}
              onClick={() => navigate(item.to)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition cursor-pointer ${
                active
                  ? 'bg-[#C42826]/5 text-[#C42826] font-medium border-l-2 border-[#C42826]'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="p-3 border-t border-gray-200">
        <div className="px-3 py-2 text-sm text-gray-500 truncate">{user?.username}</div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-500 hover:bg-red-50 rounded-lg transition cursor-pointer"
        >
          <LogOut size={18} />
          <span>Déconnexion</span>
        </button>
      </div>
    </aside>
  );
}
