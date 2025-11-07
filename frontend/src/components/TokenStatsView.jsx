import React, { useState, useEffect } from 'react';
import { TrendingUp, DollarSign, Activity, Database, Globe, Users as UsersIcon } from 'lucide-react';
import apiClient from '../api/client';
import Loading from './Loading';
import { useToast } from '../contexts/ToastContext';

export default function TokenStatsView() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const toast = useToast();

  useEffect(() => {
    loadStats();
  }, [days]);

  const loadStats = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/stats/overview?days=${days}`);
      setStats(response.data);
    } catch (error) {
      toast.error('Error al cargar estadísticas');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Loading message="Cargando estadísticas..." />;
  }

  if (!stats) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-500 dark:text-gray-400">No hay estadísticas disponibles</p>
      </div>
    );
  }

  // Calcular totales
  const totalTokens = stats.daily_usage.reduce((sum, day) => sum + parseInt(day.total_tokens || 0), 0);
  const totalCost = stats.daily_usage.reduce((sum, day) => sum + parseFloat(day.total_cost_usd || 0), 0);

  // Preparar datos para análisis vs chat
  const analysisTotal = stats.analysis_vs_chat.find(item => item.operation_type === 'analysis');
  const chatTotal = stats.analysis_vs_chat.find(item => item.operation_type === 'chat');
  const generationTotal = stats.analysis_vs_chat.find(item => item.operation_type === 'generation');

  // Calcular porcentajes para Codex Dilus vs externa
  const libraryTotal = stats.library_vs_external.find(item => item.source_type === 'library') || { query_count: 0, total_tokens: 0 };
  const externalTotal = stats.library_vs_external.find(item => item.source_type === 'external') || { query_count: 0, total_tokens: 0 };
  const totalQueries = parseInt(libraryTotal.query_count) + parseInt(externalTotal.query_count);
  const libraryPercentage = totalQueries > 0 ? (parseInt(libraryTotal.query_count) / totalQueries * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Selector de período */}
      <div className="flex justify-between items-center">
        <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Estadísticas de Tokens
        </h3>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-gray-600 dark:text-gray-400">Período:</span>
          <select
            value={days}
            onChange={(e) => setDays(parseInt(e.target.value))}
            className="input py-2"
          >
            <option value={7}>Últimos 7 días</option>
            <option value={30}>Últimos 30 días</option>
            <option value={90}>Últimos 90 días</option>
          </select>
        </div>
      </div>

      {/* Cards de resumen */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Tokens */}
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Tokens</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-2">
                {totalTokens.toLocaleString()}
              </p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Activity className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        {/* Coste Total */}
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Coste Total</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-2">
                ${totalCost.toFixed(2)}
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <DollarSign className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        {/* Total Operaciones */}
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Operaciones</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-2">
                {stats.daily_usage.reduce((sum, day) => sum + parseInt(day.operation_count || 0), 0)}
              </p>
            </div>
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <TrendingUp className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>

        {/* % Codex Dilus */}
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Uso Codex Dilus</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-2">
                {libraryPercentage.toFixed(0)}%
              </p>
            </div>
            <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
              <Database className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            </div>
          </div>
        </div>
      </div>

      {/* Análisis vs Chat vs Generation */}
      <div className="card p-6">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Distribución por Tipo de Operación
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {analysisTotal && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100">📊 Análisis</p>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-100 mt-2">
                {parseInt(analysisTotal.operation_count).toLocaleString()}
              </p>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                {parseInt(analysisTotal.total_tokens).toLocaleString()} tokens
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                ${parseFloat(analysisTotal.total_cost_usd).toFixed(2)}
              </p>
            </div>
          )}
          
          {chatTotal && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-sm font-medium text-green-900 dark:text-green-100">💬 Chat</p>
              <p className="text-2xl font-bold text-green-900 dark:text-green-100 mt-2">
                {parseInt(chatTotal.operation_count).toLocaleString()}
              </p>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                {parseInt(chatTotal.total_tokens).toLocaleString()} tokens
              </p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                ${parseFloat(chatTotal.total_cost_usd).toFixed(2)}
              </p>
            </div>
          )}
          
          {generationTotal && (
            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
              <p className="text-sm font-medium text-purple-900 dark:text-purple-100">📄 Generación</p>
              <p className="text-2xl font-bold text-purple-900 dark:text-purple-100 mt-2">
                {parseInt(generationTotal.operation_count).toLocaleString()}
              </p>
              <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                {parseInt(generationTotal.total_tokens).toLocaleString()} tokens
              </p>
              <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                ${parseFloat(generationTotal.total_cost_usd).toFixed(2)}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top 10 Consultas */}
        <div className="card p-6">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Top 10 Consultas Más Costosas
          </h4>
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {stats.top_queries.map((query, idx) => (
              <div key={query.id} className="flex items-start justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">#{idx + 1}</span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      query.operation_type === 'analysis' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                      query.operation_type === 'chat' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                      'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                    }`}>
                      {query.operation_subtype}
                    </span>
                    {query.source_type && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {query.source_type === 'library' ? '🗄️' : '🌍'}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-800 dark:text-gray-200 mt-1 truncate" title={query.query_object}>
                    {query.query_object}
                  </p>
                </div>
                <div className="text-right ml-4">
                  <p className="text-sm font-bold text-gray-900 dark:text-gray-100">
                    ${parseFloat(query.cost_usd).toFixed(3)}
                  </p>
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    {parseInt(query.tokens_used).toLocaleString()} tokens
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Codex Dilus vs Externa */}
        <div className="card p-6">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
            Codex Dilus vs Fuentes Externas
          </h4>
          
          {/* Visual de porcentajes */}
          <div className="mb-6">
            <div className="flex h-8 rounded-lg overflow-hidden">
              {libraryTotal.query_count > 0 && (
                <div 
                  className="bg-green-500 dark:bg-green-600 flex items-center justify-center text-white text-xs font-semibold"
                  style={{ width: `${libraryPercentage}%` }}
                >
                  {libraryPercentage > 20 && `${libraryPercentage.toFixed(0)}%`}
                </div>
              )}
              {externalTotal.query_count > 0 && (
                <div 
                  className="bg-blue-500 dark:bg-blue-600 flex items-center justify-center text-white text-xs font-semibold"
                  style={{ width: `${100 - libraryPercentage}%` }}
                >
                  {(100 - libraryPercentage) > 20 && `${(100 - libraryPercentage).toFixed(0)}%`}
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Codex Dilus */}
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Database className="w-5 h-5 text-green-600 dark:text-green-400" />
                <p className="text-sm font-medium text-green-900 dark:text-green-100">Codex Dilus</p>
              </div>
              <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                {parseInt(libraryTotal.query_count || 0).toLocaleString()}
              </p>
              <p className="text-xs text-green-700 dark:text-green-300 mt-1">
                {parseInt(libraryTotal.total_tokens || 0).toLocaleString()} tokens
              </p>
              <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                ${parseFloat(libraryTotal.total_cost || 0).toFixed(2)}
              </p>
            </div>

            {/* Externa */}
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-center space-x-2 mb-2">
                <Globe className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Externa</p>
              </div>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                {parseInt(externalTotal.query_count || 0).toLocaleString()}
              </p>
              <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                {parseInt(externalTotal.total_tokens || 0).toLocaleString()} tokens
              </p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                ${parseFloat(externalTotal.total_cost || 0).toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        {/* Costes Input/Output por Modelo y Fuente */}
        <div className="card p-6 col-span-full">
          <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-6">
            📊 Costes de Entrada (Input) vs Salida (Output) por Modelo y Fuente
          </h4>
          
          {stats.input_output_costs && stats.input_output_costs.length > 0 ? (
            <div className="space-y-6">
              {/* Resumen de datos disponibles */}
              <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                Mostrando {stats.input_output_costs.length} combinación(es) de modelo/fuente con datos
              </div>

              {/* Gráfico de Barras */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* GPT-5 */}
                <div>
                  <h5 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 pb-2 border-b-2 border-blue-500">
                    GPT-5
                  </h5>
                  <div className="space-y-4">
                    {['analysis', 'library', 'external'].map(sourceType => {
                      const data = stats.input_output_costs.find(
                        item => item.ai_model === 'gpt-5' && item.source_type === sourceType
                      );
                      
                      if (!data || (data.input_cost_usd === 0 && data.output_cost_usd === 0)) return null;
                      
                      const maxCost = Math.max(data.input_cost_usd, data.output_cost_usd, 0.01);
                      const inputWidth = (data.input_cost_usd / maxCost) * 100;
                      const outputWidth = (data.output_cost_usd / maxCost) * 100;
                      
                      const sourceLabel = sourceType === 'analysis' ? '📊 Análisis de Documentos' : 
                                         sourceType === 'library' ? '🗄️ Chat (Codex Dilus)' : 
                                         '🌍 Chat (Fuente Externa)';
                      
                      return (
                        <div key={sourceType} className="space-y-2 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{sourceLabel}</p>
                          
                          {/* Barra Input */}
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-gray-600 dark:text-gray-400 w-16">Input</span>
                            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-6 overflow-hidden">
                              <div 
                                className="bg-blue-500 dark:bg-blue-600 h-full flex items-center justify-end px-2"
                                style={{ width: `${inputWidth}%` }}
                              >
                                <span className="text-xs font-semibold text-white">
                                  ${data.input_cost_usd.toFixed(4)}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Barra Output */}
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-gray-600 dark:text-gray-400 w-16">Output</span>
                            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-6 overflow-hidden">
                              <div 
                                className="bg-orange-500 dark:bg-orange-600 h-full flex items-center justify-end px-2"
                                style={{ width: `${outputWidth}%` }}
                              >
                                <span className="text-xs font-semibold text-white">
                                  ${data.output_cost_usd.toFixed(4)}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <p className="text-xs text-gray-500 dark:text-gray-400 text-right">
                            Total: ${data.total_cost_usd.toFixed(4)} ({data.operation_count} ops)
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* GPT-5-mini */}
                <div>
                  <h5 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-4 pb-2 border-b-2 border-green-500">
                    GPT-5-mini
                  </h5>
                  <div className="space-y-4">
                    {['analysis', 'library', 'external'].map(sourceType => {
                      const data = stats.input_output_costs.find(
                        item => item.ai_model === 'gpt-5-mini' && item.source_type === sourceType
                      );
                      
                      if (!data || (data.input_cost_usd === 0 && data.output_cost_usd === 0)) return null;
                      
                      const maxCost = Math.max(data.input_cost_usd, data.output_cost_usd, 0.01);
                      const inputWidth = (data.input_cost_usd / maxCost) * 100;
                      const outputWidth = (data.output_cost_usd / maxCost) * 100;
                      
                      const sourceLabel = sourceType === 'analysis' ? '📊 Análisis de Documentos' : 
                                         sourceType === 'library' ? '🗄️ Chat (Codex Dilus)' : 
                                         '🌍 Chat (Fuente Externa)';
                      
                      return (
                        <div key={sourceType} className="space-y-2 bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{sourceLabel}</p>
                          
                          {/* Barra Input */}
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-gray-600 dark:text-gray-400 w-16">Input</span>
                            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-6 overflow-hidden">
                              <div 
                                className="bg-blue-500 dark:bg-blue-600 h-full flex items-center justify-end px-2"
                                style={{ width: `${inputWidth}%` }}
                              >
                                <span className="text-xs font-semibold text-white">
                                  ${data.input_cost_usd.toFixed(4)}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Barra Output */}
                          <div className="flex items-center space-x-2">
                            <span className="text-xs text-gray-600 dark:text-gray-400 w-16">Output</span>
                            <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-6 overflow-hidden">
                              <div 
                                className="bg-orange-500 dark:bg-orange-600 h-full flex items-center justify-end px-2"
                                style={{ width: `${outputWidth}%` }}
                              >
                                <span className="text-xs font-semibold text-white">
                                  ${data.output_cost_usd.toFixed(4)}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          <p className="text-xs text-gray-500 dark:text-gray-400 text-right">
                            Total: ${data.total_cost_usd.toFixed(4)} ({data.operation_count} ops)
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Leyenda */}
              <div className="flex items-center justify-center space-x-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-blue-500 dark:bg-blue-600 rounded"></div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">Input (Entrada)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-4 h-4 bg-orange-500 dark:bg-orange-600 rounded"></div>
                  <span className="text-sm text-gray-700 dark:text-gray-300">Output (Salida)</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">
              No hay datos de costes input/output disponibles para el período seleccionado
            </p>
          )}
        </div>
      </div>

      {/* Tabla de usuarios */}
      <div className="card p-6">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4 flex items-center space-x-2">
          <UsersIcon className="w-5 h-5" />
          <span>Coste Acumulado por Usuario</span>
        </h4>
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-200 dark:border-gray-700">
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Usuario</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Operaciones</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Tokens</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Análisis</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Chat</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Generación</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {stats.user_summary.map((user) => (
                <tr key={user.username}>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-gray-100">{user.username}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-400">{parseInt(user.total_operations).toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-400">{parseInt(user.total_tokens).toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-400">${parseFloat(user.cost_analysis).toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-400">${parseFloat(user.cost_chat).toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-600 dark:text-gray-400">${parseFloat(user.cost_generation).toFixed(2)}</td>
                  <td className="px-4 py-3 text-sm text-right font-bold text-gray-900 dark:text-gray-100">${parseFloat(user.total_cost).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Gráfico de tokens por día (simplificado como barras) */}
      <div className="card p-6">
        <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Tokens por Día
        </h4>
        <div className="space-y-2">
          {stats.daily_usage.slice(0, 14).reverse().map((day) => {
            const maxTokens = Math.max(...stats.daily_usage.map(d => parseInt(d.total_tokens || 0)));
            const percentage = maxTokens > 0 ? (parseInt(day.total_tokens) / maxTokens * 100) : 0;
            
            return (
              <div key={day.usage_date} className="flex items-center space-x-4">
                <div className="w-24 text-sm text-gray-600 dark:text-gray-400">
                  {new Date(day.usage_date).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })}
                </div>
                <div className="flex-1">
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-primary-500 to-primary-600 flex items-center px-3"
                      style={{ width: `${Math.max(percentage, 5)}%` }}
                    >
                      <span className="text-xs text-white font-semibold">
                        {parseInt(day.total_tokens).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="w-20 text-sm text-right text-gray-600 dark:text-gray-400">
                  ${parseFloat(day.total_cost_usd || 0).toFixed(2)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

