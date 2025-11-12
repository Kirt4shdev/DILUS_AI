import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { Sun, Moon, LogIn } from 'lucide-react';
import { useToast } from '../contexts/ToastContext';

export default function Login() {
  const [isRegister, setIsRegister] = useState(false);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    full_name: ''
  });
  const [loading, setLoading] = useState(false);

  const auth = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const toast = useToast();
  
  // Manejar caso de HMR donde el contexto no está disponible
  if (!auth) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary-600"></div>
      </div>
    );
  }

  const { login, register } = auth;

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      let result;
      if (isRegister) {
        result = await register(
          formData.username,
          formData.email,
          formData.password,
          formData.full_name
        );
      } else {
        result = await login(formData.username, formData.password);
      }

      if (result.success) {
        navigate('/');
      } else {
        toast.error(result.error);
      }
    } catch (err) {
      toast.error('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      {/* Toggle tema */}
      <button
        onClick={toggleTheme}
        className="fixed top-4 right-4 p-3 rounded-full bg-white dark:bg-gray-800 shadow-lg hover:shadow-xl transition-all"
      >
        {theme === 'light' ? (
          <Moon className="w-6 h-6 text-gray-700" />
        ) : (
          <Sun className="w-6 h-6 text-yellow-400" />
        )}
      </button>

      {/* Card de login */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary-600 dark:text-primary-400 mb-2">
            DILUS_AI
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Gestión de proyectos de ingeniería con IA
          </p>
        </div>

        {/* Tabs */}
        <div className="flex space-x-2 mb-6 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
          <button
            onClick={() => setIsRegister(false)}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
              !isRegister
                ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            Iniciar Sesión
          </button>
          <button
            onClick={() => setIsRegister(true)}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
              isRegister
                ? 'bg-white dark:bg-gray-800 text-primary-600 dark:text-primary-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            Registrarse
          </button>
        </div>

        {/* Error */}

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Username */}
          <div>
            <label className="label">Usuario</label>
            <input
              type="text"
              name="username"
              value={formData.username}
              onChange={handleChange}
              className="input"
              placeholder="tu_usuario"
              required
            />
          </div>

          {/* Email (solo registro) */}
          {isRegister && (
            <div>
              <label className="label">Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="input"
                placeholder="tu@email.com"
                required
              />
            </div>
          )}

          {/* Full name (solo registro) */}
          {isRegister && (
            <div>
              <label className="label">Nombre completo</label>
              <input
                type="text"
                name="full_name"
                value={formData.full_name}
                onChange={handleChange}
                className="input"
                placeholder="Tu Nombre"
              />
            </div>
          )}

          {/* Password */}
          <div>
            <label className="label">Contraseña</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className="input"
              placeholder="••••••••"
              required
              minLength={6}
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full btn-primary flex items-center justify-center space-x-2"
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
            ) : (
              <>
                <LogIn className="w-5 h-5" />
                <span>{isRegister ? 'Crear cuenta' : 'Iniciar sesión'}</span>
              </>
            )}
          </button>
        </form>

        {/* Credenciales de prueba */}
        <div className="mt-6 p-4 bg-stone-200 dark:bg-gray-700 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            <strong>Credenciales de prueba:</strong>
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Admin: <code className="font-mono bg-gray-200 dark:bg-gray-600 px-1 rounded">admin / admin123</code>
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Demo: <code className="font-mono bg-gray-200 dark:bg-gray-600 px-1 rounded">demo / demo123</code>
          </p>
        </div>
      </div>
    </div>
  );
}

