# 🚀 DILUS_AI v2.0

**Plataforma de gestión de proyectos de ingeniería con análisis de documentación técnica mediante IA**

---

## 📋 Descripción

DILUS_AI es una aplicación web moderna que permite a ingenieros y gestores de proyectos:

- 📂 Organizar trabajo en proyectos independientes
- 📄 Subir y analizar documentación técnica (PDF, DOCX, TXT)
- 🤖 Evaluar pliegos técnicos y contratos con IA
- 📝 Generar ofertas y documentación técnica automatizada
- 💬 Consultar una bóveda de conocimiento corporativo
- 👥 Gestionar usuarios y documentación (administradores)

---

## 🏗️ Arquitectura

### Stack Tecnológico

**Backend:**
- Node.js v20 + Express.js
- PostgreSQL 16 con pgvector
- MinIO (almacenamiento S3-compatible)
- JWT para autenticación

**Frontend:**
- React 18
- React Router v6
- Tailwind CSS
- Lucide Icons

**IA:**
- OpenAI GPT-5 Mini (análisis general)
- OpenAI GPT-5 Standard (análisis profundo)
- text-embedding-3-small (embeddings)

**DevOps:**
- Docker + Docker Compose
- Nodemon (desarrollo)
- Vite (dev server frontend)

---

## 🚀 Inicio Rápido

### Prerrequisitos

- Docker y Docker Compose instalados
- API Key de OpenAI

### 1. Clonar el repositorio

```bash
git clone <repository-url>
cd DILUS_AI
```

### 2. Configurar variables de entorno

```bash
# Backend
cp backend/.env.example backend/.env
```

Edita `backend/.env` y configura tu API Key de OpenAI:

```bash
OPENAI_API_KEY=sk-proj-your-key-here
OPENAI_API_KEY_STANDARD=sk-proj-your-key-here  # Puede ser la misma
```

### 3. Levantar servicios

```bash
docker-compose up -d
```

### 4. Acceder a la aplicación

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8080
- **MinIO Console:** http://localhost:9001
- **DocGen:** http://localhost:8090

### 5. Login

**Usuario Admin:**
- Username: `admin`
- Password: `admin123`

**Usuario Demo:**
- Username: `demo`
- Password: `demo123`

---

## 📁 Estructura del Proyecto

```
DILUS_AI/
├── backend/          # API REST (Node.js + Express)
├── frontend/         # Interfaz web (React + Tailwind)
├── docgen/           # Generador de documentos (Python FastAPI)
├── sql/              # Scripts de inicialización de BD
├── docs/             # Documentación adicional
└── docker-compose.yml
```

---

## 🎯 Funcionalidades Principales

### Para Usuarios:
- ✅ Crear y gestionar proyectos
- ✅ Subir documentos técnicos
- ✅ Analizar pliegos técnicos con IA
- ✅ Analizar contratos con IA
- ✅ Generar ofertas personalizadas
- ✅ Generar documentación técnica
- ✅ Consultar la Bóveda de conocimiento
- ✅ Repetir análisis con IA mejorada

### Para Administradores:
- ✅ Alimentar la Bóveda con documentación corporativa
- ✅ Gestionar usuarios del sistema
- ✅ Ver estadísticas de uso
- ✅ Monitorear estado de servicios

---

## 🤖 Configuración de IA

### Dos Niveles de Análisis

**GPT-5 Mini (por defecto):**
- Rápido y económico
- Suficiente para el 90% de casos
- Análisis de pliegos, contratos, generación de docs

**GPT-5 Standard (premium):**
- Análisis más profundo
- Se activa con botón "Repetir con IA Mejorada 🔄"
- Mayor capacidad de razonamiento

---

## 📦 Variables de Entorno

Ver `backend/.env.example` para la lista completa.

**Críticas:**
```bash
OPENAI_API_KEY=sk-proj-...           # GPT-5 Mini + Embeddings
OPENAI_API_KEY_STANDARD=sk-proj-...  # GPT-5 Standard (opcional)
JWT_SECRET=change_in_production      # Secret para JWT
```

---

## 🗄️ Base de Datos

### Tablas Principales:
- `users` - Usuarios del sistema
- `projects` - Proyectos de ingeniería
- `documents` - Documentos subidos
- `embeddings` - Vectores para RAG
- `analysis_results` - Resultados de análisis
- `vault_queries` - Estadísticas de consultas

### Extensiones:
- `pgvector` - Búsqueda vectorial para RAG

---

## 🔐 Seguridad

- Autenticación JWT stateless
- Contraseñas hasheadas con bcrypt
- Rutas protegidas con middleware
- Validación de inputs
- CORS configurado

---

## 🐳 Comandos Docker

```bash
# Levantar servicios
docker-compose up -d

# Ver logs
docker-compose logs -f

# Parar servicios
docker-compose down

# Resetear base de datos (⚠️ borra todos los datos)
docker-compose down -v
docker-compose up -d
```

---

## 📚 Documentación Adicional

- [API Endpoints](docs/API.md)
- [Guía de Despliegue](docs/DEPLOYMENT.md)
- [Features Implementados](docs/FEATURES.md)

---

## 🛠️ Desarrollo

### Backend

```bash
cd backend
npm install
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### DocGen

```bash
cd docgen
pip install -r requirements.txt
uvicorn main:app --reload --port 8090
```

---

## 🎨 Diseño

- **Paleta:** Azul corporativo (#2563eb) + acentos verdes
- **Modo oscuro/claro:** Toggle en header
- **Responsive:** Desktop-first, adaptado a tablets
- **Iconos:** Lucide Icons

---

## 🧪 Testing

```bash
# Backend
cd backend
npm test

# Frontend
cd frontend
npm test
```

---

## 📄 Licencia

Propietario - DILUS_AI 2025

---

## 👥 Contacto

Para soporte o consultas, contactar al equipo de desarrollo.

---

**¡Listo para transformar la gestión de proyectos de ingeniería con IA!** 🚀

