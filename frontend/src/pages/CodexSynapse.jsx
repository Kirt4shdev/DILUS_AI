import React, { useState, useEffect, useRef, Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text, Line, Html } from '@react-three/drei';
import { Search, Filter, RefreshCw, Maximize2, Info, Eye, EyeOff } from 'lucide-react';
import Header from '../components/Header';
import Loading from '../components/Loading';
import apiClient from '../api/client';
import { useToast } from '../contexts/ToastContext';

// Componente para un chunk 3D
function ChunkPoint({ chunk, isSelected, isHighlighted, onClick, onHover }) {
  const meshRef = useRef();
  const [hovered, setHovered] = useState(false);

  // Tamaños: normal pequeño, resaltado GRANDE, seleccionado MUY GRANDE
  const size = isSelected ? 0.045 : isHighlighted ? 0.035 : 0.015;
  
  // Colores: resaltado en amarillo brillante, seleccionado en naranja
  const color = isSelected ? '#F97316' : isHighlighted ? '#FCD34D' : chunk.color || '#3B82F6';

  return (
    <group>
      <mesh
        ref={meshRef}
        position={[chunk.coordinates.x, chunk.coordinates.y, chunk.coordinates.z]}
        onClick={(e) => {
          e.stopPropagation();
          onClick(chunk);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          onHover(chunk);
        }}
        onPointerOut={() => {
          setHovered(false);
          onHover(null);
        }}
      >
        <sphereGeometry args={[size, 16, 16]} />
        <meshStandardMaterial 
          color={color} 
          emissive={color}
          emissiveIntensity={hovered || isSelected || isHighlighted ? 0.8 : 0.2}
          metalness={isHighlighted ? 0.6 : 0.3}
          roughness={isHighlighted ? 0.2 : 0.4}
        />
      </mesh>

      {/* Label al hover */}
      {hovered && (
        <Html position={[chunk.coordinates.x, chunk.coordinates.y + 0.08, chunk.coordinates.z]}>
          <div className="bg-gray-900/95 text-white text-xs px-3 py-2 rounded-lg shadow-xl border border-gray-700 max-w-xs backdrop-blur">
            <div className="font-semibold mb-1">{chunk.document_name}</div>
            <div className="text-gray-300">Chunk #{chunk.chunk_index}</div>
          </div>
        </Html>
      )}
    </group>
  );
}

// Componente para centros de clusters
function ClusterCenter({ cluster, visible }) {
  if (!visible) return null;

  return (
    <group>
      <mesh position={[cluster.x, cluster.y, cluster.z]}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshStandardMaterial 
          color={cluster.color}
          transparent
          opacity={0.3}
          wireframe
        />
      </mesh>
      <Html position={[cluster.x, cluster.y + 0.1, cluster.z]}>
        <div className="bg-gray-900/90 text-white text-xs px-2 py-1 rounded shadow-lg border border-gray-700">
          {cluster.theme || `Cluster ${cluster.id}`} ({cluster.size})
        </div>
      </Html>
    </group>
  );
}

// Escena 3D
function Scene({ chunks, clusters, selectedChunk, highlightedChunks, onChunkClick, onChunkHover, showClusters }) {
  return (
    <>
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={0.8} />
      <pointLight position={[-10, -10, -10]} intensity={0.4} />
      
      {/* Grid de referencia */}
      <gridHelper args={[4, 20, '#444444', '#222222']} rotation={[0, 0, 0]} />
      
      {/* Chunks */}
      {chunks.map(chunk => (
        <ChunkPoint
          key={chunk.id}
          chunk={chunk}
          isSelected={selectedChunk?.id === chunk.id}
          isHighlighted={highlightedChunks.includes(chunk.id)}
          onClick={onChunkClick}
          onHover={onChunkHover}
        />
      ))}
      
      {/* Centros de clusters */}
      {clusters.map(cluster => (
        <ClusterCenter key={cluster.id} cluster={cluster} visible={showClusters} />
      ))}
      
      {/* Controles de cámara */}
      <OrbitControls
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
        minDistance={1}
        maxDistance={10}
      />
    </>
  );
}

export default function CodexSynapse() {
  const toast = useToast();
  
  const [loading, setLoading] = useState(false);
  const [chunks, setChunks] = useState([]);
  const [clusters, setClusters] = useState([]);
  const [metadata, setMetadata] = useState(null);
  
  const [selectedChunk, setSelectedChunk] = useState(null);
  const [hoveredChunk, setHoveredChunk] = useState(null);
  const [highlightedChunks, setHighlightedChunks] = useState([]);
  
  const [searchQuery, setSearchQuery] = useState('');
  const [showClusters, setShowClusters] = useState(true);
  const [method, setMethod] = useState('umap');
  const [nClusters, setNClusters] = useState(8);
  
  const [filters, setFilters] = useState({
    is_vault_only: false
  });

  useEffect(() => {
    loadVisualization();
  }, [method, nClusters, filters]);

  const loadVisualization = async () => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:8091/api/visualize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          method,
          n_clusters: nClusters,
          filters
        })
      });

      if (!response.ok) {
        throw new Error('Error fetching visualization');
      }

      const data = await response.json();
      
      setChunks(data.chunks || []);
      setClusters(data.clusters || []);
      setMetadata(data.metadata || {});
      
      if (data.chunks.length === 0) {
        toast.warning('No hay chunks para visualizar. Sube algunos documentos primero.');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error cargando visualización 3D');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      setHighlightedChunks([]);
      return;
    }

    // Buscar chunks que contengan el texto
    const query = searchQuery.toLowerCase();
    const matching = chunks
      .filter(chunk => 
        chunk.chunk_text.toLowerCase().includes(query) ||
        chunk.document_name.toLowerCase().includes(query)
      )
      .map(chunk => chunk.id);
    
    setHighlightedChunks(matching);
    
    if (matching.length > 0) {
      toast.success(`${matching.length} chunks encontrados`);
    } else {
      toast.info('No se encontraron chunks con ese texto');
    }
  };

  const handleReset = () => {
    setSearchQuery('');
    setHighlightedChunks([]);
    setSelectedChunk(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <Header title="🌌 Codex Synapse" subtitle="Mapa 3D del Conocimiento" />

      <div className="container mx-auto px-6 py-8">
        
        {/* Panel de control */}
        <div className="bg-gray-800/50 backdrop-blur rounded-lg p-6 mb-6 border border-gray-700">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            
            {/* Búsqueda */}
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                🔍 Buscar en el Codex
              </label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  placeholder="Buscar chunks..."
                  className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  onClick={handleSearch}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition flex items-center space-x-2"
                >
                  <Search className="w-4 h-4" />
                  <span>Buscar</span>
                </button>
              </div>
            </div>

            {/* Método */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Método de Reducción
              </label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              >
                <option value="umap">UMAP (Recomendado)</option>
                <option value="pca">PCA (Rápido)</option>
              </select>
            </div>

            {/* Clusters */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Número de Clusters
              </label>
              <input
                type="number"
                value={nClusters}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  if (!isNaN(value) && value >= 2 && value <= 20) {
                    setNClusters(value);
                  }
                }}
                min={2}
                max={20}
                className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
              />
            </div>
          </div>

          {/* Controles adicionales */}
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-700">
            <div className="flex items-center space-x-6">
              <button
                onClick={() => setShowClusters(!showClusters)}
                className="flex items-center space-x-2 text-gray-300 hover:text-white transition"
              >
                {showClusters ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                <span className="text-sm">Mostrar Clusters</span>
              </button>
              
              <label className="flex items-center space-x-2 text-gray-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filters.is_vault_only}
                  onChange={(e) => setFilters({...filters, is_vault_only: e.target.checked})}
                  className="form-checkbox h-4 w-4 text-blue-600 rounded"
                />
                <span className="text-sm">Solo Codex Dilus</span>
              </label>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={handleReset}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition flex items-center space-x-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Resetear</span>
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Visualización 3D */}
          <div className="lg:col-span-2">
            <div className="bg-gray-800/50 backdrop-blur rounded-lg border border-gray-700 overflow-hidden" style={{ height: '700px' }}>
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <Loading />
                </div>
              ) : chunks.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <Info className="w-16 h-16 mb-4 opacity-50" />
                  <p className="text-lg font-medium">No hay datos para visualizar</p>
                  <p className="text-sm mt-2">Sube algunos documentos al Codex Dilus</p>
                </div>
              ) : (
                <Canvas camera={{ position: [2, 2, 2], fov: 50 }}>
                  <Suspense fallback={null}>
                    <Scene
                      chunks={chunks}
                      clusters={clusters}
                      selectedChunk={selectedChunk}
                      highlightedChunks={highlightedChunks}
                      onChunkClick={setSelectedChunk}
                      onChunkHover={setHoveredChunk}
                      showClusters={showClusters}
                    />
                  </Suspense>
                </Canvas>
              )}
            </div>

            {/* Estadísticas */}
            {metadata && (
              <div className="mt-4 grid grid-cols-4 gap-4">
                <div className="bg-gray-800/50 backdrop-blur rounded-lg p-4 border border-gray-700">
                  <div className="text-2xl font-bold text-white">{metadata.n_samples || 0}</div>
                  <div className="text-xs text-gray-400">Chunks Totales</div>
                </div>
                <div className="bg-gray-800/50 backdrop-blur rounded-lg p-4 border border-gray-700">
                  <div className="text-2xl font-bold text-white">{metadata.n_clusters || 0}</div>
                  <div className="text-xs text-gray-400">Clusters</div>
                </div>
                <div className="bg-gray-800/50 backdrop-blur rounded-lg p-4 border border-gray-700">
                  <div className="text-2xl font-bold text-white">{metadata.method?.toUpperCase()}</div>
                  <div className="text-xs text-gray-400">Método</div>
                </div>
                <div className="bg-gray-800/50 backdrop-blur rounded-lg p-4 border border-gray-700">
                  <div className="text-2xl font-bold text-white">
                    {metadata.variance_explained ? (metadata.variance_explained * 100).toFixed(1) + '%' : '-'}
                  </div>
                  <div className="text-xs text-gray-400">Varianza</div>
                </div>
              </div>
            )}
          </div>

          {/* Panel de detalles */}
          <div className="space-y-6">
            
            {/* Chunk seleccionado */}
            {selectedChunk && (
              <div className="bg-gray-800/50 backdrop-blur rounded-lg p-6 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                  <Info className="w-5 h-5 mr-2" />
                  Chunk Seleccionado
                </h3>
                
                <div className="space-y-3">
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Documento</div>
                    <div className="text-sm text-white font-medium">{selectedChunk.document_name}</div>
                  </div>
                  
                  <div>
                    <div className="text-xs text-gray-400 mb-1">Chunk #{selectedChunk.chunk_index}</div>
                    <div className="text-xs text-gray-300 bg-gray-900/50 p-3 rounded border border-gray-700 max-h-48 overflow-y-auto">
                      {selectedChunk.chunk_text}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-gray-700">
                    <div>
                      <div className="text-xs text-gray-400">Cluster</div>
                      <div className="flex items-center space-x-2 mt-1">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedChunk.color }}></div>
                        <span className="text-sm text-white font-medium">{selectedChunk.cluster}</span>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400">Coordenadas</div>
                      <div className="text-xs text-gray-300 mt-1">
                        ({selectedChunk.coordinates.x.toFixed(2)}, {selectedChunk.coordinates.y.toFixed(2)}, {selectedChunk.coordinates.z.toFixed(2)})
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Información */}
            <div className="bg-blue-900/20 backdrop-blur rounded-lg p-4 border border-blue-800">
              <h4 className="text-sm font-semibold text-blue-300 mb-2">💡 Cómo usar Codex Synapse</h4>
              <ul className="text-xs text-blue-200 space-y-1">
                <li>• <strong>Rotar:</strong> Click izquierdo + arrastrar</li>
                <li>• <strong>Zoom:</strong> Scroll del ratón</li>
                <li>• <strong>Pan:</strong> Click derecho + arrastrar</li>
                <li>• <strong>Seleccionar:</strong> Click en un punto</li>
                <li>• <strong>Buscar:</strong> Los puntos se hacen GRANDES y amarillos</li>
              </ul>
            </div>

            {/* Explicación de Clusters */}
            <div className="bg-purple-900/20 backdrop-blur rounded-lg p-4 border border-purple-800">
              <h4 className="text-sm font-semibold text-purple-300 mb-2">🎨 ¿Qué son los Clusters?</h4>
              <p className="text-xs text-purple-200 mb-2">
                Los <strong>clusters</strong> son grupos automáticos de chunks que hablan de temas similares.
              </p>
              <ul className="text-xs text-purple-200 space-y-1">
                <li>• <strong>Mismo color</strong> = Mismo tema</li>
                <li>• <strong>Chunks cerca</strong> = Contenido parecido</li>
                <li>• <strong>Chunks lejos</strong> = Temas diferentes</li>
              </ul>
              <p className="text-xs text-purple-200 mt-2 italic">
                Ej: Azul = Liderazgo, Verde = Tecnología, etc.
              </p>
            </div>

            {/* Leyenda de colores */}
            {clusters.length > 0 && (
              <div className="bg-gray-800/50 backdrop-blur rounded-lg p-4 border border-gray-700">
                <h4 className="text-sm font-semibold text-gray-300 mb-3">🎨 Clusters Temáticos</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {clusters.map(cluster => (
                    <div key={cluster.id} className="flex items-center space-x-2 bg-gray-700/30 rounded p-2 hover:bg-gray-700/50 transition">
                      <div 
                        className="w-4 h-4 rounded-full flex-shrink-0"
                        style={{ backgroundColor: cluster.color }}
                      ></div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-gray-200 truncate">
                          {cluster.theme || `Tema ${cluster.id + 1}`}
                        </div>
                        <div className="text-xs text-gray-400">
                          {cluster.size} chunks
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

