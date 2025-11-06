# 🤖 Alexandrina - Sistema de Consulta Inteligente

## 📖 Descripción

**Alexandrina** es el asistente inteligente de DILUS_AI que combina búsqueda en base de conocimientos local (RAG) con consultas externas a ChatGPT-5-mini para proporcionar respuestas técnicas precisas.

---

## 🔄 Flujo de Funcionamiento

### 1. **Búsqueda en Biblioteca Local (RAG)**
Cuando el usuario hace una consulta, Alexandrina **primero** busca en la biblioteca de documentación corporativa:

```
Usuario pregunta → Búsqueda en RAG (PostgreSQL + pgvector)
                 ↓
           ¿Se encontraron documentos?
```

#### Si SÍ se encuentra información (Source Type: `library`):
1. ✅ Se recuperan los fragmentos más relevantes (top 5)
2. 📝 Se construye un contexto con esos fragmentos
3. 🤖 Se envía el contexto + pregunta a GPT-5-mini
4. 💬 Se genera una respuesta basada en la documentación local
5. 📚 Se muestran las fuentes (nombres de archivos)

**Indicador visual:** Badge verde con icono de base de datos 🗄️

#### Si NO se encuentra información (Source Type: `external`):
1. ⚠️ No hay documentos relevantes en la biblioteca
2. 🌐 Se hace una consulta directa a ChatGPT-5-mini
3. 🤖 GPT-5 responde basándose en su conocimiento general
4. 💬 Se muestra la respuesta externa
5. 📌 Se indica que la fuente es "ChatGPT-5 (Conocimiento externo)"

**Indicador visual:** Badge azul con icono de globo 🌍

---

## 💬 Mensajes de Progreso

Durante el proceso, el usuario ve mensajes en **texto opaco** que se actualizan en tiempo real:

### Fase 1: Análisis Inicial
```
Analizando tu consulta...
```

### Fase 2: Búsqueda en Biblioteca
```
Buscando en la biblioteca de documentación...
```

### Fase 3A: Datos Encontrados (Biblioteca)
```
✓ Datos encontrados en la biblioteca
Generando respuesta...
```

### Fase 3B: Sin Datos (Externo)
```
⚠ No hay datos en la biblioteca
Buscando información externa en ChatGPT-5...
```

### Fase 4: Finalización
```
Procesando respuesta...
```

**Al terminar:** Todos los mensajes de progreso desaparecen y se muestra la respuesta final.

---

## 🎨 Interfaz de Usuario

### Indicadores de Fuente

#### 🟢 Biblioteca (Verde)
- **Badge:** `🗄️ Biblioteca`
- **Icono en fuentes:** `Database` icon
- **Muestra:** Lista de documentos consultados + número de fragmentos

#### 🔵 Externa (Azul)
- **Badge:** `🌍 Fuente Externa`
- **Icono en fuentes:** `Globe` icon
- **Muestra:** "ChatGPT-5 (Conocimiento externo)"

### Componentes

#### `AlexandrinaWidget` (Dashboard)
- Widget compacto en 1/3 de la pantalla
- Siempre visible
- Sticky (fijo al hacer scroll)
- Input + botón de envío

#### `VaultChat` (Modal)
- Modal a pantalla completa
- Más espacio para respuestas largas
- Mismo funcionamiento que el widget

---

## 🔧 Implementación Técnica

### Backend: `/api/vault/query`

```javascript
// 1. Buscar en RAG
const chunks = await searchInVault(queryText, { topK: 5 });

// 2. Decidir fuente
if (chunks.length > 0) {
  // Usar biblioteca
  sourceType = 'library';
  const context = await getContextFromChunks(chunks);
  aiResponse = await generateWithGPT5Mini(promptWithContext);
  sources = uniqueFilenames;
} else {
  // Usar fuente externa
  sourceType = 'external';
  aiResponse = await generateWithGPT5Mini(externalPrompt);
  sources = ['ChatGPT-5 (Conocimiento externo)'];
}

// 3. Responder
return {
  response: aiResponse.result,
  chunks_used: chunks.length,
  sources: sources,
  source_type: sourceType, // 'library' | 'external'
  metadata: { model, tokens_used, duration }
};
```

### Frontend: Manejo de Estados

```javascript
const [progressMessage, setProgressMessage] = useState('');
const [response, setResponse] = useState(null);

// Durante el proceso
setProgressMessage('Buscando en la biblioteca...');

// Al recibir respuesta
if (res.data.source_type === 'library') {
  setProgressMessage('✓ Datos encontrados en la biblioteca');
} else {
  setProgressMessage('⚠ No hay datos en la biblioteca');
}

// Al finalizar
setProgressMessage(''); // Se borra
setResponse(res.data); // Se muestra
```

---

## 📊 Ventajas del Sistema

### ✅ Para el Usuario
1. **Transparencia**: Sabe de dónde viene la información
2. **Confianza**: Puede ver las fuentes consultadas
3. **Feedback**: Indicadores de progreso claros
4. **Disponibilidad**: Siempre obtiene respuesta (local o externa)

### ✅ Para la Empresa
1. **Control**: Prioriza documentación corporativa
2. **Fallback**: No se queda sin respuesta
3. **Trazabilidad**: Log de consultas y fuentes
4. **Optimización**: Identifica gaps en la documentación

---

## 📈 Métricas Guardadas

Cada consulta se registra en `vault_queries`:

```sql
INSERT INTO vault_queries (
  user_id,
  query_text,
  response_text,
  chunks_used,  -- 0 si es externa, >0 si es biblioteca
  ai_model,     -- 'gpt-5-mini'
  tokens_used
)
```

---

## 🎯 Casos de Uso

### Ejemplo 1: Consulta con Documentación
**Pregunta:** "¿Cuál es el protocolo para sensores Modbus RTU?"

**Flujo:**
1. Busca "Modbus RTU" en biblioteca → ✅ Encuentra 3 documentos
2. Genera respuesta basada en esos documentos
3. Muestra: 🟢 Biblioteca + lista de archivos

---

### Ejemplo 2: Consulta sin Documentación
**Pregunta:** "¿Qué es machine learning?"

**Flujo:**
1. Busca "machine learning" en biblioteca → ❌ No encuentra nada
2. Consulta a ChatGPT-5-mini directamente
3. Muestra: 🔵 Fuente Externa + "ChatGPT-5 (Conocimiento externo)"

---

## 🔮 Mejoras Futuras

- [ ] Caché de respuestas frecuentes
- [ ] Sugerencias de documentos relacionados
- [ ] Feedback del usuario (👍/👎)
- [ ] Conversaciones con historial
- [ ] Búsqueda híbrida (biblioteca + externa simultánea)
- [ ] Análisis de sentiment para mejorar prompts

---

## 📝 Conclusión

**Alexandrina** ofrece lo mejor de dos mundos:
- **Precisión** de documentación corporativa
- **Disponibilidad** de conocimiento externo

Con indicadores claros y transparencia total, los usuarios siempre saben el origen de la información y pueden confiar en las respuestas. 🚀

