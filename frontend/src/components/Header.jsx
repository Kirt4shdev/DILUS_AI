import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Sun, Moon, LogOut, Shield, User, Home, ArrowLeft } from 'lucide-react';

export default function Header({ title }) {
  const auth = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Manejar caso de HMR donde el contexto no está disponible
  if (!auth) {
    return null;
  }

  const { user, logout, isAdmin } = auth;
  const isAdminPage = location.pathname.startsWith('/admin');
  const isProjectPage = location.pathname.startsWith('/project/');

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="bg-white dark:bg-gray-800 shadow-md border-b border-gray-200 dark:border-gray-700">
      <div className="px-6 py-4 flex items-center justify-between">
        {/* Logo y título */}
        <div className="flex items-center space-x-4">
          <h1 className="text-2xl font-bold text-primary-600 dark:text-primary-400">
            DILUS_AI
          </h1>
          {isProjectPage ? (
            <>
              <span className="text-gray-400">|</span>
              <button
                onClick={() => navigate('/')}
                className="flex items-center space-x-2 text-lg font-medium text-gray-700 dark:text-gray-300 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
                <span>Proyectos</span>
              </button>
            </>
          ) : title ? (
            <>
              <span className="text-gray-400">|</span>
              <h2 className="text-lg font-medium text-gray-700 dark:text-gray-300">
                {title}
              </h2>
            </>
          ) : null}
        </div>

        {/* Acciones */}
        <div className="flex items-center space-x-4">
          {/* Toggle tema */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title={theme === 'light' ? 'Modo oscuro' : 'Modo claro'}
          >
            {theme === 'light' ? (
              <Moon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            ) : (
              <Sun className="w-5 h-5 text-gray-400" />
            )}
          </button>

          {/* Admin panel link / Back to Dashboard */}
          {isAdmin && (
            isAdminPage ? (
              <button
                onClick={() => navigate('/')}
                className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Volver al inicio"
              >
                <Home className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Inicio
                </span>
              </button>
            ) : (
              <button
                onClick={() => navigate('/admin')}
                className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="Panel de administración"
              >
                <Shield className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Admin
                </span>
              </button>
            )
          )}

          {/* Usuario */}
          <div className="flex items-center space-x-3 px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-700">
            <User className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {user?.username}
            </span>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            className="flex items-center space-x-2 px-3 py-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 transition-colors"
            title="Cerrar sesión"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-sm font-medium">Salir</span>
          </button>
        </div>
      </div>
    </header>
  );
}

