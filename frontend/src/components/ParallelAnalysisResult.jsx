import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Clock, Zap, CheckCircle, XCircle } from 'lucide-react';

/**
 * Componente para mostrar resultados de análisis paralelo con prompts múltiples
 */
export default function ParallelAnalysisResult({ result, metadata }) {
  const [expandedPrompts, setExpandedPrompts] = useState({});
  const [showConsolidated, setShowConsolidated] = useState(true);

  if (!result) return null;

  const togglePrompt = (promptId) => {
    setExpandedPrompts(prev => ({
      ...prev,
      [promptId]: !prev[promptId]
    }));
  };

  const formatDuration = (ms) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const individualPrompts = result.resultado_individual_prompts || [];
  const consolidado = result.resultado_final_consolidado || {};
  const metadataGlobal = result.metadata_global || {};

  return (
    <div className="space-y-6">
      {/* Resumen Global */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border-l-4 border-blue-500">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <Zap className="w-6 h-6 text-blue-500" />
          Resumen de Análisis Paralelo
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
            <div className="text-sm text-gray-600 dark:text-gray-300">Método</div>
            <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
              {result.metodo || 'Parallel Prompts'}
            </div>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
            <div className="text-sm text-gray-600 dark:text-gray-300">Prompts Ejecutados</div>
            <div className="text-lg font-bold text-green-600 dark:text-green-400">
              {result.prompts_ejecutados || 0}
            </div>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
            <div className="text-sm text-gray-600 dark:text-gray-300">Duración Total</div>
            <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
              {formatDuration(metadataGlobal.duracion_total_ms || 0)}
            </div>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
            <div className="text-sm text-gray-600 dark:text-gray-300">Tiempo Promedio</div>
            <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
              {formatDuration(metadataGlobal.duracion_promedio_por_prompt_ms || 0)}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
            <div className="text-sm text-gray-600 dark:text-gray-300">Tokens Totales</div>
            <div className="text-lg font-bold text-indigo-600 dark:text-indigo-400">
              {(metadataGlobal.tokens_totales || 0).toLocaleString()}
            </div>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
            <div className="text-sm text-gray-600 dark:text-gray-300">Tokens Input</div>
            <div className="text-lg font-bold text-cyan-600 dark:text-cyan-400">
              {(metadataGlobal.tokens_input_totales || 0).toLocaleString()}
            </div>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
            <div className="text-sm text-gray-600 dark:text-gray-300">Tokens Output</div>
            <div className="text-lg font-bold text-teal-600 dark:text-teal-400">
              {(metadataGlobal.tokens_output_totales || 0).toLocaleString()}
            </div>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
            <div className="text-sm text-gray-600 dark:text-gray-300">Modelo</div>
            <div className="text-sm font-bold text-gray-900 dark:text-white">
              {metadataGlobal.modelo_utilizado || 'N/A'}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
              <div className="text-sm text-gray-600 dark:text-gray-300">Prompts Exitosos</div>
            </div>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400 mt-1">
              {metadataGlobal.prompts_exitosos || 0}
            </div>
          </div>
          
          <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
            <div className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              <div className="text-sm text-gray-600 dark:text-gray-300">Prompts con Error</div>
            </div>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400 mt-1">
              {metadataGlobal.prompts_con_error || 0}
            </div>
          </div>
        </div>

        {metadata?.created_at && (
          <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
            <Clock className="w-4 h-4 inline mr-1" />
            Generado: {formatTimestamp(metadata.created_at)}
          </div>
        )}
      </div>

      {/* Resultado Consolidado Final */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
        <button
          onClick={() => setShowConsolidated(!showConsolidated)}
          className="w-full flex items-center justify-between p-6 bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700 transition-colors"
        >
          <h3 className="text-xl font-bold flex items-center gap-2">
            <CheckCircle className="w-6 h-6" />
            Resultado Final Consolidado
          </h3>
          {showConsolidated ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
        </button>
        
        {showConsolidated && (
          <div className="p-6 space-y-4">
            {Object.keys(consolidado).length === 0 ? (
              <p className="text-gray-600 dark:text-gray-400">No hay datos consolidados disponibles.</p>
            ) : (
              <div className="space-y-4">
                {Object.entries(consolidado).map(([key, value]) => (
                  <div key={key} className="border-l-4 border-green-500 pl-4">
                    <h4 className="font-bold text-gray-900 dark:text-white mb-2 capitalize">
                      {key.replace(/_/g, ' ')}
                    </h4>
                    <pre className="bg-gray-50 dark:bg-gray-900 p-4 rounded text-sm overflow-x-auto">
                      {JSON.stringify(value, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Prompts Individuales */}
      <div className="space-y-3">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
          Respuestas Individuales de Prompts ({individualPrompts.length})
        </h3>
        
        {individualPrompts.map((promptResult, index) => {
          const isExpanded = expandedPrompts[promptResult.prompt_id];
          const hasError = promptResult.metadata?.error;
          
          return (
            <div 
              key={promptResult.prompt_id} 
              className={`bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden border-l-4 ${
                hasError ? 'border-red-500' : 'border-blue-500'
              }`}
            >
              <button
                onClick={() => togglePrompt(promptResult.prompt_id)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${
                    hasError ? 'bg-red-500' : 'bg-blue-500'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-gray-900 dark:text-white">
                      {promptResult.prompt_id}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-4 mt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDuration(promptResult.metadata?.duracion_ms || 0)}
                      </span>
                      <span>
                        {(promptResult.metadata?.tokens_usados || 0).toLocaleString()} tokens
                      </span>
                      {promptResult.metadata?.chunks_utilizados > 0 && (
                        <span className="text-purple-600 dark:text-purple-400">
                          {promptResult.metadata.chunks_utilizados} chunks
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
              
              {isExpanded && (
                <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 space-y-3">
                  <div>
                    <h5 className="font-semibold text-gray-900 dark:text-white mb-2">Pregunta:</h5>
                    <p className="text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 p-3 rounded">
                      {promptResult.pregunta}
                    </p>
                  </div>
                  
                  <div>
                    <h5 className="font-semibold text-gray-900 dark:text-white mb-2">Respuesta JSON:</h5>
                    <pre className="bg-white dark:bg-gray-800 p-3 rounded text-xs overflow-x-auto border border-gray-200 dark:border-gray-700">
                      {JSON.stringify(promptResult.respuesta, null, 2)}
                    </pre>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div className="bg-white dark:bg-gray-800 p-2 rounded">
                      <div className="text-gray-600 dark:text-gray-400">Input Tokens</div>
                      <div className="font-bold">{(promptResult.metadata?.tokens_input || 0).toLocaleString()}</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-2 rounded">
                      <div className="text-gray-600 dark:text-gray-400">Output Tokens</div>
                      <div className="font-bold">{(promptResult.metadata?.tokens_output || 0).toLocaleString()}</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-2 rounded">
                      <div className="text-gray-600 dark:text-gray-400">Modelo</div>
                      <div className="font-bold text-xs">{promptResult.metadata?.modelo || 'N/A'}</div>
                    </div>
                    <div className="bg-white dark:bg-gray-800 p-2 rounded">
                      <div className="text-gray-600 dark:text-gray-400">Documentos</div>
                      <div className="font-bold">{promptResult.metadata?.documentos_consultados || 0}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}



