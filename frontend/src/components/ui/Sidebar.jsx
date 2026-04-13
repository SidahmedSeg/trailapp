import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  LayoutDashboard,
  ScanLine,
  ClipboardList,
  Users,
  UserCheck,
  Settings,
  Ticket,
  LogOut,
  ChevronDown,
} from 'lucide-react';

const navItems = [
  { to: '/admin', icon: LayoutDashboard, label: 'Tableau de bord' },
  { to: '/admin/runners', icon: UserCheck, label: 'Coureurs' },
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
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClick(e) { if (menuRef.current && !menuRef.current.contains(e.target)) setUserMenuOpen(false); }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/admin/login', { replace: true });
  };

  return (
    <aside className="fixed inset-y-0 left-0 w-60 bg-white border-r border-gray-200 flex flex-col">
      {/* Top — Logo */}
      <div className="px-5 py-6 border-b border-gray-200">
        <div className="flex items-center gap-1.5">
          <span className="bg-[#C42826] text-white text-xs font-bold px-2 py-0.5 rounded">Trail</span>
          <span className="text-sm font-semibold text-gray-700">Admin</span>
        </div>
      </div>

      {/* Nav */}
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
                  ? 'bg-[#C42826]/5 text-[#C42826] font-medium'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom — User dropdown */}
      <div className="p-3 border-t border-gray-200 relative" ref={menuRef}>
        <button
          onClick={() => setUserMenuOpen(!userMenuOpen)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 transition cursor-pointer"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[#C42826]/10 flex items-center justify-center flex-shrink-0">
              <span className="text-xs font-bold text-[#C42826]">{(user?.username || '?')[0].toUpperCase()}</span>
            </div>
            <span className="text-sm font-medium text-gray-700 truncate">{user?.username}</span>
          </div>
          <ChevronDown size={14} className={`text-gray-400 transition flex-shrink-0 ${userMenuOpen ? 'rotate-180' : ''}`} />
        </button>

        {userMenuOpen && (
          <div className="absolute bottom-full start-3 end-3 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition cursor-pointer"
            >
              <LogOut size={16} />
              <span>Déconnexion</span>
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
