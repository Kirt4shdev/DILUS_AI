import React, { useState, useEffect } from 'react';
import { Upload, Trash2, Users, BarChart3, FileText, Check, X, TrendingUp } from 'lucide-react';
import Header from '../components/Header';
import Loading from '../components/Loading';
import TokenStatsView from '../components/TokenStatsView';
import apiClient from '../api/client';
import { useToast } from '../contexts/ToastContext';

export default function AdminPanel() {
  const toast = useToast();
  
  const [activeTab, setActiveTab] = useState('codex');
  const [codexDocs, setCodexDocs] = useState([]);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (activeTab === 'codex') loadCodexDocs();
    if (activeTab === 'users') loadUsers();
    if (activeTab === 'stats') loadStats();
  }, [activeTab]);

  const loadCodexDocs = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/admin/vault/documents');
      setCodexDocs(response.data.documents);
    } catch (error) {
      toast.error('Error al cargar documentos del Codex Dilus');
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/admin/users');
      setUsers(response.data.users);
    } catch (error) {
      toast.error('Error al cargar usuarios');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/admin/stats');
      setStats(response.data);
    } catch (error) {
      toast.error('Error al cargar estadísticas');
    } finally {
      setLoading(false);
    }
  };

  const handleUploadVaultDoc = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploading(true);
      await apiClient.post('/admin/vault/documents', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Documento añadido al Codex Dilus exitosamente');
      loadCodexDocs();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al subir documento');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteVaultDoc = async (id, filename) => {
    if (!confirm(`¿Eliminar documento "${filename}" del Codex Dilus?`)) return;

    try {
      await apiClient.delete(`/admin/vault/documents/${id}`);
      toast.success('Documento eliminado del Codex Dilus');
      loadCodexDocs();
    } catch (error) {
      toast.error('Error al eliminar documento');
    }
  };

  const handleToggleUserStatus = async (userId, currentStatus) => {
    try {
      await apiClient.put(`/admin/users/${userId}`, {
        is_active: !currentStatus
      });
      toast.success('Estado del usuario actualizado');
      loadUsers();
    } catch (error) {
      toast.error('Error al actualizar usuario');
    }
  };

  const tabs = [
    { id: 'codex', name: 'Codex Dilus', icon: FileText },
    { id: 'users', name: 'Usuarios', icon: Users },
    { id: 'tokenstats', name: 'Estadísticas Tokens', icon: TrendingUp },
    { id: 'stats', name: 'General', icon: BarChart3 }
  ];

  return (
    <div className="min-h-screen bg-stone-100 dark:bg-gray-900">
      <Header title="Panel de Administración" />

      <div className="container mx-auto px-6 py-8">

        {/* Tabs */}
        <div className="flex space-x-2 mb-6 border-b border-gray-200 dark:border-gray-700">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-3 border-b-2 font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                    : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span>{tab.name}</span>
              </button>
            );
          })}
        </div>

        {/* Contenido del tab */}
        <div className="card">
          {loading && <Loading />}

          {/* Tab: Codex Dilus */}
          {activeTab === 'codex' && !loading && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                    Alimentador del Codex Dilus
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">
                    Documentación corporativa accesible para todos los usuarios
                  </p>
                </div>
                <label className="btn-primary flex items-center space-x-2 cursor-pointer">
                  <Upload className="w-5 h-5" />
                  <span>{uploading ? 'Subiendo...' : 'Subir Documento'}</span>
                  <input
                    type="file"
                    onChange={handleUploadVaultDoc}
                    accept=".pdf,.docx,.txt"
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
              </div>

              {/* Lista de documentos */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-stone-200 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Documento
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Estado
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Fecha
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {codexDocs.map((doc) => (
                      <tr key={doc.id}>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                          {doc.filename}
                        </td>
                        <td className="px-4 py-3">
                          {doc.vectorization_status === 'completed' && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                              <Check className="w-3 h-3 mr-1" />
                              Procesado
                            </span>
                          )}
                          {doc.vectorization_status === 'processing' && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                              Procesando...
                            </span>
                          )}
                          {doc.vectorization_status === 'failed' && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                              Error
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                          {new Date(doc.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleDeleteVaultDoc(doc.id, doc.filename)}
                            className="text-red-600 hover:text-red-700 dark:text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {codexDocs.length === 0 && (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    No hay documentos en el Codex Dilus
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab: Usuarios */}
          {activeTab === 'users' && !loading && (
            <div className="space-y-4">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Gestión de Usuarios
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-stone-200 dark:bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Usuario
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Email
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Estado
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Rol
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Acciones
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {users.map((user) => (
                      <tr key={user.id}>
                        <td className="px-4 py-3">
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {user.username}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {user.full_name}
                            </p>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                          {user.email}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => handleToggleUserStatus(user.id, user.is_active)}
                            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                              user.is_active
                                ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                                : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                            }`}
                          >
                            {user.is_active ? (
                              <>
                                <Check className="w-3 h-3 mr-1" />
                                Activo
                              </>
                            ) : (
                              <>
                                <X className="w-3 h-3 mr-1" />
                                Inactivo
                              </>
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                            user.is_admin
                              ? 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300'
                              : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                          }`}>
                            {user.is_admin ? 'Admin' : 'Usuario'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-gray-500 dark:text-gray-400">
                          {new Date(user.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Tab: Estadísticas de Tokens */}
          {activeTab === 'tokenstats' && (
            <TokenStatsView />
          )}

          {/* Tab: Estadísticas Generales */}
          {activeTab === 'stats' && !loading && stats && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Estadísticas del Sistema
              </h3>

              {/* Tarjetas de estadísticas */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard title="Usuarios" value={stats.users.total} icon={Users} />
                <StatCard title="Proyectos" value={stats.projects.total} icon={FolderOpen} />
                <StatCard
                  title="Documentos"
                  value={stats.documents.total}
                  subtitle={`${stats.documents.vault} en Codex Dilus`}
                  icon={FileText}
                />
                <StatCard
                  title="Consultas al Codex Dilus"
                  value={stats.vault_queries.last_30_days}
                  subtitle="Últimos 30 días"
                  icon={BarChart3}
                />
              </div>

              {/* Uso de IA */}
              <div className="bg-stone-200 dark:bg-gray-700 rounded-lg p-6">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
                  Uso de IA (Últimos 30 días)
                </h4>
                <div className="space-y-3">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Total tokens consumidos:
                    </p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      {stats.ai_usage.tokens_last_30_days.toLocaleString()}
                    </p>
                  </div>

                  {stats.ai_usage.by_model.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Por modelo:
                      </p>
                      {stats.ai_usage.by_model.map((model, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between items-center text-sm"
                        >
                          <span className="text-gray-600 dark:text-gray-400">
                            {model.ai_model_used}
                          </span>
                          <span className="font-medium text-gray-900 dark:text-gray-100">
                            {parseInt(model.count)} análisis ({parseInt(model.tokens).toLocaleString()} tokens)
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value, subtitle, icon: Icon }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">{title}</p>
        <Icon className="w-5 h-5 text-gray-400" />
      </div>
      <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{value}</p>
      {subtitle && (
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{subtitle}</p>
      )}
    </div>
  );
}

// Icon import para StatCard
import { FolderOpen } from 'lucide-react';

