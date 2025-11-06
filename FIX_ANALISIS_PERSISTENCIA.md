# 🔧 Fix: Persistencia y Visualización de Análisis

**Fecha:** 6 de noviembre de 2025

---

## 🐛 Problema Reportado

Al actualizar la página, **el análisis realizado no se cargaba**, dando la impresión de que no se estaban guardando los análisis en la base de datos.

**Requerimiento adicional:**
- Mostrar **solo el último análisis** al cargar
- Indicar claramente si es **IA Normal** (GPT-5 Mini) o **IA Avanzada** (GPT-5 Standard)

---

## 🔍 Diagnóstico

### ✅ Backend: Guardado funcionaba correctamente

El backend **SÍ estaba guardando** los análisis en la tabla `analysis_results` de PostgreSQL correctamente:

```javascript
// backend/routes/analysis.js - líneas 125-130
const saveResult = await query(
  `INSERT INTO analysis_results (project_id, user_id, analysis_type, input_document_ids, 
   result_data, ai_model_used, tokens_used, duration_ms)
   VALUES ($1, $2, 'pliego_tecnico', $3, $4, $5, $6, $7)
   RETURNING *`,
  [projectId, req.user.id, document_ids, JSON.stringify(resultData), 
   aiResponse.model, aiResponse.tokensUsed, aiResponse.duration]
);
```

### ❌ Frontend: Problema en la carga del historial

El problema estaba en el frontend (`ProjectView.jsx`):

**Problema 1: Desajuste en nombres de tipos**
- Base de datos guardaba: `pliego_tecnico`
- Frontend buscaba en tab: `pliego`
- **No coincidían** → no se cargaba el análisis

**Problema 2: No se guardaban los metadatos**
- El frontend no guardaba información sobre qué modelo se usó (normal o avanzado)
- No se persistía duración, tokens, etc.

**Problema 3: No se recargaba al cambiar de tab**
- Solo cargaba en el `useEffect` inicial
- Al cambiar de tab no actualizaba el resultado

---

## ✅ Solución Implementada

### 1. **Mapeo de tipos de análisis**

Agregué un mapeo explícito de tipos de BD a tabs del frontend:

```javascript
// frontend/src/pages/ProjectView.jsx
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
```

### 2. **Estado de metadatos del resultado**

Agregué un nuevo estado para guardar metadatos del análisis:

```javascript
const [resultMetadata, setResultMetadata] = useState(null);
```

Incluye:
- `model`: Modelo usado (gpt-5-mini o gpt-5)
- `tokens_used`: Tokens consumidos
- `duration`: Duración en ms
- `created_at`: Fecha de creación

### 3. **Carga automática del último análisis**

Al cargar el historial, ahora carga automáticamente el análisis más reciente del tab actual:

```javascript
// Cargar el resultado más reciente del tab actual al cargar la página
if (history[activeTab] && history[activeTab].length > 0) {
  const latestAnalysis = history[activeTab][0];
  setResult(latestAnalysis.result_data);
  setResultMetadata({
    model: latestAnalysis.ai_model_used,
    tokens_used: latestAnalysis.tokens_used,
    duration: latestAnalysis.duration_ms,
    created_at: latestAnalysis.created_at
  });
}
```

### 4. **Recarga al cambiar de tab**

Agregué un `useEffect` que detecta cambios de tab y carga el análisis correspondiente:

```javascript
// Recargar análisis al cambiar de tab
useEffect(() => {
  if (analysisHistory[activeTab] && analysisHistory[activeTab].length > 0) {
    const latestAnalysis = analysisHistory[activeTab][0];
    setResult(latestAnalysis.result_data);
    setResultMetadata({
      model: latestAnalysis.ai_model_used,
      tokens_used: latestAnalysis.tokens_used,
      duration: latestAnalysis.duration_ms,
      created_at: latestAnalysis.created_at
    });
  } else {
    setResult(null);
    setResultMetadata(null);
  }
}, [activeTab, analysisHistory]);
```

### 5. **Visualización mejorada del resultado**

Ahora el resultado muestra claramente:

```jsx
<div className="flex items-center justify-between mb-4">
  <h4 className="font-semibold text-gray-900 dark:text-gray-100">
    Resultado del análisis
  </h4>
  {resultMetadata && (
    <div className="flex items-center gap-3 text-xs">
      <span className={`px-2 py-1 rounded-full font-medium ${
        resultMetadata.model === 'gpt-5' 
          ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' 
          : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
      }`}>
        {resultMetadata.model === 'gpt-5' ? '⭐ IA Avanzada' : '✨ IA Normal'}
      </span>
      <span className="text-gray-500 dark:text-gray-400">
        {Math.round(resultMetadata.duration / 1000)}s
      </span>
      <span className="text-gray-500 dark:text-gray-400">
        {resultMetadata.tokens_used?.toLocaleString()} tokens
      </span>
    </div>
  )}
</div>
```

**Resultado visual:**
- **⭐ IA Avanzada** (morado) para GPT-5 Standard
- **✨ IA Normal** (azul) para GPT-5 Mini
- Duración en segundos
- Tokens usados formateados

### 6. **Actualización de metadatos al hacer nuevo análisis**

Modificado `handleAnalyze` para guardar metadatos al completar:

```javascript
setResult(response.data.result);
setResultMetadata(response.data.metadata);  // ← NUEVO
setSuccess('Análisis completado exitosamente');
```

### 7. **Historial de análisis actualizado**

Los botones del historial ahora también actualizan los metadatos:

```javascript
<button
  onClick={() => {
    setResult(analysis.result_data);
    setResultMetadata({
      model: analysis.ai_model_used,
      tokens_used: analysis.tokens_used,
      duration: analysis.duration_ms,
      created_at: analysis.created_at
    });
  }}
>
  {idx === 0 ? '🆕 ' : ''}
  {new Date(analysis.created_at).toLocaleString('es-ES', {...})}
  <span className="ml-1 text-gray-500">
    ({analysis.ai_model_used === 'gpt-5' ? '⭐' : '✨'})
  </span>
</button>
```

---

## 📊 Tipos de Análisis y su Guardado

| Tipo de análisis | Guardado en BD como | Tab del frontend | Mapeo necesario |
|------------------|---------------------|------------------|-----------------|
| Análisis de pliego | `pliego_tecnico` | `pliego` | ✅ Sí |
| Análisis de contrato | `contrato` | `contrato` | ❌ No |
| Generación de oferta | `oferta` | `oferta` | ❌ No |
| Generación de docs | `documentacion` | `documentacion` | ❌ No |

---

## 🎯 Resultado Final

### ✅ Ahora funciona correctamente:

1. **Al hacer un análisis:**
   - ✅ Se guarda en la base de datos
   - ✅ Se muestra inmediatamente con badge "⭐ IA Avanzada" o "✨ IA Normal"
   - ✅ Muestra duración y tokens

2. **Al actualizar la página:**
   - ✅ Se carga automáticamente el último análisis del tab actual
   - ✅ Se mantiene visible con toda su información

3. **Al cambiar de tab:**
   - ✅ Se carga automáticamente el último análisis de ese tab
   - ✅ Si no hay análisis en ese tab, se limpia el resultado

4. **En el historial:**
   - ✅ Se ven todos los análisis previos con fecha
   - ✅ Se indica con emoji si es normal (✨) o avanzado (⭐)
   - ✅ El más reciente tiene badge "🆕"
   - ✅ Al hacer clic se carga ese análisis específico

---

## 🧪 Cómo Verificar

1. **Hacer un análisis nuevo:**
   ```
   - Seleccionar documentos
   - Clic en "Analizar con IA" (IA Normal)
   - Ver que aparece "✨ IA Normal" con duración y tokens
   ```

2. **Repetir con IA Mejorada:**
   ```
   - Clic en "🔄 Repetir con IA Mejorada"
   - Ver que aparece "⭐ IA Avanzada"
   ```

3. **Actualizar la página (F5):**
   ```
   - El análisis más reciente debe seguir visible
   - Debe mostrar el badge correcto
   ```

4. **Cambiar de tab:**
   ```
   - Ir a otro tab (ej: Contrato)
   - Si hay análisis previo, se carga automáticamente
   - Volver al tab anterior, se recarga el análisis
   ```

5. **Verificar historial:**
   ```
   - Ver la lista de análisis anteriores
   - Hacer clic en uno antiguo
   - Debe cargarse correctamente
   ```

---

## 📋 Archivos Modificados

### `frontend/src/pages/ProjectView.jsx`

**Cambios realizados:**
- ✅ Agregado estado `resultMetadata`
- ✅ Agregado mapping de tipos `pliego_tecnico` → `pliego`
- ✅ Modificada función `loadAnalysisHistory()` para mapear y cargar último análisis
- ✅ Agregado `useEffect` para recargar al cambiar de tab
- ✅ Modificada función `handleAnalyze()` para guardar metadatos
- ✅ Mejorada visualización del resultado con badges
- ✅ Actualizados botones del historial para cargar metadatos

**Líneas afectadas:** ~100 líneas de cambios

---

## 🚀 Estado Actual

**✅ TODO FUNCIONANDO CORRECTAMENTE**

- ✅ Los análisis se guardan en la BD (siempre funcionó)
- ✅ Los análisis se cargan al actualizar la página (ARREGLADO)
- ✅ Se muestra si es IA Normal o IA Avanzada (IMPLEMENTADO)
- ✅ Se muestra solo el último análisis (IMPLEMENTADO)
- ✅ Se puede navegar por el historial (FUNCIONAL)
- ✅ Los metadatos se persisten y muestran (IMPLEMENTADO)

---

**¡Problema resuelto!** 🎉

