import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FolderOpen, Trash2, Calendar, Search, X, Filter, ArrowUpDown, ChevronDown, Edit2, Archive, ArchiveRestore } from 'lucide-react';
import Header from '../components/Header';
import Modal from '../components/Modal';
import Loading from '../components/Loading';
import CodexDilusWidget from '../components/CodexDilusWidget';
import apiClient from '../api/client';
import { useToast } from '../contexts/ToastContext';

export default function Dashboard() {
  const [projects, setProjects] = useState([]);
  const [filteredProjects, setFilteredProjects] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'active', 'archived'
  const [sortBy, setSortBy] = useState('date-desc'); // 'date-desc', 'date-asc', 'name-asc', 'name-desc'
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectData, setNewProjectData] = useState({ name: '', description: '', client: '' });
  const [deleteConfirmModal, setDeleteConfirmModal] = useState(null);
  const [editingProject, setEditingProject] = useState(null);
  const [editProjectData, setEditProjectData] = useState({ name: '', description: '', client: '', status: 'active' });

  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/projects');
      setProjects(response.data.projects);
      setFilteredProjects(response.data.projects);
    } catch (error) {
      toast.error('Error al cargar proyectos');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar y ordenar proyectos
  useEffect(() => {
    let result = [...projects];

    // Aplicar filtro de búsqueda
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(project =>
        project.name.toLowerCase().includes(query) ||
        (project.description && project.description.toLowerCase().includes(query))
      );
    }

    // Aplicar filtro de estado
    if (statusFilter !== 'all') {
      result = result.filter(project => {
        if (statusFilter === 'active') return project.status === 'active';
        if (statusFilter === 'archived') return project.status !== 'active';
        return true;
      });
    }

    // Aplicar ordenamiento
    result.sort((a, b) => {
      switch (sortBy) {
        case 'date-desc':
          return new Date(b.created_at) - new Date(a.created_at);
        case 'date-asc':
          return new Date(a.created_at) - new Date(b.created_at);
        case 'name-asc':
          return a.name.localeCompare(b.name);
        case 'name-desc':
          return b.name.localeCompare(a.name);
        default:
          return 0;
      }
    });

    setFilteredProjects(result);
  }, [searchQuery, projects, statusFilter, sortBy]);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    
    if (!newProjectData.name.trim()) {
      toast.warning('El nombre del proyecto es requerido');
      return;
    }

    try {
      await apiClient.post('/projects', newProjectData);
      toast.success('Proyecto creado exitosamente');
      setShowNewProject(false);
      setNewProjectData({ name: '', description: '', client: '' });
      loadProjects();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al crear proyecto');
    }
  };

  const handleDeleteProject = async () => {
    if (!deleteConfirmModal) return;

    try {
      await apiClient.delete(`/projects/${deleteConfirmModal.id}`);
      toast.success('Proyecto eliminado exitosamente');
      setDeleteConfirmModal(null);
      loadProjects();
    } catch (error) {
      toast.error('Error al eliminar proyecto');
      setDeleteConfirmModal(null);
    }
  };

  const handleEditProject = (project) => {
    setEditingProject(project);
    setEditProjectData({
      name: project.name,
      description: project.description || '',
      client: project.client || '',
      status: project.status || 'active'
    });
  };

  const handleUpdateProject = async (e) => {
    e.preventDefault();
    
    if (!editProjectData.name.trim()) {
      toast.warning('El nombre del proyecto es requerido');
      return;
    }

    try {
      await apiClient.put(`/projects/${editingProject.id}`, editProjectData);
      toast.success('Proyecto actualizado exitosamente');
      setEditingProject(null);
      setEditProjectData({ name: '', description: '', client: '', status: 'active' });
      loadProjects();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al actualizar proyecto');
    }
  };

  const handleToggleStatus = async (project) => {
    const newStatus = project.status === 'active' ? 'archived' : 'active';
    const actionText = newStatus === 'active' ? 'activado' : 'archivado';
    
    try {
      await apiClient.put(`/projects/${project.id}`, { 
        name: project.name,
        description: project.description,
        client: project.client,
        status: newStatus 
      });
      toast.success(`Proyecto ${actionText} exitosamente`);
      loadProjects();
    } catch (error) {
      toast.error(`Error al ${newStatus === 'active' ? 'activar' : 'archivar'} proyecto`);
    }
  };

  return (
    <div className="h-screen flex flex-col bg-stone-100 dark:bg-gray-900">
      <Header title="Mis Proyectos" />

      <div className="flex-1 overflow-hidden">
        <div className="container mx-auto px-6 py-4 h-full">
          {/* Layout con 2 columnas: 2/3 proyectos + 1/3 chat */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            {/* Columna izquierda: Proyectos (2/3) */}
            <div className="lg:col-span-2 flex flex-col h-full overflow-hidden">
              {/* Acciones principales - FIJO */}
              <div className="mb-4 flex-shrink-0 px-1">
                <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Proyectos
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
                      {filteredProjects.length} {filteredProjects.length === 1 ? 'proyecto' : 'proyectos'}
            </p>
          </div>

            <button
              onClick={() => setShowNewProject(true)}
              className="flex items-center space-x-2 px-4 py-2 btn-primary"
            >
              <Plus className="w-5 h-5" />
              <span>Nuevo Proyecto</span>
            </button>
          </div>

                {/* Barra de búsqueda y filtros */}
                {projects.length > 0 && (
                  <div className="space-y-3">
                    {/* Búsqueda principal */}
                    <div className="flex gap-3">
                      <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Buscar por nombre o descripción..."
                          className="w-full pl-10 pr-10 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent shadow-sm transition-all"
                        />
                        {searchQuery && (
                          <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      
                      {/* Botón de filtros */}
                      <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`flex items-center space-x-2 px-4 py-2.5 border rounded-lg shadow-sm transition-all ${
                          showFilters || statusFilter !== 'all'
                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                            : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <Filter className="w-4 h-4" />
                        <span className="font-medium">Filtros</span>
                        {statusFilter !== 'all' && (
                          <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary-600 text-white rounded-full">
                            1
                          </span>
                        )}
                      </button>
                    </div>

                    {/* Panel de filtros expandible */}
                    {showFilters && (
                      <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-4 shadow-sm animate-slide-in-line">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {/* Filtro de estado */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Estado
                            </label>
                            <div className="flex gap-2">
                              <button
                                onClick={() => setStatusFilter('all')}
                                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                  statusFilter === 'all'
                                    ? 'bg-primary-600 text-white'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                              >
                                Todos
                              </button>
                              <button
                                onClick={() => setStatusFilter('active')}
                                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                  statusFilter === 'active'
                                    ? 'bg-green-600 text-white'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                              >
                                Activos
                              </button>
                              <button
                                onClick={() => setStatusFilter('archived')}
                                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                                  statusFilter === 'archived'
                                    ? 'bg-gray-600 text-white'
                                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                                }`}
                              >
                                Archivados
                              </button>
                            </div>
                          </div>

                          {/* Ordenamiento */}
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                              Ordenar por
                            </label>
                            <select
                              value={sortBy}
                              onChange={(e) => setSortBy(e.target.value)}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                            >
                              <option value="date-desc">Más reciente primero</option>
                              <option value="date-asc">Más antiguo primero</option>
                              <option value="name-asc">Nombre (A-Z)</option>
                              <option value="name-desc">Nombre (Z-A)</option>
                            </select>
                          </div>
                        </div>

                        {/* Botón para limpiar filtros */}
                        {statusFilter !== 'all' && (
                          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                            <button
                              onClick={() => {
                                setStatusFilter('all');
                                setSortBy('date-desc');
                              }}
                              className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium transition-colors"
                            >
                              Limpiar todos los filtros
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
        </div>

              {/* Tabla de proyectos - CON SCROLL */}
              <div className="flex-1 overflow-hidden px-1">
                <div className="h-full overflow-y-auto">
        {loading ? (
          <Loading message="Cargando proyectos..." />
        ) : projects.length === 0 ? (
          <div className="text-center py-16">
            <FolderOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-700 dark:text-gray-300 mb-2">
              No tienes proyectos aún
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Crea tu primer proyecto para comenzar
            </p>
            <button
              onClick={() => setShowNewProject(true)}
              className="btn-primary inline-flex items-center space-x-2"
            >
              <Plus className="w-5 h-5" />
              <span>Crear primer proyecto</span>
            </button>
          </div>
                ) : filteredProjects.length === 0 ? (
                  <div className="text-center py-16">
                    <p className="text-gray-600 dark:text-gray-400">
                      No se encontraron proyectos con los filtros aplicados
                    </p>
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setStatusFilter('all');
                        setSortBy('date-desc');
                      }}
                      className="mt-4 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium transition-colors"
                    >
                      Limpiar filtros
                    </button>
                  </div>
        ) : (
                  <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                              Proyecto
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                              Cliente
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                              Estado
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">
                              Fecha de creación
                            </th>
                            <th className="px-8 py-3 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider min-w-[180px]">
                              {/* Columna sin título para acciones */}
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {filteredProjects.map((project) => (
                            <tr
                              key={project.id}
                              onClick={() => navigate(`/project/${project.id}`)}
                              className="hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-pointer transition-colors group"
                            >
                              {/* Columna: Proyecto */}
                              <td className="px-6 py-4">
                                <div className="flex items-center space-x-3">
                                  <div className="p-2 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex-shrink-0 group-hover:bg-primary-200 dark:group-hover:bg-primary-900/50 transition-colors">
                                    <FolderOpen className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors truncate">
                                      {project.name}
                                    </h3>
                                    {project.description && (
                                      <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mt-0.5">
                                        {project.description}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </td>

                              {/* Columna: Cliente */}
                              <td className="px-6 py-4">
                                {project.client ? (
                                  <span className="text-sm text-gray-700 dark:text-gray-300">
                                    {project.client}
                                  </span>
                                ) : (
                                  <span className="text-sm text-gray-400 dark:text-gray-500 italic">
                                    Sin cliente
                                  </span>
                                )}
                              </td>

                              {/* Columna: Estado */}
                              <td className="px-6 py-4">
                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                  project.status === 'active'
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                    : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                }`}>
                                  <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                                    project.status === 'active'
                                      ? 'bg-green-600 dark:bg-green-400'
                                      : 'bg-gray-600 dark:bg-gray-400'
                                  }`} />
                                  {project.status === 'active' ? 'Activo' : 'Archivado'}
                                </span>
                              </td>

                              {/* Columna: Fecha */}
                              <td className="px-6 py-4">
                                <div className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
                                  <Calendar className="w-4 h-4 text-gray-400" />
                                  <div>
                                    <div className="font-medium">
                                      {new Date(project.created_at).toLocaleDateString('es-ES', {
                                        day: '2-digit',
                                        month: 'short',
                                        year: 'numeric'
                                      })}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                      {new Date(project.created_at).toLocaleTimeString('es-ES', {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </div>
                                  </div>
                                </div>
                              </td>

                              {/* Columna: Acciones */}
                              <td className="px-8 py-4">
                                <div className="flex items-center justify-end space-x-2">
                                  {/* Botón editar */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEditProject(project);
                                    }}
                                    className="inline-flex items-center justify-center p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                    title="Editar proyecto"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>

                                  {/* Botón archivar/activar */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleStatus(project);
                                    }}
                                    className={`inline-flex items-center justify-center p-2 rounded-lg transition-colors ${
                                      project.status === 'active'
                                        ? 'text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                                        : 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'
                                    }`}
                                    title={project.status === 'active' ? 'Archivar proyecto' : 'Activar proyecto'}
                                  >
                                    {project.status === 'active' ? (
                                      <Archive className="w-4 h-4" />
                                    ) : (
                                      <ArchiveRestore className="w-4 h-4" />
                                    )}
                                  </button>

                                  {/* Botón eliminar */}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setDeleteConfirmModal({ id: project.id, name: project.name });
                                    }}
                                    className="inline-flex items-center justify-center p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                    title="Eliminar proyecto"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
        )}
                </div>
              </div>
            </div>

              {/* Columna derecha: Chat con Codex Dilus (1/3) */}
              <div className="lg:col-span-1 h-full overflow-hidden">
                <CodexDilusWidget />
              </div>
          </div>
        </div>
      </div>

      {/* Modal: Nuevo Proyecto */}
      <Modal
        isOpen={showNewProject}
        onClose={() => setShowNewProject(false)}
        title="Crear Nuevo Proyecto"
        size="md"
      >
        <form onSubmit={handleCreateProject} className="space-y-4">
          <div>
            <label className="label">Nombre del proyecto *</label>
            <input
              type="text"
              value={newProjectData.name}
              onChange={(e) =>
                setNewProjectData({ ...newProjectData, name: e.target.value })
              }
              className="input"
              placeholder="Licitación Metro, Hospital Central, etc."
              required
            />
          </div>

          <div>
            <label className="label">Descripción (opcional)</label>
            <textarea
              value={newProjectData.description}
              onChange={(e) =>
                setNewProjectData({ ...newProjectData, description: e.target.value })
              }
              className="input"
              rows="3"
              placeholder="Descripción del proyecto..."
            />
          </div>

          <div>
            <label className="label">Cliente (opcional)</label>
            <input
              type="text"
              value={newProjectData.client}
              onChange={(e) =>
                setNewProjectData({ ...newProjectData, client: e.target.value })
              }
              className="input"
              placeholder="Nombre del cliente..."
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => setShowNewProject(false)}
              className="btn-secondary"
            >
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              Crear Proyecto
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal de confirmación para borrar proyecto */}
      <Modal 
        isOpen={!!deleteConfirmModal} 
        onClose={() => setDeleteConfirmModal(null)}
        title="Confirmar eliminación"
      >
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          ¿Estás seguro de que deseas eliminar el proyecto <strong className="text-gray-900 dark:text-gray-100">"{deleteConfirmModal?.name}"</strong>? Esta acción no se puede deshacer.
        </p>
        <div className="flex space-x-3 justify-end">
          <button
            onClick={() => setDeleteConfirmModal(null)}
            className="btn-secondary"
          >
            Cancelar
          </button>
          <button
            onClick={handleDeleteProject}
            className="btn-danger"
          >
            Eliminar
          </button>
        </div>
      </Modal>

      {/* Modal: Editar Proyecto */}
      <Modal
        isOpen={!!editingProject}
        onClose={() => {
          setEditingProject(null);
          setEditProjectData({ name: '', description: '', client: '', status: 'active' });
        }}
        title="Editar Proyecto"
        size="md"
      >
        <form onSubmit={handleUpdateProject} className="space-y-4">
          <div>
            <label className="label">Nombre del proyecto *</label>
            <input
              type="text"
              value={editProjectData.name}
              onChange={(e) =>
                setEditProjectData({ ...editProjectData, name: e.target.value })
              }
              className="input"
              placeholder="Nombre del proyecto"
              required
            />
          </div>

          <div>
            <label className="label">Descripción (opcional)</label>
            <textarea
              value={editProjectData.description}
              onChange={(e) =>
                setEditProjectData({ ...editProjectData, description: e.target.value })
              }
              className="input"
              rows="3"
              placeholder="Descripción del proyecto..."
            />
          </div>

          <div>
            <label className="label">Cliente (opcional)</label>
            <input
              type="text"
              value={editProjectData.client}
              onChange={(e) =>
                setEditProjectData({ ...editProjectData, client: e.target.value })
              }
              className="input"
              placeholder="Nombre del cliente..."
            />
          </div>

          <div>
            <label className="label">Estado del proyecto</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setEditProjectData({ ...editProjectData, status: 'active' })}
                className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-lg border-2 transition-all ${
                  editProjectData.status === 'active'
                    ? 'border-green-500 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-green-400'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-green-600 dark:bg-green-400"></span>
                <span className="font-medium">Activo</span>
              </button>
              
              <button
                type="button"
                onClick={() => setEditProjectData({ ...editProjectData, status: 'archived' })}
                className={`flex-1 flex items-center justify-center space-x-2 px-4 py-3 rounded-lg border-2 transition-all ${
                  editProjectData.status === 'archived'
                    ? 'border-gray-500 bg-gray-50 dark:bg-gray-700/50 text-gray-700 dark:text-gray-300'
                    : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:border-gray-400'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-gray-600 dark:bg-gray-400"></span>
                <span className="font-medium">Archivado</span>
              </button>
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setEditingProject(null);
                setEditProjectData({ name: '', description: '', client: '', status: 'active' });
              }}
              className="btn-secondary"
            >
              Cancelar
            </button>
            <button type="submit" className="btn-primary">
              Guardar Cambios
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

