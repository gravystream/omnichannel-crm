import React, { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import {
  Bars3Icon,
  XMarkIcon,
  HomeIcon,
  InboxIcon,
  ChatBubbleLeftRightIcon,
  UserGroupIcon,
  ClipboardDocumentListIcon,
  BookOpenIcon,
  ChartBarIcon,
  Cog6ToothIcon,
  ShieldCheckIcon,
  BellIcon,
  ArrowRightOnRectangleIcon,
  CpuChipIcon,
} from '@heroicons/react/24/outline';
import { useAuth } from '../hooks/useAuth';
import { useAppSelector, useAppDispatch, uiActions } from '../store';
import { useSocket } from '../contexts/SocketContext';

// Navigation for all users (agents can see these)
const agentNavigation = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  { name: 'Inbox', href: '/inbox', icon: InboxIcon },
  { name: 'Conversations', href: '/conversations', icon: ChatBubbleLeftRightIcon },
  { name: 'Resolutions', href: '/resolutions', icon: ClipboardDocumentListIcon },
  { name: 'Customers', href: '/customers', icon: UserGroupIcon },
];

// Navigation only for admins/owners
const adminOnlyNavigation = [
  { name: 'Knowledge Base', href: '/knowledge', icon: BookOpenIcon },
  { name: 'AI Agent', href: '/ai-agent', icon: CpuChipIcon },
  { name: 'Analytics', href: '/analytics', icon: ChartBarIcon },
];

const settingsNavigation = [
  { name: 'Settings', href: '/settings', icon: Cog6ToothIcon },
  { name: 'Admin', href: '/admin', icon: ShieldCheckIcon },
];

const statusColors: Record<string, string> = {
  online: 'bg-green-500',
  away: 'bg-yellow-500',
  busy: 'bg-red-500',
  offline: 'bg-gray-400',
};

export const MainLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { user, logout, updateStatus } = useAuth();
  const { isConnected } = useSocket();
  const dispatch = useAppDispatch();
  const notifications = useAppSelector(state => state.ui.notifications);
  const navigate = useNavigate();

  const unreadNotifications = notifications.filter(n => !n.read).length;

  const handleStatusChange = (status: 'online' | 'away' | 'busy' | 'offline') => {
    updateStatus(status);
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Mobile sidebar */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? '' : 'hidden'}`}>
        <div className="fixed inset-0 bg-gray-900/80" onClick={() => setSidebarOpen(false)} />
        <div className="fixed inset-y-0 left-0 w-64 bg-white shadow-xl">
          <div className="flex items-center justify-between h-16 px-4 border-b">
            <span className="text-xl font-bold text-primary-600">GravyStream</span>
            <button onClick={() => setSidebarOpen(false)} className="text-gray-500 hover:text-gray-700">
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>
          <nav className="px-2 py-4 space-y-1">
            {/* Agent navigation - visible to all users */}
            {agentNavigation.map(item => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  `flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`
                }
                onClick={() => setSidebarOpen(false)}
              >
                <item.icon className="w-5 h-5 mr-3" />
                {item.name}
              </NavLink>
            ))}

            {/* Admin-only navigation - only visible to owners/admins */}
            {user && (user.role === 'owner' || user.role === 'admin') && (
              <>
                <div className="pt-4 mt-4 border-t">
                  <p className="px-3 mb-2 text-xs font-semibold text-gray-500 uppercase">
                    Management
                  </p>
                  {adminOnlyNavigation.map(item => (
                    <NavLink
                      key={item.name}
                      to={item.href}
                      className={({ isActive }) =>
                        `flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                          isActive
                            ? 'bg-primary-50 text-primary-700'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`
                      }
                      onClick={() => setSidebarOpen(false)}
                    >
                      <item.icon className="w-5 h-5 mr-3" />
                      {item.name}
                    </NavLink>
                  ))}
                </div>
                <div className="pt-4 mt-4 border-t">
                  <p className="px-3 mb-2 text-xs font-semibold text-gray-500 uppercase">
                    Administration
                  </p>
                  {settingsNavigation.map(item => (
                    <NavLink
                      key={item.name}
                      to={item.href}
                      className={({ isActive }) =>
                        `flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                          isActive
                            ? 'bg-primary-50 text-primary-700'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`
                      }
                      onClick={() => setSidebarOpen(false)}
                    >
                      <item.icon className="w-5 h-5 mr-3" />
                      {item.name}
                    </NavLink>
                  ))}
                </div>
              </>
            )}
          </nav>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white border-r shadow-sm">
          {/* Logo */}
          <div className="flex items-center h-16 px-4 border-b">
            <span className="text-xl font-bold text-primary-600">GravyStream</span>
            <span className="ml-2 px-2 py-0.5 text-xs font-medium text-primary-700 bg-primary-100 rounded-full">
              CRM
            </span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
            {/* Agent navigation - visible to all users */}
            {agentNavigation.map(item => (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) =>
                  `flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-primary-50 text-primary-700'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`
                }
              >
                <item.icon className="w-5 h-5 mr-3" />
                {item.name}
              </NavLink>
            ))}

            {/* Admin-only navigation - only visible to owners/admins */}
            {user && (user.role === 'owner' || user.role === 'admin') && (
              <>
                <div className="pt-4 mt-4 border-t">
                  <p className="px-3 mb-2 text-xs font-semibold text-gray-500 uppercase">
                    Management
                  </p>
                  {adminOnlyNavigation.map(item => (
                    <NavLink
                      key={item.name}
                      to={item.href}
                      className={({ isActive }) =>
                        `flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                          isActive
                            ? 'bg-primary-50 text-primary-700'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`
                      }
                    >
                      <item.icon className="w-5 h-5 mr-3" />
                      {item.name}
                    </NavLink>
                  ))}
                </div>
                <div className="pt-4 mt-4 border-t">
                  <p className="px-3 mb-2 text-xs font-semibold text-gray-500 uppercase">
                    Administration
                  </p>
                  {settingsNavigation.map(item => (
                    <NavLink
                      key={item.name}
                      to={item.href}
                      className={({ isActive }) =>
                        `flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                          isActive
                            ? 'bg-primary-50 text-primary-700'
                            : 'text-gray-700 hover:bg-gray-100'
                        }`
                      }
                    >
                      <item.icon className="w-5 h-5 mr-3" />
                      {item.name}
                    </NavLink>
                  ))}
                </div>
              </>
            )}
          </nav>

          {/* User section */}
          <div className="p-4 border-t">
            <div className="flex items-center">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-semibold">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
                <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white ${statusColors[user?.status || 'offline']}`} />
              </div>
              <div className="ml-3 flex-1">
                <p className="text-sm font-medium text-gray-700">{user?.name}</p>
                <p className="text-xs text-gray-500 capitalize">{user?.role}</p>
              </div>
            </div>
            <div className="mt-3 flex gap-1">
              {(['online', 'away', 'busy', 'offline'] as const).map(status => (
                <button
                  key={status}
                  onClick={() => handleStatusChange(status)}
                  className={`flex-1 px-2 py-1 text-xs rounded capitalize ${
                    user?.status === status
                      ? 'bg-gray-200 font-medium'
                      : 'hover:bg-gray-100'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top header */}
        <header className="sticky top-0 z-40 flex items-center h-16 px-4 bg-white border-b shadow-sm">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-gray-500 hover:text-gray-700"
          >
            <Bars3Icon className="w-6 h-6" />
          </button>

          <div className="flex-1" />

          {/* Connection status */}
          <div className="flex items-center mr-4">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="ml-2 text-xs text-gray-500">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          {/* Notifications */}
          <button className="relative p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100">
            <BellIcon className="w-6 h-6" />
            {unreadNotifications > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 text-xs text-white bg-red-500 rounded-full flex items-center justify-center">
                {unreadNotifications}
              </span>
            )}
          </button>

          {/* Logout */}
          <button
            onClick={logout}
            className="ml-2 p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100"
            title="Logout"
          >
            <ArrowRightOnRectangleIcon className="w-6 h-6" />
          </button>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default MainLayout;
