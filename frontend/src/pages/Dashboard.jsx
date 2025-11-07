import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FolderOpen, Trash2, Calendar } from 'lucide-react';
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
  const [loading, setLoading] = useState(true);
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectData, setNewProjectData] = useState({ name: '', description: '' });
  const [deleteConfirmModal, setDeleteConfirmModal] = useState(null);

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

  // Filtrar proyectos por búsqueda
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredProjects(projects);
    } else {
      const query = searchQuery.toLowerCase();
      setFilteredProjects(
        projects.filter(project =>
          project.name.toLowerCase().includes(query) ||
          (project.description && project.description.toLowerCase().includes(query))
        )
      );
    }
  }, [searchQuery, projects]);

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
      setNewProjectData({ name: '', description: '' });
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
              <div className="mb-4 flex-shrink-0">
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

                {/* Buscador */}
                {projects.length > 0 && (
                  <div className="relative">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar proyectos..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                    <svg
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </div>
                )}
        </div>

              {/* Lista de proyectos - CON SCROLL */}
              <div className="flex-1 overflow-y-auto pr-2">
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
                      No se encontraron proyectos que coincidan con "{searchQuery}"
                    </p>
                  </div>
        ) : (
                  <div className="space-y-3 pb-4">
                {filteredProjects.map((project) => (
              <div
                key={project.id}
                    className="card hover:shadow-lg transition-all cursor-pointer group flex items-center justify-between p-4"
                    onClick={() => navigate(`/project/${project.id}`)}
                  >
                    {/* Icono y contenido principal */}
                    <div className="flex items-center space-x-4 flex-1 min-w-0">
                      <div className="p-3 bg-primary-100 dark:bg-primary-900 rounded-lg flex-shrink-0">
                        <FolderOpen className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-3 mb-1">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors truncate">
                          {project.name}
                        </h3>
                          <span className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${
                          project.status === 'active'
                            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {project.status === 'active' ? 'Activo' : 'Archivado'}
                        </span>
                      </div>
                  {project.description && (
                          <p className="text-gray-600 dark:text-gray-400 text-sm line-clamp-1">
                      {project.description}
                    </p>
                  )}
                      </div>
                    </div>

                    {/* Fecha y acciones */}
                    <div className="flex items-center space-x-4 flex-shrink-0">
                      <div className="text-right">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
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

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteConfirmModal({ id: project.id, name: project.name });
                    }}
                        className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Eliminar proyecto"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
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
    </div>
  );
}

