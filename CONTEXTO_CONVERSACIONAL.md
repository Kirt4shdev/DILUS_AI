# 🧠 Contexto Conversacional en Codex Dilus

## 📋 Resumen

Se ha implementado un **sistema de contexto conversacional** en el chat de Codex Dilus. Ahora la IA **recuerda toda la conversación anterior** y puede responder en base al historial completo hasta que se borre o refresque la página.

---

## ✨ Características Implementadas

### 1️⃣ **Memoria de Conversación**

✅ **Historial Completo**: Cada nueva consulta incluye TODO el historial previo  
✅ **Contexto Persistente**: La IA recuerda lo que preguntaste antes  
✅ **Respuestas Contextuales**: Puede referirse a mensajes anteriores  
✅ **Truncamiento Automático**: Si excede el límite, mantiene solo los más recientes  

### 2️⃣ **Límite de Contexto Inteligente**

- **Contexto Máximo**: 400,000 tokens (GPT-5-mini y GPT-5)
- **Límite de Input**: 262,500 tokens (75% del contexto)
- **Reserva para Output**: 137,500 tokens (25% para respuesta)
- **Truncamiento**: Si se excede, mantiene los mensajes **MÁS RECIENTES**

### 3️⃣ **Funciona en Ambos Modos**

✅ **Biblioteca Interna**: Contexto + Historial de conversación  
✅ **Búsqueda Externa**: GPT-5-mini + Historial de conversación  

---

## 🔄 **FLUJO COMPLETO**

### **Primera Consulta (Sin Historial)**

```
Usuario: "¿Qué es el protocolo Modbus?"
          ↓
Backend recibe:
  - query: "¿Qué es el protocolo Modbus?"
  - conversation_history: []  (vacío)
          ↓
OpenAI recibe:
  [
    { role: "system", content: "Eres un asistente técnico..." },
    { role: "user", content: "¿Qué es el protocolo Modbus?" }
  ]
          ↓
IA responde: "Modbus es un protocolo de comunicación..."
          ↓
Frontend guarda en historial:
  messages = [
    { type: "user", text: "¿Qué es el protocolo Modbus?" },
    { type: "assistant", text: "Modbus es un protocolo..." }
  ]
```

---

### **Segunda Consulta (Con Historial)**

```
Usuario: "¿Y para qué sirve?"
          ↓
Backend recibe:
  - query: "¿Y para qué sirve?"
  - conversation_history: [
      { role: "user", content: "¿Qué es el protocolo Modbus?" },
      { role: "assistant", content: "Modbus es un protocolo..." }
    ]
          ↓
OpenAI recibe:
  [
    { role: "system", content: "Eres un asistente técnico..." },
    { role: "user", content: "¿Qué es el protocolo Modbus?" },
    { role: "assistant", content: "Modbus es un protocolo..." },
    { role: "user", content: "¿Y para qué sirve?" }  ← NUEVA CONSULTA
  ]
          ↓
IA responde (CON CONTEXTO): 
  "Modbus sirve para comunicar dispositivos industriales..."
  (La IA SABE que estás hablando de Modbus por el contexto)
          ↓
Frontend actualiza historial:
  messages = [
    { type: "user", text: "¿Qué es el protocolo Modbus?" },
    { type: "assistant", text: "Modbus es un protocolo..." },
    { type: "user", text: "¿Y para qué sirve?" },
    { type: "assistant", text: "Modbus sirve para comunicar..." }
  ]
```

---

### **Tercera Consulta (Más Contexto)**

```
Usuario: "Dame un ejemplo de implementación"
          ↓
Backend recibe:
  - query: "Dame un ejemplo de implementación"
  - conversation_history: [
      { role: "user", content: "¿Qué es el protocolo Modbus?" },
      { role: "assistant", content: "Modbus es un protocolo..." },
      { role: "user", content: "¿Y para qué sirve?" },
      { role: "assistant", content: "Modbus sirve para..." }
    ]
          ↓
OpenAI recibe TODO EL HISTORIAL + nueva consulta
          ↓
IA responde (CON CONTEXTO COMPLETO):
  "Un ejemplo de implementación de Modbus RTU sería..."
  (La IA SABE que hablas de Modbus por todo el contexto previo)
```

---

## 🧮 **TRUNCAMIENTO AUTOMÁTICO**

### **Cuando el Historial Excede 262,500 Tokens**

```javascript
// backend/services/aiService.js
export function truncateConversationHistory(messages, systemPrompt = '', maxTokens = 262500) {
  const systemTokens = estimateTokens(systemPrompt);
  let availableTokens = maxTokens - systemTokens;
  
  const truncatedMessages = [];
  
  // Recorrer desde el más RECIENTE al más antiguo
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    const messageTokens = estimateTokens(message.content);
    
    if (messageTokens <= availableTokens) {
      truncatedMessages.unshift(message); // Agregar al inicio
      availableTokens -= messageTokens;
    } else {
      break; // Detener, los mensajes antiguos se descartan
    }
  }
  
  return truncatedMessages;
}
```

### **Ejemplo de Truncamiento**

```
Supongamos que tienes 50 mensajes que suman 300k tokens (excede 262.5k):

Mensajes ANTIGUOS (descartados):
  1. "¿Qué es SCADA?" (15k tokens) ❌
  2. "Respuesta sobre SCADA" (20k tokens) ❌
  3. "¿Y PLC?" (10k tokens) ❌
  4. "Respuesta sobre PLC" (18k tokens) ❌
  ... (más mensajes antiguos descartados)

Mensajes RECIENTES (conservados):
  40. "¿Qué es Modbus?" (12k tokens) ✅
  41. "Respuesta sobre Modbus" (25k tokens) ✅
  42. "¿Y DNP3?" (8k tokens) ✅
  43. "Respuesta sobre DNP3" (22k tokens) ✅
  ... (hasta completar ~262.5k tokens)

Total conservado: ~260k tokens (dentro del límite)
```

**La IA sigue teniendo contexto**, solo pierde las conversaciones MÁS ANTIGUAS.

---

## 🔧 **IMPLEMENTACIÓN TÉCNICA**

### **Backend: `backend/services/aiService.js`**

#### Función `generateWithGPT5Mini` Mejorada

```javascript
export async function generateWithGPT5Mini(prompt, options = {}) {
  let messages = [];
  
  if (typeof prompt === 'string') {
    // Modo simple: un solo mensaje
    messages = [{ role: 'user', content: prompt }];
  } else if (Array.isArray(prompt)) {
    // Modo conversacional: array de mensajes
    messages = prompt;
  }
  
  // Agregar system prompt si existe
  const systemPrompt = options.systemPrompt || '';
  if (systemPrompt) {
    messages = [{ role: 'system', content: systemPrompt }, ...messages];
  }
  
  // Truncar si excede 262.5k tokens
  const totalTokens = messages.reduce((sum, msg) => sum + estimateTokens(msg.content), 0);
  
  if (totalTokens > 262500) {
    messages = truncateConversationHistory(
      messages.filter(m => m.role !== 'system'), 
      systemPrompt
    );
    if (systemPrompt) {
      messages = [{ role: 'system', content: systemPrompt }, ...messages];
    }
  }
  
  // Enviar a OpenAI
  const response = await axios.post(OPENAI_API_URL, {
    model: 'gpt-5-mini',
    messages: messages
  }, ...);
  
  return { result, tokensUsed, tokensInput, tokensOutput, duration, model };
}
```

---

### **Backend: `backend/routes/vault.js`**

#### Endpoint `/vault/query` Actualizado

```javascript
router.post('/query', async (req, res, next) => {
  const { query: userQuery, conversation_history } = req.body;
  
  const hasHistory = Array.isArray(conversation_history) && conversation_history.length > 0;
  
  // Buscar en biblioteca
  const chunks = await searchInVault(queryText, { topK: 5 });
  
  if (chunks.length > 0) {
    // Modo BIBLIOTECA con historial
    const context = await getContextFromChunks(chunks);
    
    const systemPrompt = `Eres un asistente técnico...
    
CONTEXTO DE LA BIBLIOTECA:
${context}`;
    
    const messages = [];
    
    if (hasHistory) {
      messages.push(...conversation_history); // Agregar historial previo
    }
    
    messages.push({ role: 'user', content: queryText }); // Agregar nueva consulta
    
    aiResponse = await generateWithGPT5Mini(messages, { systemPrompt });
    
  } else {
    // Modo EXTERNO con historial
    const systemPrompt = `Eres un asistente técnico...`;
    
    const messages = [];
    
    if (hasHistory) {
      messages.push(...conversation_history); // Agregar historial previo
    }
    
    messages.push({ role: 'user', content: queryText }); // Agregar nueva consulta
    
    aiResponse = await generateWithGPT5Mini(messages, { systemPrompt });
  }
  
  res.json({ response: aiResponse.result, ... });
});
```

---

### **Frontend: `CodexDilusWidget.jsx` y `VaultChat.jsx`**

#### Envío de Historial en Cada Consulta

```javascript
const handleSubmit = async (e) => {
  e.preventDefault();
  
  const userQuery = query.trim();
  
  // Agregar mensaje del usuario al historial local
  setMessages(prev => [...prev, {
    type: 'user',
    text: userQuery,
    timestamp: new Date()
  }]);
  
  // Construir historial de conversación (formato OpenAI)
  const conversationHistory = messages
    .filter(msg => msg.type === 'user' || msg.type === 'assistant')
    .map(msg => ({
      role: msg.type === 'user' ? 'user' : 'assistant',
      content: msg.text
    }));
  
  // Enviar consulta CON historial
  const res = await apiClient.post('/vault/query', { 
    query: userQuery,
    conversation_history: conversationHistory  // ← HISTORIAL INCLUIDO
  });
  
  // Agregar respuesta al historial local
  setMessages(prev => [...prev, {
    type: 'assistant',
    text: res.data.response,
    source_type: res.data.source_type,
    sources: res.data.sources,
    timestamp: new Date()
  }]);
};
```

---

## 📊 **DIAGRAMA DE ARQUITECTURA**

```
┌──────────────────────────────────────────────────────────────┐
│                     FRONTEND                                 │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  messages = [                                                │
│    { type: 'user', text: 'Pregunta 1' },                    │
│    { type: 'assistant', text: 'Respuesta 1' },              │
│    { type: 'user', text: 'Pregunta 2' },                    │
│    { type: 'assistant', text: 'Respuesta 2' }               │
│  ]                                                           │
│                                                              │
│  Nueva consulta: "Pregunta 3"                               │
│         ↓                                                    │
│  Convierte a formato OpenAI:                                │
│  conversation_history = [                                    │
│    { role: 'user', content: 'Pregunta 1' },                 │
│    { role: 'assistant', content: 'Respuesta 1' },           │
│    { role: 'user', content: 'Pregunta 2' },                 │
│    { role: 'assistant', content: 'Respuesta 2' }            │
│  ]                                                           │
│         ↓                                                    │
└──────────────────────────────────────────────────────────────┘
                         ↓ POST /vault/query
┌──────────────────────────────────────────────────────────────┐
│                     BACKEND                                  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Recibe:                                                     │
│    - query: "Pregunta 3"                                     │
│    - conversation_history: [...]                            │
│                                                              │
│  Busca en RAG o usa externo                                 │
│         ↓                                                    │
│  Construye array completo:                                  │
│  messages = [                                                │
│    { role: 'system', content: 'System prompt + contexto' }, │
│    { role: 'user', content: 'Pregunta 1' },                 │
│    { role: 'assistant', content: 'Respuesta 1' },           │
│    { role: 'user', content: 'Pregunta 2' },                 │
│    { role: 'assistant', content: 'Respuesta 2' },           │
│    { role: 'user', content: 'Pregunta 3' }  ← NUEVA         │
│  ]                                                           │
│         ↓                                                    │
│  Verifica tokens: ¿Excede 262.5k?                           │
│    NO → Envía todo                                           │
│    SÍ → Trunca (mantiene mensajes recientes)                │
│         ↓                                                    │
└──────────────────────────────────────────────────────────────┘
                         ↓ POST OpenAI API
┌──────────────────────────────────────────────────────────────┐
│                     OPENAI GPT-5-MINI                        │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Procesa TODO el historial + nueva consulta                 │
│  Genera respuesta CON CONTEXTO COMPLETO                     │
│         ↓                                                    │
│  Respuesta: "Respuesta 3 (basada en contexto previo)"       │
│                                                              │
└──────────────────────────────────────────────────────────────┘
                         ↓ Response
┌──────────────────────────────────────────────────────────────┐
│                     FRONTEND                                 │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Recibe respuesta y actualiza historial:                    │
│  messages = [                                                │
│    { type: 'user', text: 'Pregunta 1' },                    │
│    { type: 'assistant', text: 'Respuesta 1' },              │
│    { type: 'user', text: 'Pregunta 2' },                    │
│    { type: 'assistant', text: 'Respuesta 2' },              │
│    { type: 'user', text: 'Pregunta 3' },                    │
│    { type: 'assistant', text: 'Respuesta 3' }  ← NUEVA      │
│  ]                                                           │
│                                                              │
│  Usuario puede seguir preguntando con contexto completo     │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 🎯 **CASOS DE USO**

### **Caso 1: Preguntas de Seguimiento**

```
Usuario: "¿Qué es el protocolo DNP3?"
IA: "DNP3 es un protocolo de comunicación..."

Usuario: "¿Cómo se diferencia de Modbus?"
         ↑ La IA SABE que hablas de DNP3 por el contexto
IA: "A diferencia de Modbus, DNP3 tiene mejores características..."

Usuario: "Dame un ejemplo de su uso"
         ↑ La IA SABE que hablas de DNP3 (no de Modbus)
IA: "Un ejemplo de uso de DNP3 sería..."
```

---

### **Caso 2: Aclaraciones y Profundización**

```
Usuario: "¿Qué es un PLC?"
IA: "Un PLC (Programmable Logic Controller) es..."

Usuario: "Explícalo de forma más simple"
         ↑ La IA SABE que debe simplificar la explicación de PLC
IA: "En términos simples, un PLC es como un ordenador..."

Usuario: "¿Cuáles son las marcas más comunes?"
         ↑ La IA SABE que hablas de marcas de PLCs
IA: "Las marcas más comunes de PLCs son Siemens, Allen Bradley..."
```

---

### **Caso 3: Comparaciones**

```
Usuario: "¿Qué es SCADA?"
IA: "SCADA es un sistema de control..."

Usuario: "¿Y HMI?"
IA: "HMI es una interfaz hombre-máquina..."

Usuario: "¿Cuál es la diferencia entre ambos?"
         ↑ La IA SABE que hablas de SCADA y HMI
IA: "La principal diferencia entre SCADA y HMI es..."
```

---

## 🧪 **PRUEBAS SUGERIDAS**

### **Prueba 1: Contexto Básico**

1. Pregunta: "¿Qué es el protocolo Modbus?"
2. Pregunta: "¿Para qué sirve?"  
   ✅ Debe responder sobre Modbus (no preguntar de qué hablas)

### **Prueba 2: Múltiples Consultas**

1. Pregunta: "¿Qué es un RTU?"
2. Pregunta: "¿Y un MTU?"
3. Pregunta: "¿Cuál es mejor?"  
   ✅ Debe comparar RTU vs MTU (sabe de qué hablas)

### **Prueba 3: Cambio de Tema**

1. Pregunta: "¿Qué es Modbus?"
2. Pregunta: "Ahora háblame de DNP3"  
   ✅ Debe cambiar de tema correctamente

### **Prueba 4: Preguntas de Seguimiento**

1. Pregunta: "¿Qué es un PLC?"
2. Pregunta: "Dame ejemplos"  
   ✅ Debe dar ejemplos de PLCs (no preguntar "ejemplos de qué")

### **Prueba 5: Refrescar Página**

1. Haz 5 preguntas
2. Refresca la página (F5)  
   ✅ El historial se borra (comportamiento esperado)
3. Nueva pregunta  
   ✅ Comienza conversación nueva sin contexto previo

---

## 📈 **BENEFICIOS**

### ✅ **UX Mejorada**

- Conversaciones más **naturales** y **fluidas**
- No necesitas repetir información en cada pregunta
- La IA "recuerda" el contexto completo

### ✅ **Eficiencia**

- Preguntas más **cortas** ("¿Y eso?" en lugar de "¿Y cómo funciona el protocolo Modbus?")
- Menos repetición de información
- Respuestas más **relevantes** al contexto

### ✅ **Inteligencia**

- Respuestas más **precisas** basadas en el historial
- Puede **referirse** a mensajes anteriores
- **Compara** y **contrasta** información previa

---

## ⚠️ **LIMITACIONES**

### ❌ **Persistencia**

- El historial se borra al **refrescar la página**
- No se guarda en base de datos (solo en memoria de sesión)
- No hay sincronización entre dispositivos

### ⚠️ **Truncamiento**

- Si el historial excede 262.5k tokens, se pierden mensajes **antiguos**
- Solo se mantienen los mensajes **más recientes**

### 💡 **Posibles Mejoras Futuras**

- Guardar historial en `localStorage` para persistir en la sesión
- Guardar conversaciones en BD para historial permanente
- Opción "Nueva conversación" para empezar de cero
- Mostrar indicador cuando se ha truncado el historial

---

## 🔒 **SEGURIDAD Y PRIVACIDAD**

✅ **Cada usuario tiene su propio historial** (no compartido)  
✅ **El historial NO se guarda en BD** (solo en memoria de sesión)  
✅ **Se borra al refrescar** (no persiste entre sesiones)  
✅ **Estadísticas se registran** (para análisis de uso)  

---

## 📝 **ARCHIVOS MODIFICADOS**

### Backend

1. **`backend/services/aiService.js`**
   - ✅ Añadida función `truncateConversationHistory()`
   - ✅ Modificada `generateWithGPT5Mini()` para soportar array de mensajes
   - ✅ Lógica de truncamiento automático al 75% del contexto

2. **`backend/routes/vault.js`**
   - ✅ Actualizado `/query` para recibir `conversation_history`
   - ✅ Construcción de mensajes con historial para biblioteca
   - ✅ Construcción de mensajes con historial para búsqueda externa

### Frontend

3. **`frontend/src/components/CodexDilusWidget.jsx`**
   - ✅ Construcción de `conversationHistory` desde `messages`
   - ✅ Envío de historial en cada request
   - ✅ Mensajes de progreso actualizados ("con contexto previo")

4. **`frontend/src/components/VaultChat.jsx`**
   - ✅ Construcción de `conversationHistory` desde `messages`
   - ✅ Envío de historial en cada request
   - ✅ Mensajes de progreso actualizados ("con contexto previo")

---

## 🎉 **RESULTADO FINAL**

### Antes (❌ Sin Contexto)

```
Usuario: "¿Qué es Modbus?"
IA: "Modbus es un protocolo..."

Usuario: "¿Para qué sirve?"
IA: "¿A qué te refieres específicamente?" ❌ No recuerda
```

### Ahora (✅ Con Contexto)

```
Usuario: "¿Qué es Modbus?"
IA: "Modbus es un protocolo..."

Usuario: "¿Para qué sirve?"
IA: "Modbus sirve para comunicar dispositivos industriales..." ✅ Recuerda el contexto
```

---

**Fecha de implementación:** 7 de Noviembre, 2025  
**Estado:** ✅ Completado y desplegado  
**Impacto:** Alto - Conversaciones naturales y contextuales  

**¡El chat de Codex Dilus ahora mantiene contexto conversacional completo!** 🧠💬✨

