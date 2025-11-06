# ⚡ DILUS_AI - Quick Start Guide

Get DILUS_AI up and running in 5 minutes!

---

## 🚀 Quick Start

### Step 1: Prerequisites
- Docker & Docker Compose installed
- OpenAI API Key

### Step 2: Configure API Key

```bash
cd DILUS_AI
cp backend/.env.example backend/.env
```

Edit `backend/.env` and add your OpenAI API key:

```bash
OPENAI_API_KEY=sk-proj-YOUR_KEY_HERE
OPENAI_API_KEY_STANDARD=sk-proj-YOUR_KEY_HERE
```

### Step 3: Start Services

```bash
docker-compose up -d
```

Wait ~30 seconds for services to initialize.

### Step 4: Access Application

- **Frontend:** http://localhost:5173
- **Backend API:** http://localhost:8080
- **MinIO Console:** http://localhost:9001

### Step 5: Login

**Admin User:**
- Username: `admin`
- Password: `admin123`

**Demo User:**
- Username: `demo`
- Password: `demo123`

---

## 🎯 First Steps

### 1. Create a Project
1. Click **"Nuevo Proyecto"**
2. Enter name and description
3. Click **"Crear Proyecto"**

### 2. Upload Documents
1. Enter your project
2. Click **"Subir Documento"** in sidebar
3. Select PDF, DOCX, or TXT file
4. Wait for vectorization (automatic)

### 3. Analyze Documents
1. Select documents with checkboxes
2. Choose analysis type (Pliego/Contrato/Oferta/Documentación)
3. Click **"Analizar"** or **"Generar"**
4. View results

### 4. Try Vault Chat
1. Click **"Chat de la Bóveda"** button
2. Ask: *"¿Qué documentación tenemos disponible?"*
3. Get instant answers from knowledge base

---

## 👑 Admin Features

Login as `admin` and access **Admin Panel**:

1. **Upload to Vault:** Corporate documents accessible to all users
2. **Manage Users:** Activate/deactivate, change roles
3. **View Stats:** Monitor usage and AI consumption

---

## 🐳 Docker Commands

```bash
# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Restart a service
docker-compose restart backend

# Rebuild after code changes
docker-compose build
docker-compose up -d
```

---

## ⚠️ Troubleshooting

### Backend won't start?
```bash
docker-compose logs backend
```
**Common issue:** Missing OpenAI API key in `.env`

### Can't login?
**Solution:** Database may not be initialized. Restart:
```bash
docker-compose down
docker-compose up -d
```

### Documents not vectorizing?
**Check:** OpenAI API key is valid and has credits

---

## 📚 Next Steps

- Read [API Documentation](docs/API.md)
- Review [Deployment Guide](docs/DEPLOYMENT.md)
- Check [Features List](docs/FEATURES.md)
- Customize for your needs

---

## 💡 Pro Tips

1. **Upload vault documents first** (as admin) for better vault chat responses
2. **Use GPT-5 Mini** for most tasks (faster & cheaper)
3. **Enable dark mode** in header for better UX
4. **Select multiple documents** for comprehensive analysis
5. **Check vectorization status** before analyzing

---

## 🎉 You're Ready!

Start analyzing technical documents with AI! 🚀

**Need help?**
- Check logs: `docker-compose logs`
- Read docs: `/docs/`
- Review code: Well-commented and organized

---

**DILUS_AI v2.0** | Quick Start Guide

