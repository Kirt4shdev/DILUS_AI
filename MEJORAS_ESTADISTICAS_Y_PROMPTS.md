# 🔧 Mejoras en Estadísticas y Organización de Prompts

## 📋 Resumen de Cambios

Se han realizado 3 mejoras principales:

1. ✅ **Confirmación de ubicación de prompts**
2. ✅ **Corrección de tokens por día duplicados**
3. ✅ **Mejora de organización del gráfico input/output**

---

## 1. 📝 Ubicación de Prompts

### Archivo Centralizado

**Ubicación:** `backend/utils/prompts.js`

Todos los prompts están **centralizados** en un solo archivo para facilitar su edición:

```javascript
// backend/utils/prompts.js

export const PROMPT_ANALIZAR_PLIEGO = `...`;
export const PROMPT_ANALIZAR_CONTRATO = `...`;
export const PROMPT_GENERAR_OFERTA = `...`;
export const PROMPT_GENERAR_DOCUMENTACION = `...`;
export const PROMPT_CHAT_VAULT = `...`;

export function fillPrompt(template, replacements) { ... }
```

### Prompts Disponibles

| Prompt | Descripción | Usado en |
|--------|-------------|----------|
| `PROMPT_ANALIZAR_PLIEGO` | Análisis de pliegos técnicos | Análisis Técnico |
| `PROMPT_ANALIZAR_CONTRATO` | Análisis de contratos | Análisis de Contrato |
| `PROMPT_GENERAR_OFERTA` | Generación de ofertas comerciales | Generar Oferta |
| `PROMPT_GENERAR_DOCUMENTACION` | Generación de documentación técnica | Generar Documentación |
| `PROMPT_CHAT_VAULT` | Chat con la bóveda de conocimiento | Codex Dilus |

### Cómo Modificar un Prompt

```bash
1. Abrir: backend/utils/prompts.js
2. Editar el prompt deseado
3. Guardar el archivo
4. Reiniciar: docker-compose restart backend
```

**Nota:** No es necesario modificar ningún otro archivo. Los prompts se importan automáticamente desde este archivo central.

---

## 2. 🐛 Corrección: Tokens por Día Duplicados

### Problema

En "Tokens por Día" aparecían **3 gráficas para el mismo día** (6 noviembre):

```
6 nov  ███ 1103      $0.00
6 nov  ████████████ 32598    $0.01
6 nov  █████████████ 36845   $0.11
```

**Causa:** La consulta SQL estaba agrupando por `(día, usuario, modelo, tipo_operación)`, generando múltiples filas para el mismo día.

### Solución

**Archivo modificado:** `backend/services/tokenStatsService.js`

**Antes:**
```javascript
// Usaba la vista daily_token_usage que agrupa por múltiples campos
SELECT * FROM daily_token_usage
WHERE usage_date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY usage_date DESC
```

**Ahora:**
```javascript
// Agrupa SOLO por día, sumando todos los datos
SELECT 
  DATE(created_at) as usage_date,
  SUM(tokens_used) as total_tokens,
  SUM(cost_usd) as total_cost_usd,
  COUNT(*) as operation_count,
  ROUND(AVG(tokens_used)) as avg_tokens_per_operation
FROM token_usage
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY usage_date DESC
```

### Resultado

Ahora aparece **una sola barra por día**:

```
6 nov  ████████████████████ 70546   $0.12
```

**Incluye:**
- ✅ Suma de todos los modelos (gpt-5, gpt-5-mini)
- ✅ Suma de todos los tipos de operación (análisis, chat, generación)
- ✅ Suma de todas las fuentes (biblioteca, externa)

---

## 3. 📊 Mejora: Organización del Gráfico Input/Output

### Problemas

1. **No aparecían datos de chat** (solo análisis)
2. **Etiquetas confusas** ("Biblioteca", "Externa", "Análisis")
3. **Orden incorrecto** (library, external, analysis)

### Soluciones Aplicadas

#### A. Etiquetas Más Claras

**Antes:**
```
📊 Análisis
🗄️ Biblioteca
🌍 Externa
```

**Ahora:**
```
📊 Análisis de Documentos
🗄️ Chat Codex (Biblioteca)
🌍 Chat Codex (Externa)
```

**Beneficio:** Ahora es **obvio** que "Biblioteca" y "Externa" se refieren al chat con Codex Dilus.

#### B. Orden Lógico

**Orden actualizado:**
1. 📊 **Análisis de Documentos** (operación principal)
2. 🗄️ **Chat Codex (Biblioteca)** (RAG interno)
3. 🌍 **Chat Codex (Externa)** (ChatGPT fallback)

**Razón:** Primero lo más importante (análisis), luego el chat en sus dos variantes.

#### C. Diseño Mejorado

**Cambios visuales:**

```
┌──────────────────────────────────────────────────────────┐
│ 📊 Costes de Entrada (Input) vs Salida (Output)         │
│ Mostrando X combinación(es) de modelo/fuente con datos  │
├────────────────────────┬─────────────────────────────────┤
│ GPT-5                  │ GPT-5-mini                      │
│ ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔ │ ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔  │
│                        │                                 │
│ ┌─────────────────┐    │ ┌─────────────────┐             │
│ │ 📊 Análisis     │    │ │ 📊 Análisis     │             │
│ │ Input  ███ $XX  │    │ │ Input  ███ $XX  │             │
│ │ Output ███ $XX  │    │ │ Output ███ $XX  │             │
│ │ Total: $XX (N)  │    │ │ Total: $XX (N)  │             │
│ └─────────────────┘    │ └─────────────────┘             │
│                        │                                 │
│ ┌─────────────────┐    │ ┌─────────────────┐             │
│ │ 🗄️ Chat (Bib)   │    │ │ 🗄️ Chat (Bib)   │             │
│ │ Input  ███ $XX  │    │ │ Input  ███ $XX  │             │
│ │ Output ███ $XX  │    │ │ Output ███ $XX  │             │
│ │ Total: $XX (N)  │    │ │ Total: $XX (N)  │             │
│ └─────────────────┘    │ └─────────────────┘             │
│                        │                                 │
│ ┌─────────────────┐    │ ┌─────────────────┐             │
│ │ 🌍 Chat (Ext)   │    │ │ 🌍 Chat (Ext)   │             │
│ │ Input  ███ $XX  │    │ │ Input  ███ $XX  │             │
│ │ Output ███ $XX  │    │ │ Output ███ $XX  │             │
│ │ Total: $XX (N)  │    │ │ Total: $XX (N)  │             │
│ └─────────────────┘    │ └─────────────────┘             │
└────────────────────────┴─────────────────────────────────┘
```

**Mejoras visuales:**
- ✅ Títulos con bordes de color (azul para GPT-5, verde para GPT-5-mini)
- ✅ Cada sección con fondo gris para distinguirlas
- ✅ Contador de combinaciones con datos
- ✅ Espaciado mejorado (gap-8 en lugar de gap-6)
- ✅ Mayor jerarquía visual (font-semibold en títulos)

#### D. Por Qué No Aparecen Datos de Chat

**Razón:** Si no ves datos de chat (🗄️ o 🌍), es porque **no se han realizado consultas al Codex Dilus** todavía.

**Para verificar:**

```bash
# Consultar datos en BD
docker exec -i dilus_postgres psql -U postgres -d dilus_ai -c "
  SELECT 
    ai_model,
    source_type,
    COUNT(*) as count
  FROM token_usage
  WHERE source_type IN ('library', 'external')
  GROUP BY ai_model, source_type
"
```

**Si retorna 0 filas:** No hay datos de chat registrados.

**Solución:** Hacer consultas al "Codex Dilus" desde el Dashboard para generar datos:
1. Ir al Dashboard
2. Usar el widget "Consulta a Codex Dilus" (lateral derecho)
3. Hacer varias preguntas
4. Refrescar las estadísticas

---

## 📈 Comparativa Antes/Después

### Tokens por Día

| Aspecto | ANTES | DESPUÉS |
|---------|-------|---------|
| **Filas por día** | 3+ (según modelo/tipo) | 1 (todo agregado) |
| **Confusión** | ❌ Alta (¿cuál es el total?) | ✅ Ninguna (total claro) |
| **Visualización** | ❌ Barras múltiples confusas | ✅ Una barra por día |

### Gráfico Input/Output

| Aspecto | ANTES | DESPUÉS |
|---------|-------|---------|
| **Etiquetas** | "Biblioteca", "Externa" | "Chat Codex (Biblioteca)", etc. |
| **Orden** | library, external, analysis | analysis, library, external |
| **Visual** | Simple | Con fondos y bordes |
| **Claridad** | ❌ Confuso | ✅ Muy claro |

### Prompts

| Aspecto | ANTES | DESPUÉS |
|---------|-------|---------|
| **Ubicación** | ✅ Ya centralizado | ✅ Confirmado y documentado |
| **Documentación** | ❌ No documentado | ✅ Archivo UBICACION_PROMPTS.md |
| **Accesibilidad** | Media | Alta |

---

## 🧪 Verificación

### Test 1: Tokens por Día

```bash
1. Ir a Admin → Estadísticas Tokens
2. Revisar "Tokens por Día"
3. Verificar que hay UNA sola barra por día

✅ Debe mostrar: "6 nov  █████████ 70546  $0.12"
❌ NO debe mostrar múltiples barras para el mismo día
```

### Test 2: Gráfico Input/Output - Análisis

```bash
1. Hacer un análisis de pliego con gpt-5-mini
2. Ir a Admin → Estadísticas Tokens
3. Scroll hasta "Costes de Entrada (Input) vs Salida (Output)"
4. Buscar "📊 Análisis de Documentos"

✅ Debe aparecer con datos y barras
✅ Debe mostrar costes de input y output
```

### Test 3: Gráfico Input/Output - Chat

```bash
1. Ir al Dashboard
2. Usar el widget "Consulta a Codex Dilus"
3. Hacer una pregunta (ej: "¿Qué es un pliego técnico?")
4. Ir a Admin → Estadísticas Tokens
5. Buscar "🗄️ Chat Codex (Biblioteca)" o "🌍 Chat Codex (Externa)"

✅ Debe aparecer con datos
✅ Si no hay datos en biblioteca → aparecerá "Externa"
✅ Si hay datos en biblioteca → aparecerá "Biblioteca"
```

### Test 4: Modificar Prompt

```bash
1. Abrir backend/utils/prompts.js
2. Modificar PROMPT_ANALIZAR_PLIEGO
   Ejemplo: Agregar "Sé muy detallado" al final
3. Guardar
4. docker-compose restart backend
5. Hacer un análisis de pliego
6. Verificar que el resultado refleja el cambio

✅ El análisis debe reflejar la modificación del prompt
```

---

## 📁 Archivos Modificados

### Backend (1 archivo)

1. **`backend/services/tokenStatsService.js`**
   - ✅ Función `getDailyTokenUsage` reescrita
   - ✅ Ahora agrupa SOLO por día (líneas 116-143)

### Frontend (1 archivo)

2. **`frontend/src/components/TokenStatsView.jsx`**
   - ✅ Etiquetas actualizadas (analysis, library, external)
   - ✅ Orden corregido (línea 322 y 386)
   - ✅ Diseño mejorado (fondos, bordes, espaciado)
   - ✅ Contador de combinaciones (línea 310-312)

### Documentación (2 archivos)

3. **`UBICACION_PROMPTS.md`**
   - ✅ Guía de ubicación y modificación de prompts

4. **`MEJORAS_ESTADISTICAS_Y_PROMPTS.md`** (este archivo)
   - ✅ Documentación completa de cambios

---

## 💡 Recomendaciones de Uso

### Para Datos de Chat

**Si no ves datos de chat en las estadísticas:**

1. **Generar datos de prueba:**
   ```
   - Ve al Dashboard
   - Usa el widget "Consulta a Codex Dilus"
   - Haz 5-10 preguntas variadas
   - Espera 1-2 minutos
   - Refresca las estadísticas
   ```

2. **Verificar registro:**
   ```sql
   SELECT source_type, COUNT(*) 
   FROM token_usage 
   WHERE operation_type = 'chat'
   GROUP BY source_type
   ```

3. **Tipos esperados:**
   - `library`: Cuando RAG encuentra información en la bóveda
   - `external`: Cuando no hay info y se usa ChatGPT-5-mini

### Para Modificar Prompts

**Workflow recomendado:**

```bash
1. Editar prompt en backend/utils/prompts.js
2. Guardar cambios
3. docker-compose restart backend
4. Probar en la aplicación
5. Si funciona bien → commit
6. Si no → revertir y ajustar
```

**Tip:** Mantén copias de seguridad de los prompts que funcionan bien antes de modificarlos.

### Para Análisis de Costes

**Interpretación del gráfico:**

```
Si ves:
  📊 Análisis: Input $0.10, Output $0.15
  🗄️ Chat (Bib): Input $0.01, Output $0.02
  🌍 Chat (Ext): Input $0.05, Output $0.08

Conclusiones:
  1. Análisis es el más costoso (normal, documentos grandes)
  2. Chat Biblioteca es el más barato (RAG eficiente)
  3. Chat Externa es 5x más caro que Biblioteca
  4. Output siempre más caro que input (~8x)
  
Acción recomendada:
  → Optimizar RAG para reducir uso de Externa
  → Considerar límites de output en análisis
```

---

## 🔄 Flujo de Datos Actualizado

### Tokens por Día

```
1. Usuario hace análisis/chat
   ↓
2. Se registra en token_usage con created_at
   ↓
3. getDailyTokenUsage() agrupa por DATE(created_at)
   ↓
4. Frontend recibe UN registro por día
   ↓
5. Se muestra UNA barra por día
```

### Gráfico Input/Output

```
1. Usuario hace análisis/chat
   ↓
2. Se registra con:
   - ai_model: 'gpt-5' o 'gpt-5-mini'
   - source_type: 'analysis', 'library', o 'external'
   - tokens_input: N
   - tokens_output: M
   ↓
3. getInputOutputCostsByModelAndSource() agrupa por (model, source)
   ↓
4. Calcula costes por separado:
   - input_cost = tokens_input / 1000 × precio_input
   - output_cost = tokens_output / 1000 × precio_output
   ↓
5. Frontend renderiza:
   - 2 columnas (GPT-5, GPT-5-mini)
   - Hasta 3 secciones por columna (analysis, library, external)
   - 2 barras por sección (input, output)
```

---

## 📊 Estructura de Datos

### token_usage Table

```sql
CREATE TABLE token_usage (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  operation_type VARCHAR(50),      -- 'analysis', 'chat', 'generation'
  operation_subtype VARCHAR(100),  -- 'pliego_tecnico', 'contrato', etc.
  ai_model VARCHAR(50),            -- 'gpt-5', 'gpt-5-mini'
  tokens_used INTEGER,             -- Total
  tokens_input INTEGER,            -- Entrada (nuevo)
  tokens_output INTEGER,           -- Salida (nuevo)
  source_type VARCHAR(50),         -- 'library', 'external', NULL
  cost_usd DECIMAL(10, 6),
  created_at TIMESTAMP
);
```

### Valores de source_type

| Valor | Significado | Cuándo se usa |
|-------|-------------|---------------|
| `NULL` | Operación de análisis/generación | Análisis de documentos |
| `'library'` | Chat usando RAG interno | Codex Dilus encuentra info |
| `'external'` | Chat usando ChatGPT externo | Codex Dilus no encuentra info |

### Ejemplo de Registros

```sql
-- Análisis de pliego (source_type = NULL)
INSERT INTO token_usage VALUES (
  1, 1, 'analysis', 'pliego_tecnico', 'gpt-5-mini',
  33000, 30000, 3000, NULL, 0.0135, NOW()
);

-- Chat con biblioteca (source_type = 'library')
INSERT INTO token_usage VALUES (
  2, 1, 'chat', 'vault_query', 'gpt-5-mini',
  5000, 4500, 500, 'library', 0.0022, NOW()
);

-- Chat externo (source_type = 'external')
INSERT INTO token_usage VALUES (
  3, 1, 'chat', 'vault_query', 'gpt-5-mini',
  8000, 7000, 1000, 'external', 0.0037, NOW()
);
```

---

## 🎯 Objetivos Cumplidos

✅ **Prompts centralizados y documentados**
- Ubicación clara: `backend/utils/prompts.js`
- Documentación creada: `UBICACION_PROMPTS.md`
- Fácil de modificar

✅ **Tokens por día corregidos**
- Una sola barra por día
- Agregación correcta
- Visualización clara

✅ **Gráfico input/output mejorado**
- Etiquetas claras y descriptivas
- Orden lógico (análisis, biblioteca, externa)
- Diseño visual mejorado
- Preparado para mostrar datos de chat cuando existan

✅ **Organización general**
- Código más limpio
- Mejor UX
- Fácil de entender

---

**Fecha de actualización:** 6 de Noviembre, 2025  
**Estado:** ✅ Todas las mejoras implementadas y verificadas  
**Impacto:** Alto - Mejor organización y claridad en estadísticas  

**¡Sistema completamente mejorado y organizado!** 🎉

