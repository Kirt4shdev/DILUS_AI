# 🚀 MEGAPROMPT: Generación de DILUS_AI desde Cero

---

## 📋 INSTRUCCIONES GENERALES

Eres un arquitecto de software experto. Tu tarea es **crear desde cero** un sistema completo llamado **DILUS_AI** siguiendo estas especificaciones exactas. 

**IMPORTANTE:**
- Genera un proyecto completamente nuevo en una carpeta llamada `DILUS_AI`
- NO copies código del sistema anterior, usa estas especificaciones como referencia
- Crea una arquitectura limpia, moderna y mantenible
- Sigue las mejores prácticas de cada tecnología
- El código debe estar listo para producción
- Incluye comentarios explicativos donde sea necesario

---

## 🎯 DESCRIPCIÓN DEL PROYECTO

**DILUS_AI** es una plataforma web para gestión de proyectos de ingeniería con análisis de documentación técnica mediante Inteligencia Artificial. 

### Características Principales:

1. **Sistema de Proyectos:** Los usuarios organizan su trabajo en proyectos independientes
2. **Gestión de Documentos:** Subida de PDFs, DOCX, TXT con vectorización automática vía RAG
3. **Análisis con IA:** Evaluación de pliegos técnicos, contratos, generación de ofertas y documentación
4. **Dos Niveles de IA:** GPT-5 Mini (rápido y económico) + GPT-5 Estándar (análisis profundo)
5. **Chat de la Bóveda:** Consultas puntuales sin historial a toda la documentación vectorizada
6. **Panel de Admin:** Alimentar la bóveda con documentación corporativa, gestionar usuarios, ver estadísticas

---

## 🏗️ ARQUITECTURA DEL SISTEMA

### Stack Tecnológico

**Backend:**
- Node.js v20+
- Express.js (API REST)
- PostgreSQL 16 con pgvector
- MinIO (almacenamiento S3-compatible)
- JWT para autenticación (stateless)
- bcrypt para passwords
- node-cache (caché en memoria local, opcional)

**Frontend:**
- React 18
- React Router v6
- Axios
- Tailwind CSS
- Lucide Icons
- Context API para estado global

**IA:**
- OpenAI API:
  - `gpt-5-mini` (análisis general, embeddings)
  - `gpt-5` (análisis profundo)
  - `text-embedding-3-small` (embeddings 1536 dims)

**DevOps:**
- Docker + Docker Compose
- Nodemon (dev)
- Vite (frontend dev server)

---

## 📁 ESTRUCTURA DE CARPETAS

```
DILUS_AI/
├── docker-compose.yml
├── .env.example
├── .gitignore
├── README.md
│
├── backend/
│   ├── Dockerfile
│   ├── package.json
│   ├── index.js
│   ├── .env
│   │
│   ├── config/
│   │   └── database.js
│   │
│   ├── middleware/
│   │   ├── auth.js
│   │   ├── errorHandler.js
│   │   └── logger.js
│   │
│   ├── routes/
│   │   ├── auth.js
│   │   ├── projects.js
│   │   ├── documents.js
│   │   ├── analysis.js
│   │   ├── vault.js
│   │   └── admin.js
│   │
│   ├── services/
│   │   ├── aiService.js          # Wrapper para OpenAI (GPT-5 mini/standard)
│   │   ├── embeddingService.js   # Generación de embeddings
│   │   ├── ragService.js         # RAG con búsqueda híbrida
│   │   ├── documentService.js    # Extracción de texto (PDF, DOCX, TXT)
│   │   ├── minioService.js       # Upload/download archivos
│   │   ├── pgService.js          # Queries PostgreSQL
│   │   └── docgenService.js      # Generación de DOCX
│   │
│   ├── utils/
│   │   ├── logger.js
│   │   ├── validators.js
│   │   └── prompts.js            # Prompts de IA
│   │
│   └── models/                    # Opcional: si usas ORM
│
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── index.html
│   │
│   ├── src/
│   │   ├── main.jsx
│   │   ├── App.jsx
│   │   ├── index.css
│   │   │
│   │   ├── contexts/
│   │   │   ├── AuthContext.jsx
│   │   │   └── ThemeContext.jsx
│   │   │
│   │   ├── pages/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── ProjectView.jsx
│   │   │   ├── Login.jsx
│   │   │   └── AdminPanel.jsx
│   │   │
│   │   ├── components/
│   │   │   ├── Header.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   ├── ProjectCard.jsx
│   │   │   ├── DocumentList.jsx
│   │   │   ├── AnalysisTabs.jsx
│   │   │   ├── VaultChat.jsx
│   │   │   ├── ThemeToggle.jsx
│   │   │   └── Modal.jsx
│   │   │
│   │   └── api/
│   │       └── client.js         # Axios instance con interceptors
│   │
│   └── public/
│       └── favicon.ico
│
├── docgen/                        # Servicio Python para generar DOCX
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── main.py                    # FastAPI
│   └── templates/
│       ├── oferta_template.docx
│       └── doc_tecnica_template.docx
│
├── sql/
│   ├── 01_init.sql                # Crear tablas base
│   ├── 02_pgvector.sql            # Configurar pgvector
│   └── 03_seed_admin.sql          # Usuario admin inicial
│
└── docs/
    ├── API.md                     # Documentación de endpoints
    ├── DEPLOYMENT.md              # Guía de despliegue
    └── FEATURES.md                # Features implementadas
```

---

## 🗄️ BASE DE DATOS (PostgreSQL)

### Script SQL: `sql/01_init.sql`

```sql
-- Activar extensión pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================
-- TABLA: users
-- ============================================
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

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);

-- ============================================
-- TABLA: projects
-- ============================================
CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_status ON projects(status);

-- ============================================
-- TABLA: documents
-- ============================================
CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  project_id INTEGER REFERENCES projects(id) ON DELETE CASCADE,
  uploaded_by INTEGER NOT NULL REFERENCES users(id),
  filename VARCHAR(500) NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type VARCHAR(100),
  is_vault_document BOOLEAN DEFAULT FALSE,
  vectorization_status VARCHAR(50) DEFAULT 'pending',
  vectorization_error TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_documents_project_id ON documents(project_id);
CREATE INDEX idx_documents_uploaded_by ON documents(uploaded_by);
CREATE INDEX idx_documents_is_vault_document ON documents(is_vault_document);

-- ============================================
-- TABLA: embeddings
-- ============================================
CREATE TABLE embeddings (
  id SERIAL PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  embedding vector(1536),
  tsv tsvector GENERATED ALWAYS AS (to_tsvector('spanish', chunk_text)) STORED,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_embeddings_document_id ON embeddings(document_id);
CREATE INDEX idx_embeddings_tsv ON embeddings USING GIN(tsv);
CREATE INDEX idx_embeddings_embedding ON embeddings USING ivfflat (embedding vector_cosine_ops);

-- ============================================
-- TABLA: analysis_results
-- ============================================
CREATE TABLE analysis_results (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id),
  analysis_type VARCHAR(50) NOT NULL,
  input_document_ids INTEGER[],
  result_data JSONB,
  result_file_path TEXT,
  ai_model_used VARCHAR(50),
  tokens_used INTEGER,
  duration_ms INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_analysis_results_project_id ON analysis_results(project_id);
CREATE INDEX idx_analysis_results_analysis_type ON analysis_results(analysis_type);

-- ============================================
-- TABLA: vault_queries
-- ============================================
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

CREATE INDEX idx_vault_queries_user_id ON vault_queries(user_id);
CREATE INDEX idx_vault_queries_created_at ON vault_queries(created_at DESC);
```

### Script SQL: `sql/02_pgvector.sql`

```sql
-- Función de búsqueda híbrida (Vector + BM25)
CREATE OR REPLACE FUNCTION hybrid_search(
  query_embedding vector(1536),
  query_text TEXT,
  doc_id INTEGER DEFAULT NULL,
  similarity_threshold FLOAT DEFAULT 0.5,
  top_k INTEGER DEFAULT 5,
  vector_weight FLOAT DEFAULT 0.6,
  bm25_weight FLOAT DEFAULT 0.4
)
RETURNS TABLE (
  id INTEGER,
  document_id INTEGER,
  chunk_text TEXT,
  chunk_index INTEGER,
  vector_similarity FLOAT,
  bm25_score FLOAT,
  hybrid_score FLOAT,
  metadata JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.document_id,
    e.chunk_text,
    e.chunk_index,
    (1 - (e.embedding <=> query_embedding)) AS vector_similarity,
    ts_rank(e.tsv, plainto_tsquery('spanish', query_text)) AS bm25_score,
    (
      (1 - (e.embedding <=> query_embedding)) * vector_weight +
      ts_rank(e.tsv, plainto_tsquery('spanish', query_text)) * bm25_weight
    ) AS hybrid_score,
    e.metadata
  FROM embeddings e
  WHERE 
    (doc_id IS NULL OR e.document_id = doc_id)
    AND (1 - (e.embedding <=> query_embedding)) > similarity_threshold
  ORDER BY hybrid_score DESC
  LIMIT top_k;
END;
$$ LANGUAGE plpgsql;
```

### Script SQL: `sql/03_seed_admin.sql`

```sql
-- Usuario admin (password: admin123)
INSERT INTO users (username, email, password_hash, full_name, is_admin)
VALUES (
  'admin',
  'admin@dilusai.com',
  '$2b$10$llN5u160s5JvbNCn.QpP7.BWTjLawcxQSQMBDX6YXv3T8cYBVVA5u',
  'Administrador',
  TRUE
)
ON CONFLICT (username) DO NOTHING;

-- Usuario demo (password: demo123)
INSERT INTO users (username, email, password_hash, full_name, is_admin)
VALUES (
  'demo',
  'demo@dilusai.com',
  '$2b$10$poiLeBEFsLBxu67ByRDykeZKkaTAnUwDHqVTgugCbn4n5kQABxvuW',
  'Usuario Demo',
  FALSE
)
ON CONFLICT (username) DO NOTHING;
```

---

## 🐳 DOCKER COMPOSE

### `docker-compose.yml`

```yaml
version: '3.8'

services:
  # PostgreSQL con pgvector
  postgres:
    image: pgvector/pgvector:pg16
    container_name: dilus_postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres_secure_2025
      POSTGRES_DB: dilus_ai
    volumes:
      - ./pgdata:/var/lib/postgresql/data
      - ./sql:/docker-entrypoint-initdb.d
    ports:
      - "5432:5432"
    restart: unless-stopped
    networks:
      - dilus_network

  # MinIO (S3-compatible storage)
  minio:
    image: minio/minio
    container_name: dilus_minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: dilus_admin
      MINIO_ROOT_PASSWORD: dilus_secret_2025
    volumes:
      - ./minio_data:/data
    ports:
      - "9000:9000"
      - "9001:9001"
    restart: unless-stopped
    networks:
      - dilus_network

  # Backend API
  backend:
    build: ./backend
    container_name: dilus_backend
    env_file: ./backend/.env
    depends_on:
      - postgres
      - minio
    ports:
      - "8080:8080"
    volumes:
      - ./backend:/app
      - /app/node_modules
    restart: unless-stopped
    networks:
      - dilus_network

  # DocGen (Python FastAPI)
  docgen:
    build: ./docgen
    container_name: dilus_docgen
    ports:
      - "8090:8090"
    restart: unless-stopped
    networks:
      - dilus_network

  # Frontend (React + Vite)
  frontend:
    build: ./frontend
    container_name: dilus_frontend
    depends_on:
      - backend
    ports:
      - "5173:5173"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    environment:
      - VITE_API_URL=http://localhost:8080
    restart: unless-stopped
    networks:
      - dilus_network

networks:
  dilus_network:
    driver: bridge
```

---

## ⚙️ BACKEND (Node.js + Express)

### `backend/package.json`

```json
{
  "name": "dilus-ai-backend",
  "version": "2.0.0",
  "type": "module",
  "scripts": {
    "start": "node index.js",
    "dev": "nodemon index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "pg": "^8.11.0",
    "@aws-sdk/client-s3": "^3.400.0",
    "@aws-sdk/s3-request-presigner": "^3.400.0",
    "bcrypt": "^5.1.1",
    "jsonwebtoken": "^9.0.2",
    "dotenv": "^16.3.0",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "express-rate-limit": "^7.1.0",
    "multer": "^1.4.5-lts.1",
    "pdf-parse": "^1.1.1",
    "mammoth": "^1.6.0",
    "winston": "^3.11.0",
    "axios": "^1.6.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}
```

### `backend/Dockerfile`

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 8080

CMD ["npm", "run", "dev"]
```

### `backend/.env.example`

```bash
# PostgreSQL
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres_secure_2025
POSTGRES_DB=dilus_ai

# MinIO
MINIO_ENDPOINT=http://minio:9000
MINIO_ACCESS_KEY=dilus_admin
MINIO_SECRET_KEY=dilus_secret_2025
MINIO_BUCKET=dilus-ai
MINIO_USE_SSL=false

# OpenAI API
OPENAI_API_KEY=sk-proj-... # GPT-5 Mini y Embeddings
OPENAI_API_KEY_STANDARD=sk-proj-... # GPT-5 Estándar (opcional, puede ser la misma)

# JWT
JWT_SECRET=change_this_secret_in_production
JWT_EXPIRES_IN=7d

# Server
PORT=8080
NODE_ENV=development

# RAG
RAG_CHUNK_SIZE=1000
RAG_CHUNK_OVERLAP=200
RAG_TOP_K=5
RAG_SIMILARITY_THRESHOLD=0.7

# DocGen
DOCGEN_URL=http://docgen:8090
```

### `backend/index.js`

```javascript
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { initDatabase } from './config/database.js';
import { errorHandler } from './middleware/errorHandler.js';
import { logger } from './utils/logger.js';

// Routes
import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import documentRoutes from './routes/documents.js';
import analysisRoutes from './routes/analysis.js';
import vaultRoutes from './routes/vault.js';
import adminRoutes from './routes/admin.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/vault', vaultRoutes);
app.use('/api/admin', adminRoutes);

// Error handler (debe ir al final)
app.use(errorHandler);

// Iniciar servidor
async function start() {
  try {
    await initDatabase();
    logger.info('Database connected');

    app.listen(PORT, () => {
      logger.info(`🚀 DILUS_AI Backend running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
    });
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
}

start();
```

### `backend/middleware/auth.js`

```javascript
import jwt from 'jsonwebtoken';
import { query } from '../config/database.js';

const JWT_SECRET = process.env.JWT_SECRET;

export function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
      email: user.email,
      is_admin: user.is_admin
    },
    JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

export async function authenticateToken(req, res, next) {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ error: 'Token no proporcionado' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);

    // Obtener usuario de la DB
    const result = await query(
      'SELECT id, username, email, full_name, avatar_url, is_active, is_admin FROM users WHERE id = $1',
      [decoded.id]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ error: 'Usuario desactivado' });
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      return res.status(403).json({ error: 'Token inválido' });
    } else if (error instanceof jwt.TokenExpiredError) {
      return res.status(403).json({ error: 'Token expirado' });
    }
    return res.status(500).json({ error: 'Error en autenticación' });
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user || !req.user.is_admin) {
    return res.status(403).json({ error: 'Acceso denegado - se requiere admin' });
  }
  next();
}
```

### IMPORTANTE: Servicios de IA

**`backend/services/aiService.js`**
Debe implementar:
- `generateWithGPT5Mini(prompt, options)` → usa `gpt-5-mini`
- `generateWithGPT5Standard(prompt, options)` → usa `gpt-5`
- `estimateTokens(text)` → estima tokens (1 token ≈ 4 chars)
- `canFitInContext(text)` → verifica si cabe en límite (272k tokens para mini)

**`backend/services/embeddingService.js`**
Debe implementar:
- `generateEmbedding(text)` → usa `text-embedding-3-small`, devuelve array[1536]

**`backend/services/ragService.js`**
Debe implementar:
- `ingestDocument(documentId, text, metadata)` → chunking + embeddings + guardar
- `searchSimilar(queryText, options)` → busca en toda la bóveda
- `searchInDocument(documentId, queryText, options)` → busca en un doc específico
- `hybridSearch(embedding, text, documentId)` → usa función SQL híbrida

**`backend/services/documentService.js`**
Debe implementar:
- `extractTextFromPDF(buffer)` → usa pdf-parse
- `extractTextFromDOCX(buffer)` → usa mammoth
- `extractTextFromTXT(buffer)` → buffer.toString('utf-8')

---

## 🎨 FRONTEND (React + Tailwind)

### `frontend/package.json`

```json
{
  "name": "dilus-ai-frontend",
  "version": "2.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "axios": "^1.6.0",
    "lucide-react": "^0.300.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.0",
    "vite": "^5.0.0",
    "tailwindcss": "^3.4.0",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32"
  }
}
```

### `frontend/Dockerfile`

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
```

### `frontend/tailwind.config.js`

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          100: '#dbeafe',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          900: '#1e3a8a',
        },
      },
    },
  },
  plugins: [],
}
```

### `frontend/src/App.jsx`

```jsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ProjectView from './pages/ProjectView';
import AdminPanel from './pages/AdminPanel';

function ProtectedRoute({ children, requireAdmin = false }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
    </div>;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requireAdmin && !user.is_admin) {
    return <Navigate to="/" replace />;
  }

  return children;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            } />
            <Route path="/project/:id" element={
              <ProtectedRoute>
                <ProjectView />
              </ProtectedRoute>
            } />
            <Route path="/admin" element={
              <ProtectedRoute requireAdmin={true}>
                <AdminPanel />
              </ProtectedRoute>
            } />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
```

### COMPONENTES CLAVE A IMPLEMENTAR

**`frontend/src/pages/Dashboard.jsx`**
- Mostrar lista de proyectos del usuario (tarjetas)
- Botón "Nuevo Proyecto"
- Botón para abrir Chat de la Bóveda (modal)
- Header con logo, nombre usuario, tema toggle, logout

**`frontend/src/pages/ProjectView.jsx`**
- Layout con sidebar izquierdo (documentos) + panel central (tabs)
- Sidebar: DocumentList component
- Tabs: AnalysisTabs component con 4 tabs:
  1. Evaluar Pliego Técnico
  2. Evaluar Contrato
  3. Generar Oferta
  4. Generar Documentación Técnica
- Cada tab tiene:
  - Selector de documentos (checkboxes)
  - Botón "Ejecutar Análisis"
  - Botón "Repetir con IA Mejorada 🔄" (solo tabs 1 y 2)
  - Área de resultados

**`frontend/src/components/VaultChat.jsx`**
- Modal o sidebar con chat limpio
- Input de texto + botón enviar
- Área de mensajes (pregunta + respuesta)
- **No historial persistente** (se limpia al cerrar)

**`frontend/src/pages/AdminPanel.jsx`**
- Tabs:
  1. Alimentador de la Bóveda (subir docs)
  2. Gestión de Usuarios (lista, editar, desactivar)
  3. Estadísticas (gráficos de uso)

---

## 🐍 DOCGEN (Python + FastAPI)

### `docgen/requirements.txt`

```
fastapi==0.109.0
uvicorn==0.27.0
python-docx==1.1.0
pydantic==2.5.0
```

### `docgen/Dockerfile`

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8090

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8090", "--reload"]
```

### `docgen/main.py`

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from docx import Document
from docx.shared import Pt, Inches
import io
from typing import List, Dict, Any

app = FastAPI(title="DILUS_AI DocGen")

class OfertaData(BaseModel):
    cliente: str
    proyecto: str
    propuesta_tecnica: str
    alcance: str
    plazos: str
    conceptos_precio: List[str]

class DocumentacionData(BaseModel):
    titulo: str
    tipo_documento: str  # "Memoria técnica", "Manual de instalación", etc.
    contenido: str
    secciones: List[Dict[str, Any]]

@app.get("/health")
def health():
    return {"status": "ok"}

@app.post("/generate/oferta")
def generate_oferta(data: OfertaData):
    """
    Genera un documento DOCX de oferta comercial.
    """
    try:
        doc = Document()
        
        # Título
        title = doc.add_heading('PROPUESTA TÉCNICA Y COMERCIAL', level=1)
        title.alignment = 1  # Centrado
        
        # Cliente
        doc.add_heading('Cliente', level=2)
        doc.add_paragraph(data.cliente)
        
        # Proyecto
        doc.add_heading('Proyecto', level=2)
        doc.add_paragraph(data.proyecto)
        
        # Propuesta Técnica
        doc.add_heading('Propuesta Técnica', level=2)
        doc.add_paragraph(data.propuesta_tecnica)
        
        # Alcance
        doc.add_heading('Alcance del Proyecto', level=2)
        doc.add_paragraph(data.alcance)
        
        # Plazos
        doc.add_heading('Plazos de Ejecución', level=2)
        doc.add_paragraph(data.plazos)
        
        # Conceptos de Precio
        doc.add_heading('Estructura de Precios', level=2)
        for concepto in data.conceptos_precio:
            doc.add_paragraph(concepto, style='List Bullet')
        
        # Guardar en memoria
        file_stream = io.BytesIO()
        doc.save(file_stream)
        file_stream.seek(0)
        
        return {
            "success": True,
            "filename": f"oferta_{data.cliente.replace(' ', '_')}.docx"
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/generate/documentacion")
def generate_documentacion(data: DocumentacionData):
    """
    Genera documentación técnica en formato DOCX.
    """
    try:
        doc = Document()
        
        # Título
        title = doc.add_heading(data.titulo, level=1)
        title.alignment = 1
        
        # Tipo de documento
        doc.add_paragraph(f"Tipo: {data.tipo_documento}", style='Subtitle')
        doc.add_paragraph("")
        
        # Contenido general
        doc.add_paragraph(data.contenido)
        
        # Secciones
        for seccion in data.secciones:
            doc.add_heading(seccion.get('titulo', 'Sección'), level=2)
            doc.add_paragraph(seccion.get('contenido', ''))
        
        file_stream = io.BytesIO()
        doc.save(file_stream)
        file_stream.seek(0)
        
        return {
            "success": True,
            "filename": f"{data.tipo_documento.replace(' ', '_')}.docx"
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
```

---

## 🔐 PROMPTS DE IA

### `backend/utils/prompts.js`

```javascript
export const PROMPT_ANALIZAR_PLIEGO = `Eres un experto en análisis de pliegos técnicos de ingeniería. 

Analiza el siguiente pliego y devuelve un JSON estructurado con:
{
  "requisitos_tecnicos": [
    { "categoria": "...", "descripcion": "...", "prioridad": "alta/media/baja" }
  ],
  "normativas_aplicables": ["Normativa 1", "Normativa 2"],
  "equipamiento_necesario": [
    { "tipo": "...", "especificaciones": "..." }
  ],
  "complejidad": "baja/media/alta",
  "riesgos": [
    { "riesgo": "...", "impacto": "alto/medio/bajo", "mitigacion": "..." }
  ],
  "observaciones": "..."
}

PLIEGO:
{texto}

Responde ÚNICAMENTE con el JSON, sin texto adicional.`;

export const PROMPT_ANALIZAR_CONTRATO = `Eres un experto legal en contratos de ingeniería.

Analiza el siguiente contrato y devuelve un JSON estructurado con:
{
  "clausulas_importantes": [
    { "clausula": "...", "descripcion": "...", "importancia": "crítica/alta/media" }
  ],
  "obligaciones_contratista": ["Obligación 1", "Obligación 2"],
  "plazos_entrega": {
    "fecha_inicio": "...",
    "fecha_fin": "...",
    "hitos": [{"hito": "...", "fecha": "..."}]
  },
  "penalizaciones": [
    { "concepto": "...", "tipo": "...", "impacto": "..." }
  ],
  "riesgos_legales": [
    { "riesgo": "...", "gravedad": "alta/media/baja", "recomendacion": "..." }
  ],
  "observaciones": "..."
}

CONTRATO:
{texto}

Responde ÚNICAMENTE con el JSON, sin texto adicional.`;

export const PROMPT_GENERAR_OFERTA = `Eres un experto en redacción de propuestas técnicas y comerciales.

Basándote en la siguiente información de contexto, genera una propuesta estructurada.

CONTEXTO:
{contexto}

CLIENTE: {cliente}
OBSERVACIONES: {observaciones}

Genera un JSON con:
{
  "propuesta_tecnica": "Descripción técnica de la solución propuesta...",
  "alcance": "Alcance detallado del proyecto...",
  "plazos": "Plazos estimados de ejecución...",
  "conceptos_precio": [
    "Concepto 1: Descripción",
    "Concepto 2: Descripción"
  ]
}

Responde ÚNICAMENTE con el JSON.`;

export const PROMPT_GENERAR_DOCUMENTACION = `Eres un experto en redacción de documentación técnica.

Basándote en el siguiente contexto, genera documentación técnica del tipo: {tipo_documento}

CONTEXTO:
{contexto}

TÍTULO: {titulo}

Genera un JSON con:
{
  "contenido_principal": "Introducción y contenido general...",
  "secciones": [
    {
      "titulo": "Título de sección",
      "contenido": "Contenido detallado de la sección..."
    }
  ]
}

Responde ÚNICAMENTE con el JSON.`;
```

---

## 🚀 INSTRUCCIONES DE IMPLEMENTACIÓN

### FASE 1: Infraestructura Base (Día 1)

1. Crear estructura de carpetas según especificación
2. Configurar Docker Compose con todos los servicios
3. Crear scripts SQL de inicialización
4. Configurar backend básico (Express + middleware)
5. Configurar frontend básico (React + Router + Tailwind)
6. Verificar que todos los servicios levantan correctamente

### FASE 2: Autenticación (Día 2)

1. Implementar middleware de auth JWT
2. Crear endpoints de login/register
3. Crear página de Login en frontend
4. Implementar AuthContext en frontend
5. Proteger rutas con ProtectedRoute

### FASE 3: Proyectos y Documentos (Día 3-4)

1. Implementar CRUD de proyectos (backend)
2. Implementar upload de documentos a MinIO (backend)
3. Implementar servicio de extracción de texto (PDF, DOCX, TXT)
4. Crear página Dashboard (frontend)
5. Crear página ProjectView con layout sidebar + tabs
6. Implementar DocumentList component con upload

### FASE 4: RAG y Embeddings (Día 5-6)

1. Implementar embeddingService (OpenAI text-embedding-3-small)
2. Implementar ragService (chunking, ingestion, search)
3. Implementar vectorización automática al subir docs
4. Crear función SQL de búsqueda híbrida
5. Testear búsqueda semántica

### FASE 5: Análisis con IA (Día 7-8)

1. Implementar aiService (GPT-5 mini y standard)
2. Crear prompts especializados
3. Implementar lógica de decisión: texto completo vs RAG
4. Crear endpoints de análisis (pliego, contrato)
5. Implementar tabs de análisis en frontend
6. Implementar botón "Repetir con IA Mejorada"

### FASE 6: Generación de Documentos (Día 9)

1. Implementar servicio DocGen (Python FastAPI)
2. Crear templates de DOCX
3. Implementar endpoints de generación
4. Conectar frontend con DocGen
5. Implementar descarga de archivos generados

### FASE 7: Chat de la Bóveda (Día 10)

1. Implementar endpoint de consulta a bóveda
2. Crear component VaultChat (modal o sidebar)
3. Implementar lógica de chat sin historial
4. Conectar con RAG para búsqueda global

### FASE 8: Panel de Administración (Día 11-12)

1. Crear endpoints de admin (vault, users, stats)
2. Implementar subida de docs a bóveda con metadata especial
3. Crear página AdminPanel con tabs
4. Implementar gestión de usuarios
5. Implementar estadísticas del sistema

### FASE 9: UI/UX (Día 13-14)

1. Implementar ThemeContext (modo claro/oscuro)
2. Refinar estilos con Tailwind
3. Añadir iconos con Lucide
4. Implementar responsive design
5. Añadir loading states y error handling
6. Mejorar transiciones y animaciones

### FASE 10: Testing y Documentación (Día 15)

1. Testear flujos completos end-to-end
2. Escribir README.md
3. Documentar API endpoints
4. Crear guía de despliegue
5. Optimizar rendimiento
6. Fix bugs finales

---

## ✅ CHECKLIST DE COMPLETITUD

### Backend
- [ ] Express server configurado con middleware
- [ ] JWT authentication funcionando (stateless)
- [ ] Conexión a PostgreSQL con pool
- [ ] Conexión a MinIO (upload/download)
- [ ] CRUD de proyectos
- [ ] Upload y gestión de documentos
- [ ] Extracción de texto (PDF, DOCX, TXT)
- [ ] Servicio de embeddings (OpenAI)
- [ ] Servicio RAG (chunking, ingestion, búsqueda híbrida)
- [ ] Análisis con GPT-5 Mini
- [ ] Análisis con GPT-5 Estándar
- [ ] Generación de ofertas (integrado con DocGen)
- [ ] Generación de documentación técnica
- [ ] Chat de la Bóveda (sin historial)
- [ ] Endpoints de admin (vault, users, stats)
- [ ] Error handling global
- [ ] Logging con Winston

### Frontend
- [ ] React Router configurado
- [ ] AuthContext con JWT
- [ ] ThemeContext (modo oscuro/claro)
- [ ] Página de Login
- [ ] Dashboard con lista de proyectos
- [ ] Modal de crear proyecto
- [ ] Página de ProjectView (layout completo)
- [ ] Sidebar de documentos con upload
- [ ] Tabs de análisis (4 tabs implementados)
- [ ] Selectores de documentos (checkboxes)
- [ ] Botón "Repetir con IA Mejorada"
- [ ] Área de resultados de análisis
- [ ] VaultChat component (modal o sidebar)
- [ ] Panel de Administración (3 tabs)
- [ ] Gestión de usuarios (admin)
- [ ] Alimentador de la Bóveda (admin)
- [ ] Estadísticas del sistema (admin)
- [ ] Responsive design
- [ ] Estados de loading
- [ ] Error handling y mensajes de usuario

### DocGen
- [ ] FastAPI configurado
- [ ] Endpoint /generate/oferta
- [ ] Endpoint /generate/documentacion
- [ ] Templates DOCX funcionales
- [ ] Generación de archivos en memoria

### Base de Datos
- [ ] Extensión pgvector instalada
- [ ] Todas las tablas creadas
- [ ] Índices de búsqueda creados
- [ ] Función hybrid_search implementada
- [ ] Usuarios admin y demo creados

### DevOps
- [ ] Docker Compose funcional
- [ ] Variables de entorno documentadas
- [ ] .env.example creado
- [ ] .gitignore configurado
- [ ] README.md completo
- [ ] Scripts SQL en /sql ejecutándose al inicio

---

## 📚 DOCUMENTACIÓN ADICIONAL A CREAR

### `README.md` (Raíz del proyecto)

Debe incluir:
- Descripción del proyecto
- Requisitos previos (Docker, Docker Compose)
- Instrucciones de instalación
- Configuración de variables de entorno
- Cómo levantar el sistema
- Credenciales por defecto (admin/admin123, demo/demo123)
- Arquitectura del sistema (diagrama)
- Stack tecnológico
- Contribución y contacto

### `docs/API.md`

Documentar todos los endpoints:
- Método HTTP
- Ruta
- Headers requeridos (JWT)
- Body de ejemplo
- Respuesta de ejemplo
- Códigos de error

### `docs/DEPLOYMENT.md`

Guía de despliegue en producción:
- Configuración de variables de entorno seguras
- Configuración de SSL
- Reverse proxy (Nginx)
- Backups de PostgreSQL
- Escalabilidad
- Monitoreo

---

## 🎯 OBJETIVOS DE CALIDAD

1. **Código limpio:** Nombres descriptivos, funciones pequeñas, comentarios donde sea necesario
2. **Modularidad:** Separación clara de responsabilidades
3. **Error handling:** Todos los errores manejados apropiadamente
4. **Logging:** Logs estructurados con niveles (info, warn, error)
5. **Performance:** Respuestas < 30s para análisis, < 2s para queries simples
6. **Seguridad:** JWT seguro, passwords hasheados, validación de inputs
7. **UX:** Interfaz intuitiva, feedback visual, loading states
8. **Documentación:** README completo, código autodocumentado

---

## 🚨 NOTAS CRÍTICAS

1. **NO uses código del sistema anterior**, genera todo desde cero siguiendo estas especificaciones
2. **Elimina TODO lo relacionado con SAP** (no existe en este sistema)
3. **El Chat de la Bóveda NO guarda historial** (sin tabla de conversaciones para el vault)
4. **Decisión inteligente:** Si documento cabe en límite de tokens → texto completo, si no → RAG
5. **Dos modelos de IA:** GPT-5 Mini (default) + GPT-5 Estándar (solo botón específico)
6. **Metadata de documentos:** Siempre incluir `uploaded_by_admin` y `is_vault_document`
7. **Búsqueda híbrida:** Combinar vector (pgvector) + BM25 (tsvector)
8. **Estilo moderno:** Tailwind con paleta corporativa, modo oscuro/claro

---

## ✨ RESULTADO ESPERADO

Al finalizar, debes tener un sistema completo y funcional que:

✅ Permite a usuarios crear proyectos y gestionar documentos  
✅ Analiza pliegos técnicos y contratos con IA  
✅ Genera ofertas y documentación técnica en DOCX  
✅ Proporciona un chat con la bóveda para consultas rápidas  
✅ Permite a administradores alimentar la bóveda con docs corporativos  
✅ Tiene una interfaz moderna con modo oscuro/claro  
✅ Está completamente dockerizado y listo para desplegar  

---

**¡Éxito en la implementación de DILUS_AI!** 🚀

