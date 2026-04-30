import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useEvent } from '../../hooks/useEvent';
import {
  LayoutDashboard, ScanLine, ClipboardList, Users, UserCheck,
  Settings, Ticket, LogOut, ChevronDown, Menu, X, Calendar, Eye, Plus, Shuffle,
} from 'lucide-react';

const navItems = [
  { to: '/admin', icon: LayoutDashboard, label: 'Tableau de bord' },
  { to: '/admin/runners', icon: UserCheck, label: 'Coureurs' },
  { to: '/admin/scan', icon: ScanLine, label: 'Scanner' },
  { to: '/admin/bibs', icon: Ticket, label: 'Dossards' },
  { to: '/admin/events', icon: Calendar, label: 'Événements' },
  { to: '/admin/reconciliation', icon: Shuffle, label: 'Réconciliation', roles: ['super_admin', 'reconciliation_specialist'] },
  { to: '/admin/activity', icon: ClipboardList, label: 'Activité' },
  { to: '/admin/users', icon: Users, label: 'Utilisateurs', superOnly: true },
  { to: '/admin/settings', icon: Settings, label: 'Paramètres' },
];

export default function Sidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { events, selectedEvent, switchEvent, isViewingHistory } = useEvent();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [eventMenuOpen, setEventMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef(null);
  const eventMenuRef = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setUserMenuOpen(false);
      if (eventMenuRef.current && !eventMenuRef.current.contains(e.target)) setEventMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const handleLogout = () => { logout(); navigate('/admin/login', { replace: true }); };
  const handleNav = (to) => { navigate(to); setMobileOpen(false); };

  const sidebarContent = (
    <>
      {/* Top — Logo */}
      <div className="px-5 py-5 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="bg-[#C42826] text-white text-xs font-bold px-2 py-0.5 rounded">Trail</span>
          <span className="text-sm font-semibold text-gray-700">Admin</span>
        </div>
        <button onClick={() => setMobileOpen(false)} className="lg:hidden text-gray-400 hover:text-gray-600 cursor-pointer">
          <X size={20} />
        </button>
      </div>

      {/* Event switcher */}
      {events.length > 0 && (
        <div className="px-3 py-2 border-b border-gray-200 relative" ref={eventMenuRef}>
          <button
            onClick={() => setEventMenuOpen(!eventMenuOpen)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition cursor-pointer"
          >
            <div className="flex items-center gap-2 min-w-0">
              <Calendar size={14} className="text-[#C42826] flex-shrink-0" />
              <span className="text-xs font-medium text-gray-700 truncate">
                {selectedEvent?.name || 'Événement'}
              </span>
            </div>
            <ChevronDown size={12} className={`text-gray-400 transition flex-shrink-0 ${eventMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          {isViewingHistory && (
            <div className="mx-3 mt-1 flex items-center gap-1 text-xs text-amber-600">
              <Eye size={12} />
              <span>Consultation historique</span>
            </div>
          )}

          {eventMenuOpen && (
            <div className="absolute left-3 right-3 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-50 max-h-48 overflow-y-auto">
              {events.map((evt) => (
                <button
                  key={evt.id}
                  onClick={() => { switchEvent(evt.id); setEventMenuOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition cursor-pointer flex items-center justify-between ${
                    evt.id === selectedEvent?.id ? 'bg-[#C42826]/5 text-[#C42826] font-medium' : 'text-gray-700'
                  }`}
                >
                  <span className="truncate">{evt.name}</span>
                  {evt.active && (
                    <span className="flex-shrink-0 ml-2 text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">actif</span>
                  )}
                </button>
              ))}
              <button
                onClick={() => { setEventMenuOpen(false); navigate('/admin/events'); }}
                className="w-full text-left px-3 py-2 text-xs text-[#C42826] hover:bg-[#C42826]/5 transition cursor-pointer flex items-center gap-1.5 border-t border-gray-100 mt-1 pt-2"
              >
                <Plus size={12} />
                <span>Nouvel événement</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          if (item.superOnly && user?.role !== 'super_admin') return null;
          if (item.roles && !item.roles.includes(user?.role)) return null;
          const active = location.pathname === item.to;
          const Icon = item.icon;
          return (
            <button key={item.to} onClick={() => handleNav(item.to)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition cursor-pointer ${
                active ? 'bg-[#C42826]/5 text-[#C42826] font-medium' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}>
              <Icon size={18} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Bottom — User dropdown */}
      <div className="p-3 border-t border-gray-200 relative" ref={menuRef}>
        <button onClick={() => setUserMenuOpen(!userMenuOpen)}
          className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 transition cursor-pointer">
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
            <button onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition cursor-pointer">
              <LogOut size={16} />
              <span>Déconnexion</span>
            </button>
          </div>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="bg-[#C42826] text-white text-xs font-bold px-2 py-0.5 rounded">Trail</span>
          <span className="text-sm font-semibold text-gray-700">Admin</span>
        </div>
        <button onClick={() => setMobileOpen(true)} className="text-gray-600 hover:text-gray-900 cursor-pointer">
          <Menu size={24} />
        </button>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 bg-white flex flex-col shadow-xl">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-60 bg-white border-r border-gray-200 flex-col z-30">
        {sidebarContent}
      </aside>
    </>
  );
}
