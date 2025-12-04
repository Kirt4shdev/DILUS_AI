import React, { useState, useEffect } from 'react';
import { X, Save, Loader } from 'lucide-react';
import Modal from './Modal';
import apiClient from '../api/client';
import { useToast } from '../contexts/ToastContext';

export default function EditMetadataModal({ documentId, isOpen, onClose, onSuccess }) {
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [metadata, setMetadata] = useState({
    doc_type: 'otro',
    source: 'externo',
    creation_origin: 'humano',
    project_id: '',
    equipo: '',
    fabricante: ''
  });

  useEffect(() => {
    if (isOpen && documentId) {
      loadMetadata();
    }
  }, [isOpen, documentId]);

  const loadMetadata = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/documents/${documentId}/metadata`);
      
      const meta = response.data.metadata || {};
      setMetadata({
        doc_type: meta.doc_type || 'otro',
        source: meta.source || 'externo',
        creation_origin: meta.creation_origin || 'humano',
        project_id: meta.project_id || '',
        equipo: meta.equipo || '',
        fabricante: meta.fabricante || ''
      });
    } catch (error) {
      toast.error('Error al cargar metadata del documento');
      console.error('Error loading metadata:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      await apiClient.put(`/documents/${documentId}/metadata`, {
        ...metadata,
        // Convertir strings vacíos a null
        project_id: metadata.project_id || null,
        equipo: metadata.equipo || null,
        fabricante: metadata.fabricante || null
      });

      toast.success('Metadata actualizado exitosamente');
      onSuccess();
      onClose();
    } catch (error) {
      toast.error('Error al actualizar metadata');
      console.error('Error saving metadata:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field, value) => {
    setMetadata(prev => ({
      ...prev,
      [field]: value
    }));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Editar Metadata del Documento">
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader className="w-6 h-6 animate-spin text-blue-500" />
            <span className="ml-2 text-gray-600 dark:text-gray-400">Cargando metadata...</span>
          </div>
        ) : (
          <>
            {/* Tipo de documento */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Tipo de Documento
              </label>
              <select
                value={metadata.doc_type}
                onChange={(e) => handleChange('doc_type', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="manual">Manual</option>
                <option value="datasheet">Datasheet</option>
                <option value="pliego">Pliego</option>
                <option value="interno">Interno</option>
                <option value="oferta">Oferta</option>
                <option value="informe">Informe</option>
                <option value="otro">Otro</option>
              </select>
            </div>

            {/* Origen del documento */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Origen
              </label>
              <select
                value={metadata.source}
                onChange={(e) => handleChange('source', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="interno">Interno</option>
                <option value="externo">Externo</option>
              </select>
            </div>

            {/* Origen de creación */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Creado por
              </label>
              <select
                value={metadata.creation_origin}
                onChange={(e) => handleChange('creation_origin', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="humano">Humano</option>
                <option value="ia">IA</option>
              </select>
            </div>

            {/* Project ID */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Project ID (opcional)
              </label>
              <input
                type="text"
                value={metadata.project_id}
                onChange={(e) => handleChange('project_id', e.target.value)}
                placeholder="Ej: PRJ-001"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                         placeholder-gray-400 dark:placeholder-gray-500
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Equipo */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Equipo (opcional)
              </label>
              <input
                type="text"
                value={metadata.equipo}
                onChange={(e) => handleChange('equipo', e.target.value)}
                placeholder="Ej: WS600, RPU-3000"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                         placeholder-gray-400 dark:placeholder-gray-500
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Nombre del equipo o producto al que hace referencia el documento
              </p>
            </div>

            {/* Fabricante */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Fabricante (opcional)
              </label>
              <input
                type="text"
                value={metadata.fabricante}
                onChange={(e) => handleChange('fabricante', e.target.value)}
                placeholder="Ej: Siemens, ABB"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                         bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100
                         placeholder-gray-400 dark:placeholder-gray-500
                         focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Fabricante o marca del equipo
              </p>
            </div>

            {/* Botones */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={onClose}
                disabled={saving}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 
                         rounded-lg transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="btn-primary flex items-center space-x-2"
              >
                {saving ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>Guardar</span>
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}

