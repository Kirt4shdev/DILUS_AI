import React, { useState } from 'react';
import { Send, BookOpen, Database, Globe } from 'lucide-react';
import apiClient from '../api/client';
import { useToast } from '../contexts/ToastContext';

export default function CodexDilusWidget() {
  const toast = useToast();
  
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progressSteps, setProgressSteps] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);
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
    const queryStartTime = Date.now();
    
    // Agregar mensaje del usuario al historial
    setMessages(prev => [...prev, {
      type: 'user',
      text: userQuery,
      timestamp: new Date()
    }]);

    setQuery('');
    setLoading(true);
    setCurrentStep(0);
    
    // Inicializar pasos de progreso
    const steps = [
      { id: 1, text: 'Analizando consulta...', status: 'active', time: null },
      { id: 2, text: 'Detectando equipos (fuzzy match)...', status: 'pending', time: null },
      { id: 3, text: 'Buscando en Codex (Vector + BM25)...', status: 'pending', time: null },
      { id: 4, text: 'Preparando contexto...', status: 'pending', time: null },
      { id: 5, text: 'Generando respuesta con GPT-5-mini...', status: 'pending', time: null },
      { id: 6, text: 'Guardando estadísticas...', status: 'pending', time: null }
    ];
    console.log('🔍 Iniciando progreso con pasos:', steps);
    setProgressSteps(steps);

    try {
      // Paso 1
      setProgressSteps(prev => prev.map(step => 
        step.id === 1 ? { ...step, status: 'active' } : step
      ));
      setCurrentStep(1);
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Paso 2
      setProgressSteps(prev => prev.map(step => 
        step.id === 1 ? { ...step, status: 'completed', time: 0.3 } :
        step.id === 2 ? { ...step, status: 'active' } : step
      ));
      setCurrentStep(2);
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Paso 3 - Llamada real al backend
      const step3Start = Date.now();
      setProgressSteps(prev => prev.map(step => 
        step.id === 2 ? { ...step, status: 'completed', time: 0.2 } :
        step.id === 3 ? { ...step, status: 'active' } : step
      ));
      setCurrentStep(3);
      
      // Construir historial de conversación
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
      
      const step3Time = ((Date.now() - step3Start) / 1000).toFixed(2);
      const timings = res.data.metadata?.timings || {};
      
      // Paso 4
      setProgressSteps(prev => prev.map(step => 
        step.id === 3 ? { ...step, status: 'completed', time: step3Time } :
        step.id === 4 ? { ...step, status: 'active' } : step
      ));
      setCurrentStep(4);
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Paso 5
      setProgressSteps(prev => prev.map(step => 
        step.id === 4 ? { ...step, status: 'completed', time: timings.contextPrep ? (timings.contextPrep / 1000).toFixed(2) : '0.2' } :
        step.id === 5 ? { ...step, status: 'active' } : step
      ));
      setCurrentStep(5);
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Paso 6
      setProgressSteps(prev => prev.map(step => 
        step.id === 5 ? { ...step, status: 'completed', time: timings.aiGeneration ? (timings.aiGeneration / 1000).toFixed(2) : '3.0' } :
        step.id === 6 ? { ...step, status: 'active' } : step
      ));
      setCurrentStep(6);
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Completar
      const totalTime = ((Date.now() - queryStartTime) / 1000).toFixed(2);
      setProgressSteps(prev => prev.map(step => 
        step.id === 6 ? { ...step, status: 'completed', time: timings.dbSave ? (timings.dbSave / 1000).toFixed(2) : '0.1' } : step
      ));
      
      // Agregar respuesta del asistente al historial con tiempos
      setMessages(prev => [...prev, {
        type: 'assistant',
        text: res.data.response,
        source_type: res.data.source_type,
        sources: res.data.sources,
        chunks_used: res.data.chunks_used,
        timestamp: new Date(),
        timings: timings.ragSearch ? {
          total: totalTime,
          ragSearch: (timings.ragSearch / 1000).toFixed(2),
          aiGeneration: (timings.aiGeneration / 1000).toFixed(2),
          breakdown: timings
        } : null
      }]);
      
      setProgressSteps([]);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Error al consultar al Codex Dilus');
      setProgressSteps([]);
      setMessages(prev => [...prev, {
        type: 'error',
        text: err.response?.data?.error || 'Error al consultar al Codex Dilus',
        timestamp: new Date()
      }]);
    } finally {
      setLoading(false);
      setCurrentStep(0);
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
            Ej: "¿Que alimentación requiere el equipo WS600?"
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
                            <span>Codex Dilus</span>
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

                  {/* Tiempos de respuesta */}
                  {message.timings && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg px-3 py-2 ml-2 border border-blue-200 dark:border-blue-800">
                      <h4 className="font-medium text-blue-700 dark:text-blue-300 mb-1 text-xs">
                        ⏱️ Tiempos de Procesamiento
                      </h4>
                      <div className="space-y-1 text-xs">
                        <div className="flex justify-between">
                          <span className="text-blue-600 dark:text-blue-400">Búsqueda RAG:</span>
                          <span className="font-mono text-blue-700 dark:text-blue-300">{message.timings.ragSearch}s</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-blue-600 dark:text-blue-400">Generación IA:</span>
                          <span className="font-mono text-blue-700 dark:text-blue-300">{message.timings.aiGeneration}s</span>
                        </div>
                        <div className="flex justify-between font-semibold border-t border-blue-200 dark:border-blue-700 pt-1 mt-1">
                          <span className="text-blue-700 dark:text-blue-200">Total:</span>
                          <span className="font-mono text-blue-800 dark:text-blue-100">{message.timings.total}s</span>
                        </div>
                      </div>
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

        {/* Indicador de carga con pasos detallados */}
        {loading && (
          <div className="flex justify-start">
            <div className="w-full space-y-1.5 py-2 px-3 rounded-lg bg-gray-100 dark:bg-gray-800 rounded-tl-none">
              {progressSteps.length > 0 ? (
                progressSteps.map((step) => (
                  <div key={step.id} className="flex items-center space-x-2">
                    <div className="flex-shrink-0">
                      {step.status === 'completed' ? (
                        <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                          <span className="text-white text-xs font-bold">✓</span>
                        </div>
                      ) : step.status === 'active' ? (
                        <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                          <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent"></div>
                        </div>
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                          <span className="text-gray-500 dark:text-gray-400 text-xs">{step.id}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs ${
                        step.status === 'completed' ? 'text-gray-600 dark:text-gray-400' :
                        step.status === 'active' ? 'text-gray-900 dark:text-gray-100 font-medium' :
                        'text-gray-400 dark:text-gray-500'
                      }`}>
                        {step.text}
                      </p>
                    </div>
                    {step.time && (
                      <div className="flex-shrink-0">
                        <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
                          {step.time}s
                        </span>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="flex items-center space-x-2">
                  <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent"></div>
                  </div>
                  <p className="text-xs text-gray-900 dark:text-gray-100 font-medium">
                    Buscando en el Codex Dilus...
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Referencia para el scroll automático */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form - FIJO */}
      <div className="pt-4 mt-4 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
        <form onSubmit={handleSubmit} className="flex space-x-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Escribe tu pregunta..."
            className="input flex-1 text-sm"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="btn-primary flex items-center space-x-2 px-4 py-2"
          >
            <Send className="w-4 h-4" />
            <span className="text-sm">Preguntar</span>
          </button>
        </form>
      </div>
    </div>
  );
}
