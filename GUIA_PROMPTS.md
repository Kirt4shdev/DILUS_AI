# 📝 Guía de Prompts - DILUS_AI

**Última actualización:** 6 de noviembre de 2025

---

## 📍 Ubicación de los Prompts

**Todos los prompts están centralizados en un solo archivo:**

```
backend/utils/prompts.js
```

Este archivo contiene TODOS los prompts utilizados en el sistema para:
- ✅ Análisis de pliegos técnicos
- ✅ Análisis de contratos
- ✅ Generación de ofertas
- ✅ Generación de documentación técnica
- ✅ Chat de la Bóveda

---

## 📚 Prompts Disponibles

### 1. `PROMPT_ANALIZAR_PLIEGO`
**Usado para:** Analizar pliegos técnicos de licitaciones

**Variables disponibles:**
- `{texto}` - El texto completo del pliego o fragmentos RAG

**Formato de respuesta:** JSON estructurado con:
- `requisitos_tecnicos`
- `normativas_aplicables`
- `equipamiento_necesario`
- `complejidad`
- `riesgos`
- `observaciones`

**Usado en:**
- `POST /api/projects/:projectId/analyze/pliego`
- GPT-5 Mini (por defecto)
- GPT-5 Standard (al usar "Repetir con IA Mejorada")

---

### 2. `PROMPT_ANALIZAR_CONTRATO`
**Usado para:** Analizar contratos, cláusulas y condiciones legales

**Variables disponibles:**
- `{texto}` - El texto completo del contrato o fragmentos RAG

**Formato de respuesta:** JSON estructurado con:
- `clausulas_importantes`
- `obligaciones_contratista`
- `plazos_entrega`
- `penalizaciones`
- `riesgos_legales`
- `observaciones`

**Usado en:**
- `POST /api/projects/:projectId/analyze/contrato`
- GPT-5 Mini (por defecto)
- GPT-5 Standard (al usar "Repetir con IA Mejorada")

---

### 3. `PROMPT_GENERAR_OFERTA`
**Usado para:** Generar propuestas comerciales técnicas

**Variables disponibles:**
- `{contexto}` - Texto de los documentos seleccionados
- `{cliente}` - Nombre del cliente (proporcionado por el usuario)
- `{observaciones}` - Observaciones adicionales (proporcionadas por el usuario)

**Formato de respuesta:** JSON estructurado con:
- `propuesta_tecnica`
- `alcance`
- `plazos`
- `conceptos_precio`

**Usado en:**
- `POST /api/projects/:projectId/generate/oferta`
- Solo GPT-5 Mini

---

### 4. `PROMPT_GENERAR_DOCUMENTACION`
**Usado para:** Generar documentación técnica profesional

**Variables disponibles:**
- `{contexto}` - Texto de los documentos seleccionados
- `{tipo_documento}` - Tipo de documento (Memoria técnica, Manual, etc.)
- `{titulo}` - Título del documento (proporcionado por el usuario)

**Formato de respuesta:** JSON estructurado con:
- `contenido_principal`
- `secciones` (array de objetos con titulo y contenido)

**Usado en:**
- `POST /api/projects/:projectId/generate/documentacion`
- Solo GPT-5 Mini

---

### 5. `PROMPT_CHAT_VAULT`
**Usado para:** Chat con la Bóveda de conocimiento

**Variables disponibles:**
- `{contexto}` - Fragmentos relevantes recuperados por RAG de la bóveda
- `{pregunta}` - Pregunta del usuario

**Formato de respuesta:** Texto libre (no JSON)

**Usado en:**
- `POST /api/vault/query`
- Solo GPT-5 Mini

---

## 🔧 Cómo Editar los Prompts

### Pasos:

1. **Abrir el archivo:**
   ```bash
   D:\GitHub\DILUS_AI\backend\utils\prompts.js
   ```

2. **Localizar el prompt que quieres editar:**
   - Busca `export const PROMPT_ANALIZAR_PLIEGO`
   - O el prompt que necesites modificar

3. **Editar el contenido:**
   ```javascript
   export const PROMPT_ANALIZAR_PLIEGO = `
   Eres un experto en análisis de pliegos técnicos.
   
   [Tu nuevo texto aquí]
   
   PLIEGO:
   {texto}
   `;
   ```

4. **Reiniciar el backend:**
   ```bash
   cd D:\GitHub\DILUS_AI
   docker-compose restart backend
   ```

5. **Verificar:**
   - Haz un nuevo análisis
   - Revisa que el resultado refleje los cambios

---

## ⚙️ Función Auxiliar: `fillPrompt()`

Esta función reemplaza los placeholders en los prompts:

```javascript
fillPrompt(PROMPT_ANALIZAR_PLIEGO, { texto: "contenido del documento..." })
```

**Cómo funciona:**
- Busca `{nombreVariable}` en el template
- Lo reemplaza con el valor proporcionado
- Retorna el prompt completo

**Ejemplo:**
```javascript
const prompt = fillPrompt(PROMPT_GENERAR_OFERTA, {
  contexto: "Pliego técnico...",
  cliente: "Acme Corp",
  observaciones: "Proyecto urgente"
});
// Resultado:
// "Eres un experto...
//  CONTEXTO:
//  Pliego técnico...
//  CLIENTE: Acme Corp
//  OBSERVACIONES: Proyecto urgente"
```

---

## 📂 Archivos que Usan los Prompts

### `backend/routes/analysis.js`
Usa:
- ✅ `PROMPT_ANALIZAR_PLIEGO`
- ✅ `PROMPT_ANALIZAR_CONTRATO`
- ✅ `PROMPT_GENERAR_OFERTA`
- ✅ `PROMPT_GENERAR_DOCUMENTACION`
- ✅ `fillPrompt()`

### `backend/routes/vault.js`
Usa:
- ✅ `PROMPT_CHAT_VAULT`
- ✅ `fillPrompt()`

---

## 🎯 Mejores Prácticas

### 1. **Mantén el formato JSON**
Los prompts de análisis y generación esperan respuestas en JSON.
Si cambias el formato, actualiza también el código que parsea la respuesta.

### 2. **Usa placeholders descriptivos**
```javascript
// ❌ MAL
const prompt = `Analiza esto: ${texto}`;

// ✅ BIEN
const prompt = `Analiza esto: {texto}`;
// Y luego: fillPrompt(prompt, { texto: miTexto })
```

### 3. **Especifica el formato de salida**
```javascript
// ✅ BIEN
`Responde ÚNICAMENTE con el JSON, sin texto adicional ni markdown.`
```

Esto evita que GPT-5 agregue explicaciones innecesarias.

### 4. **Sé específico en las instrucciones**
```javascript
// ❌ VAGO
`Analiza el documento`

// ✅ ESPECÍFICO
`Eres un experto en análisis de pliegos técnicos de ingeniería.
Analiza el siguiente pliego e identifica requisitos técnicos,
normativas aplicables y riesgos potenciales.`
```

### 5. **Testea los cambios**
Después de modificar un prompt:
1. Reinicia el backend
2. Prueba con un documento real
3. Verifica que el resultado sea el esperado
4. Ajusta si es necesario

---

## 🔄 Diferencias entre GPT-5 Mini y GPT-5 Standard

**Ambos modelos usan los mismos prompts.**

La diferencia está en:
- **GPT-5 Mini:**
  - Más rápido (~1 minuto)
  - Más económico
  - Bueno para análisis estándar

- **GPT-5 Standard:**
  - Más lento (~2 minutos)
  - Más costoso
  - Razonamiento más profundo
  - Mejor para casos complejos

**El usuario decide cuál usar:**
- Botón "Analizar con IA" → GPT-5 Mini
- Botón "🔄 Repetir con IA Mejorada" → GPT-5 Standard

---

## 📝 Ejemplos de Personalización

### Ejemplo 1: Agregar más detalle al análisis de pliegos

```javascript
export const PROMPT_ANALIZAR_PLIEGO = `Eres un experto en análisis de pliegos técnicos de ingeniería. 

Analiza el siguiente pliego con MÁXIMO DETALLE y devuelve un JSON estructurado con:
{
  "requisitos_tecnicos": [
    { 
      "categoria": "...", 
      "descripcion": "...", 
      "prioridad": "alta/media/baja",
      "cumplimiento_estimado": "fácil/medio/difícil"  // NUEVO
    }
  ],
  "normativas_aplicables": ["Normativa 1", "Normativa 2"],
  "equipamiento_necesario": [
    { 
      "tipo": "...", 
      "especificaciones": "...",
      "proveedor_sugerido": "..."  // NUEVO
    }
  ],
  "presupuesto_estimado": {  // NUEVO
    "rango_minimo": "...",
    "rango_maximo": "...",
    "justificacion": "..."
  },
  "complejidad": "baja/media/alta",
  "riesgos": [
    { 
      "riesgo": "...", 
      "impacto": "alto/medio/bajo", 
      "probabilidad": "alta/media/baja",  // NUEVO
      "mitigacion": "..." 
    }
  ],
  "observaciones": "..."
}

PLIEGO:
{texto}

Responde ÚNICAMENTE con el JSON, sin texto adicional ni markdown.`;
```

### Ejemplo 2: Cambiar el tono de las ofertas

```javascript
export const PROMPT_GENERAR_OFERTA = `Eres un experto en redacción de propuestas técnicas y comerciales con un estilo PROFESIONAL Y CERCANO.

Basándote en la siguiente información de contexto, genera una propuesta estructurada que DESTAQUE nuestras ventajas competitivas.

Usa un lenguaje CLARO, DIRECTO y CONVINCENTE.

CONTEXTO:
{contexto}

CLIENTE: {cliente}
OBSERVACIONES: {observaciones}

Genera un JSON con:
{
  "propuesta_tecnica": "Descripción técnica de la solución propuesta destacando innovación y calidad...",
  "alcance": "Alcance detallado del proyecto con entregables específicos...",
  "plazos": "Plazos estimados de ejecución con hitos claros...",
  "ventajas_competitivas": [  // NUEVO
    "Ventaja 1",
    "Ventaja 2"
  ],
  "conceptos_precio": [
    "Concepto 1: Descripción",
    "Concepto 2: Descripción"
  ]
}

Responde ÚNICAMENTE con el JSON, sin texto adicional ni markdown.`;
```

---

## ⚠️ Notas Importantes

1. **Los prompts NO incluyen mensajes de `system` role**
   - GPT-5 no requiere mensajes system separados
   - Todo está en el prompt como mensaje user

2. **Los prompts NO especifican `temperature` ni `max_tokens`**
   - Se usan los valores por defecto del modelo
   - Se puede ajustar en `backend/services/aiService.js` si es necesario

3. **Los prompts piden respuestas en JSON**
   - El código parsea automáticamente el JSON con `parseAIResponse()`
   - Si cambias el formato, actualiza también el parser

4. **RAG se aplica automáticamente**
   - Si el documento es muy grande, se usa RAG
   - El prompt recibe `{texto}` que puede ser:
     - Texto completo (si cabe)
     - Fragmentos relevantes (si no cabe)

---

## 🚀 Resumen Rápido

**¿Dónde editar?** → `backend/utils/prompts.js`

**¿Cómo aplicar cambios?** → `docker-compose restart backend`

**¿Qué prompts hay?**
1. `PROMPT_ANALIZAR_PLIEGO`
2. `PROMPT_ANALIZAR_CONTRATO`
3. `PROMPT_GENERAR_OFERTA`
4. `PROMPT_GENERAR_DOCUMENTACION`
5. `PROMPT_CHAT_VAULT`

**¿Cómo funcionan?** → `fillPrompt(template, { variable: valor })`

---

**¡Listo para personalizar tus prompts!** ✨

