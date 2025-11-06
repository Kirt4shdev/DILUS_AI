import React, { useState } from 'react';
import { Send, X, BookOpen, Database, Globe } from 'lucide-react';
import apiClient from '../api/client';
import Loading from './Loading';
import { useToast } from '../contexts/ToastContext';

export default function VaultChat({ isOpen, onClose }) {
  const toast = useToast();
  
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!query.trim()) return;

    setLoading(true);
    setResponse(null);

    try {
      // Paso 1: Analizando consulta
      setProgressMessage('Analizando tu consulta...');
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Paso 2: Buscando en la biblioteca
      setProgressMessage('Buscando en la biblioteca de documentación...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const res = await apiClient.post('/vault/query', { query: query.trim() });
      
      // Paso 3: Indicar fuente
      if (res.data.source_type === 'library') {
        setProgressMessage('✓ Datos encontrados en la biblioteca');
        await new Promise(resolve => setTimeout(resolve, 300));
        setProgressMessage('Generando respuesta...');
      } else {
        setProgressMessage('⚠ No hay datos en la biblioteca');
        await new Promise(resolve => setTimeout(resolve, 300));
        setProgressMessage('Buscando información externa en ChatGPT-5...');
      }
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Paso 4: Procesando respuesta
      setProgressMessage('Procesando respuesta...');
      await new Promise(resolve => setTimeout(resolve, 300));
      
      setResponse(res.data);
      setQuery('');
      setProgressMessage(''); // Limpiar mensaje de progreso
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al consultar al Codex Dilus');
      setProgressMessage(''); // Limpiar mensaje de progreso en caso de error
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      ></div>

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-primary-100 dark:bg-primary-900 rounded-lg">
                <BookOpen className="w-6 h-6 text-primary-600 dark:text-primary-400" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                  Consulta al Codex Dilus
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Tu asistente de documentación técnica
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">

            {!response && !loading && (
              <div className="text-center py-8">
                <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">
                  Haz una pregunta sobre la documentación técnica al Codex Dilus
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                  Ejemplo: "¿Cuál es el protocolo estándar para sensores Modbus?"
                </p>
              </div>
            )}

            {loading && (
              <div className="flex items-center space-x-3 py-4 px-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50">
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-300 dark:border-gray-600 border-t-gray-600 dark:border-t-gray-400"></div>
                <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                  {progressMessage || 'Consultando al Codex Dilus...'}
                </p>
              </div>
            )}

            {response && (
              <div className="space-y-4">
                {/* Respuesta con indicador de fuente */}
                <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-primary-900 dark:text-primary-100">
                    Respuesta:
                  </h4>
                    <div className={`flex items-center space-x-2 text-xs px-2 py-1 rounded-full ${
                      response.source_type === 'library'
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                        : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                    }`}>
                      {response.source_type === 'library' ? (
                        <>
                          <Database className="w-4 h-4" />
                          <span>Biblioteca</span>
                        </>
                      ) : (
                        <>
                          <Globe className="w-4 h-4" />
                          <span>Fuente Externa</span>
                        </>
                      )}
                    </div>
                  </div>
                  <p className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                    {response.response}
                  </p>
                </div>

                {/* Fuentes */}
                {response.sources && response.sources.length > 0 && (
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2 text-sm flex items-center space-x-2">
                      <span>Fuentes consultadas:</span>
                      {response.chunks_used > 0 && (
                        <span className="text-gray-500 dark:text-gray-400">
                          ({response.chunks_used} fragmentos)
                        </span>
                      )}
                    </h4>
                    <ul className="space-y-1">
                      {response.sources.map((source, idx) => (
                        <li
                          key={idx}
                          className="text-sm text-gray-600 dark:text-gray-400 flex items-center"
                        >
                          {response.source_type === 'library' ? (
                            <Database className="w-4 h-4 mr-2 text-green-600 dark:text-green-400" />
                          ) : (
                            <Globe className="w-4 h-4 mr-2 text-blue-600 dark:text-blue-400" />
                          )}
                          {source}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Metadata */}
                {response.metadata && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Tokens usados: {response.metadata.tokens_used} | 
                    Modelo: {response.metadata.model} | 
                    Duración: {response.metadata.duration}ms
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Input Form */}
          <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700">
            <form onSubmit={handleSubmit} className="flex space-x-3">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Escribe tu pregunta..."
                className="input flex-1"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading || !query.trim()}
                className="btn-primary flex items-center space-x-2"
              >
                <Send className="w-5 h-5" />
                <span>Preguntar</span>
              </button>
            </form>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              ℹ️ Este chat no guarda historial. Cada consulta es independiente.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

