# 📊 Gráfico de Costes Input/Output por Modelo y Fuente

## 📋 Resumen

Se ha implementado un **nuevo gráfico de barras** en el dashboard de Estadísticas de Tokens que muestra los costes separados de **entrada (input)** y **salida (output)** para cada combinación de:

- **Modelo**: GPT-5 o GPT-5-mini
- **Fuente**: Biblioteca (interno), Externa (externo), o Análisis

**Total de datos mostrados:** 8 combinaciones posibles (aunque solo aparecen las que tienen datos)

---

## 🎯 Objetivo

Visualizar claramente la diferencia de costes entre tokens de entrada y salida, ya que:
- **Los tokens de output son ~8x más caros** que los de input
- **En DILUS_AI, ~90-95% son tokens de input** (documentos grandes)
- Es crucial **separar y visualizar estos costes** para entender el impacto real

---

## 🔧 Implementación

### 1. Backend: Nueva Función en `tokenStatsService.js`

**Ubicación:** `backend/services/tokenStatsService.js` (líneas 225-330)

```javascript
export async function getInputOutputCostsByModelAndSource(userId = null, days = 30) {
  // Precios de OpenAI por 1K tokens
  const PRICES = {
    'gpt-5': { input: 0.00125, output: 0.01 },
    'gpt-5-mini': { input: 0.00025, output: 0.002 },
    'text-embedding-3-small': { input: 0.00002, output: 0 }
  };

  // Consulta SQL agregando por modelo y fuente
  const result = await query(`
    SELECT 
      ai_model,
      COALESCE(source_type, 'analysis') as source_type,
      SUM(tokens_input) as total_tokens_input,
      SUM(tokens_output) as total_tokens_output,
      COUNT(*) as operation_count
    FROM token_usage
    WHERE created_at >= NOW() - INTERVAL '${parseInt(days)} days' ${userFilter}
    GROUP BY ai_model, source_type
    ORDER BY ai_model, source_type
  `, params);

  // Calcular costes separados en el backend
  const enrichedResults = result.rows.map(row => {
    const modelPrices = PRICES[row.ai_model] || PRICES['gpt-5-mini'];
    const inputCost = (row.total_tokens_input || 0) / 1000 * modelPrices.input;
    const outputCost = (row.total_tokens_output || 0) / 1000 * modelPrices.output;
    
    return {
      ai_model: row.ai_model,
      source_type: row.source_type,
      total_tokens_input: parseInt(row.total_tokens_input) || 0,
      total_tokens_output: parseInt(row.total_tokens_output) || 0,
      input_cost_usd: inputCost,
      output_cost_usd: outputCost,
      total_cost_usd: inputCost + outputCost,
      operation_count: parseInt(row.operation_count)
    };
  });

  return enrichedResults;
}
```

**Características:**
- ✅ Agrupa por `ai_model` y `source_type`
- ✅ Suma tokens de input y output por separado
- ✅ Calcula costes usando precios reales de OpenAI
- ✅ Filtra por período (días) y usuario (opcional para admin)

### 2. Backend: Endpoint Actualizado

**Ubicación:** `backend/routes/stats.js` (líneas 40-41, 84)

```javascript
// Importar la nueva función
import { 
  // ... otras funciones
  getInputOutputCostsByModelAndSource
} from '../services/tokenStatsService.js';

// En el endpoint /api/stats/overview
router.get('/overview', async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    
    // ... otras consultas
    
    // Costes de input/output por modelo y fuente
    const inputOutputCosts = await getInputOutputCostsByModelAndSource(null, parseInt(days));
    
    res.json({
      period_days: parseInt(days),
      // ... otros datos
      input_output_costs: inputOutputCosts,  // ← Nuevo campo
      // ... más datos
    });
  } catch (error) {
    next(error);
  }
});
```

### 3. Frontend: Gráfico de Barras

**Ubicación:** `frontend/src/components/TokenStatsView.jsx` (líneas 301-453)

```jsx
{/* Costes Input/Output por Modelo y Fuente */}
<div className="card p-6 col-span-full">
  <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
    Costes de Entrada (Input) vs Salida (Output) por Modelo y Fuente
  </h4>
  
  {stats.input_output_costs && stats.input_output_costs.length > 0 ? (
    <div className="space-y-6">
      {/* Gráfico de Barras */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* GPT-5 */}
        <div>
          <h5 className="text-md font-medium text-gray-800 dark:text-gray-200 mb-3">GPT-5</h5>
          <div className="space-y-3">
            {['library', 'external', 'analysis'].map(sourceType => {
              const data = stats.input_output_costs.find(
                item => item.ai_model === 'gpt-5' && item.source_type === sourceType
              );
              
              if (!data || (data.input_cost_usd === 0 && data.output_cost_usd === 0)) return null;
              
              // Calcular anchos proporcionales
              const maxCost = Math.max(data.input_cost_usd, data.output_cost_usd, 0.01);
              const inputWidth = (data.input_cost_usd / maxCost) * 100;
              const outputWidth = (data.output_cost_usd / maxCost) * 100;
              
              return (
                <div key={sourceType} className="space-y-2">
                  <p className="text-sm font-medium">
                    {sourceType === 'library' ? '🗄️ Biblioteca' : 
                     sourceType === 'external' ? '🌍 Externa' : 
                     '📊 Análisis'}
                  </p>
                  
                  {/* Barra Input (Azul) */}
                  <div className="flex items-center space-x-2">
                    <span className="text-xs w-16">Input</span>
                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-6">
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
                  
                  {/* Barra Output (Naranja) */}
                  <div className="flex items-center space-x-2">
                    <span className="text-xs w-16">Output</span>
                    <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-6">
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
                  
                  <p className="text-xs text-right">
                    Total: ${data.total_cost_usd.toFixed(4)} ({data.operation_count} ops)
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* GPT-5-mini */}
        {/* (Estructura idéntica a GPT-5) */}
      </div>

      {/* Leyenda */}
      <div className="flex items-center justify-center space-x-6 pt-4 border-t">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-blue-500 dark:bg-blue-600 rounded"></div>
          <span className="text-sm">Input (Entrada)</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 bg-orange-500 dark:bg-orange-600 rounded"></div>
          <span className="text-sm">Output (Salida)</span>
        </div>
      </div>
    </div>
  ) : (
    <p className="text-center text-gray-500 py-8">
      No hay datos de costes input/output disponibles
    </p>
  )}
</div>
```

**Características del Gráfico:**
- ✅ **2 columnas**: GPT-5 y GPT-5-mini lado a lado
- ✅ **3 fuentes por modelo**: Biblioteca, Externa, Análisis
- ✅ **2 barras por fuente**: Input (azul) y Output (naranja)
- ✅ **Ancho proporcional**: Basado en el máximo coste de cada grupo
- ✅ **Valores mostrados**: Coste en USD con 4 decimales
- ✅ **Total y operaciones**: Debajo de cada grupo
- ✅ **Leyenda clara**: Con colores representativos
- ✅ **Responsive**: Se adapta a móvil (1 columna) y desktop (2 columnas)
- ✅ **Dark mode**: Colores optimizados para ambos temas

---

## 📊 Ejemplo Visual

### Datos de Ejemplo

```json
{
  "input_output_costs": [
    {
      "ai_model": "gpt-5-mini",
      "source_type": "analysis",
      "total_tokens_input": 50000,
      "total_tokens_output": 5000,
      "input_cost_usd": 0.0125,
      "output_cost_usd": 0.0100,
      "total_cost_usd": 0.0225,
      "operation_count": 3
    },
    {
      "ai_model": "gpt-5-mini",
      "source_type": "external",
      "total_tokens_input": 10000,
      "total_tokens_output": 2000,
      "input_cost_usd": 0.0025,
      "output_cost_usd": 0.0040,
      "total_cost_usd": 0.0065,
      "operation_count": 5
    },
    {
      "ai_model": "gpt-5",
      "source_type": "analysis",
      "total_tokens_input": 30000,
      "total_tokens_output": 3000,
      "input_cost_usd": 0.0375,
      "output_cost_usd": 0.0300,
      "total_cost_usd": 0.0675,
      "operation_count": 2
    }
  ]
}
```

### Representación Visual

```
┌─────────────────────────────────────────────────────────────────────────┐
│        Costes de Entrada (Input) vs Salida (Output) por Modelo         │
└─────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────┬───────────────────────────────────────────┐
│       GPT-5               │           GPT-5-mini                      │
├───────────────────────────┼───────────────────────────────────────────┤
│                           │                                           │
│ 📊 Análisis               │ 📊 Análisis                               │
│ Input  ████████ $0.0375   │ Input  ███ $0.0125                        │
│ Output ██████   $0.0300   │ Output ██  $0.0100                        │
│ Total: $0.0675 (2 ops)    │ Total: $0.0225 (3 ops)                    │
│                           │                                           │
│                           │ 🌍 Externa                                │
│                           │ Input  █ $0.0025                          │
│                           │ Output █ $0.0040                          │
│                           │ Total: $0.0065 (5 ops)                    │
│                           │                                           │
└───────────────────────────┴───────────────────────────────────────────┘

Leyenda: ● Input (Entrada)  ● Output (Salida)
```

---

## 🔍 Interpretación del Gráfico

### 1. Comparación Visual Inmediata

**Ejemplo:**
```
GPT-5-mini - Análisis:
  Input:  ████████████████████████ $0.0125  (Barra más larga)
  Output: ████████████████         $0.0100  (Barra más corta)
```

**Interpretación:**
- La barra de **Input es más larga** porque hay más tokens de entrada (50k vs 5k)
- Pero el **coste es solo 25% mayor** porque el precio por token es menor
- Esto muestra visualmente cómo **el output es proporcionalmente más caro**

### 2. Comparación entre Modelos

**GPT-5 vs GPT-5-mini (mismo número de tokens):**

```
GPT-5:
  Input:  30k tokens × $0.00125 = $0.0375
  Output:  3k tokens × $0.01000 = $0.0300

GPT-5-mini:
  Input:  50k tokens × $0.00025 = $0.0125
  Output:  5k tokens × $0.00200 = $0.0100
```

**Conclusión Visual:**
- GPT-5-mini procesa **más tokens** pero **cuesta menos**
- Las barras de GPT-5 son **más largas** (más caras) aunque tenga menos tokens
- **Ratio coste/token** es ~5x mejor en GPT-5-mini

### 3. Comparación por Fuente

**Biblioteca vs Externa:**

```
🗄️ Biblioteca (RAG):
  - Suele tener MENOS tokens (solo chunks relevantes)
  - Costes MÁS BAJOS
  - Barras MÁS CORTAS

🌍 Externa (ChatGPT directo):
  - Puede tener MÁS tokens (respuestas más extensas)
  - Costes MÁS ALTOS
  - Barras MÁS LARGAS
```

**Insight:**
- Si las barras de "Externa" son mucho más largas → **RAG está funcionando bien**
- Si "Biblioteca" tiene barras largas → **Revisar optimización de chunks**

### 4. Proporción Input/Output

**Típico en DILUS_AI:**

```
Análisis de Pliego:
  Input:  ████████████████████████████████████ $0.0375 (90% tokens)
  Output: ████                                 $0.0300 (10% tokens)
```

**Lo que esto revela:**
- A pesar de que **input tiene 9x más tokens**
- El **coste de output es casi igual** (80% del coste de input)
- Esto confirma que **output es ~8x más caro por token**

---

## 💡 Casos de Uso

### 1. Identificar Operaciones Costosas

```
Si ves:
  Output: ████████████████████ $0.5000  ← ¡MUY ALTO!

Acción:
  → Revisar el prompt
  → Limitar `max_completion_tokens`
  → Usar respuestas más concisas
  → Considerar formato JSON estructurado
```

### 2. Optimizar Uso de Modelos

```
Si GPT-5 tiene barras muy largas:
  GPT-5 Total: $0.5000
  GPT-5-mini Total: $0.1000

Pregunta:
  → ¿Realmente necesito GPT-5 para esta tarea?
  → ¿Puedo usar GPT-5-mini para análisis estándar?
```

### 3. Validar Eficiencia de RAG

```
Comparar:
  🗄️ Biblioteca: $0.01  (20 operaciones)
  🌍 Externa:     $0.50  (5 operaciones)

Conclusión:
  → RAG es 25x más eficiente por operación
  → Se usa 4x más frecuentemente
  → Sistema optimizado ✅
```

### 4. Detectar Anomalías

```
Si de repente ves:
  GPT-5-mini - Externa:
    Input:  ████████████████████████ $1.0000  ← ¡ANORMAL!
    Output: ██                       $0.0200

Posibles causas:
  → RAG no está devolviendo resultados (fallback a external)
  → Se están enviando documentos completos por error
  → Límite de contexto mal configurado
```

---

## 🎯 Beneficios de Esta Visualización

### 1. **Transparencia Total**
- ✅ Ver **exactamente** cuánto cuesta input vs output
- ✅ No más "promedios" que ocultan la realidad
- ✅ Datos precisos al céntimo de dólar

### 2. **Decisiones Informadas**
- ✅ **Qué modelo usar** para cada tarea
- ✅ **Cuándo optimizar** tokens de output
- ✅ **Si RAG está funcionando** correctamente

### 3. **Detección Temprana**
- ✅ Identificar **picos de coste** inmediatamente
- ✅ Detectar **configuraciones ineficientes**
- ✅ Prevenir **sobrecostes inesperados**

### 4. **Justificación de Costes**
- ✅ **Reportes claros** para administración
- ✅ **Evidencia visual** de optimizaciones
- ✅ **Desglose detallado** por tipo de operación

---

## 📈 Datos Mostrados

### Estructura del Gráfico

```
Para cada MODELO (GPT-5, GPT-5-mini):
  Para cada FUENTE (🗄️ Biblioteca, 🌍 Externa, 📊 Análisis):
    ├─ Barra INPUT (azul)
    │  └─ Coste en USD (4 decimales)
    ├─ Barra OUTPUT (naranja)
    │  └─ Coste en USD (4 decimales)
    └─ Total: $X.XXXX (N operaciones)
```

### Ejemplo Completo

```json
{
  "GPT-5": {
    "Biblioteca": {
      "input": "$0.0050 (████████)",
      "output": "$0.0200 (████████████████)",
      "total": "$0.0250 (10 ops)"
    },
    "Externa": {
      "input": "$0.0025 (████)",
      "output": "$0.0100 (████████)",
      "total": "$0.0125 (5 ops)"
    },
    "Análisis": {
      "input": "$0.0375 (████████████████████)",
      "output": "$0.0300 (██████████████)",
      "total": "$0.0675 (2 ops)"
    }
  },
  "GPT-5-mini": {
    "Biblioteca": {
      "input": "$0.0010 (██)",
      "output": "$0.0040 (████)",
      "total": "$0.0050 (15 ops)"
    },
    "Externa": {
      "input": "$0.0005 (█)",
      "output": "$0.0020 (██)",
      "total": "$0.0025 (8 ops)"
    },
    "Análisis": {
      "input": "$0.0125 (████████)",
      "output": "$0.0100 (█████)",
      "total": "$0.0225 (3 ops)"
    }
  }
}
```

---

## 🔧 Flujo de Datos Completo

### 1. Captura (AI API)

```
OpenAI Response:
{
  "usage": {
    "prompt_tokens": 25000,      // ← INPUT
    "completion_tokens": 3000,   // ← OUTPUT
    "total_tokens": 28000
  }
}
```

### 2. Registro (Backend)

```javascript
// aiService.js
const tokensInput = response.data.usage?.prompt_tokens || 0;
const tokensOutput = response.data.usage?.completion_tokens || 0;

// analysis.js
await logTokenUsage({
  tokensInput: 25000,
  tokensOutput: 3000,
  // ... otros campos
});
```

### 3. Almacenamiento (PostgreSQL)

```sql
INSERT INTO token_usage (
  ai_model, tokens_input, tokens_output, source_type, ...
) VALUES (
  'gpt-5-mini', 25000, 3000, 'analysis', ...
);
```

### 4. Agregación (Backend Service)

```javascript
// tokenStatsService.js
SELECT 
  ai_model,
  source_type,
  SUM(tokens_input) as total_tokens_input,
  SUM(tokens_output) as total_tokens_output
FROM token_usage
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY ai_model, source_type
```

### 5. Cálculo de Costes

```javascript
const inputCost = (total_tokens_input / 1000) * PRICES[model].input;
const outputCost = (total_tokens_output / 1000) * PRICES[model].output;

// GPT-5-mini: 25k input + 3k output
// input:  25000 / 1000 × $0.00025 = $0.00625
// output:  3000 / 1000 × $0.00200 = $0.00600
// total:                           $0.01225
```

### 6. API Response

```json
{
  "input_output_costs": [
    {
      "ai_model": "gpt-5-mini",
      "source_type": "analysis",
      "total_tokens_input": 25000,
      "total_tokens_output": 3000,
      "input_cost_usd": 0.00625,
      "output_cost_usd": 0.00600,
      "total_cost_usd": 0.01225,
      "operation_count": 1
    }
  ]
}
```

### 7. Visualización (Frontend)

```jsx
<div className="bg-blue-500" style={{ width: "52%" }}>  // Input más ancho
  $0.00625
</div>
<div className="bg-orange-500" style={{ width: "48%" }}>  // Output casi igual
  $0.00600
</div>
```

---

## 🧪 Testing y Verificación

### Test 1: Datos Aparecen

```bash
1. Hacer análisis de pliego con gpt-5-mini
2. Ir a Admin → Estadísticas Tokens
3. Scroll hasta "Costes de Entrada (Input) vs Salida (Output)"

✅ Debe aparecer:
   - GPT-5-mini
   - 📊 Análisis
   - 2 barras (input azul, output naranja)
   - Costes en USD
   - Total y número de operaciones
```

### Test 2: Valores Correctos

```bash
# Consultar BD directamente
docker exec -i dilus_postgres psql -U postgres -d dilus_ai -c "
  SELECT 
    ai_model,
    source_type,
    SUM(tokens_input) as input,
    SUM(tokens_output) as output
  FROM token_usage
  WHERE created_at >= NOW() - INTERVAL '30 days'
  GROUP BY ai_model, source_type
"

# Calcular manualmente:
# input_cost = (input / 1000) × precio_input
# output_cost = (output / 1000) × precio_output

✅ Los valores del gráfico deben coincidir con el cálculo manual
```

### Test 3: Proporciones Visuales

```bash
Si tengo:
  input_cost = $0.01
  output_cost = $0.08

✅ La barra de output debe ser 8x más larga que la de input
✅ Los valores deben mostrarse dentro de las barras
✅ El total debe ser $0.09
```

### Test 4: Responsive

```bash
1. Redimensionar ventana a móvil (< 1024px)
2. El gráfico debe cambiar a 1 columna
3. GPT-5 arriba, GPT-5-mini abajo

✅ Debe verse correctamente en ambos layouts
```

---

## 📊 Archivos Modificados

1. **backend/services/tokenStatsService.js**
   - ✅ Nueva función `getInputOutputCostsByModelAndSource()`
   - ✅ Agregada a exports

2. **backend/routes/stats.js**
   - ✅ Import de nueva función
   - ✅ Llamada en endpoint `/overview`
   - ✅ Incluida en respuesta JSON (`input_output_costs`)

3. **frontend/src/components/TokenStatsView.jsx**
   - ✅ Nueva sección de gráfico (líneas 301-453)
   - ✅ Renderizado de barras por modelo y fuente
   - ✅ Leyenda con colores

---

## 🎨 Diseño Visual

### Colores

- **Input (Entrada)**: Azul (`bg-blue-500`, `dark:bg-blue-600`)
- **Output (Salida)**: Naranja (`bg-orange-500`, `dark:bg-orange-600`)
- **Fondo barras**: Gris claro/oscuro según tema

### Iconos

- 🗄️ **Biblioteca** (Interno/RAG)
- 🌍 **Externa** (Consulta externa ChatGPT)
- 📊 **Análisis** (Procesamiento de documentos)

### Layout

```
┌─────────────────────────────────────────────────────────┐
│ Costes de Entrada (Input) vs Salida (Output)           │
├──────────────────────────┬──────────────────────────────┤
│ GPT-5                    │ GPT-5-mini                   │
│                          │                              │
│ 🗄️ Biblioteca            │ 🗄️ Biblioteca                │
│ Input  ███ $0.XX         │ Input  ███ $0.XX             │
│ Output ███ $0.XX         │ Output ███ $0.XX             │
│ Total: $0.XX (N ops)     │ Total: $0.XX (N ops)         │
│                          │                              │
│ 🌍 Externa               │ 🌍 Externa                   │
│ Input  ███ $0.XX         │ Input  ███ $0.XX             │
│ Output ███ $0.XX         │ Output ███ $0.XX             │
│ Total: $0.XX (N ops)     │ Total: $0.XX (N ops)         │
│                          │                              │
│ 📊 Análisis              │ 📊 Análisis                  │
│ Input  ███ $0.XX         │ Input  ███ $0.XX             │
│ Output ███ $0.XX         │ Output ███ $0.XX             │
│ Total: $0.XX (N ops)     │ Total: $0.XX (N ops)         │
└──────────────────────────┴──────────────────────────────┘
┌─────────────────────────────────────────────────────────┐
│ ● Input (Entrada)  ● Output (Salida)                    │
└─────────────────────────────────────────────────────────┘
```

---

**Fecha de implementación:** 6 de Noviembre, 2025  
**Estado:** ✅ Completado y funcional  
**Impacto:** Alto - Visibilidad total de costes input/output  

**¡Gráfico de barras implementado con separación completa de costes!** 🎉

