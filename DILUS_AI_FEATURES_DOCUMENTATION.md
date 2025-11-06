# 📋 DILUS_AI - Documentación de Features y Requisitos

**Proyecto:** DILUS_AI  
**Fecha:** 6 de noviembre de 2025  
**Versión:** 2.0 (Rediseño completo)  

---

## 🎯 Objetivo General

Crear una nueva aplicación desde cero que transforme la experiencia de usuario actual (basada en chat) a una interfaz moderna con selectores y botones, orientada a la gestión de proyectos de ingeniería con análisis de documentación técnica mediante IA.

---

## 🔄 Cambios Principales Respecto al Sistema Actual

### ✅ Mantener
- **RAG (Retrieval-Augmented Generation)** con vectorización de documentos
- **MinIO** para almacenamiento de archivos
- **PostgreSQL** con pgvector para embeddings
- **Sistema de autenticación y roles** (usuarios y administradores)
- **Docker Compose** para orquestación

### ❌ Eliminar
- **TODO lo relacionado con SAP Business One** (conectores, servicios, endpoints)
- **Sistema de chat conversacional** como interfaz principal
- **Módulo de ofertas comerciales** con precios
- **Catálogo de sensores** específico

### 🆕 Nuevas Funcionalidades
- **Sistema de proyectos** para organizar trabajo
- **Bóveda de conocimiento (Vault)** separada por tipo de usuario
- **Interfaz basada en selectores y botones** (no chat)
- **Análisis con dos niveles de IA** (GPT-5 mini / GPT-5 estándar)
- **Panel de administración** para alimentar la bóveda

---

## 🏗️ Arquitectura de Módulos

### 1. Módulo de Dashboard Principal

**Pantalla:** Dashboard de Usuario

**Elementos:**
- Lista de proyectos existentes (tarjetas visuales)
- Botón "Nuevo Proyecto"
- Acceso al **Chat de la Bóveda** (lateral o modal)
- Estadísticas rápidas (proyectos activos, documentos procesados)
- Menú de usuario (perfil, logout)
- Botón de administración (solo para admins)

**Funcionalidades:**
- Ver todos los proyectos del usuario
- Crear nuevo proyecto (modal con nombre y descripción)
- Eliminar/archivar proyectos
- Buscar y filtrar proyectos
- Acceso rápido a la Bóveda para consultas puntuales

---

### 2. Módulo de Chat con la Bóveda

**Ubicación:** Sidebar o Modal accesible desde el dashboard

**Características:**
- **Chat limpio y sin historial persistente**
- Interfaz de conversación simple y directa
- Cada consulta es independiente
- **NO se guardan conversaciones**
- Usa RAG para consultar toda la documentación de la bóveda
- Respuestas rápidas basadas en conocimiento interno

**Tipo de Consultas:**
- "¿Cuál es el protocolo estándar para sensores Modbus?"
- "¿Qué normativa se aplica a instalaciones eléctricas de baja tensión?"
- "Explícame el proceso de homologación de equipos"

**RAG:**
- Consulta embeddings de documentos subidos por usuarios y admins
- Distingue entre documentos de admin y usuario (metadata)
- No almacena el historial de chat

---

### 3. Módulo de Proyecto Individual

**Pantalla:** Vista de Proyecto

**Layout:**

```
┌────────────────────────────────────────────────────────────┐
│  HEADER: Nombre del Proyecto | Botón Volver | Menú Usuario │
├──────────────┬─────────────────────────────────────────────┤
│              │                                             │
│  SIDEBAR     │        PANEL DE ACCIÓN (tabs)               │
│  IZQUIERDO   │                                             │
│              │  ┌─────┬─────┬─────┬─────┐                  │
│  📄 Docs     │  │Eval │Eval │Genr │Genr │                  │
│  Subidos:    │  │Pliego│Cont│Ofrt │Doc │                  │
│              │  │Técn │ rato│ a   │Técn │                  │
│  ☑ doc1.pdf  │  └─────┴─────┴─────┴─────┘                  │
│  ☐ doc2.docx │                                             │
│  ☐ doc3.txt  │  [Selector de documentos para contexto]     │
│              │  ☑ doc1.pdf                                 │
│  + Subir Doc │  ☐ doc2.docx                                │
│              │  ☐ resultado_anterior.docx                  │
│              │                                             │
│              │  [Botón: Ejecutar Análisis]                 │
│              │  [Botón: Repetir con IA Mejorada 🔄]        │
│              │                                             │
│              │  [Resultado del análisis / documento]       │
│              │                                             │
└──────────────┴─────────────────────────────────────────────┘
```

**Sidebar Izquierdo: Documentos del Proyecto**

- Lista de todos los documentos subidos al proyecto
- **Estado de vectorización** (procesado / procesando)
- Nombre, fecha de subida, tamaño
- Botón "Subir Documento" (PDF, DOCX, TXT)
- Botón para eliminar documentos
- **Checkbox para seleccionar** qué documentos usar como contexto en la acción actual

**Panel de Acción (Tabs):**

#### Tab 1: Evaluar Pliego Técnico
- **Descripción:** Analiza un pliego de licitación o especificaciones técnicas
- **Selector de documentos:** Checkboxes de los docs disponibles
- **Botón:** "Analizar Pliego Técnico"
- **Botón Secundario:** "Repetir con IA Mejorada 🔄" (usa GPT-5 estándar)
- **Resultado:** Análisis estructurado en JSON/tabla con:
  - Requisitos técnicos clave
  - Normativas aplicables
  - Equipamiento necesario
  - Estimación de complejidad
  - Riesgos identificados
- **Guardado:** El resultado se guarda como documento generado en el proyecto

#### Tab 2: Evaluar Contrato
- **Descripción:** Analiza contratos, cláusulas y condiciones legales
- **Selector de documentos:** Checkboxes de los docs disponibles
- **Botón:** "Analizar Contrato"
- **Botón Secundario:** "Repetir con IA Mejorada 🔄"
- **Resultado:** Análisis con:
  - Cláusulas importantes
  - Obligaciones del contratista
  - Riesgos legales
  - Plazos de entrega
  - Penalizaciones
- **Guardado:** El resultado se guarda como documento generado

#### Tab 3: Generar Oferta
- **Descripción:** Genera una propuesta comercial basada en el contexto
- **Selector de documentos:** Checkboxes de los docs disponibles (pliegos, análisis previos)
- **Campos adicionales:**
  - Nombre del cliente
  - Datos de contacto
  - Observaciones personalizadas
- **Botón:** "Generar Oferta"
- **Resultado:** Documento DOCX descargable con:
  - Propuesta técnica
  - Solución propuesta
  - Alcance del proyecto
  - Plazos estimados
  - Estructura de precios (solo conceptos, sin valores monetarios)

#### Tab 4: Generar Documentación Técnica
- **Descripción:** Crea documentación técnica del proyecto (memoria, anexos, etc.)
- **Selector de documentos:** Checkboxes de los docs disponibles
- **Campos adicionales:**
  - Tipo de documento (Memoria técnica, Manual de instalación, Plan de calidad)
  - Título del documento
- **Botón:** "Generar Documentación"
- **Resultado:** Documento DOCX descargable

---

### 4. Módulo de Gestión de Documentos (RAG)

**Funcionalidades Core:**

#### Subida de Documentos
- **Formatos soportados:** PDF, DOCX, TXT
- **Proceso:**
  1. Usuario sube archivo
  2. Sistema extrae texto completo
  3. Sistema determina:
     - Si el documento **cabe en el límite de tokens** de GPT-5 mini (272k tokens)
     - Si cabe → Se envía **texto completo** como contexto
     - Si NO cabe → Se **vectoriza** y se usa RAG para recuperar chunks relevantes
  4. Se genera embedding y se guarda en PostgreSQL
  5. Archivo original se guarda en MinIO

#### Vectorización Inteligente
- **Chunk Size:** 1000 caracteres con overlap de 200
- **Modelo de Embeddings:** text-embedding-3-small (OpenAI)
- **Búsqueda híbrida:** Vector (pgvector) + BM25 para keywords
- **Metadata por chunk:**
  - `document_id`
  - `chunk_index`
  - `page` (si es PDF)
  - `section_title` (si se detecta)
  - `uploaded_by` (user_id o 'admin')
  - `project_id` (si aplica)

#### Distinción de Documentos
- **Documentos de Usuario:** Subidos en proyectos específicos, visibles solo para ese proyecto
- **Documentos de Admin (Vault):** Subidos por administradores, visibles globalmente en el Chat de la Bóveda

---

### 5. Módulo de Administración (Solo Admins)

**Pantalla:** Panel de Administración

**Secciones:**

#### 5.1. Alimentador de la Bóveda
- **Descripción:** Sección para subir documentación corporativa que estará disponible para todos los usuarios en el Chat de la Bóveda
- **Funcionalidades:**
  - Subir archivos (PDF, DOCX, TXT)
  - Listar documentos de la bóveda
  - Ver estado de vectorización
  - Eliminar documentos
  - Agregar categorías/tags a documentos
- **Metadata especial:** `uploaded_by_admin: true`

#### 5.2. Gestión de Usuarios
- Ver lista de usuarios
- Activar/desactivar usuarios
- Cambiar roles (user/admin)
- Ver estadísticas de uso por usuario

#### 5.3. Monitoreo del Sistema
- Estado de servicios (PostgreSQL, MinIO, API IA)
- Estadísticas de uso de IA:
  - Consultas con GPT-5 mini
  - Consultas con GPT-5 estándar
  - Tokens consumidos
- Logs del sistema
- Estadísticas del RAG:
  - Total de documentos vectorizados
  - Total de chunks
  - Espacio usado en MinIO

---

## 🤖 Configuración de Modelos de IA

### GPT-5 Mini (Uso General)
- **Modelo:** `gpt-5-mini`
- **API Key:** Variable de entorno `CHATGPT5_MINI_API_KEY`
- **Uso:**
  - Análisis de pliegos técnicos (primera pasada)
  - Análisis de contratos (primera pasada)
  - Generación de ofertas
  - Generación de documentación técnica
  - Chat de la Bóveda

**Límites:**
- Context: 400k tokens
- Input: 272k tokens
- Output: 128k tokens

### GPT-5 Estándar (Análisis Profundo)
- **Modelo:** `gpt-5`
- **API Key:** Variable de entorno `CHATGPT5_STANDARD_API_KEY`
- **Uso:**
  - Botón "Repetir consulta más inteligente" en:
    - Análisis de pliegos técnicos
    - Análisis de contratos
  - Solo se activa cuando el usuario presiona el botón específico

**Límites:**
- Context: 1M tokens (estimado)
- Mayor capacidad de razonamiento

### Embeddings
- **Modelo:** `text-embedding-3-small` (OpenAI)
- **Dimensiones:** 1536
- **API Key:** Misma que GPT-5 Mini (`CHATGPT5_MINI_API_KEY`)

---

## 🎨 Diseño y Experiencia de Usuario

### Estilo Visual
- **Estilo corporativo moderno**
- **Paleta de colores:**
  - **Modo Claro:** Blanco, grises suaves, azul corporativo (#2563eb), acentos verdes
  - **Modo Oscuro:** Gris oscuro (#1e1e1e), azul oscuro (#1e3a8a), acentos cyan
- **Tipografía:** Inter, Roboto o similar (sans-serif moderna)
- **Iconos:** Lucide Icons o Heroicons (modernos y minimalistas)

### Componentes UI
- **Botones:** Redondeados, con sombras sutiles, estados hover/active
- **Tarjetas:** Elevación suave, bordes redondeados
- **Selectores de documentos:** Checkboxes grandes y claros
- **Tabs:** Underline o pills, con iconos
- **Modales:** Centrados con overlay oscuro

### Modo Oscuro / Claro
- **Toggle en el header** (icono de sol/luna)
- **Persistencia:** Guardar preferencia en localStorage
- **Transiciones suaves** entre modos

### Responsive
- **Desktop first** pero responsive para tablets
- Sidebar colapsable en dispositivos pequeños
- Tabs horizontales pasan a dropdown en móvil

---

## 🗄️ Estructura de Base de Datos

### Tablas Principales

#### `users`
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  is_admin BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_login_at TIMESTAMP
);
```

**Usuarios por defecto:**
- **Admin:** `admin` / `admin123`
- **Demo:** `demo` / `demo123`

#### `projects`
```sql
CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'active', -- active, archived
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### `documents`
```sql
CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  uploaded_by INTEGER NOT NULL REFERENCES users(id),
  filename VARCHAR(500) NOT NULL,
  file_path TEXT NOT NULL, -- Ruta en MinIO
  file_size BIGINT,
  mime_type VARCHAR(100),
  is_vault_document BOOLEAN DEFAULT FALSE, -- true si es doc de admin para vault
  vectorization_status VARCHAR(50) DEFAULT 'pending', -- pending, processing, completed, failed
  vectorization_error TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### `embeddings`
```sql
CREATE TABLE embeddings (
  id SERIAL PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  embedding vector(1536), -- text-embedding-3-small
  tsv tsvector GENERATED ALWAYS AS (to_tsvector('spanish', chunk_text)) STORED, -- Para BM25
  metadata JSONB DEFAULT '{}'::jsonb, -- page, section_title, uploaded_by_admin, etc.
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_embeddings_document_id ON embeddings(document_id);
CREATE INDEX idx_embeddings_tsv ON embeddings USING GIN(tsv);
```

#### `analysis_results`
```sql
CREATE TABLE analysis_results (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  analysis_type VARCHAR(50) NOT NULL, -- pliego_tecnico, contrato, oferta, documentacion
  input_document_ids INTEGER[], -- Array de IDs de documentos usados como input
  result_data JSONB, -- Resultado estructurado del análisis
  result_file_path TEXT, -- Si se generó un archivo (DOCX, PDF)
  ai_model_used VARCHAR(50), -- gpt-5-mini, gpt-5
  tokens_used INTEGER,
  duration_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### `vault_queries`
```sql
CREATE TABLE vault_queries (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  query_text TEXT NOT NULL,
  response_text TEXT,
  chunks_used INTEGER,
  ai_model VARCHAR(50),
  tokens_used INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🔐 Sistema de Autenticación

### JWT (JSON Web Tokens)
- **Secret:** Variable de entorno `JWT_SECRET`
- **Expiración:** 7 días
- **Contenido del token:**
  - `id`: User ID
  - `username`: Username
  - `email`: Email
  - `is_admin`: Rol de administrador

### Rutas Protegidas
- **Públicas:** `/api/auth/login`, `/api/auth/register`
- **Autenticadas:** Todas las demás rutas
- **Admin:** `/api/admin/*`

### Middleware
- `authenticateToken`: Verifica JWT en header `Authorization: Bearer <token>`
- `requireAdmin`: Verifica que `is_admin === true`

---

## 📡 API Endpoints (Resumen)

### Auth
- `POST /api/auth/register` - Registro de usuario
- `POST /api/auth/login` - Login (devuelve JWT)
- `GET /api/auth/me` - Info del usuario actual

### Projects
- `GET /api/projects` - Listar proyectos del usuario
- `POST /api/projects` - Crear proyecto
- `GET /api/projects/:id` - Obtener proyecto
- `PUT /api/projects/:id` - Actualizar proyecto
- `DELETE /api/projects/:id` - Eliminar proyecto

### Documents
- `POST /api/projects/:projectId/documents` - Subir documento a proyecto
- `GET /api/projects/:projectId/documents` - Listar documentos del proyecto
- `DELETE /api/documents/:id` - Eliminar documento
- `GET /api/documents/:id/download` - Descargar documento

### Analysis
- `POST /api/projects/:projectId/analyze/pliego` - Analizar pliego técnico
- `POST /api/projects/:projectId/analyze/contrato` - Analizar contrato
- `POST /api/projects/:projectId/generate/oferta` - Generar oferta
- `POST /api/projects/:projectId/generate/documentacion` - Generar doc técnica
- `POST /api/projects/:projectId/analyze/repeat-smart` - Repetir con IA mejorada

### Vault (Chat de la Bóveda)
- `POST /api/vault/query` - Consultar la bóveda (chat)

### Admin
- `POST /api/admin/vault/documents` - Subir documento a la bóveda
- `GET /api/admin/vault/documents` - Listar docs de la bóveda
- `DELETE /api/admin/vault/documents/:id` - Eliminar doc de la bóveda
- `GET /api/admin/users` - Listar usuarios
- `PUT /api/admin/users/:id` - Actualizar usuario
- `GET /api/admin/stats` - Estadísticas del sistema

---

## 🐳 Stack Tecnológico

### Backend
- **Node.js** (v20+)
- **Express.js** para API REST
- **PostgreSQL 16** con extensión **pgvector**
- **MinIO** para almacenamiento S3-compatible
- **JWT** para autenticación (stateless, sin necesidad de Redis)
- **bcrypt** para hashing de contraseñas
- **node-cache** para caché en memoria (opcional, para respuestas frecuentes)

### Frontend
- **React 18**
- **React Router** para navegación
- **Axios** para peticiones HTTP
- **Tailwind CSS** para estilos (o CSS Modules)
- **Lucide Icons** o **Heroicons**
- **React Context** para estado global (auth, theme)

### IA
- **OpenAI API:**
  - `gpt-5-mini` (análisis general)
  - `gpt-5` (análisis profundo)
  - `text-embedding-3-small` (embeddings)

### Procesamiento de Documentos
- **pdf-parse** para PDFs
- **mammoth** para DOCX
- **docx** (Python/docgen) para generar DOCX

### DevOps
- **Docker** y **Docker Compose**
- **Nodemon** para hot-reload (desarrollo)
- **Vite** para frontend dev server

---

## 📦 Variables de Entorno

### `.env` (Backend)

```bash
# ============================================
# PROVEEDOR DE IA
# ============================================
AI_PROVIDER=chatgpt

# API Keys OpenAI
CHATGPT5_MINI_API_KEY=sk-proj-... # GPT-5 Mini
CHATGPT5_STANDARD_API_KEY=sk-proj-... # GPT-5 Estándar (análisis profundo)

# ============================================
# BASE DE DATOS POSTGRESQL
# ============================================
POSTGRES_HOST=pg
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres_secure_2025
POSTGRES_DB=dilus_ai

# ============================================
# MINIO (Almacenamiento S3)
# ============================================
MINIO_ENDPOINT=http://minio:9000
MINIO_USE_SSL=false
MINIO_REGION=us-east-1
MINIO_ACCESS_KEY=dilus_admin
MINIO_SECRET_KEY=dilus_secret_2025
MINIO_BUCKET=dilus-ai

# ============================================
# RAG (Retrieval-Augmented Generation)
# ============================================
RAG_ENABLED=true
RAG_CHUNK_SIZE=1000
RAG_CHUNK_OVERLAP=200
RAG_TOP_K=5
RAG_SIMILARITY_THRESHOLD=0.7

# ============================================
# AUTENTICACIÓN
# ============================================
JWT_SECRET=dilus_jwt_secret_change_in_production_2025
JWT_EXPIRES_IN=7d

# ============================================
# SERVIDOR
# ============================================
PORT=8080
NODE_ENV=development

# ============================================
# DOCGEN (Generador de Documentos)
# ============================================
DOCGEN_URL=http://docgen:8090
```

---

## 🚀 Flujos de Usuario Principales

### Flujo 1: Análisis de Pliego Técnico

1. Usuario **crea un proyecto** desde el dashboard
2. Usuario entra al proyecto
3. Usuario **sube pliego técnico** (PDF) en el sidebar
4. Sistema vectoriza el documento automáticamente
5. Usuario selecciona tab **"Evaluar Pliego Técnico"**
6. Usuario marca checkbox del pliego en el selector de docs
7. Usuario presiona **"Analizar Pliego Técnico"**
8. Sistema:
   - Extrae texto del PDF
   - Si cabe en límite de tokens → envía texto completo
   - Si no cabe → usa RAG para recuperar chunks relevantes
   - Envía a GPT-5 Mini con prompt especializado
9. Sistema muestra resultado estructurado
10. Usuario revisa el resultado
11. **Opcionalmente:** Usuario presiona "Repetir con IA Mejorada 🔄"
12. Sistema repite análisis con GPT-5 Estándar
13. Resultado se guarda en el proyecto como documento generado

### Flujo 2: Consulta a la Bóveda

1. Usuario desde cualquier pantalla abre **Chat de la Bóveda** (sidebar/modal)
2. Usuario escribe pregunta: *"¿Qué normativa aplica a instalaciones eléctricas BT?"*
3. Sistema:
   - Genera embedding de la pregunta
   - Busca chunks similares en documentos de la bóveda (admin + usuario)
   - Recupera top 5 chunks más relevantes
   - Envía a GPT-5 Mini con contexto RAG
4. Sistema muestra respuesta
5. Usuario puede hacer más preguntas (chat limpio, sin historial guardado)
6. Usuario cierra el chat

### Flujo 3: Administrador Alimenta la Bóveda

1. Admin entra al **Panel de Administración**
2. Admin navega a **"Alimentador de la Bóveda"**
3. Admin sube documentos corporativos (manuales, normativas, datasheets)
4. Sistema:
   - Guarda documentos en MinIO
   - Marca metadata `is_vault_document: true`
   - Vectoriza documentos
   - Guarda embeddings con flag `uploaded_by_admin: true`
5. Admin ve lista de documentos de la bóveda con estado de procesamiento
6. Estos documentos quedan disponibles para todos los usuarios en el Chat de la Bóveda

---

## ✅ Criterios de Aceptación

### Funcionales
- ✅ Usuario puede crear proyectos y organizarlos
- ✅ Usuario puede subir documentos PDF, DOCX, TXT a proyectos
- ✅ Sistema vectoriza documentos automáticamente
- ✅ Usuario puede analizar pliegos técnicos con IA
- ✅ Usuario puede analizar contratos con IA
- ✅ Usuario puede generar ofertas personalizadas
- ✅ Usuario puede generar documentación técnica
- ✅ Sistema usa GPT-5 Mini por defecto
- ✅ Usuario puede repetir análisis con GPT-5 Estándar
- ✅ Usuario puede consultar la Bóveda sin guardar historial
- ✅ Admin puede subir documentos a la Bóveda
- ✅ Admin puede gestionar usuarios
- ✅ Admin puede ver estadísticas de uso

### No Funcionales
- ✅ Interfaz moderna y profesional
- ✅ Modo oscuro y claro
- ✅ Responsive (desktop y tablet)
- ✅ Tiempo de respuesta < 30s para análisis
- ✅ Autenticación segura con JWT
- ✅ Contraseñas hasheadas con bcrypt
- ✅ Archivos almacenados de forma segura en MinIO
- ✅ Logs de auditoría para acciones críticas
- ✅ Sistema 100% dockerizado

---

## 📝 Notas Finales

### Decisiones de Diseño

1. **Chat de la Bóveda sin historial:** Se decidió no guardar conversaciones para mantener el chat limpio y enfocado en consultas puntuales. Esto simplifica la UX y evita la complejidad de gestionar historial.

2. **Dos niveles de IA:** GPT-5 Mini es suficiente para el 90% de casos y mucho más económico. GPT-5 Estándar queda como opción premium para análisis complejos.

3. **Texto completo vs RAG:** Si el documento cabe en el límite de tokens, se envía completo para evitar pérdida de contexto. Solo se usa RAG cuando es necesario por tamaño.

4. **Distinción Admin/Usuario en Vault:** Se guarda metadata para distinguir documentos subidos por admin vs usuario. Esto permite en el futuro filtrar o priorizar información corporativa oficial.

5. **Sin precios ni SAP:** El sistema se enfoca en análisis técnico y legal, dejando fuera la parte comercial y la integración con ERP.

### Roadmap Futuro (Post-MVP)

- **Colaboración:** Compartir proyectos entre usuarios
- **Plantillas:** Templates para ofertas y documentación
- **Exportación:** Formatos adicionales (PDF, Markdown)
- **Notificaciones:** Avisos cuando termina vectorización o análisis
- **Historial de análisis:** Ver análisis anteriores de un proyecto
- **Comparación de versiones:** Comparar resultados de GPT-5 Mini vs Estándar
- **Tags y categorías:** Organizar proyectos y documentos
- **API Pública:** Endpoints REST para integraciones externas

---

**Fin del Documento**

