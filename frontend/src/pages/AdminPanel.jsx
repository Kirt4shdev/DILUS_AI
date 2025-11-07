import React, { useState, useEffect, useRef } from 'react';
import { Upload, Trash2, Users, BarChart3, FileText, Check, X, TrendingUp, Loader, Activity, DollarSign, FolderOpen, Settings, Save, RotateCcw } from 'lucide-react';
import Header from '../components/Header';
import Loading from '../components/Loading';
import Modal from '../components/Modal';
import TokenStatsView from '../components/TokenStatsView';
import apiClient from '../api/client';
import { useToast } from '../contexts/ToastContext';

export default function AdminPanel() {
  const toast = useToast();
  const pollingInterval = useRef(null);
  
  const [activeTab, setActiveTab] = useState('codex');
  const [codexDocs, setCodexDocs] = useState([]);
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState(null);
  
  // Chunks RAG state
  const [chunks, setChunks] = useState([]);
  const [chunkStats, setChunkStats] = useState(null);
  const [chunkFilters, setChunkFilters] = useState({
    operation_type: '',
    operation_subtype: '',
    was_selected: '',
    limit: 50,
    offset: 0
  });
  const [totalChunks, setTotalChunks] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);

  // Embedding costs state
  const [embeddingCosts, setEmbeddingCosts] = useState(null);
  const [loadingCosts, setLoadingCosts] = useState(false);

  // RAG Config state
  const [ragConfig, setRagConfig] = useState(null);
  const [loadingRagConfig, setLoadingRagConfig] = useState(false);
  const [configHistory, setConfigHistory] = useState([]);
  const [unsavedChanges, setUnsavedChanges] = useState({});

  useEffect(() => {
    if (activeTab === 'codex') loadCodexDocs();
    if (activeTab === 'users') loadUsers();
    if (activeTab === 'stats') loadStats();
    if (activeTab === 'chunks') loadChunksHistory();
    if (activeTab === 'costs') loadEmbeddingCosts();
    if (activeTab === 'ragcontrol') loadRagConfig();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'chunks') loadChunksHistory();
  }, [chunkFilters, currentPage]);

  // Auto-refrescar cuando hay documentos procesándose
  useEffect(() => {
    const hasProcessingDocs = codexDocs.some(
      doc => doc.vectorization_status === 'pending' || doc.vectorization_status === 'processing'
    );

    if (hasProcessingDocs && activeTab === 'codex') {
      // Iniciar polling cada 3 segundos (sin mostrar loading spinner)
      pollingInterval.current = setInterval(() => {
        loadCodexDocs(false);
      }, 3000);
    } else {
      // Limpiar intervalo si no hay docs procesándose
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
        pollingInterval.current = null;
      }
    }

    // Cleanup al desmontar o cambiar de tab
    return () => {
      if (pollingInterval.current) {
        clearInterval(pollingInterval.current);
        pollingInterval.current = null;
      }
    };
  }, [codexDocs, activeTab]);

  const loadCodexDocs = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const response = await apiClient.get('/admin/vault/documents');
      setCodexDocs(response.data.documents);
    } catch (error) {
      if (showLoading) toast.error('Error al cargar documentos del Codex Dilus');
    } finally {
      if (showLoading) setLoading(false);
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

  const loadChunksHistory = async () => {
    try {
      setLoading(true);
      const params = {
        ...chunkFilters,
        offset: (currentPage - 1) * chunkFilters.limit
      };
      
      // Eliminar filtros vacíos
      Object.keys(params).forEach(key => {
        if (params[key] === '') delete params[key];
      });

      const response = await apiClient.get('/admin/chunks/history', { params });
      setChunks(response.data.chunks);
      setTotalChunks(response.data.total);
    } catch (error) {
      toast.error('Error al cargar historial de chunks');
    } finally {
      setLoading(false);
    }
  };

  const loadChunkStats = async () => {
    try {
      const response = await apiClient.get('/admin/chunks/stats');
      setChunkStats(response.data);
    } catch (error) {
      toast.error('Error al cargar estadísticas de chunks');
    }
  };

  const loadEmbeddingCosts = async () => {
    setLoadingCosts(true);
    try {
      const response = await apiClient.get('/admin/embedding-costs/overview');
      setEmbeddingCosts(response.data);
    } catch (error) {
      toast.error('Error cargando costes de embeddings');
      console.error('Error:', error);
    } finally {
      setLoadingCosts(false);
    }
  };

  const loadRagConfig = async () => {
    setLoadingRagConfig(true);
    try {
      const response = await apiClient.get('/admin/rag-config');
      setRagConfig(response.data.config);
      setUnsavedChanges({});
    } catch (error) {
      toast.error('Error cargando configuración del RAG');
      console.error('Error:', error);
    } finally {
      setLoadingRagConfig(false);
    }
  };

  const handleConfigChange = (key, value) => {
    setUnsavedChanges(prev => ({...prev, [key]: value}));
  };

  const saveRagConfig = async () => {
    if (Object.keys(unsavedChanges).length === 0) {
      toast.info('No hay cambios para guardar');
      return;
    }

    setLoadingRagConfig(true);
    try {
      await apiClient.put('/admin/rag-config', { updates: unsavedChanges });
      toast.success('Configuración actualizada correctamente');
      await loadRagConfig();
    } catch (error) {
      toast.error('Error actualizando configuración');
      console.error('Error:', error);
    } finally {
      setLoadingRagConfig(false);
    }
  };

  const resetRagConfig = async () => {
    if (!window.confirm('¿Estás seguro de resetear la configuración a los valores por defecto?')) {
      return;
    }

    setLoadingRagConfig(true);
    try {
      await apiClient.post('/admin/rag-config/reset');
      toast.success('Configuración reseteada a valores por defecto');
      await loadRagConfig();
    } catch (error) {
      toast.error('Error reseteando configuración');
      console.error('Error:', error);
    } finally {
      setLoadingRagConfig(false);
    }
  };

  const getConfigValue = (key) => {
    if (unsavedChanges.hasOwnProperty(key)) {
      return unsavedChanges[key];
    }
    return ragConfig?.[key]?.value ?? '';
  };

  const handleChunkFilterChange = (key, value) => {
    setChunkFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const getScoreColor = (score, type = 'similarity') => {
    const threshold = type === 'similarity' ? 0.3 : 0.25;
    if (score >= 0.7) return 'text-green-600 dark:text-green-400 font-semibold';
    if (score >= threshold) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
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

  const handleDeleteVaultDoc = async () => {
    if (!deleteConfirmModal) return;

    try {
      await apiClient.delete(`/admin/vault/documents/${deleteConfirmModal.id}`);
      toast.success('Documento eliminado del Codex Dilus');
      setDeleteConfirmModal(null);
      loadCodexDocs();
    } catch (error) {
      toast.error('Error al eliminar documento');
      setDeleteConfirmModal(null);
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
    { id: 'chunks', name: 'Análisis Chunks RAG', icon: Activity },
    { id: 'costs', name: 'Costes Embeddings', icon: DollarSign },
    { id: 'ragcontrol', name: 'Control del RAG', icon: Settings },
    { id: 'tokenstats', name: 'Estadísticas Tokens', icon: TrendingUp },
    { id: 'stats', name: 'General', icon: BarChart3 }
  ];

  const totalPages = Math.ceil(totalChunks / chunkFilters.limit);

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
                          {(doc.vectorization_status === 'processing' || doc.vectorization_status === 'pending') && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                              <Loader className="w-3 h-3 mr-1 animate-spin" />
                              {doc.vectorization_status === 'pending' ? 'En cola...' : 'Procesando...'}
                            </span>
                          )}
                          {doc.vectorization_status === 'failed' && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                              <X className="w-3 h-3 mr-1" />
                              Error
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                          {new Date(doc.created_at).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => setDeleteConfirmModal({ id: doc.id, filename: doc.filename })}
                            className="text-red-600 hover:text-red-700 dark:text-red-400"
                            title="Eliminar documento"
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

          {/* Tab: Análisis Chunks RAG */}
          {activeTab === 'chunks' && !loading && (
            <div className="space-y-6">
              <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                📊 Análisis de Chunks RAG
              </h3>

              {/* Filtros */}
              <div className="bg-stone-200 dark:bg-gray-700 rounded-lg p-6">
                <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Filtros</h4>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Tipo de Operación
                    </label>
                    <select
                      value={chunkFilters.operation_type}
                      onChange={(e) => handleChunkFilterChange('operation_type', e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100"
                    >
                      <option value="">Todos</option>
                      <option value="chat">Chat</option>
                      <option value="analysis">Análisis</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Subtipo
                    </label>
                    <select
                      value={chunkFilters.operation_subtype}
                      onChange={(e) => handleChunkFilterChange('operation_subtype', e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100"
                    >
                      <option value="">Todos</option>
                      <option value="vault_query">Consulta Bóveda</option>
                      <option value="pliego_tecnico">Pliego Técnico</option>
                      <option value="contrato">Contrato</option>
                      <option value="oferta">Oferta</option>
                      <option value="documentacion">Documentación</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Estado
                    </label>
                    <select
                      value={chunkFilters.was_selected}
                      onChange={(e) => handleChunkFilterChange('was_selected', e.target.value)}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100"
                    >
                      <option value="">Todos</option>
                      <option value="true">Seleccionados</option>
                      <option value="false">Rechazados</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Por página
                    </label>
                    <select
                      value={chunkFilters.limit}
                      onChange={(e) => handleChunkFilterChange('limit', parseInt(e.target.value))}
                      className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-gray-100"
                    >
                      <option value="25">25</option>
                      <option value="50">50</option>
                      <option value="100">100</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Tabla de Chunks */}
              {chunks.length === 0 ? (
                <div className="bg-stone-200 dark:bg-gray-700 rounded-lg p-12 text-center">
                  <p className="text-gray-600 dark:text-gray-400">No hay chunks registrados con estos filtros</p>
                </div>
              ) : (
                <div className="overflow-x-auto bg-white dark:bg-gray-800 rounded-lg shadow">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-stone-100 dark:bg-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                          Fecha/Hora
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                          Operación
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                          Documento
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                          Similitud
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                          Score Híbrido
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                          Thresholds
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                          Estado
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 dark:text-gray-300 uppercase tracking-wider">
                          Usuario
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {chunks.map((chunk) => (
                        <tr key={chunk.id} className="hover:bg-stone-100 dark:hover:bg-gray-700">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                            {new Date(chunk.created_at).toLocaleString('es-ES')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <div>
                              <span className="font-medium text-gray-900 dark:text-gray-100">{chunk.operation_type}</span>
                              {chunk.operation_subtype && (
                                <div className="text-xs text-gray-500 dark:text-gray-400">{chunk.operation_subtype}</div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 text-sm">
                            <div className="max-w-xs truncate text-gray-900 dark:text-gray-100" title={chunk.document_name}>
                              {chunk.document_name || '-'}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">Chunk #{chunk.chunk_index}</div>
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm ${getScoreColor(chunk.vector_similarity, 'similarity')}`}>
                            {chunk.vector_similarity.toFixed(3)}
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm ${getScoreColor(chunk.hybrid_score, 'hybrid')}`}>
                            {chunk.hybrid_score.toFixed(3)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-600 dark:text-gray-400">
                            <div>Sim: {chunk.min_similarity_threshold?.toFixed(2) || '-'}</div>
                            <div>Hyb: {chunk.min_hybrid_threshold?.toFixed(2) || '-'}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {chunk.was_selected ? (
                              <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200">
                                ✓ Seleccionado
                              </span>
                            ) : (
                              <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200">
                                ✗ Rechazado
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                            {chunk.username || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Paginación */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 rounded-b-lg">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <button
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="btn-secondary disabled:opacity-50"
                    >
                      Anterior
                    </button>
                    <button
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="btn-secondary disabled:opacity-50"
                    >
                      Siguiente
                    </button>
                  </div>
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        Mostrando{' '}
                        <span className="font-medium">{(currentPage - 1) * chunkFilters.limit + 1}</span>
                        {' - '}
                        <span className="font-medium">
                          {Math.min(currentPage * chunkFilters.limit, totalChunks)}
                        </span>
                        {' de '}
                        <span className="font-medium">{totalChunks}</span>
                        {' resultados'}
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                        <button
                          onClick={() => setCurrentPage(1)}
                          disabled={currentPage === 1}
                          className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                        >
                          «
                        </button>
                        <button
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="relative inline-flex items-center px-2 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                        >
                          ‹
                        </button>
                        <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300">
                          {currentPage} / {totalPages}
                        </span>
                        <button
                          onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          className="relative inline-flex items-center px-2 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                        >
                          ›
                        </button>
                        <button
                          onClick={() => setCurrentPage(totalPages)}
                          disabled={currentPage === totalPages}
                          className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                        >
                          »
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}

              {/* Botón para cargar estadísticas */}
              <div className="flex justify-center">
                <button
                  onClick={loadChunkStats}
                  className="btn-primary"
                >
                  📈 Ver Estadísticas Detalladas
                </button>
              </div>

              {/* Estadísticas detalladas */}
              {chunkStats && (
                <div className="space-y-6 mt-6">
                  {/* Resumen por operación */}
                  {chunkStats.overview && chunkStats.overview.length > 0 && (
                    <div className="bg-stone-200 dark:bg-gray-700 rounded-lg p-6">
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
                        📊 Resumen por Tipo de Operación
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
                          <thead>
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Operación</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Subtipo</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Total</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Selec.</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Rechaz.</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Avg Sim</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Avg Hybrid</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                            {chunkStats.overview.map((row, idx) => (
                              <tr key={idx} className="text-sm">
                                <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{row.operation_type}</td>
                                <td className="px-4 py-2 text-gray-600 dark:text-gray-400">{row.operation_subtype || '-'}</td>
                                <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{row.total_chunks}</td>
                                <td className="px-4 py-2 text-green-600 dark:text-green-400">{row.selected_chunks}</td>
                                <td className="px-4 py-2 text-red-600 dark:text-red-400">{row.rejected_chunks}</td>
                                <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{parseFloat(row.avg_similarity).toFixed(3)}</td>
                                <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{parseFloat(row.avg_hybrid_score).toFixed(3)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Historial de thresholds */}
                  {chunkStats.threshold_history && chunkStats.threshold_history.length > 0 && (
                    <div className="bg-stone-200 dark:bg-gray-700 rounded-lg p-6">
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
                        ⚙️ Historial de Thresholds Aplicados
                      </h4>
                      <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
                          <thead>
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Threshold Sim</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Threshold Hyb</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Usos</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Selec.</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Rechaz.</th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">% Éxito</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                            {chunkStats.threshold_history.map((row, idx) => {
                              const successRate = row.uses > 0 ? (row.selected / row.uses * 100).toFixed(1) : 0;
                              return (
                                <tr key={idx} className="text-sm">
                                  <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{row.min_similarity_threshold?.toFixed(2) || '-'}</td>
                                  <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{row.min_hybrid_threshold?.toFixed(2) || '-'}</td>
                                  <td className="px-4 py-2 text-gray-900 dark:text-gray-100">{row.uses}</td>
                                  <td className="px-4 py-2 text-green-600 dark:text-green-400">{row.selected}</td>
                                  <td className="px-4 py-2 text-red-600 dark:text-red-400">{row.rejected}</td>
                                  <td className="px-4 py-2 font-medium text-gray-900 dark:text-gray-100">{successRate}%</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        {/* Tab: Costes Embeddings */}
        {activeTab === 'costs' && (
          <div className="space-y-6">
            {loadingCosts ? (
              <div className="flex justify-center py-12">
                <Loader className="w-8 h-8 text-blue-600 animate-spin" />
              </div>
            ) : embeddingCosts ? (
              <>
                {/* Resumen General */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6 flex items-center">
                    <DollarSign className="w-5 h-5 mr-2 text-green-600" />
                    Resumen de Costes (Embeddings)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Operaciones</p>
                      <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                        {parseInt(embeddingCosts.total.total_operations || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Tokens</p>
                      <p className="text-3xl font-bold text-purple-600 dark:text-purple-400">
                        {parseInt(embeddingCosts.total.total_tokens || 0).toLocaleString()}
                      </p>
                    </div>
                    <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Coste Total</p>
                      <p className="text-3xl font-bold text-green-600 dark:text-green-400">
                        ${parseFloat(embeddingCosts.total.total_cost_usd || 0).toFixed(4)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Modelo: text-embedding-ada-002
                      </p>
                    </div>
                  </div>
                </div>

                {/* Por Tipo de Operación */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
                    📊 Costes por Tipo de Operación
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-300 dark:divide-gray-600">
                      <thead>
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 dark:text-gray-300">Tipo</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 dark:text-gray-300">Operaciones</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 dark:text-gray-300">Tokens</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 dark:text-gray-300">Coste</th>
                          <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 dark:text-gray-300">Avg/Op</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                        {embeddingCosts.byOperation && embeddingCosts.byOperation.map((op, idx) => (
                          <tr key={idx} className="text-sm">
                            <td className="px-4 py-3 text-gray-900 dark:text-gray-100 font-medium">
                              {op.operation_type === 'document_ingestion' && '📄 Procesamiento Docs'}
                              {op.operation_type === 'vault_query' && '🔍 Búsqueda Vault'}
                              {op.operation_type === 'document_query' && '📝 Búsqueda Documento'}
                              {op.operation_type === 'general_query' && '🌐 Búsqueda General'}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100">
                              {parseInt(op.total_operations).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-900 dark:text-gray-100">
                              {parseInt(op.total_tokens).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-right text-green-600 dark:text-green-400 font-semibold">
                              ${parseFloat(op.total_cost_usd).toFixed(4)}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                              ${parseFloat(op.avg_cost_usd).toFixed(6)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Top Usuarios */}
                {embeddingCosts.byUser && embeddingCosts.byUser.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
                      👥 Top Usuarios por Coste
                    </h4>
                    <div className="space-y-3">
                      {embeddingCosts.byUser.slice(0, 5).map((user, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {user.username || user.email}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              {parseInt(user.total_operations).toLocaleString()} operaciones • {parseInt(user.total_tokens).toLocaleString()} tokens
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-green-600 dark:text-green-400">
                              ${parseFloat(user.total_cost_usd).toFixed(4)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Top Documentos */}
                {embeddingCosts.byDocument && embeddingCosts.byDocument.length > 0 && (
                  <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">
                      📚 Top Documentos por Coste
                    </h4>
                    <div className="space-y-3">
                      {embeddingCosts.byDocument.slice(0, 5).map((doc, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {doc.filename}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              {doc.is_vault_document ? '🔒 Vault' : '📁 Proyecto'} • {parseInt(doc.total_operations).toLocaleString()} ops • {parseInt(doc.total_tokens).toLocaleString()} tokens
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-green-600 dark:text-green-400">
                              ${parseFloat(doc.total_cost_usd).toFixed(4)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                No hay datos de costes disponibles
              </div>
            )}
          </div>
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

        {/* Tab: Control del RAG */}
        {activeTab === 'ragcontrol' && (
          <div className="space-y-6">
            {loadingRagConfig ? (
              <Loading />
            ) : ragConfig ? (
              <>
                {/* Header con botones de acción */}
                <div className="flex justify-between items-center">
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Control del RAG
                  </h3>
                  <div className="flex space-x-3">
                    {Object.keys(unsavedChanges).length > 0 && (
                      <span className="text-amber-600 dark:text-amber-400 text-sm flex items-center">
                        <Activity className="w-4 h-4 mr-1" />
                        {Object.keys(unsavedChanges).length} cambios sin guardar
                      </span>
                    )}
                    <button
                      onClick={saveRagConfig}
                      disabled={Object.keys(unsavedChanges).length === 0}
                      className="btn-primary flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Save className="w-4 h-4" />
                      <span>Guardar Cambios</span>
                    </button>
                    <button
                      onClick={resetRagConfig}
                      className="btn-secondary flex items-center space-x-2"
                    >
                      <RotateCcw className="w-4 h-4" />
                      <span>Resetear</span>
                    </button>
                  </div>
                </div>

                {/* Configuración de Chunking */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                  <h4 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                    <FileText className="w-5 h-5 mr-2" />
                    Configuración de Chunking
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Chunk Size */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Tamaño de Chunk (caracteres)
                      </label>
                      <input
                        type="number"
                        value={getConfigValue('chunk_size')}
                        onChange={(e) => handleConfigChange('chunk_size', e.target.value)}
                        min={ragConfig.chunk_size?.minValue}
                        max={ragConfig.chunk_size?.maxValue}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Rango: {ragConfig.chunk_size?.minValue} - {ragConfig.chunk_size?.maxValue}
                      </p>
                    </div>

                    {/* Chunk Overlap */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Overlap (caracteres)
                      </label>
                      <input
                        type="number"
                        value={getConfigValue('chunk_overlap')}
                        onChange={(e) => handleConfigChange('chunk_overlap', e.target.value)}
                        min={ragConfig.chunk_overlap?.minValue}
                        max={ragConfig.chunk_overlap?.maxValue}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Rango: {ragConfig.chunk_overlap?.minValue} - {ragConfig.chunk_overlap?.maxValue}
                      </p>
                    </div>

                    {/* Chunking Method */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Método de Chunking
                      </label>
                      <select
                        value={getConfigValue('chunking_method')}
                        onChange={(e) => handleConfigChange('chunking_method', e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="fixed">Fixed Size</option>
                        <option value="sentence">Por Sentencias</option>
                        <option value="paragraph">Por Párrafos</option>
                      </select>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Actualmente solo "fixed" está implementado
                      </p>
                    </div>
                  </div>
                </div>

                {/* Thresholds de Selección */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                  <h4 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                    <Activity className="w-5 h-5 mr-2" />
                    Thresholds de Selección de Chunks
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Min Similarity */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Threshold de Similitud Vectorial
                      </label>
                      <div className="flex items-center space-x-3">
                        <input
                          type="range"
                          value={getConfigValue('min_similarity')}
                          onChange={(e) => handleConfigChange('min_similarity', e.target.value)}
                          min={0}
                          max={1}
                          step={0.05}
                          className="flex-1"
                        />
                        <span className="text-lg font-bold text-gray-900 dark:text-white w-16 text-right">
                          {parseFloat(getConfigValue('min_similarity')).toFixed(2)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {ragConfig.min_similarity?.description}
                      </p>
                    </div>

                    {/* Min Hybrid Score */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Threshold de Score Híbrido
                      </label>
                      <div className="flex items-center space-x-3">
                        <input
                          type="range"
                          value={getConfigValue('min_hybrid_score')}
                          onChange={(e) => handleConfigChange('min_hybrid_score', e.target.value)}
                          min={0}
                          max={1}
                          step={0.05}
                          className="flex-1"
                        />
                        <span className="text-lg font-bold text-gray-900 dark:text-white w-16 text-right">
                          {parseFloat(getConfigValue('min_hybrid_score')).toFixed(2)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {ragConfig.min_hybrid_score?.description}
                      </p>
                    </div>

                    {/* Top K */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Número de Chunks (Top K)
                      </label>
                      <input
                        type="number"
                        value={getConfigValue('top_k')}
                        onChange={(e) => handleConfigChange('top_k', e.target.value)}
                        min={ragConfig.top_k?.minValue}
                        max={ragConfig.top_k?.maxValue}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Rango: {ragConfig.top_k?.minValue} - {ragConfig.top_k?.maxValue}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Pesos de Score Híbrido */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                  <h4 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                    <TrendingUp className="w-5 h-5 mr-2" />
                    Pesos de Score Híbrido
                  </h4>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Vector Weight */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Peso Vectorial (Semántico)
                      </label>
                      <div className="flex items-center space-x-3">
                        <input
                          type="range"
                          value={getConfigValue('vector_weight')}
                          onChange={(e) => handleConfigChange('vector_weight', e.target.value)}
                          min={0}
                          max={1}
                          step={0.1}
                          className="flex-1"
                        />
                        <span className="text-lg font-bold text-gray-900 dark:text-white w-16 text-right">
                          {parseFloat(getConfigValue('vector_weight')).toFixed(1)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Influencia de similitud semántica
                      </p>
                    </div>

                    {/* BM25 Weight */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Peso BM25 (Keywords)
                      </label>
                      <div className="flex items-center space-x-3">
                        <input
                          type="range"
                          value={getConfigValue('bm25_weight')}
                          onChange={(e) => handleConfigChange('bm25_weight', e.target.value)}
                          min={0}
                          max={1}
                          step={0.1}
                          className="flex-1"
                        />
                        <span className="text-lg font-bold text-gray-900 dark:text-white w-16 text-right">
                          {parseFloat(getConfigValue('bm25_weight')).toFixed(1)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Influencia de coincidencia de palabras clave
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                    <p className="text-sm text-amber-800 dark:text-amber-300">
                      💡 <strong>Nota:</strong> La suma de vector_weight + bm25_weight debería ser 1.0 para mejores resultados.
                      Actualmente: {(parseFloat(getConfigValue('vector_weight')) + parseFloat(getConfigValue('bm25_weight'))).toFixed(1)}
                    </p>
                  </div>
                </div>

                {/* Info adicional */}
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <h5 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
                    ℹ️ Información importante
                  </h5>
                  <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1 list-disc list-inside">
                    <li>Los cambios se aplican inmediatamente a nuevas búsquedas y chunking</li>
                    <li>Los documentos ya vectorizados no se re-procesan automáticamente</li>
                    <li>Puedes ver el efecto de los thresholds en la pestaña "Análisis Chunks RAG"</li>
                    <li>Los valores por defecto están optimizados para español</li>
                  </ul>
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">No se pudo cargar la configuración</p>
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      {/* Modal de confirmación para borrar documento del Codex */}
      <Modal 
        isOpen={!!deleteConfirmModal} 
        onClose={() => setDeleteConfirmModal(null)}
        title="Confirmar eliminación"
      >
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          ¿Estás seguro de que deseas eliminar el documento <strong className="text-gray-900 dark:text-gray-100">"{deleteConfirmModal?.filename}"</strong> del Codex Dilus? Esta acción no se puede deshacer.
        </p>
        <div className="flex space-x-3 justify-end">
          <button
            onClick={() => setDeleteConfirmModal(null)}
            className="btn-secondary"
          >
            Cancelar
          </button>
          <button
            onClick={handleDeleteVaultDoc}
            className="btn-danger"
          >
            Eliminar
          </button>
        </div>
      </Modal>
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

