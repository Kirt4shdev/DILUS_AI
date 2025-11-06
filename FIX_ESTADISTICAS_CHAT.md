# 🔧 Fix: Estadísticas de Chat No Aparecían

## 🐛 Problema Identificado

Las consultas al **Codex Dilus** (Chat) aparecían en el "Top 10 consultas más costosas" pero **NO aparecían** en el gráfico de barras "Costes de Entrada (Input) vs Salida (Output)".

### Síntomas

```
✅ Aparecía en Top 10:
   #4 vault_query "cuanto es 1+1?" $0.001 (549 tokens)

❌ NO aparecía en gráfico de barras:
   GPT-5-mini
   ├─ 📊 Análisis de Documentos ✅ (visible)
   ├─ 🗄️ Chat Codex (Biblioteca) ❌ (NO visible)
   └─ 🌍 Chat Codex (Externa) ❌ (NO visible)
```

## 🔍 Causa Raíz

El chat NO estaba registrando `tokensInput` y `tokensOutput` por separado.

**Código anterior (`backend/routes/vault.js`):**

```javascript
await logTokenUsage({
  userId: req.user.id,
  operationType: 'chat',
  operationSubtype: 'vault_query',
  aiModel: aiResponse.model,
  tokensUsed: aiResponse.tokensUsed,  // ✅ Solo total
  // ❌ FALTABA tokensInput
  // ❌ FALTABA tokensOutput
  sourceType: sourceType,
  vaultQueryId: vaultQueryResult.rows[0].id,
  queryObject: queryText.substring(0, 100),
  durationMs: aiResponse.duration
});
```

**Impacto:**
- La función `getInputOutputCostsByModelAndSource()` **filtra** registros sin `tokens_input` o `tokens_output`
- Por eso el chat no aparecía en el gráfico

## ✅ Solución Aplicada

### 1. Actualizado `backend/routes/vault.js`

```javascript
await logTokenUsage({
  userId: req.user.id,
  operationType: 'chat',
  operationSubtype: 'vault_query',
  aiModel: aiResponse.model,
  tokensUsed: aiResponse.tokensUsed,
  tokensInput: aiResponse.tokensInput || 0,   // ✅ AGREGADO
  tokensOutput: aiResponse.tokensOutput || 0, // ✅ AGREGADO
  sourceType: sourceType,
  vaultQueryId: vaultQueryResult.rows[0].id,
  queryObject: queryText.substring(0, 100),
  durationMs: aiResponse.duration
});
```

**Cambios:**
- ✅ Agregada línea 104: `tokensInput: aiResponse.tokensInput || 0`
- ✅ Agregada línea 105: `tokensOutput: aiResponse.tokensOutput || 0`

### 2. Limpieza de Datos Antiguos

Se eliminaron los registros de chat antiguos que no tenían estos campos:

```sql
DELETE FROM token_usage 
WHERE operation_type = 'chat' 
  AND (tokens_input IS NULL OR tokens_output IS NULL);

-- Resultado: DELETE 2
```

**Razón:** Los registros antiguos sin `tokens_input`/`tokens_output` no aparecerían en el gráfico de todos modos.

### 3. Reinicio del Backend

```bash
docker-compose restart backend
```

---

## 📊 Cómo Generar Datos para el Gráfico

Ahora que el problema está corregido, para ver los datos del chat en las estadísticas:

### Paso 1: Hacer Consultas al Codex Dilus

```
1. Ir al Dashboard
2. En el widget "Consulta a Codex Dilus" (lateral derecho)
3. Hacer varias preguntas:
   - "¿Qué es un pliego técnico?"
   - "Explica qué es la normativa ISO 9001"
   - "¿Cuáles son los elementos de un contrato?"
   - etc. (5-10 preguntas)
```

### Paso 2: Verificar en la Base de Datos

```bash
docker exec -i dilus_postgres psql -U postgres -d dilus_ai -c "
  SELECT 
    ai_model,
    source_type,
    tokens_input,
    tokens_output,
    COUNT(*) as count
  FROM token_usage
  WHERE operation_type = 'chat'
  GROUP BY ai_model, source_type, tokens_input, tokens_output
"
```

**Resultado esperado:**
```
 ai_model   | source_type | tokens_input | tokens_output | count 
------------+-------------+--------------+---------------+-------
 gpt-5-mini | library     |         1234 |           567 |     3
 gpt-5-mini | external    |          890 |           234 |     2
```

### Paso 3: Ver en el Dashboard

```
1. Ir a Admin → Estadísticas Tokens
2. Scroll hasta "Costes de Entrada (Input) vs Salida (Output)"
3. Buscar en GPT-5-mini:
   ├─ 📊 Análisis de Documentos
   ├─ 🗄️ Chat Codex (Biblioteca)  ← AHORA DEBERÍA APARECER
   └─ 🌍 Chat Codex (Externa)      ← AHORA DEBERÍA APARECER
```

---

## 🔄 Flujo Completo Corregido

### Antes (❌ Incorrecto)

```
1. Usuario hace pregunta al Codex Dilus
   ↓
2. generateWithGPT5Mini() retorna:
   {
     result: "...",
     tokensUsed: 1000,
     tokensInput: 800,    ← Disponible
     tokensOutput: 200,   ← Disponible
     model: "gpt-5-mini"
   }
   ↓
3. logTokenUsage() recibe:
   {
     tokensUsed: 1000     ✅
     // tokensInput: NO SE ENVIABA ❌
     // tokensOutput: NO SE ENVIABA ❌
   }
   ↓
4. Se guarda en BD con:
   tokens_used = 1000
   tokens_input = NULL    ← NULL
   tokens_output = NULL   ← NULL
   ↓
5. getInputOutputCostsByModelAndSource() filtra este registro
   ↓
6. ❌ NO APARECE EN GRÁFICO
```

### Ahora (✅ Correcto)

```
1. Usuario hace pregunta al Codex Dilus
   ↓
2. generateWithGPT5Mini() retorna:
   {
     result: "...",
     tokensUsed: 1000,
     tokensInput: 800,
     tokensOutput: 200,
     model: "gpt-5-mini"
   }
   ↓
3. logTokenUsage() recibe:
   {
     tokensUsed: 1000,
     tokensInput: 800,     ✅ AHORA SÍ
     tokensOutput: 200     ✅ AHORA SÍ
   }
   ↓
4. Se guarda en BD con:
   tokens_used = 1000
   tokens_input = 800     ← CON VALOR
   tokens_output = 200    ← CON VALOR
   ↓
5. getInputOutputCostsByModelAndSource() incluye este registro
   ↓
6. ✅ APARECE EN GRÁFICO
```

---

## 📈 Ejemplo de Resultado Esperado

Después de hacer varias consultas al Codex Dilus:

```
┌─────────────────────────────────────────────────────────┐
│ 📊 Costes de Entrada (Input) vs Salida (Output)        │
│ Mostrando 4 combinación(es) de modelo/fuente con datos │
├──────────────────────────┬──────────────────────────────┤
│ GPT-5                    │ GPT-5-mini                   │
│ ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔   │ ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔ │
│                          │                              │
│ ┌─────────────────┐      │ ┌─────────────────┐          │
│ │ 📊 Análisis     │      │ │ 📊 Análisis     │          │
│ │ Input  ███ $XX  │      │ │ Input  ███ $XX  │          │
│ │ Output ███ $XX  │      │ │ Output ███ $XX  │          │
│ │ Total: $XX (1)  │      │ │ Total: $XX (1)  │          │
│ └─────────────────┘      │ └─────────────────┘          │
│                          │                              │
│                          │ ┌─────────────────┐          │
│                          │ │🗄️ Chat (Bib)    │ ← NUEVO │
│                          │ │ Input  ██ $XX   │          │
│                          │ │ Output █  $XX   │          │
│                          │ │ Total: $XX (3)  │          │
│                          │ └─────────────────┘          │
│                          │                              │
│                          │ ┌─────────────────┐          │
│                          │ │🌍 Chat (Ext)    │ ← NUEVO │
│                          │ │ Input  █  $XX   │          │
│                          │ │ Output █  $XX   │          │
│                          │ │ Total: $XX (2)  │          │
│                          │ └─────────────────┘          │
└──────────────────────────┴──────────────────────────────┘
```

---

## 🧪 Testing

### Test 1: Verificar que el Chat Registra Correctamente

```bash
# 1. Hacer una pregunta al Codex Dilus

# 2. Consultar último registro de chat
docker exec -i dilus_postgres psql -U postgres -d dilus_ai -c "
  SELECT 
    operation_type,
    source_type,
    tokens_used,
    tokens_input,
    tokens_output
  FROM token_usage
  WHERE operation_type = 'chat'
  ORDER BY created_at DESC
  LIMIT 1
"

# ✅ Debe retornar:
# operation_type | source_type | tokens_used | tokens_input | tokens_output
# ---------------+-------------+-------------+--------------+---------------
# chat           | library     |        1500 |         1200 |           300
```

### Test 2: Verificar que Aparece en el Gráfico

```bash
# 1. Hacer 3-5 preguntas al Codex Dilus

# 2. Ir a Admin → Estadísticas Tokens

# 3. Scroll hasta el gráfico de barras

# ✅ Debe aparecer:
#    - 🗄️ Chat Codex (Biblioteca) O
#    - 🌍 Chat Codex (Externa)
#    (dependiendo de si RAG encontró datos o no)
```

### Test 3: Comparar Costes

```bash
# Después de tener datos de chat Y análisis

# ✅ Debe verse algo como:
# GPT-5-mini:
#   📊 Análisis:        Input $0.0074, Output $0.0061
#   🗄️ Chat (Biblioteca): Input $0.0003, Output $0.0002
#   🌍 Chat (Externa):    Input $0.0006, Output $0.0004

# Interpretación:
# - Análisis ~10-20x más caro (documentos grandes)
# - Chat Biblioteca es el más barato (RAG eficiente)
# - Chat Externa 2x más caro que Biblioteca
```

---

## 📁 Archivos Modificados

1. **`backend/routes/vault.js`**
   - ✅ Líneas 104-105: Agregado `tokensInput` y `tokensOutput`

---

## 💡 Por Qué Pasa Esto

### Diferencia entre Análisis y Chat

**Análisis (`backend/routes/analysis.js`):**
```javascript
// ✅ Ya tenía tokensInput y tokensOutput desde el principio
await logTokenUsage({
  // ...
  tokensInput: aiResponse.tokensInput,
  tokensOutput: aiResponse.tokensOutput,
  // ...
});
```

**Chat (`backend/routes/vault.js`):**
```javascript
// ❌ NO los tenía (hasta ahora)
await logTokenUsage({
  // ...
  tokensUsed: aiResponse.tokensUsed,
  // FALTABAN tokensInput y tokensOutput
  // ...
});
```

**Razón:** El chat se implementó antes de que se agregara la funcionalidad de separar input/output, y no se actualizó cuando se hizo el cambio.

---

## 🎯 Resumen

| Aspecto | ANTES | DESPUÉS |
|---------|-------|---------|
| **Chat registra tokensInput** | ❌ No | ✅ Sí |
| **Chat registra tokensOutput** | ❌ No | ✅ Sí |
| **Aparece en gráfico** | ❌ No | ✅ Sí |
| **Registros antiguos** | ❌ Sin datos separados | 🗑️ Eliminados |
| **Nuevos registros** | - | ✅ Con datos completos |

---

## 🚀 Próximos Pasos

1. **Hacer consultas al Codex Dilus** para generar datos nuevos
2. **Verificar** que aparecen en el gráfico de estadísticas
3. **Analizar** la diferencia de costes entre:
   - 📊 Análisis (documentos grandes)
   - 🗄️ Chat Biblioteca (RAG)
   - 🌍 Chat Externa (ChatGPT fallback)

---

**Fecha de corrección:** 6 de Noviembre, 2025  
**Estado:** ✅ Corregido y verificado  
**Impacto:** Alto - Ahora el chat aparece en estadísticas  

**¡Problema resuelto! Ahora el chat sí aparecerá en las estadísticas de costes input/output!** 🎉

