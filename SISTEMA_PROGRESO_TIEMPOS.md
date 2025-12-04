# ⏱️ ANÁLISIS DE TIEMPOS - Sistema de Progreso Detallado

## ✅ IMPLEMENTADO

Se ha añadido un sistema completo de medición y visualización de tiempos para cada paso del proceso de consulta al Codex Dilus.

---

## 🎯 Mejoras Implementadas

### 1. **Progreso Visual Paso a Paso**

Ahora el usuario ve cada paso en tiempo real con:
- ✅ **Contador visual** (1/6, 2/6, etc.)
- ✅ **Estado de cada paso** (pendiente, activo, completado)
- ✅ **Tiempo exacto** de cada operación
- ✅ **Indicador visual** (spinner, checkmark, número)

**Pasos mostrados:**
1. 🔍 Analizando consulta...
2. 🎯 Detectando equipos (fuzzy match)...
3. 🔎 Buscando en Codex (Vector + BM25)...
4. 📦 Preparando contexto...
5. 🤖 Generando respuesta con GPT-5-mini...
6. 💾 Guardando estadísticas...

### 2. **Medición Precisa de Tiempos en Backend**

**Archivo:** `backend/routes/vault.js`

El backend ahora mide y devuelve:

```javascript
{
  config: 5,              // ms cargando configuración
  ragSearch: 1234,        // ms búsqueda RAG (Vector + BM25 + Fuzzy)
  contextPrep: 89,        // ms preparando contexto
  messageConstruction: 12, // ms construyendo mensajes
  aiGeneration: 3456,     // ms generando respuesta IA
  dbSave: 45,            // ms guardando en BD
  tokenStats: 23,        // ms registrando stats
  total: 4864            // ms total
}
```

### 3. **Análisis de Rendimiento Automático**

El backend calcula automáticamente los porcentajes:

```javascript
{
  ragSearch: "25.4%",
  aiGeneration: "71.0%",
  other: "3.6%"
}
```

Esto permite identificar cuellos de botella.

---

## 📊 Visualización en Frontend

### Durante la Consulta

```
┌─────────────────────────────────────┐
│ ● 1. Analizando consulta...      ✓ │ 0.3s
│ ● 2. Detectando equipos...       ✓ │ 0.2s
│ ⟳ 3. Buscando en Codex...         │
│ ○ 4. Preparando contexto...        │
│ ○ 5. Generando respuesta...        │
│ ○ 6. Guardando estadísticas...     │
└─────────────────────────────────────┘
```

### Después de la Respuesta

Se muestra una tarjeta con desglose de tiempos:

```
┌──────────────────────────────────────┐
│ ⏱️ Tiempos de Procesamiento         │
├──────────────────────────────────────┤
│ Búsqueda RAG:      1.23s             │
│ Generación IA:     3.45s             │
├──────────────────────────────────────┤
│ Total:             4.86s             │
└──────────────────────────────────────┘
```

---

## 🔍 Análisis de Rendimiento

### Tiempos Típicos Esperados

| Operación | Tiempo Normal | Si Tarda Mucho | Causa Probable |
|-----------|---------------|----------------|----------------|
| Config | <50ms | >200ms | BD lenta |
| RAG Search | 200-800ms | >2s | Muchos embeddings o índices faltantes |
| Context Prep | 50-200ms | >500ms | Chunks muy grandes |
| Message Const | <50ms | >100ms | Historial muy largo |
| AI Generation | 2-8s | >15s | Query compleja o respuesta larga |
| DB Save | 20-100ms | >500ms | BD lenta |
| Token Stats | 20-100ms | >500ms | BD lenta |

### Identificar Cuellos de Botella

**Ejemplo 1: RAG Search lento (>2s)**
```
Causa: Índice pgvector no optimizado
Solución: 
  - Aplicar sql/09_metadata_optimization.sql
  - Verificar tamaño de embeddings table
  - Aumentar lists en índice ivfflat
```

**Ejemplo 2: AI Generation muy lento (>15s)**
```
Causa: Contexto demasiado grande
Solución:
  - Reducir top_k (de 5 a 3)
  - Chunks más pequeños
  - Verificar que no se envíe historial duplicado
```

**Ejemplo 3: Todo lento en general**
```
Causa: Recursos del servidor
Solución:
  - Verificar CPU/RAM de contenedores
  - Escalar servicios
  - Optimizar BD
```

---

## 📝 Logs en Backend

Los logs ahora incluyen un desglose completo:

```
Query timing breakdown: {
  config: 5,
  ragSearch: 1234,
  contextPrep: 89,
  messageConstruction: 12,
  aiGeneration: 3456,
  dbSave: 45,
  tokenStats: 23,
  total: 4864,
  percentages: {
    ragSearch: "25.4%",
    aiGeneration: "71.0%",
    other: "3.6%"
  }
}
```

---

## 🧪 Testing

### Ver Tiempos en Acción

1. Haz una consulta en Vault Chat
2. Observa los pasos con tiempos
3. Revisa la tarjeta de tiempos en la respuesta
4. Compara con logs del backend:

```bash
docker logs dilus_backend --tail 50 | Select-String -Pattern "timing"
```

### Comparar Consultas

**Consulta simple:**
```
Query: "¿Qué es Modbus?"
Esperado: 3-5s total (sin filtrado, contexto pequeño)
```

**Consulta con filtrado:**
```
Query: "registros modbus del razon+"
Esperado: 2-4s total (filtrado reduce búsqueda)
```

**Consulta compleja:**
```
Query: "Explica todos los registros Modbus del RaZON+ con ejemplos"
Esperado: 6-10s total (respuesta larga)
```

---

## 📊 Datos que Obtienes

### En UI
- ✅ Progreso visual en tiempo real
- ✅ Tiempo de cada paso
- ✅ Tiempo total
- ✅ Desglose RAG vs IA

### En Logs
- ✅ Timing de cada operación
- ✅ Porcentajes de tiempo
- ✅ Chunks encontrados
- ✅ Equipos detectados
- ✅ Tokens usados

---

## 🎯 Casos de Uso

### 1. Debugging de Lentitud

Si una consulta tarda 15 segundos:
1. Mira los tiempos en la respuesta
2. Identifica el paso más lento
3. Revisa logs del backend
4. Aplica optimización específica

### 2. Optimización del Sistema

Compara tiempos antes/después de:
- Aplicar índices SQL
- Reducir top_k
- Cambiar chunk_size
- Optimizar Docker

### 3. Monitoreo de Performance

Revisa logs periódicamente:
```bash
# Ver tiempos promedio
docker logs dilus_backend | Select-String -Pattern "timing breakdown" | Select-Object -Last 10
```

---

## ✅ Mejoras Futuras Opcionales

1. **Dashboard de tiempos**: Gráficos históricos
2. **Alertas**: Si un paso tarda >5s
3. **Caché**: Guardar resultados de búsquedas repetidas
4. **Streaming**: Mostrar respuesta mientras se genera

---

## 🚀 PRUÉBALO AHORA

1. **Refresca el navegador**
2. Abre **Vault Chat**
3. Haz una consulta: "registros modbus del razon+"
4. **Observa:**
   - Progreso paso a paso con tiempos
   - Tarjeta de tiempos al final
   - Logs del backend con breakdown

**¡Ahora sabrás exactamente dónde está el cuello de botella!** 🎯

---

*Implementado: 2025-12-04*  
*Versión: 2.1.0*

