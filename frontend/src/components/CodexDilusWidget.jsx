import React, { useState } from 'react';
import { Send, BookOpen, Database, Globe } from 'lucide-react';
import apiClient from '../api/client';
import { useToast } from '../contexts/ToastContext';

export default function CodexDilusWidget() {
  const toast = useToast();
  
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  const messagesEndRef = React.useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  React.useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!query.trim()) return;

    const userQuery = query.trim();
    
    // Agregar mensaje del usuario al historial
    setMessages(prev => [...prev, {
      type: 'user',
      text: userQuery,
      timestamp: new Date()
    }]);

    setQuery('');
    setLoading(true);

    try {
      // Paso 1: Analizando consulta
      setProgressMessage('Analizando tu consulta...');
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Paso 2: Buscando en la biblioteca
      setProgressMessage('Buscando en la biblioteca de documentación...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Construir historial de conversación (excluir mensajes de error y el mensaje actual)
      const conversationHistory = messages
        .filter(msg => msg.type === 'user' || msg.type === 'assistant')
        .map(msg => ({
          role: msg.type === 'user' ? 'user' : 'assistant',
          content: msg.text
        }));
      
      const res = await apiClient.post('/vault/query', { 
        query: userQuery,
        conversation_history: conversationHistory
      });
      
      // Paso 3: Indicar fuente
      if (res.data.source_type === 'library') {
        setProgressMessage('✓ Datos encontrados en la biblioteca');
        await new Promise(resolve => setTimeout(resolve, 300));
        setProgressMessage('Generando respuesta con contexto previo...');
      } else {
        setProgressMessage('⚠ No hay datos en la biblioteca');
        await new Promise(resolve => setTimeout(resolve, 300));
        setProgressMessage('Buscando información externa con contexto previo...');
      }
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Paso 4: Procesando respuesta
      setProgressMessage('Procesando respuesta...');
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Agregar respuesta del asistente al historial
      setMessages(prev => [...prev, {
        type: 'assistant',
        text: res.data.response,
        source_type: res.data.source_type,
        sources: res.data.sources,
        chunks_used: res.data.chunks_used,
        timestamp: new Date()
      }]);
      
      setProgressMessage('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al consultar al Codex Dilus');
      setProgressMessage('');
      // Agregar mensaje de error al historial
      setMessages(prev => [...prev, {
        type: 'error',
        text: err.response?.data?.error || 'Error al consultar al Codex Dilus',
        timestamp: new Date()
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card h-full flex flex-col p-4">
      {/* Header - FIJO */}
      <div className="flex items-center space-x-3 pb-4 mb-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
        <div className="p-2 bg-primary-100 dark:bg-primary-900 rounded-lg">
          <BookOpen className="w-6 h-6 text-primary-600 dark:text-primary-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Consulta el Codex Dilus
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Tu asistente de documentación técnica
          </p>
        </div>
      </div>

      {/* Content - CON SCROLL (Historial de conversación) */}
      <div className="flex-1 overflow-y-auto space-y-3 min-h-0 pr-2">

        {messages.length === 0 && !loading && (
          <div className="text-center py-8">
            <BookOpen className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Haz una pregunta técnica
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
              Ej: "¿Protocolo para sensores Modbus?"
            </p>
          </div>
        )}

        {/* Historial de mensajes */}
        {messages.map((message, idx) => (
          <div key={idx}>
            {message.type === 'user' && (
              <div className="flex justify-end">
                <div className="max-w-[85%] bg-primary-600 text-white rounded-lg rounded-tr-none px-4 py-2">
                  <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                </div>
              </div>
            )}

            {message.type === 'assistant' && (
              <div className="flex justify-start">
                <div className="max-w-[85%] space-y-2">
                  {/* Respuesta con indicador de fuente */}
                  <div className="bg-gray-100 dark:bg-gray-800 rounded-lg rounded-tl-none px-4 py-2">
                    <div className="flex items-center space-x-2 mb-2">
                      <div className={`flex items-center space-x-1 text-xs px-2 py-0.5 rounded-full ${
                        message.source_type === 'library'
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                          : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      }`}>
                        {message.source_type === 'library' ? (
                          <>
                            <Database className="w-3 h-3" />
                            <span>Biblioteca</span>
                          </>
                        ) : (
                          <>
                            <Globe className="w-3 h-3" />
                            <span>Externo</span>
                          </>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                      {message.text}
                    </p>
                  </div>

                  {/* Fuentes */}
                  {message.sources && message.sources.length > 0 && (
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg px-3 py-2 ml-2">
                      <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-1 text-xs flex items-center space-x-2">
                        <span>Fuentes:</span>
                        {message.chunks_used > 0 && (
                          <span className="text-gray-500 dark:text-gray-400">
                            ({message.chunks_used} fragmentos)
                          </span>
                        )}
                      </h4>
                      <ul className="space-y-0.5">
                        {message.sources.map((source, sourceIdx) => (
                          <li
                            key={sourceIdx}
                            className="text-xs text-gray-600 dark:text-gray-400 flex items-center"
                          >
                            {message.source_type === 'library' ? (
                              <Database className="w-2.5 h-2.5 mr-1.5 text-green-600 dark:text-green-400" />
                            ) : (
                              <Globe className="w-2.5 h-2.5 mr-1.5 text-blue-600 dark:text-blue-400" />
                            )}
                            {source}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}

            {message.type === 'error' && (
              <div className="flex justify-start">
                <div className="max-w-[85%] bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-800 text-red-800 dark:text-red-200 rounded-lg rounded-tl-none px-4 py-2">
                  <p className="text-sm">{message.text}</p>
                </div>
              </div>
            )}
          </div>
        ))}

        {/* Indicador de carga */}
        {loading && (
          <div className="flex justify-start">
            <div className="flex items-center space-x-3 py-3 px-4 rounded-lg bg-gray-100 dark:bg-gray-800 rounded-tl-none">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 dark:border-gray-600 border-t-gray-600 dark:border-t-gray-400"></div>
              <p className="text-xs text-gray-500 dark:text-gray-400 italic">
                {progressMessage || 'Consultando...'}
              </p>
            </div>
          </div>
        )}

        {/* Referencia para el scroll automático */}
        <div ref={messagesEndRef} />
      </div>

      {/* Form - FIJO EN PARTE INFERIOR */}
      <form onSubmit={handleSubmit} className="flex space-x-2 pt-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Pregunta algo..."
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
}

