# 📡 DILUS_AI - API Documentation

**Version:** 2.0.0  
**Base URL:** `http://localhost:8080/api`

---

## 🔐 Authentication

All endpoints (except auth routes) require a JWT token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

---

## 📚 Endpoints

### **Authentication**

#### `POST /auth/register`
Register a new user

**Request Body:**
```json
{
  "username": "john_doe",
  "email": "john@example.com",
  "password": "password123",
  "full_name": "John Doe"
}
```

**Response:** `201 Created`
```json
{
  "message": "Usuario registrado exitosamente",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "john_doe",
    "email": "john@example.com",
    "full_name": "John Doe",
    "is_admin": false
  }
}
```

---

#### `POST /auth/login`
Login

**Request Body:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Response:** `200 OK`
```json
{
  "message": "Login exitoso",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@dilusai.com",
    "full_name": "Administrador",
    "is_admin": true
  }
}
```

---

#### `GET /auth/me`
Get current user info

**Response:** `200 OK`
```json
{
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@dilusai.com",
    "full_name": "Administrador",
    "is_admin": true
  }
}
```

---

### **Projects**

#### `GET /projects`
List user's projects

**Query Parameters:**
- `status` (optional): Filter by status (`active`, `archived`)

**Response:** `200 OK`
```json
{
  "projects": [
    {
      "id": 1,
      "user_id": 1,
      "name": "Licitación Metro",
      "description": "Proyecto de licitación para metro de la ciudad",
      "status": "active",
      "created_at": "2025-11-06T10:00:00Z",
      "updated_at": "2025-11-06T10:00:00Z"
    }
  ],
  "total": 1
}
```

---

#### `POST /projects`
Create new project

**Request Body:**
```json
{
  "name": "Hospital Central",
  "description": "Instalaciones eléctricas para hospital"
}
```

**Response:** `201 Created`
```json
{
  "message": "Proyecto creado exitosamente",
  "project": {
    "id": 2,
    "user_id": 1,
    "name": "Hospital Central",
    "description": "Instalaciones eléctricas para hospital",
    "status": "active",
    "created_at": "2025-11-06T11:00:00Z",
    "updated_at": "2025-11-06T11:00:00Z"
  }
}
```

---

#### `GET /projects/:id`
Get project details

**Response:** `200 OK`
```json
{
  "project": {
    "id": 1,
    "user_id": 1,
    "name": "Licitación Metro",
    "description": "Proyecto de licitación para metro de la ciudad",
    "status": "active",
    "created_at": "2025-11-06T10:00:00Z",
    "updated_at": "2025-11-06T10:00:00Z"
  }
}
```

---

#### `PUT /projects/:id`
Update project

**Request Body:**
```json
{
  "name": "Licitación Metro - Actualizado",
  "description": "Nueva descripción",
  "status": "archived"
}
```

**Response:** `200 OK`

---

#### `DELETE /projects/:id`
Delete project (cascades to documents)

**Response:** `200 OK`
```json
{
  "message": "Proyecto eliminado exitosamente"
}
```

---

### **Documents**

#### `POST /projects/:projectId/documents`
Upload document to project

**Request:** `multipart/form-data`
- `file`: File (PDF, DOCX, TXT) - max 50MB

**Response:** `201 Created`
```json
{
  "message": "Documento subido exitosamente. Procesando vectorización...",
  "document": {
    "id": 1,
    "project_id": 1,
    "uploaded_by": 1,
    "filename": "pliego_tecnico.pdf",
    "file_path": "1699272000000_pliego_tecnico.pdf",
    "file_size": 1024000,
    "mime_type": "application/pdf",
    "is_vault_document": false,
    "vectorization_status": "pending",
    "created_at": "2025-11-06T12:00:00Z"
  }
}
```

---

#### `GET /projects/:projectId/documents`
List project documents

**Response:** `200 OK`
```json
{
  "documents": [
    {
      "id": 1,
      "project_id": 1,
      "filename": "pliego_tecnico.pdf",
      "vectorization_status": "completed",
      "created_at": "2025-11-06T12:00:00Z"
    }
  ],
  "total": 1
}
```

---

#### `GET /documents/:id/download`
Download document

**Response:** File stream (PDF, DOCX, TXT)

---

#### `DELETE /documents/:id`
Delete document

**Response:** `200 OK`

---

### **Analysis**

#### `POST /projects/:projectId/analyze/pliego`
Analyze technical specifications

**Request Body:**
```json
{
  "document_ids": [1, 2],
  "use_standard": false
}
```

**Response:** `200 OK`
```json
{
  "message": "Análisis completado exitosamente",
  "result": {
    "requisitos_tecnicos": [...],
    "normativas_aplicables": [...],
    "equipamiento_necesario": [...],
    "complejidad": "alta",
    "riesgos": [...],
    "observaciones": "..."
  },
  "metadata": {
    "model": "gpt-5-mini",
    "tokens_used": 5000,
    "duration": 3500,
    "analysis_id": 1
  }
}
```

---

#### `POST /projects/:projectId/analyze/contrato`
Analyze contract

**Request Body:**
```json
{
  "document_ids": [1],
  "use_standard": true
}
```

**Response:** Similar to pliego analysis

---

#### `POST /projects/:projectId/generate/oferta`
Generate commercial proposal (DOCX)

**Request Body:**
```json
{
  "document_ids": [1, 2],
  "cliente": "Empresa XYZ S.A.",
  "observaciones": "Cliente requiere solución urgente"
}
```

**Response:** DOCX file download

---

#### `POST /projects/:projectId/generate/documentacion`
Generate technical documentation (DOCX)

**Request Body:**
```json
{
  "document_ids": [1, 2],
  "tipo_documento": "Memoria técnica",
  "titulo": "Memoria Técnica del Proyecto Metro"
}
```

**Response:** DOCX file download

---

### **Vault (Knowledge Base)**

#### `POST /vault/query`
Query the knowledge vault (no history saved)

**Request Body:**
```json
{
  "query": "¿Cuál es el protocolo estándar para sensores Modbus?"
}
```

**Response:** `200 OK`
```json
{
  "response": "El protocolo Modbus estándar utiliza...",
  "chunks_used": 3,
  "sources": ["manual_modbus.pdf", "normativa_industrial.pdf"],
  "metadata": {
    "model": "gpt-5-mini",
    "tokens_used": 1200,
    "duration": 1500
  }
}
```

---

### **Admin** (Requires `is_admin: true`)

#### `POST /admin/vault/documents`
Upload document to vault

**Request:** `multipart/form-data`
- `file`: File (PDF, DOCX, TXT)

**Response:** `201 Created`

---

#### `GET /admin/vault/documents`
List vault documents

**Response:** `200 OK`

---

#### `DELETE /admin/vault/documents/:id`
Delete vault document

**Response:** `200 OK`

---

#### `GET /admin/users`
List all users

**Response:** `200 OK`
```json
{
  "users": [
    {
      "id": 1,
      "username": "admin",
      "email": "admin@dilusai.com",
      "full_name": "Administrador",
      "is_active": true,
      "is_admin": true,
      "created_at": "2025-11-06T10:00:00Z",
      "last_login_at": "2025-11-06T14:00:00Z"
    }
  ],
  "total": 1
}
```

---

#### `PUT /admin/users/:id`
Update user status/role

**Request Body:**
```json
{
  "is_active": false,
  "is_admin": true
}
```

**Response:** `200 OK`

---

#### `GET /admin/stats`
Get system statistics

**Response:** `200 OK`
```json
{
  "users": { "total": 10 },
  "projects": { "total": 25 },
  "documents": { "total": 150, "vault": 20 },
  "embeddings": { "total": 5000 },
  "analysis": { "total": 75, "last_30_days": 20 },
  "vault_queries": { "last_30_days": 150 },
  "ai_usage": {
    "tokens_last_30_days": 250000,
    "by_model": [
      { "ai_model_used": "gpt-5-mini", "count": 50, "tokens": 200000 },
      { "ai_model_used": "gpt-5-standard", "count": 10, "tokens": 50000 }
    ]
  }
}
```

---

## ⚠️ Error Responses

**401 Unauthorized:**
```json
{
  "error": "Token no proporcionado"
}
```

**403 Forbidden:**
```json
{
  "error": "Acceso denegado - se requiere rol de administrador"
}
```

**404 Not Found:**
```json
{
  "error": "Proyecto no encontrado"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Error interno del servidor"
}
```

---

## 📝 Notes

- All timestamps are in ISO 8601 format (UTC)
- File uploads limited to 50MB
- Supported file types: PDF, DOCX, TXT
- JWT tokens expire after 7 days
- Rate limiting: 100 requests per 15 minutes (production)

---

**DILUS_AI v2.0** | Documentation generated on 2025-11-06

