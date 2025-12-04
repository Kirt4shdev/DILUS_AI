import React, { useState, useEffect } from 'react';
import { MessageSquare, Edit2, Save, X, Plus, Trash2, History, Eye, EyeOff, RotateCcw, AlertCircle } from 'lucide-react';
import apiClient from '../api/client';
import { useToast } from '../contexts/ToastContext';
import Loading from './Loading';
import Modal from './Modal';

export default function PromptsManager() {
  const toast = useToast();
  
  const [categories, setCategories] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState(null);
  const [showHistory, setShowHistory] = useState(null);
  const [promptHistory, setPromptHistory] = useState([]);

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    if (selectedCategory) {
      loadPrompts(selectedCategory);
    }
  }, [selectedCategory]);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/admin/prompts/categories');
      setCategories(response.data.categories);
      
      // Seleccionar automáticamente la primera categoría con prompts
      const firstCategoryWithPrompts = Object.entries(response.data.categories).find(
        ([_, cat]) => cat.count > 0
      );
      if (firstCategoryWithPrompts) {
        setSelectedCategory(firstCategoryWithPrompts[0]);
      }
    } catch (error) {
      toast.error('Error al cargar categorías de prompts');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPrompts = async (category) => {
    try {
      setLoading(true);
      const response = await apiClient.get('/admin/prompts', { params: { category } });
      setPrompts(response.data.prompts);
    } catch (error) {
      toast.error('Error al cargar prompts');
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditPrompt = (prompt) => {
    setEditingPrompt({
      ...prompt,
      prompt_text: prompt.prompt_text
    });
  };

  const handleSavePrompt = async () => {
    if (!editingPrompt) return;

    try {
      await apiClient.put(`/admin/prompts/${editingPrompt.id}`, {
        name: editingPrompt.name,
        description: editingPrompt.description,
        prompt_text: editingPrompt.prompt_text
      });

      toast.success('Prompt actualizado correctamente');
      setEditingPrompt(null);
      loadPrompts(selectedCategory);
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al actualizar prompt');
      console.error('Error:', error);
    }
  };

  const handleViewHistory = async (promptId) => {
    try {
      const response = await apiClient.get(`/admin/prompts/${promptId}/history`);
      setPromptHistory(response.data.history);
      setShowHistory(promptId);
    } catch (error) {
      toast.error('Error al cargar historial');
      console.error('Error:', error);
    }
  };

  const handleToggleActive = async (prompt) => {
    try {
      await apiClient.put(`/admin/prompts/${prompt.id}`, {
        is_active: !prompt.is_active
      });

      toast.success(prompt.is_active ? 'Prompt desactivado' : 'Prompt activado');
      loadPrompts(selectedCategory);
    } catch (error) {
      toast.error('Error al cambiar estado del prompt');
      console.error('Error:', error);
    }
  };

  if (loading && !categories) {
    return <Loading />;
  }

  if (!categories) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 dark:text-gray-400">Error al cargar categorías</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          🤖 Gestión de Prompts
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Configura y personaliza los prompts utilizados por el sistema de IA
        </p>
      </div>

      {/* Selector de categoría */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
        <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Seleccionar Categoría</h4>
        
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Object.entries(categories).map(([key, category]) => (
            <button
              key={key}
              onClick={() => setSelectedCategory(key)}
              className={`p-4 rounded-lg border-2 transition-all ${
                selectedCategory === key
                  ? 'border-primary-600 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary-500'
              }`}
            >
              <div className="text-3xl mb-2">{category.icon}</div>
              <div className="font-semibold text-gray-900 dark:text-white text-sm mb-1">
                {category.name}
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                {category.description}
              </div>
              <div className="text-xs font-medium text-primary-600 dark:text-primary-400">
                {category.count} prompt{category.count !== 1 ? 's' : ''}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Lista de prompts */}
      {selectedCategory && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-xl font-semibold text-gray-900 dark:text-white">
              Prompts de {categories[selectedCategory]?.name}
            </h4>
          </div>

          {loading ? (
            <Loading />
          ) : prompts.length === 0 ? (
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-12 text-center">
              <p className="text-gray-600 dark:text-gray-400">
                No hay prompts en esta categoría
              </p>
            </div>
          ) : (
            prompts.map((prompt) => (
              <div
                key={prompt.id}
                className={`bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border ${
                  prompt.is_active
                    ? 'border-gray-200 dark:border-gray-700'
                    : 'border-gray-300 dark:border-gray-600 opacity-60'
                }`}
              >
                {/* Header del prompt */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h5 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {prompt.name}
                      </h5>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        prompt.prompt_type === 'single'
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                          : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                      }`}>
                        {prompt.prompt_type === 'single' ? '1 Consulta' : 'Paralelo'}
                      </span>
                      {!prompt.is_active && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                          Inactivo
                        </span>
                      )}
                    </div>
                    {prompt.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {prompt.description}
                      </p>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleViewHistory(prompt.id)}
                      className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                      title="Ver historial"
                    >
                      <History className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleToggleActive(prompt)}
                      className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100"
                      title={prompt.is_active ? 'Desactivar' : 'Activar'}
                    >
                      {prompt.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => handleEditPrompt(prompt)}
                      className="p-2 text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                      title="Editar prompt"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Texto del prompt (colapsado por defecto) */}
                <details className="group">
                  <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 list-none flex items-center space-x-2">
                    <span className="transform transition-transform group-open:rotate-90">▶</span>
                    <span>Ver prompt completo</span>
                  </summary>
                  <div className="mt-3 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap font-mono">
                      {prompt.prompt_text}
                    </pre>
                  </div>
                </details>

                {/* Variables */}
                {prompt.variables && prompt.variables.length > 0 && (
                  <div className="mt-3 flex items-center space-x-2">
                    <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                      Variables:
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {prompt.variables.map((variable, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs font-mono"
                        >
                          {`{${variable}}`}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Metadata */}
                <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
                  <span>ID: {prompt.key}</span>
                  <span className="mx-2">•</span>
                  <span>Actualizado: {new Date(prompt.updated_at).toLocaleString('es-ES')}</span>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modal de edición */}
      <Modal
        isOpen={!!editingPrompt}
        onClose={() => setEditingPrompt(null)}
        title={`Editar: ${editingPrompt?.name}`}
        size="xl"
      >
        {editingPrompt && (
          <div className="space-y-4">
            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800 dark:text-yellow-300">
                  <p className="font-medium mb-1">⚠️ Ten cuidado al editar prompts</p>
                  <p>Los cambios afectarán inmediatamente a todas las consultas futuras. Asegúrate de mantener la estructura JSON esperada en las respuestas.</p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Nombre
              </label>
              <input
                type="text"
                value={editingPrompt.name}
                onChange={(e) => setEditingPrompt({ ...editingPrompt, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Descripción
              </label>
              <input
                type="text"
                value={editingPrompt.description || ''}
                onChange={(e) => setEditingPrompt({ ...editingPrompt, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Texto del Prompt
              </label>
              <textarea
                value={editingPrompt.prompt_text}
                onChange={(e) => setEditingPrompt({ ...editingPrompt, prompt_text: e.target.value })}
                rows={20}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white font-mono text-sm"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {editingPrompt.prompt_text.length} caracteres
              </p>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setEditingPrompt(null)}
                className="btn-secondary"
              >
                Cancelar
              </button>
              <button
                onClick={handleSavePrompt}
                className="btn-primary flex items-center space-x-2"
              >
                <Save className="w-4 h-4" />
                <span>Guardar Cambios</span>
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal de historial */}
      <Modal
        isOpen={!!showHistory}
        onClose={() => {
          setShowHistory(null);
          setPromptHistory([]);
        }}
        title="Historial de Cambios"
        size="lg"
      >
        <div className="space-y-4">
          {promptHistory.length === 0 ? (
            <p className="text-gray-600 dark:text-gray-400 text-center py-8">
              No hay historial de cambios para este prompt
            </p>
          ) : (
            promptHistory.map((entry, idx) => (
              <div
                key={entry.id}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
              >
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      Cambio #{promptHistory.length - idx}
                    </p>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {new Date(entry.changed_at).toLocaleString('es-ES')}
                    </p>
                    {entry.changed_by_username && (
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Por: {entry.changed_by_username}
                      </p>
                    )}
                  </div>
                </div>

                <details className="group">
                  <summary className="cursor-pointer text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Ver cambios
                  </summary>
                  <div className="mt-3 space-y-3">
                    <div>
                      <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">
                        ❌ Anterior:
                      </p>
                      <pre className="text-xs text-gray-700 dark:text-gray-300 bg-red-50 dark:bg-red-900/20 p-3 rounded whitespace-pre-wrap">
                        {entry.prompt_text_old}
                      </pre>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-1">
                        ✅ Nuevo:
                      </p>
                      <pre className="text-xs text-gray-700 dark:text-gray-300 bg-green-50 dark:bg-green-900/20 p-3 rounded whitespace-pre-wrap">
                        {entry.prompt_text_new}
                      </pre>
                    </div>
                  </div>
                </details>
              </div>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
}

