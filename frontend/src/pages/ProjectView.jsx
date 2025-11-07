import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Upload, FileText, Check, Loader, XCircle, Trash2, X, FileSearch, Scale, Briefcase, FolderOpen } from 'lucide-react';
import Header from '../components/Header';
import Loading from '../components/Loading';
import Modal from '../components/Modal';
import apiClient from '../api/client';
import { useToast } from '../contexts/ToastContext';

export default function ProjectView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  
  const [project, setProject] = useState(null);
  const [documents, setDocuments] = useState([]);
  // Cambio: selectedDocs ahora es un objeto con keys por tab
  const [selectedDocsByTab, setSelectedDocsByTab] = useState({
    pliego: [],
    contrato: [],
    oferta: [],
    documentacion: []
  });
  const [analysisHistory, setAnalysisHistory] = useState({});
  const [activeTab, setActiveTab] = useState('pliego');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzingWithStandard, setAnalyzingWithStandard] = useState(false);
  const [progressMessage, setProgressMessage] = useState('');
  const [result, setResult] = useState(null);
  const [resultMetadata, setResultMetadata] = useState(null);
  const [currentAnalysisId, setCurrentAnalysisId] = useState(null);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState(null);
  const [deleteDocConfirmModal, setDeleteDocConfirmModal] = useState(null);

  useEffect(() => {
    loadProject();
    loadDocuments();
    loadAnalysisHistory();
  }, [id]);

  // Recargar análisis al cambiar de tab
  useEffect(() => {
    if (analysisHistory[activeTab] && analysisHistory[activeTab].length > 0) {
      const latestAnalysis = analysisHistory[activeTab][0];
      setResult(latestAnalysis.result_data);
      setCurrentAnalysisId(latestAnalysis.id);
      setResultMetadata({
        model: latestAnalysis.ai_model_used,
        tokens_used: latestAnalysis.tokens_used,
        duration: latestAnalysis.duration_ms,
        created_at: latestAnalysis.created_at
      });
    } else {
      setResult(null);
      setCurrentAnalysisId(null);
      setResultMetadata(null);
    }
  }, [activeTab, analysisHistory]);

  const loadProject = async () => {
    try {
      const response = await apiClient.get(`/projects/${id}`);
      setProject(response.data.project);
    } catch (error) {
      toast.error('Error al cargar proyecto');
      console.error(error);
    }
  };

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/projects/${id}/documents`);
      setDocuments(response.data.documents);
    } catch (error) {
      toast.error('Error al cargar documentos');
    } finally {
      setLoading(false);
    }
  };

  const loadAnalysisHistory = async () => {
    try {
      const response = await apiClient.get(`/projects/${id}/analysis`);
      const history = {};
      
      // Mapeo de tipos de análisis de BD a tabs del frontend
      const typeMapping = {
        'pliego_tecnico': 'pliego'
        // contrato, oferta y documentacion tienen el mismo nombre en BD y frontend
      };
      
      response.data.analysis.forEach(item => {
        const mappedType = typeMapping[item.analysis_type] || item.analysis_type;
        if (!history[mappedType]) {
          history[mappedType] = [];
        }
        history[mappedType].push(item);
      });
      
      setAnalysisHistory(history);
      
      // Cargar el resultado más reciente del tab actual al cargar la página
      if (history[activeTab] && history[activeTab].length > 0) {
        const latestAnalysis = history[activeTab][0];
        setResult(latestAnalysis.result_data);
        setCurrentAnalysisId(latestAnalysis.id);
        setResultMetadata({
          model: latestAnalysis.ai_model_used,
          tokens_used: latestAnalysis.tokens_used,
          duration: latestAnalysis.duration_ms,
          created_at: latestAnalysis.created_at
        });
      }
    } catch (error) {
      console.error('Error al cargar historial:', error);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
      setUploading(true);
      await apiClient.post(`/projects/${id}/documents`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.success('Documento subido exitosamente');
      loadDocuments();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al subir documento');
    } finally {
      setUploading(false);
    }
  };

  const toggleDocSelection = (docId, tab) => {
    setSelectedDocsByTab(prev => ({
      ...prev,
      [tab]: prev[tab].includes(docId)
        ? prev[tab].filter(id => id !== docId)
        : [...prev[tab], docId]
    }));
  };

  const handleDeleteDocument = async () => {
    if (!deleteDocConfirmModal) return;
    
    try {
      await apiClient.delete(`/documents/${deleteDocConfirmModal}`);
      toast.success('Documento eliminado');
      setDeleteDocConfirmModal(null);
      loadDocuments();
      // Limpiar el documento de todas las selecciones
      setSelectedDocsByTab(prev => ({
        pliego: prev.pliego.filter(id => id !== deleteDocConfirmModal),
        contrato: prev.contrato.filter(id => id !== deleteDocConfirmModal),
        oferta: prev.oferta.filter(id => id !== deleteDocConfirmModal),
        documentacion: prev.documentacion.filter(id => id !== deleteDocConfirmModal)
      }));
    } catch (error) {
      toast.error('Error al eliminar documento');
      setDeleteDocConfirmModal(null);
    }
  };

  const handleAnalyze = async (analysisType, useStandard = false) => {
    const selectedDocs = selectedDocsByTab[analysisType] || [];
    if (selectedDocs.length === 0) {
      toast.error('Selecciona al menos un documento');
      return;
    }

    setAnalyzing(true);
    setAnalyzingWithStandard(useStandard);
    setResult(null);

    try {
      // Paso 1: Preparando documentos
      setProgressMessage('Preparando documentos seleccionados...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Paso 2: Extrayendo contenido
      setProgressMessage('Extrayendo contenido de los documentos...');
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Paso 3: Consultando IA
      const modelName = useStandard ? 'Deep Análisis IA' : 'Análisis IA';
      setProgressMessage(`Consultando ${modelName}...`);
      
      const endpoint = `/projects/${id}/analyze/${analysisType}`;
      const response = await apiClient.post(endpoint, {
        document_ids: selectedDocs,
        use_standard: useStandard
      });
      
      // Paso 4: Procesando respuesta
      setProgressMessage('Procesando y estructurando resultados...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setResult(response.data.result);
      setResultMetadata(response.data.metadata);
      toast.success('Análisis completado exitosamente');
      setProgressMessage(''); // Limpiar mensaje de progreso
      // Recargar historial para mostrar el nuevo análisis
      loadAnalysisHistory();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al realizar análisis');
      setProgressMessage(''); // Limpiar mensaje de progreso en caso de error
    } finally {
      setAnalyzing(false);
      setAnalyzingWithStandard(false);
    }
  };

  const handleGenerateDocument = async (type, additionalData) => {
    const selectedDocs = selectedDocsByTab[type] || [];
    if (selectedDocs.length === 0) {
      toast.error('Selecciona al menos un documento');
      return;
    }

    setAnalyzing(true);

    try {
      // Paso 1: Preparando documentos
      setProgressMessage('Preparando documentos seleccionados...');
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Paso 2: Analizando contenido
      setProgressMessage('Analizando contenido con IA...');
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Paso 3: Generando documento
      const docType = type === 'oferta' ? 'oferta comercial' : 'documentación técnica';
      setProgressMessage(`Generando ${docType}...`);
      
      const endpoint = `/projects/${id}/generate/${type}`;
      const response = await apiClient.post(endpoint, {
        document_ids: selectedDocs,
        ...additionalData
      }, {
        responseType: 'blob'
      });

      // Paso 4: Preparando descarga
      setProgressMessage('Preparando descarga...');
      await new Promise(resolve => setTimeout(resolve, 300));

      // Descargar archivo
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${type}_${Date.now()}.docx`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success('Documento generado y descargado exitosamente');
      setProgressMessage(''); // Limpiar mensaje de progreso
    } catch (error) {
      toast.error('Error al generar documento');
      setProgressMessage(''); // Limpiar mensaje de progreso en caso de error
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDeleteAnalysis = async (analysisId) => {
    try {
      await apiClient.delete(`/projects/${id}/analysis/${analysisId}`);
      toast.success('Análisis eliminado correctamente');
      setDeleteConfirmModal(null);
      
      // Si el análisis borrado es el actual, limpiar
      if (analysisId === currentAnalysisId) {
        setResult(null);
        setCurrentAnalysisId(null);
        setResultMetadata(null);
      }
      
      // Recargar historial
      loadAnalysisHistory();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Error al eliminar análisis');
    }
  };

  const handleAddAnalysisAsDocument = async () => {
    if (!currentAnalysisId || !result) {
      toast.error('No hay análisis seleccionado');
      return;
    }

    try {
      // Generar nombre con fecha y hora
      const now = new Date();
      const fecha = now.toISOString().split('T')[0]; // YYYY-MM-DD
      const hora = now.toTimeString().split(' ')[0].replace(/:/g, ''); // HHMMSS
      
      const analysisTypeNames = {
        'pliego': 'Analisis_Tecnico',
        'contrato': 'Analisis_Contrato'
      };
      const typeName = analysisTypeNames[activeTab] || 'Analisis';
      const documentName = `${typeName}_${fecha}_${hora}`;

      if (!documentName || documentName.trim() === '') {
        toast.error('Error al generar nombre del documento');
        return;
      }

      const response = await apiClient.post(`/projects/${id}/analysis/${currentAnalysisId}/add-as-document`, {
        filename: documentName
      });

      toast.success(`Análisis añadido como documento: "${documentName}.json"`);
      // Recargar documentos
      loadDocuments();
    } catch (error) {
      console.error('Error al añadir análisis:', error);
      toast.error(error.response?.data?.error || 'Error al añadir análisis como documento');
    }
  };

  // Filtrar documentos para evitar realimentación
  const getFilteredDocuments = (analysisType) => {
    const excludePrefixes = {
      'pliego': 'Analisis_Tecnico',
      'contrato': 'Analisis_Contrato'
    };
    
    const prefix = excludePrefixes[analysisType];
    if (!prefix) return documents;
    
    return documents.filter(doc => !doc.filename.startsWith(prefix));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <Header />
        <Loading message="Cargando proyecto..." />
      </div>
    );
  }

  const tabs = [
    { 
      id: 'pliego', 
      name: 'Evaluar Pliego Técnico',
      icon: FileSearch,
      description: 'Analiza pliegos técnicos de licitaciones y especificaciones',
      color: 'blue',
      gradient: 'from-blue-500 to-cyan-500'
    },
    { 
      id: 'contrato', 
      name: 'Evaluar Contrato',
      icon: Scale,
      description: 'Analiza contratos, cláusulas y condiciones legales',
      color: 'purple',
      gradient: 'from-purple-500 to-pink-500'
    },
    { 
      id: 'oferta', 
      name: 'Generar Oferta',
      icon: Briefcase,
      description: 'Genera propuestas técnicas y comerciales (DOCX)',
      color: 'green',
      gradient: 'from-green-500 to-emerald-500'
    },
    { 
      id: 'documentacion', 
      name: 'Generar Documentación',
      icon: FolderOpen,
      description: 'Crea documentación técnica completa (DOCX)',
      color: 'orange',
      gradient: 'from-orange-500 to-amber-500'
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />

      <div className="container mx-auto px-6 py-6">
        {/* Layout principal: Grid de 2 filas x 2 columnas */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
          {/* FILA 1 - COL 1: Título */}
          <div className="lg:col-span-1 p-2.5">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {project?.name}
            </h1>
            {project?.description && (
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                {project.description}
              </p>
            )}
          </div>

          {/* FILA 1 - COL 2: Navbar */}
          <div className="lg:col-span-3 px-2.5">
            {/* Tabs navigation */}
            <div className="relative border-b border-gray-200 dark:border-gray-700/50">
              <nav className="flex overflow-x-auto scrollbar-hide" aria-label="Tabs">
                {tabs.map((tab, index) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  const isFirst = index === 0;
                  
                  // Colores específicos por tab
                  const colorClasses = {
                    blue: 'text-blue-600 dark:text-blue-400',
                    purple: 'text-purple-600 dark:text-purple-400',
                    green: 'text-green-600 dark:text-green-400',
                    orange: 'text-orange-600 dark:text-orange-400'
                  };
                  
                  const bgClasses = {
                    blue: 'bg-blue-600 dark:bg-blue-400',
                    purple: 'bg-purple-600 dark:bg-purple-400',
                    green: 'bg-green-600 dark:bg-green-400',
                    orange: 'bg-orange-600 dark:bg-orange-400'
                  };
                  
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setActiveTab(tab.id);
                        const tabHistory = analysisHistory[tab.id];
                        if (tabHistory && tabHistory.length > 0) {
                          setResult(tabHistory[0].result_data);
                        } else {
                          setResult(null);
                        }
                      }}
                      className={`group relative flex items-center space-x-2.5 ${isFirst ? 'pl-0 pr-4' : 'px-4'} py-3.5 
                                font-medium text-sm whitespace-nowrap 
                                transition-all duration-300 ease-out
                                ${isActive 
                                  ? colorClasses[tab.color]
                                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                                }`}
                    >
                      {/* Icono */}
                      <Icon className={`w-5 h-5 transition-all duration-300 ${
                        isActive ? 'opacity-100 scale-110' : 'opacity-50 group-hover:opacity-70 group-hover:scale-105'
                      }`} />
                      
                      {/* Texto */}
                      <span className="font-semibold tracking-wide">
                        {tab.name}
                      </span>
                      
                      {/* Línea animada que avanza desde la izquierda */}
                      {isActive && (
                        <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${bgClasses[tab.color]} 
                                       animate-slide-in-line rounded-full`} />
                      )}
                      
                      {/* Efecto de hover sutil */}
                      <div className={`absolute bottom-0 left-0 right-0 h-0.5 bg-gray-300 dark:bg-gray-600 
                                     opacity-0 group-hover:opacity-100 transition-opacity duration-200 rounded-full
                                     ${isActive ? 'hidden' : ''}`} />
                    </button>
                  );
                })}
              </nav>
            </div>
            
            {/* Descripción de la función activa */}
            <div className="mt-3">
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                {tabs.find(t => t.id === activeTab)?.description}
              </p>
            </div>
          </div>

          {/* FILA 2 - COL 1: Card Documentos */}
          <div className="lg:col-span-1">
            <div className="card sticky top-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Documentos
              </h3>

              {/* Lista de documentos */}
              <div className="space-y-2 mb-4 max-h-96 overflow-y-auto">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-start space-x-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-700/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <FileText className="w-4 h-4 text-gray-400" />
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {doc.filename}
                        </p>
                      </div>
                      <div className="flex items-center mt-1">
                        {doc.vectorization_status === 'completed' && (
                          <span className="text-xs text-green-600 dark:text-green-400 flex items-center">
                            <Check className="w-3 h-3 mr-1" />
                            Procesado
                          </span>
                        )}
                        {doc.vectorization_status === 'processing' && (
                          <span className="text-xs text-blue-600 dark:text-blue-400 flex items-center">
                            <Loader className="w-3 h-3 mr-1 animate-spin" />
                            Procesando...
                          </span>
                        )}
                        {doc.vectorization_status === 'failed' && (
                          <span className="text-xs text-red-600 dark:text-red-400 flex items-center">
                            <XCircle className="w-3 h-3 mr-1" />
                            Error
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => setDeleteDocConfirmModal(doc.id)}
                      className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 transition-colors"
                      title="Eliminar documento"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Upload */}
              <label className="w-full btn-secondary flex items-center justify-center space-x-2 cursor-pointer">
                <Upload className="w-5 h-5" />
                <span>{uploading ? 'Subiendo...' : 'Subir Documento'}</span>
                <input
                  type="file"
                  onChange={handleFileUpload}
                  accept=".pdf,.docx,.txt"
                  className="hidden"
                  disabled={uploading}
                />
              </label>
            </div>
          </div>

          {/* FILA 2 - COL 2: Card Contenido */}
          <div className="lg:col-span-3">
            <div className="card">

              {/* Contenido del tab */}
              <div className="space-y-4">
                {/* Tabs de análisis */}
                {(activeTab === 'pliego' || activeTab === 'contrato') && (
                  <>
                    {/* Selector de documentos con tags */}
                    <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Documentos para analizar:
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {(() => {
                          const filteredDocs = getFilteredDocuments(activeTab);
                          return filteredDocs.length === 0 ? (
                            <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                              No hay documentos disponibles. Sube un documento primero.
                            </p>
                          ) : (
                            filteredDocs.map((doc) => {
                              const isSelected = selectedDocsByTab[activeTab]?.includes(doc.id);
                              return (
                                <button
                                  key={doc.id}
                                  onClick={() => toggleDocSelection(doc.id, activeTab)}
                                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center space-x-2 ${
                                    isSelected
                                      ? 'bg-primary-600 text-white shadow-md'
                                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:border-primary-500 dark:hover:border-primary-400'
                                  }`}
                                >
                                  <FileText className="w-4 h-4" />
                                  <span className="truncate max-w-[200px]">{doc.filename}</span>
                                  {isSelected && <Check className="w-4 h-4" />}
                                </button>
                              );
                            })
                          );
                        })()}
                      </div>
                    </div>

                    <div className="flex space-x-3">
                      <button
                        onClick={() => handleAnalyze(activeTab, false)}
                        disabled={analyzing || !selectedDocsByTab[activeTab] || selectedDocsByTab[activeTab].length === 0}
                        className="btn-primary"
                      >
                        {analyzing && !analyzingWithStandard ? (
                          <span className="flex items-center space-x-2">
                            <Loader className="w-4 h-4 animate-spin" />
                            <span>Analizando con IA...</span>
                          </span>
                        ) : (
                          '✨ Análisis con IA'
                        )}
                      </button>

                      <button
                        onClick={() => handleAnalyze(activeTab, true)}
                        disabled={analyzing || !selectedDocsByTab[activeTab] || selectedDocsByTab[activeTab].length === 0}
                        className="btn-secondary"
                      >
                        {analyzing && analyzingWithStandard ? (
                          <span className="flex items-center space-x-2">
                            <Loader className="w-4 h-4 animate-spin" />
                            <span>Deep Análisis en progreso...</span>
                          </span>
                        ) : (
                          '⭐ Deep Análisis con IA'
                        )}
                      </button>
                    </div>

                    {/* Indicador de progreso sutil */}
                    {analyzing && progressMessage && (
                      <div className="flex items-center space-x-2 py-3 px-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 dark:border-gray-600 border-t-gray-600 dark:border-t-gray-400"></div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                          {progressMessage}
                        </p>
                      </div>
                    )}

                    {/* Historial de análisis */}
                    {analysisHistory[activeTab] && analysisHistory[activeTab].length > 0 && (
                      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-blue-50 dark:bg-blue-900/20">
                        <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Historial de análisis ({analysisHistory[activeTab].length})
                        </h5>
                        <div className="flex flex-wrap gap-2">
                          {analysisHistory[activeTab].map((analysis, idx) => (
                            <button
                              key={analysis.id}
                              onClick={() => {
                                setResult(analysis.result_data);
                                setCurrentAnalysisId(analysis.id);
                                setResultMetadata({
                                  model: analysis.ai_model_used,
                                  tokens_used: analysis.tokens_used,
                                  duration: analysis.duration_ms,
                                  created_at: analysis.created_at
                                });
                              }}
                              className={`px-3 py-2 text-xs rounded bg-white dark:bg-gray-700 border transition-colors ${
                                currentAnalysisId === analysis.id
                                  ? 'border-primary-500 dark:border-primary-400 bg-primary-50 dark:bg-primary-900/20'
                                  : 'border-gray-300 dark:border-gray-600 hover:border-primary-500 dark:hover:border-primary-400'
                              }`}
                            >
                              {idx === 0 ? '🆕 ' : ''}
                              {new Date(analysis.created_at).toLocaleString('es-ES', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                              <span className="ml-1 text-gray-500">
                                ({analysis.ai_model_used === 'gpt-5' ? '⭐' : '✨'})
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Resultado */}
                    {result && (
                      <div className="mt-6 space-y-4">
                        {/* Banner de acciones */}
                        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                                Resultado del análisis
                        </h4>
                              {resultMetadata && (
                                <span className={`px-2 py-1 rounded-full font-medium text-xs ${
                                  resultMetadata.model === 'gpt-5' 
                                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' 
                                    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                }`}>
                                  {resultMetadata.model === 'gpt-5' ? '⭐ Deep Análisis' : '✨ Análisis IA'}
                                </span>
                              )}
                            </div>
                            {resultMetadata && (
                              <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
                                <span>{Math.round(resultMetadata.duration / 1000)}s</span>
                                <span>{resultMetadata.tokens_used?.toLocaleString()} tokens</span>
                              </div>
                            )}
                          </div>
                          
                          {/* Botones de acción */}
                          <div className="flex flex-wrap gap-2">
                            {currentAnalysisId && (
                              <button
                                onClick={() => setDeleteConfirmModal(currentAnalysisId)}
                                className="px-3 py-2 text-sm bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors flex items-center space-x-2"
                              >
                                <Trash2 className="w-4 h-4" />
                                <span>Eliminar</span>
                              </button>
                            )}
                            
                            {currentAnalysisId && (activeTab === 'pliego' || activeTab === 'contrato') && (
                              <button
                                onClick={handleAddAnalysisAsDocument}
                                className="px-3 py-2 text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors flex items-center space-x-2"
                              >
                                <FileText className="w-4 h-4" />
                                <span>Añadir a Documentos</span>
                              </button>
                            )}
                            
                            <button
                              onClick={() => {
                                const dataStr = JSON.stringify(result, null, 2);
                                const dataBlob = new Blob([dataStr], { type: 'application/json' });
                                const url = URL.createObjectURL(dataBlob);
                                const link = document.createElement('a');
                                link.href = url;
                                const analysisType = activeTab === 'pliego' ? 'Analisis_Tecnico' : 'Analisis_Contrato';
                                link.download = `${analysisType}_${new Date().toISOString().split('T')[0]}.json`;
                                link.click();
                                URL.revokeObjectURL(url);
                              }}
                              className="px-3 py-2 text-sm bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 border border-green-200 dark:border-green-800 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors flex items-center space-x-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                              <span>Descargar JSON</span>
                            </button>
                          </div>
                        </div>
                        
                        {/* Contenido del resultado */}
                        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
                        <pre className="text-sm text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                          {JSON.stringify(result, null, 2)}
                        </pre>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Tab de oferta */}
                {activeTab === 'oferta' && (
                  <OfertaForm
                    documents={documents}
                    selectedDocs={selectedDocsByTab.oferta || []}
                    onToggleDoc={(docId) => toggleDocSelection(docId, 'oferta')}
                    analyzing={analyzing}
                    progressMessage={progressMessage}
                    onGenerate={(data) => handleGenerateDocument('oferta', data)}
                  />
                )}

                {/* Tab de documentación */}
                {activeTab === 'documentacion' && (
                  <DocumentacionForm
                    documents={documents}
                    selectedDocs={selectedDocsByTab.documentacion || []}
                    onToggleDoc={(docId) => toggleDocSelection(docId, 'documentacion')}
                    analyzing={analyzing}
                    progressMessage={progressMessage}
                    onGenerate={(data) => handleGenerateDocument('documentacion', data)}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modal de confirmación para borrar análisis */}
      <Modal 
        isOpen={!!deleteConfirmModal} 
        onClose={() => setDeleteConfirmModal(null)}
        title="Confirmar eliminación"
      >
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          ¿Estás seguro de que deseas eliminar este análisis? Esta acción no se puede deshacer.
        </p>
        <div className="flex space-x-3 justify-end">
          <button
            onClick={() => setDeleteConfirmModal(null)}
            className="btn-secondary"
          >
            Cancelar
          </button>
          <button
            onClick={() => handleDeleteAnalysis(deleteConfirmModal)}
            className="btn-danger"
          >
            Eliminar
          </button>
        </div>
      </Modal>
    </div>
  );
}

// Componente auxiliar para formulario de oferta
function OfertaForm({ documents, selectedDocs, onToggleDoc, analyzing, progressMessage, onGenerate }) {
  const [formData, setFormData] = useState({ cliente: '', observaciones: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    onGenerate(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Selector de documentos con tags */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Documentos para generar oferta:
        </label>
        <div className="flex flex-wrap gap-2">
          {documents.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic">
              No hay documentos disponibles. Sube un documento primero.
            </p>
          ) : (
            documents.map((doc) => {
              const isSelected = selectedDocs.includes(doc.id);
              return (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => onToggleDoc(doc.id)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center space-x-2 ${
                    isSelected
                      ? 'bg-primary-600 text-white shadow-md'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:border-primary-500 dark:hover:border-primary-400'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span className="truncate max-w-[200px]">{doc.filename}</span>
                  {isSelected && <Check className="w-4 h-4" />}
                </button>
              );
            })
          )}
        </div>
      </div>

      <div>
        <label className="label">Nombre del cliente *</label>
        <input
          type="text"
          value={formData.cliente}
          onChange={(e) => setFormData({ ...formData, cliente: e.target.value })}
          className="input"
          required
        />
      </div>

      <div>
        <label className="label">Observaciones personalizadas</label>
        <textarea
          value={formData.observaciones}
          onChange={(e) => setFormData({ ...formData, observaciones: e.target.value })}
          className="input"
          rows="3"
        />
      </div>

      <button
        type="submit"
        disabled={analyzing || selectedDocs.length === 0}
        className="btn-primary"
      >
        {analyzing ? 'Generando...' : 'Generar Oferta (DOCX)'}
      </button>

      {/* Indicador de progreso sutil */}
      {analyzing && progressMessage && (
        <div className="flex items-center space-x-2 py-3 px-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 dark:border-gray-600 border-t-gray-600 dark:border-t-gray-400"></div>
          <p className="text-sm text-gray-500 dark:text-gray-400 italic">
            {progressMessage}
          </p>
        </div>
      )}
    </form>
  );
}

// Componente auxiliar para formulario de documentación
function DocumentacionForm({ documents, selectedDocs, onToggleDoc, analyzing, progressMessage, onGenerate }) {
  const [formData, setFormData] = useState({ tipo_documento: 'Memoria técnica', titulo: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    onGenerate(formData);
  };

  const tiposDocs = [
    'Memoria técnica',
    'Manual de instalación',
    'Plan de calidad',
    'Especificaciones técnicas',
    'Informe técnico'
  ];

  return (
    <form onSubmit={handleSubmit} className="space-y-4">

      {/* Selector de documentos con tags */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-800/50">
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Documentos para generar documentación:
        </label>
        <div className="flex flex-wrap gap-2">
          {documents.length === 0 ? (
            <p className="text-sm text-gray-500 dark:text-gray-400 italic">
              No hay documentos disponibles. Sube un documento primero.
            </p>
          ) : (
            documents.map((doc) => {
              const isSelected = selectedDocs.includes(doc.id);
              return (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => onToggleDoc(doc.id)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center space-x-2 ${
                    isSelected
                      ? 'bg-primary-600 text-white shadow-md'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:border-primary-500 dark:hover:border-primary-400'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span className="truncate max-w-[200px]">{doc.filename}</span>
                  {isSelected && <Check className="w-4 h-4" />}
                </button>
              );
            })
          )}
        </div>
      </div>

      <div>
        <label className="label">Tipo de documento *</label>
        <select
          value={formData.tipo_documento}
          onChange={(e) => setFormData({ ...formData, tipo_documento: e.target.value })}
          className="input"
          required
        >
          {tiposDocs.map((tipo) => (
            <option key={tipo} value={tipo}>
              {tipo}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="label">Título del documento *</label>
        <input
          type="text"
          value={formData.titulo}
          onChange={(e) => setFormData({ ...formData, titulo: e.target.value })}
          className="input"
          required
        />
      </div>

      <button
        type="submit"
        disabled={analyzing || selectedDocs.length === 0}
        className="btn-primary"
      >
        {analyzing ? 'Generando...' : 'Generar Documentación (DOCX)'}
      </button>

      {/* Indicador de progreso sutil */}
      {analyzing && progressMessage && (
        <div className="flex items-center space-x-2 py-3 px-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700/50">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 dark:border-gray-600 border-t-gray-600 dark:border-t-gray-400"></div>
          <p className="text-sm text-gray-500 dark:text-gray-400 italic">
            {progressMessage}
          </p>
        </div>
      )}
    </form>
  );
}

