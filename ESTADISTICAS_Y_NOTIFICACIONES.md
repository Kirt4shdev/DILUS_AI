# 📊 Sistema de Estadísticas de Tokens y 🔔 Notificaciones Toast

## 📋 Tabla de Contenidos
1. [Estadísticas de Tokens](#estadísticas-de-tokens)
2. [Sistema de Notificaciones Toast](#sistema-de-notificaciones-toast)

---

## 📊 Estadísticas de Tokens

### 🎯 Objetivo

Registrar y analizar **todo** el uso de tokens de los modelos de IA (GPT-5, GPT-5-mini, embeddings) de manera detallada, separando:
- 📈 **Análisis de datos** (análisis técnico, contratos)
- 💬 **Chat** (Alexandrina / consultas a la bóveda)
- 📄 **Generación de documentos** (ofertas, documentación técnica)

### 🗄️ Estructura de Base de Datos

#### Tabla Principal: `token_usage`

```sql
CREATE TABLE token_usage (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  operation_type VARCHAR(50) NOT NULL,     -- 'analysis', 'chat', 'generation'
  operation_subtype VARCHAR(100),          -- 'pliego', 'contrato', 'vault_query', etc.
  ai_model VARCHAR(50) NOT NULL,           -- 'gpt-5', 'gpt-5-mini', 'text-embedding-3-small'
  tokens_used INTEGER NOT NULL,
  tokens_input INTEGER,                    -- Tokens de entrada
  tokens_output INTEGER,                   -- Tokens de salida
  source_type VARCHAR(50),                 -- 'library', 'external' (para chat)
  cost_usd DECIMAL(10, 6),                -- Coste estimado en USD
  project_id INTEGER,
  analysis_id INTEGER,
  vault_query_id INTEGER,
  query_object TEXT,                       -- Descripción del objeto
  duration_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
```

**Campos clave:**
- `operation_type`: Tipo general de operación
- `operation_subtype`: Subtipo específico
- `source_type`: Para chat, indica si viene de la biblioteca (RAG) o fuente externa
- `cost_usd`: Coste calculado automáticamente según el modelo
- `query_object`: Descripción de qué se consultó

---

### 📈 Vistas de Análisis

#### 1. **daily_token_usage** - Agregación Diaria

```sql
SELECT 
  DATE(created_at) as usage_date,
  user_id,
  operation_type,
  ai_model,
  COUNT(*) as operation_count,
  SUM(tokens_used) as total_tokens,
  SUM(cost_usd) as total_cost_usd,
  AVG(tokens_used) as avg_tokens_per_operation
FROM token_usage
GROUP BY DATE(created_at), user_id, operation_type, ai_model;
```

**Utilidad:** Análisis de tendencias diarias de uso.

---

#### 2. **user_token_summary** - Resumen por Usuario

```sql
SELECT 
  username,
  total_operations,
  total_tokens,
  tokens_analysis,      -- Tokens usados en análisis
  tokens_chat,          -- Tokens usados en chat
  tokens_generation,    -- Tokens usados en generación
  total_cost_usd
FROM user_token_summary;
```

**Utilidad:** Ver consumo total por usuario y tipo de operación.

---

#### 3. **model_usage_stats** - Estadísticas por Modelo

```sql
SELECT 
  ai_model,
  operation_type,
  usage_count,
  total_tokens,
  avg_tokens,
  total_cost
FROM model_usage_stats
ORDER BY total_tokens DESC;
```

**Utilidad:** Identificar qué modelos se usan más y cuánto cuestan.

---

### 🔧 Servicio Backend: `tokenStatsService.js`

#### Función Principal: `logTokenUsage()`

```javascript
await logTokenUsage({
  userId: req.user.id,
  operationType: 'analysis',              // 'analysis', 'chat', 'generation'
  operationSubtype: 'pliego_tecnico',     // Específico
  aiModel: 'gpt-5-mini',
  tokensUsed: 2500,
  sourceType: 'library',                  // Solo para chat
  projectId: 1,
  analysisId: 42,
  queryObject: 'Análisis de pliego técnico - 3 documentos',
  durationMs: 5000
});
```

#### Funciones de Análisis

| Función | Descripción |
|---------|-------------|
| `getUserTokenStats(userId, filters)` | Estadísticas de un usuario específico |
| `getDailyTokenUsage(filters)` | Uso diario con filtros opcionales |
| `getModelUsageStats()` | Estadísticas agregadas por modelo |
| `getAnalysisVsChatComparison(userId, days)` | Comparación análisis vs chat |
| `getTopQueriesByTokens(filters)` | Consultas que más tokens consumieron |

---

### 📊 Registro Automático

El sistema registra **automáticamente** cada uso de IA:

#### Análisis de Datos
```javascript
// backend/routes/analysis.js

// Después de guardar el análisis
await logTokenUsage({
  userId: req.user.id,
  operationType: 'analysis',
  operationSubtype: 'pliego_tecnico',
  aiModel: aiResponse.model,
  tokensUsed: aiResponse.tokensUsed,
  projectId: projectId,
  analysisId: savedAnalysis.id,
  queryObject: `Análisis de pliego técnico - ${docsCount} documentos`,
  durationMs: aiResponse.duration
});
```

#### Chat (Alexandrina)
```javascript
// backend/routes/vault.js

// Después de guardar la consulta
await logTokenUsage({
  userId: req.user.id,
  operationType: 'chat',
  operationSubtype: 'vault_query',
  aiModel: aiResponse.model,
  tokensUsed: aiResponse.tokensUsed,
  sourceType: sourceType,  // 'library' o 'external'
  vaultQueryId: savedQuery.id,
  queryObject: userQuery.substring(0, 100),
  durationMs: aiResponse.duration
});
```

#### Generación de Documentos
```javascript
// backend/routes/analysis.js (oferta/documentación)

await logTokenUsage({
  userId: req.user.id,
  operationType: 'generation',
  operationSubtype: 'oferta',
  aiModel: aiResponse.model,
  tokensUsed: aiResponse.tokensUsed,
  projectId: projectId,
  analysisId: savedDoc.id,
  queryObject: `Generación de oferta para ${clientName}`,
  durationMs: aiResponse.duration
});
```

---

### 💰 Cálculo de Costes

Los costes se calculan **automáticamente** basándose en las tarifas de OpenAI:

```sql
-- En la función log_token_usage()
v_cost_usd := CASE p_ai_model
  WHEN 'gpt-5' THEN (p_tokens_used / 1000.0) * 0.03       -- $0.03/1K tokens
  WHEN 'gpt-5-mini' THEN (p_tokens_used / 1000.0) * 0.01  -- $0.01/1K tokens
  WHEN 'text-embedding-3-small' THEN (p_tokens_used / 1000.0) * 0.0001
  ELSE (p_tokens_used / 1000.0) * 0.01
END;
```

⚠️ **Nota:** Ajustar estos valores según las tarifas reales de OpenAI.

---

### 📈 Ejemplos de Consultas Útiles

#### 1. Coste Total por Usuario (Último Mes)
```sql
SELECT 
  username,
  SUM(tu.cost_usd) as total_cost,
  SUM(tu.tokens_used) as total_tokens
FROM users u
JOIN token_usage tu ON u.id = tu.user_id
WHERE tu.created_at >= NOW() - INTERVAL '30 days'
GROUP BY username
ORDER BY total_cost DESC;
```

#### 2. Comparación Análisis vs Chat
```sql
SELECT 
  operation_type,
  COUNT(*) as operations,
  SUM(tokens_used) as total_tokens,
  ROUND(AVG(tokens_used)) as avg_tokens,
  SUM(cost_usd) as total_cost
FROM token_usage
WHERE created_at >= NOW() - INTERVAL '7 days'
GROUP BY operation_type;
```

#### 3. Consultas más Costosas
```sql
SELECT 
  query_object,
  ai_model,
  tokens_used,
  cost_usd,
  created_at
FROM token_usage
ORDER BY cost_usd DESC
LIMIT 10;
```

#### 4. Uso por Fuente (Biblioteca vs Externa)
```sql
SELECT 
  source_type,
  COUNT(*) as query_count,
  SUM(tokens_used) as total_tokens,
  ROUND(AVG(tokens_used)) as avg_tokens
FROM token_usage
WHERE operation_type = 'chat'
  AND source_type IS NOT NULL
GROUP BY source_type;
```

---

## 🔔 Sistema de Notificaciones Toast

### 🎯 Objetivo

Reemplazar las notificaciones tipo Alert (que ocupan espacio en el centro) con **Toasts modernos** que aparecen en la **esquina superior derecha**, son elegantes y desaparecen automáticamente.

### ✨ Características

✅ **Posición:** Superior derecha (top-4 right-4)  
✅ **Auto-desaparición:** 5 segundos por defecto (configurable)  
✅ **Animación:** Slide-in desde la derecha  
✅ **Tipos:** Success, Error, Warning, Info  
✅ **Stacking:** Múltiples toasts se apilan verticalmente  
✅ **Cierre manual:** Botón X para cerrar inmediatamente  
✅ **No ocupa espacio:** `position: fixed` con `pointer-events-none`

---

### 🎨 Diseño Visual

#### Success (Verde)
```
┌────────────────────────────────┐
│ ✓ Proyecto creado exitosamente │ [X]
└────────────────────────────────┘
```

#### Error (Rojo)
```
┌────────────────────────────────┐
│ ✕ Error al cargar proyectos    │ [X]
└────────────────────────────────┘
```

#### Warning (Amarillo)
```
┌────────────────────────────────┐
│ ⚠ El nombre es requerido        │ [X]
└────────────────────────────────┘
```

#### Info (Azul)
```
┌────────────────────────────────┐
│ ℹ Procesando solicitud...       │ [X]
└────────────────────────────────┘
```

---

### 🔧 Implementación

#### 1. Componentes Creados

##### `Toast.jsx`
```jsx
<Toast 
  id={toast.id}
  type="success"  // success, error, warning, info
  message="Proyecto creado exitosamente"
  duration={5000}
  onClose={handleClose}
/>
```

##### `ToastContainer.jsx`
```jsx
<ToastContainer toasts={toasts} onClose={removeToast} />
```
- Posicionado en top-right
- Maneja múltiples toasts
- `z-index: 9999` para estar siempre visible

##### `ToastContext.jsx`
```jsx
export function ToastProvider({ children }) {
  // Gestión de toasts
  return (
    <ToastContext.Provider value={{ success, error, warning, info }}>
      {children}
      <ToastContainer toasts={toasts} />
    </ToastContext.Provider>
  );
}
```

---

#### 2. Hook: `useToast()`

```jsx
import { useToast } from '../contexts/ToastContext';

function MyComponent() {
  const toast = useToast();
  
  const handleAction = async () => {
    try {
      await doSomething();
      toast.success('Operación exitosa');
    } catch (error) {
      toast.error('Error en la operación');
    }
  };
}
```

**Métodos disponibles:**
- `toast.success(message, duration?)` - Notificación verde
- `toast.error(message, duration?)` - Notificación roja
- `toast.warning(message, duration?)` - Notificación amarilla
- `toast.info(message, duration?)` - Notificación azul

---

#### 3. Integración en App.jsx

```jsx
function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>  {/* ← Wrap aquí */}
          <BrowserRouter>
            <Routes>...</Routes>
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
```

---

### 🎭 Animaciones CSS

```css
@keyframes slide-in-right {
  from {
    transform: translateX(100%);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
}

.animate-slide-in-right {
  animation: slide-in-right 0.3s ease-out;
}
```

---

### 🔄 Migración desde Alert

#### ANTES (Alert antiguo)
```jsx
const [error, setError] = useState('');
const [success, setSuccess] = useState('');

// En el JSX
{error && <Alert type="error" message={error} onClose={() => setError('')} />}
{success && <Alert type="success" message={success} onClose={() => setSuccess('')} />}

// En el código
setError('Error al cargar');
setSuccess('Operación exitosa');
```

#### DESPUÉS (Toast nuevo)
```jsx
const toast = useToast();

// Ya no hay JSX de alertas en el componente

// En el código
toast.error('Error al cargar');
toast.success('Operación exitosa');
```

**Beneficios:**
- ✅ Menos código en el componente
- ✅ No ocupa espacio en el layout
- ✅ Se gestiona globalmente
- ✅ Múltiples notificaciones simultáneas

---

### 🎯 Casos de Uso

#### 1. Operaciones CRUD
```jsx
const handleCreate = async () => {
  try {
    await apiClient.post('/projects', data);
    toast.success('Proyecto creado exitosamente');
    navigate('/');
  } catch (error) {
    toast.error(error.response?.data?.error || 'Error al crear proyecto');
  }
};
```

#### 2. Validaciones
```jsx
const handleSubmit = (e) => {
  e.preventDefault();
  
  if (!formData.name.trim()) {
    toast.warning('El nombre es requerido');
    return;
  }
  
  // ... continuar
};
```

#### 3. Información
```jsx
const handleExport = async () => {
  toast.info('Generando archivo...');
  
  const file = await generateReport();
  
  toast.success('Archivo descargado');
};
```

#### 4. Múltiples Notificaciones
```jsx
const handleBatchOperation = async (items) => {
  const results = await Promise.allSettled(
    items.map(item => processItem(item))
  );
  
  const success = results.filter(r => r.status === 'fulfilled').length;
  const failed = results.filter(r => r.status === 'rejected').length;
  
  if (success > 0) toast.success(`${success} elementos procesados`);
  if (failed > 0) toast.error(`${failed} elementos fallaron`);
};
```

---

### 📊 Personalización

#### Duración Custom
```jsx
toast.success('Guardado', 3000);  // 3 segundos
toast.error('Error crítico', 10000);  // 10 segundos
toast.info('Procesando...', 0);  // No desaparece automáticamente
```

#### Posición (Modificable en ToastContainer.jsx)
```jsx
// Top-right (actual)
<div className="fixed top-4 right-4 z-[9999]">

// Top-center
<div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999]">

// Bottom-right
<div className="fixed bottom-4 right-4 z-[9999]">
```

---

## 📈 Conclusión

### Estadísticas de Tokens
- ✅ Registro detallado de **todo** uso de IA
- ✅ Separación por tipo: análisis, chat, generación
- ✅ Cálculo automático de costes
- ✅ Vistas SQL para análisis rápido
- ✅ Identificación de fuente (biblioteca vs externa)

### Notificaciones Toast
- ✅ UX moderna y elegante
- ✅ No ocupa espacio en el layout
- ✅ Auto-desaparición configurable
- ✅ Múltiples notificaciones simultáneas
- ✅ Fácil de usar con `useToast()`

**¡Sistema completo de análisis de costes y notificaciones modernas implementado!** 🚀

