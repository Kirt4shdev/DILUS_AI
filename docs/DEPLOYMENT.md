# 🚀 DILUS_AI - Deployment Guide

Complete guide for deploying DILUS_AI in production environments.

---

## 📋 Prerequisites

- **Docker** 20.10+ and **Docker Compose** 2.0+
- **OpenAI API Key** (for GPT-5 and embeddings)
- **Domain name** (for production deployment)
- **SSL Certificate** (recommended: Let's Encrypt)
- **Minimum Server Requirements:**
  - 4 CPU cores
  - 8 GB RAM
  - 50 GB disk space

---

## 🔧 Configuration

### 1. Clone Repository

```bash
git clone <repository-url>
cd DILUS_AI
```

### 2. Configure Environment Variables

Create `backend/.env`:

```bash
cp backend/.env.example backend/.env
```

**Edit `backend/.env`:**

```bash
# ============================================
# OPENAI API (REQUIRED)
# ============================================
OPENAI_API_KEY=sk-proj-your-real-key-here
OPENAI_API_KEY_STANDARD=sk-proj-your-real-key-here

# ============================================
# POSTGRESQL
# ============================================
POSTGRES_HOST=postgres
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=CHANGE_THIS_STRONG_PASSWORD_123
POSTGRES_DB=dilus_ai

# ============================================
# MINIO
# ============================================
MINIO_ENDPOINT=http://minio:9000
MINIO_ACCESS_KEY=CHANGE_THIS_ACCESS_KEY
MINIO_SECRET_KEY=CHANGE_THIS_SECRET_KEY_2025
MINIO_BUCKET=dilus-ai
MINIO_USE_SSL=false

# ============================================
# JWT (CRITICAL - CHANGE IN PRODUCTION!)
# ============================================
JWT_SECRET=CHANGE_THIS_TO_RANDOM_SECURE_STRING
JWT_EXPIRES_IN=7d

# ============================================
# SERVER
# ============================================
PORT=8080
NODE_ENV=production

# ============================================
# RAG CONFIGURATION
# ============================================
RAG_CHUNK_SIZE=1000
RAG_CHUNK_OVERLAP=200
RAG_TOP_K=5
RAG_SIMILARITY_THRESHOLD=0.7

# ============================================
# DOCGEN SERVICE
# ============================================
DOCGEN_URL=http://docgen:8090
```

### 3. Update Docker Compose for Production

Edit `docker-compose.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: pgvector/pgvector:pg16
    container_name: dilus_postgres
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_DB: dilus_ai
    volumes:
      - ./pgdata:/var/lib/postgresql/data
      - ./sql:/docker-entrypoint-initdb.d
    restart: always
    networks:
      - dilus_network
    # Remove ports exposure in production (use internal network only)

  minio:
    image: minio/minio
    container_name: dilus_minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: ${MINIO_ACCESS_KEY}
      MINIO_ROOT_PASSWORD: ${MINIO_SECRET_KEY}
    volumes:
      - ./minio_data:/data
    restart: always
    networks:
      - dilus_network

  backend:
    build: ./backend
    container_name: dilus_backend
    env_file: ./backend/.env
    environment:
      - NODE_ENV=production
    depends_on:
      - postgres
      - minio
    restart: always
    networks:
      - dilus_network

  docgen:
    build: ./docgen
    container_name: dilus_docgen
    restart: always
    networks:
      - dilus_network

  frontend:
    build:
      context: ./frontend
      args:
        - VITE_API_URL=https://api.yourdomain.com
    container_name: dilus_frontend
    depends_on:
      - backend
    restart: always
    networks:
      - dilus_network

  # Nginx reverse proxy
  nginx:
    image: nginx:alpine
    container_name: dilus_nginx
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
    depends_on:
      - backend
      - frontend
    restart: always
    networks:
      - dilus_network

networks:
  dilus_network:
    driver: bridge
```

---

## 🔐 Security Configuration

### 1. Change Default Passwords

⚠️ **CRITICAL:** Change these in `sql/03_seed_admin.sql` or via API after deployment:

- Admin user password: `admin123` → Change immediately
- Demo user: Disable or change password

### 2. Generate Secure JWT Secret

```bash
# Linux/Mac
openssl rand -base64 32

# Use the output as JWT_SECRET in .env
```

### 3. Configure Firewall

```bash
# Ubuntu/Debian
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 4. SSL Certificate (Let's Encrypt)

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Generate certificate
sudo certbot --nginx -d yourdomain.com -d api.yourdomain.com

# Auto-renewal
sudo systemctl enable certbot.timer
```

---

## 🌐 Nginx Configuration

Create `nginx/nginx.conf`:

```nginx
events {
    worker_connections 1024;
}

http {
    upstream backend {
        server backend:8080;
    }

    upstream frontend {
        server frontend:5173;
    }

    # Frontend
    server {
        listen 80;
        server_name yourdomain.com;

        # Redirect to HTTPS
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name yourdomain.com;

        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;

        location / {
            proxy_pass http://frontend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
        }
    }

    # Backend API
    server {
        listen 80;
        server_name api.yourdomain.com;
        return 301 https://$server_name$request_uri;
    }

    server {
        listen 443 ssl http2;
        server_name api.yourdomain.com;

        ssl_certificate /etc/nginx/ssl/fullchain.pem;
        ssl_certificate_key /etc/nginx/ssl/privkey.pem;

        client_max_body_size 50M;

        location / {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }
    }
}
```

---

## 🚀 Deployment Steps

### 1. Build and Start Services

```bash
# Build images
docker-compose build

# Start services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### 2. Verify Services

```bash
# Check backend health
curl http://localhost:8080/health

# Check frontend
curl http://localhost:5173

# Check DocGen
curl http://localhost:8090/health
```

### 3. Initialize Database

Database tables are created automatically via init scripts in `sql/`.

Verify:

```bash
docker-compose exec postgres psql -U postgres -d dilus_ai -c "\dt"
```

### 4. Create Admin User

If not created by seed script, create manually:

```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "email": "admin@yourdomain.com",
    "password": "YourSecurePassword123",
    "full_name": "Administrator"
  }'
```

Then update to admin role in database:

```bash
docker-compose exec postgres psql -U postgres -d dilus_ai \
  -c "UPDATE users SET is_admin = TRUE WHERE username = 'admin';"
```

---

## 📊 Monitoring

### Check Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend

# Last 100 lines
docker-compose logs --tail=100 backend
```

### Database Backup

```bash
# Backup
docker-compose exec postgres pg_dump -U postgres dilus_ai > backup_$(date +%Y%m%d).sql

# Restore
docker-compose exec -T postgres psql -U postgres dilus_ai < backup_20251106.sql
```

### Monitor Resources

```bash
# Docker stats
docker stats

# Disk usage
df -h
du -sh pgdata/ minio_data/
```

---

## 🔄 Updates

### Update Application

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose down
docker-compose build
docker-compose up -d
```

### Update Database Schema

1. Create new SQL file in `sql/` directory
2. Apply manually:

```bash
docker-compose exec postgres psql -U postgres -d dilus_ai -f /docker-entrypoint-initdb.d/04_new_migration.sql
```

---

## 🐛 Troubleshooting

### Backend not starting

```bash
# Check logs
docker-compose logs backend

# Common issues:
# - Missing OpenAI API key
# - Database connection failed
# - Port already in use
```

### Database connection errors

```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Check connection
docker-compose exec backend node -e "require('./config/database.js').initDatabase()"
```

### MinIO connection errors

```bash
# Check MinIO logs
docker-compose logs minio

# Access MinIO console
open http://localhost:9001
```

### Frontend not loading

```bash
# Check frontend logs
docker-compose logs frontend

# Rebuild frontend
docker-compose build frontend
docker-compose up -d frontend
```

---

## 📈 Performance Optimization

### 1. PostgreSQL Tuning

Edit `docker-compose.yml`:

```yaml
postgres:
  command: postgres -c shared_buffers=256MB -c max_connections=200
```

### 2. Add Redis Cache (Optional)

```yaml
redis:
  image: redis:alpine
  container_name: dilus_redis
  restart: always
  networks:
    - dilus_network
```

### 3. Enable Docker Resource Limits

```yaml
backend:
  deploy:
    resources:
      limits:
        cpus: '2'
        memory: 2G
```

---

## 🔒 Production Checklist

- [ ] Changed all default passwords
- [ ] Generated secure JWT secret
- [ ] Configured SSL certificates
- [ ] Set NODE_ENV=production
- [ ] Configured firewall rules
- [ ] Set up automated backups
- [ ] Configured monitoring/alerts
- [ ] Tested disaster recovery
- [ ] Documented access credentials
- [ ] Set up log rotation
- [ ] Configured rate limiting
- [ ] Disabled debug endpoints
- [ ] Reviewed security headers
- [ ] Tested load capacity

---

## 🆘 Support

For issues or questions:
- Check logs: `docker-compose logs`
- Review documentation: `/docs/API.md`
- GitHub Issues: <repository-url>/issues

---

**DILUS_AI v2.0** | Deployment Guide

