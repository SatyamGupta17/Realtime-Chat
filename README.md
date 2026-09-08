# Realtime Chat Application

A scalable, real-time chat application built with **Node.js**, **Express**, **WebSocket**, **Kafka**, **PostgreSQL**, and **Redis**. This system is designed to handle concurrent users with message persistence, distributed processing, and high availability.

---

## 📋 Table of Contents

- [System Overview](#system-overview)
- [Architecture](#architecture)
- [Services & Components](#services--components)
- [Prerequisites](#prerequisites)
- [Quick Start with Docker](#quick-start-with-docker)
- [Development Setup](#development-setup)
- [Running the Application](#running-the-application)
- [Message System](#message-system)
- [API Documentation](#api-documentation)
- [Environment Configuration](#environment-configuration)
- [Troubleshooting](#troubleshooting)

---

## 🎯 System Overview

This Realtime Chat application enables users to:
- **Send and receive messages in real-time** using WebSocket connections
- **Store message history** permanently in PostgreSQL
- **Cache recent messages** for quick retrieval using Redis
- **Process messages asynchronously** using Kafka for decoupled services
- **Scale horizontally** with multiple edge servers and worker processes

### Key Features
✅ Real-time bidirectional communication via WebSocket  
✅ Message persistence with PostgreSQL  
✅ In-memory caching with Redis  
✅ Asynchronous message processing with Kafka  
✅ Microservices architecture with API, Edge, and Worker services  
✅ Docker containerization for easy deployment  
✅ TypeScript for type-safe development  

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Client (Browser)                      │
│                   WebSocket Connection                   │
└────────────────────────┬────────────────────────────────┘
                         │
        ┌────────────────┴─────────────────┐
        │                                  │
    ┌───▼────┐                        ┌───▼────┐
    │ Edge 1 │ (WebSocket Server)     │ Edge 2 │
    └───┬────┘                        └───┬────┘
        │          WebSocket Tunnels      │
        │    ┌──────────────────────┐     │
        │    │   API Server         │     │
        │    │ (Express + REST API) │     │
        │    └──────────┬───────────┘     │
        │               │                 │
        └───────────────┬─────────────────┘
                        │
              ┌─────────┼─────────┐
              │         │         │
         ┌────▼──┐  ┌───▼───┐  ┌─▼──────┐
         │ Kafka │  │Redis  │  │Postgres│
         │ Queue │  │ Cache │  │  DB    │
         └───┬───┘  └───────┘  └────────┘
             │
         ┌───▼──────┐
         │ Worker   │ (Message Processing)
         │ Service  │
         └──────────┘
```

### Service Description

| Service | Purpose | Technology |
|---------|---------|-----------|
| **API** | REST API, data management, business logic | Express.js, TypeScript |
| **Edge** | WebSocket server for real-time communication | Node.js WebSocket (ws) |
| **Worker** | Asynchronous message processing from Kafka | Node.js, KafkaJS |
| **Kafka** | Message queue for decoupled services | Apache Kafka |
| **Redis** | In-memory cache for recent messages | Redis |
| **PostgreSQL** | Persistent data storage | PostgreSQL 16 |

---

## 🔧 Services & Components

### 1. **API Service** (`packages/api`)
- **Port**: 3000
- **Purpose**: 
  - RESTful endpoints for chat operations
  - User authentication/authorization
  - Message retrieval from database
  - Room management
  - Message caching coordination
- **Endpoints**: User registration, login, room creation, message history retrieval

### 2. **Edge Service** (`packages/edge`)
- **Port**: 8080
- **Purpose**:
  - WebSocket server for real-time communication
  - Establishes persistent connections with clients
  - Routes incoming messages to Kafka
  - Broadcasts server messages to connected clients
  - Handles connection/disconnection events
- **Protocol**: WebSocket (ws://)

### 3. **Worker Service** (`packages/worker`)
- **Purpose**:
  - Consumes messages from Kafka topics
  - Processes messages asynchronously
  - Stores messages in PostgreSQL
  - Updates Redis cache
  - Handles message routing to recipient connections
  - Manages message acknowledgment

### 4. **Kafka** (Message Queue)
- **Port**: 9092
- **Topics**: 
  - `messages` - All chat messages
  - `events` - User events (join, leave, typing)
- **Why Kafka?**
  - Decouples message producers (Edge) from consumers (Workers)
  - Ensures message durability and replay capability
  - Enables horizontal scaling of workers
  - Provides audit trail of all messages

### 5. **Redis** (Cache Layer)
- **Port**: 6379
- **Keys Stored**:
  - `room:{roomId}:messages` - Recent messages in a room
  - `user:{userId}:status` - User online/offline status
  - `room:{roomId}:users` - Active users in a room
- **Why Redis?**
  - Sub-millisecond latency for message retrieval
  - Reduces database load
  - Enables fast user presence tracking
  - Session storage

### 6. **PostgreSQL** (Primary Database)
- **Port**: 5432
- **Database**: `chat`
- **Tables**:
  - `users` - User accounts and profiles
  - `rooms` - Chat rooms/channels
  - `messages` - Complete message history
  - `room_members` - User membership in rooms
- **Why PostgreSQL?**
  - ACID compliance for data integrity
  - Powerful query capabilities
  - Built-in JSON support
  - Full-text search for message content

---

## 📦 Prerequisites

Ensure you have the following installed:

- **Docker** (v20.10+) and **Docker Compose** (v2.0+)
- **Node.js** (v18+) - for local development
- **npm** (v8+)
- **Git**

### Verify Installation
```bash
docker --version
docker-compose --version
node --version
npm --version
```

---

## 🐳 Quick Start with Docker

### Option 1: Using Docker Compose (Recommended)

1. **Clone the repository**
```bash
git clone https://github.com/SatyamGupta17/Realtime-Chat.git
cd Realtime-Chat
```

2. **Start all services**
```bash
docker-compose up -d
```

This starts:
- PostgreSQL on port 5432
- Redis on port 6379
- Kafka on port 9092

3. **Verify services are running**
```bash
docker-compose ps
```

Expected output:
```
NAME                STATUS              PORTS
realtime-chat-postgres-1   Up          0.0.0.0:5432->5432/tcp
realtime-chat-redis-1      Up          0.0.0.0:6379->6379/tcp
realtime-chat-kafka-1      Up          0.0.0.0:9092->9092/tcp
```

4. **Initialize database** (one-time setup)
```bash
# Run migrations/setup scripts
npm run setup
```

5. **Start application services** (see [Running the Application](#running-the-application) below)

### Option 2: Stop Services
```bash
docker-compose down
```

### Option 3: View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f postgres
docker-compose logs -f redis
docker-compose logs -f kafka
```

---

## 🛠️ Development Setup

### Local Setup (Without Docker)

1. **Clone the repository**
```bash
git clone https://github.com/SatyamGupta17/Realtime-Chat.git
cd Realtime-Chat
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure environment variables**
```bash
cp .env.example .env
```

Edit `.env` with your configuration:
```env
# API Configuration
API_PORT=3000
API_HOST=localhost

# Edge Service Configuration
EDGE_PORT=8080
EDGE_HOST=localhost

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=chat
DB_USER=chat
DB_PASSWORD=chat

# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379

# Kafka Configuration
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=realtime-chat

# Application Configuration
NODE_ENV=development
```

4. **Ensure infrastructure services are running**
```bash
# Start Docker services only
docker-compose up postgres redis kafka -d
```

5. **Install project dependencies**
```bash
npm install
```

---

## 🚀 Running the Application

### Option 1: Development Mode

Start all services in development mode with hot reload:

```bash
npm run dev
```

This will start:
- API Server on `http://localhost:3000`
- Edge Service (WebSocket) on `ws://localhost:8080`
- Worker Service (background)

### Option 2: Individual Services

Start each service in separate terminals:

**Terminal 1 - API Server**
```bash
npm run api
```
Logs: `API Server listening on port 3000`

**Terminal 2 - Edge Service (WebSocket)**
```bash
npm run edge
```
Logs: `Edge Server listening on port 8080`

**Terminal 3 - Worker Service**
```bash
npm run worker
```
Logs: `Worker connected to Kafka`

### Option 3: Production Mode

Build and run in production:

```bash
npm run build
npm run start
```

### Option 4: Test Edge Service

Test WebSocket connectivity:
```bash
npm run test-edge
```

---

## 💬 Message System

### Message Flow Diagram

```
User A (Client)
    │
    │ (WebSocket Connection)
    │
    ▼
Edge Server
    │
    │ (Message received)
    │ POST to /api/messages
    │
    ▼
API Server
    │
    │ (Validate & publish)
    │ Publish to Kafka Topic: 'messages'
    │
    ▼
Kafka Queue
    │
    ├─────────────────────┬─────────────────────┐
    │                     │                     │
    ▼                     ▼                     ▼
Worker 1             Worker 2             Worker 3
    │                     │                     │
    │ (Process)          │ (Process)           │ (Process)
    ▼                     ▼                     ▼
PostgreSQL          Redis Cache         User B Socket
    │
Store Message ◄──────── Broadcast via WebSocket
```

### Message Structure

```json
{
  "id": "uuid-string",
  "roomId": "room-uuid",
  "userId": "user-uuid",
  "username": "john_doe",
  "content": "Hello everyone!",
  "type": "text",
  "timestamp": "2024-01-15T10:30:45.000Z",
  "status": "delivered",
  "reactions": [],
  "replies": []
}
```

### Message Types Supported

- **text** - Plain text messages
- **image** - Image messages (with URL)
- **file** - File attachments
- **system** - System notifications (user joined, etc.)

### Message Lifecycle

1. **Client sends message** via WebSocket to Edge Server
2. **Edge Server validates** and publishes to Kafka `messages` topic
3. **API Server** updates Redis cache with recent messages
4. **Worker Service** processes and stores in PostgreSQL
5. **Other connected clients** receive via WebSocket broadcast
6. **Message is persisted** in database for history retrieval

### API Endpoints

#### Send Message
```http
POST /api/messages
Content-Type: application/json

{
  "roomId": "room-uuid",
  "userId": "user-uuid",
  "content": "Hello!",
  "type": "text"
}

Response: 201 Created
{
  "id": "message-uuid",
  "status": "pending"
}
```

#### Get Message History
```http
GET /api/messages?roomId=room-uuid&limit=50&offset=0

Response: 200 OK
{
  "messages": [
    { message objects... }
  ],
  "total": 150,
  "hasMore": true
}
```

#### Get User Presence
```http
GET /api/rooms/:roomId/users

Response: 200 OK
{
  "users": [
    {
      "userId": "uuid",
      "username": "john",
      "status": "online",
      "lastSeen": "2024-01-15T10:30:45Z"
    }
  ]
}
```

#### Delete Message
```http
DELETE /api/messages/:messageId

Response: 204 No Content
```

#### Edit Message
```http
PATCH /api/messages/:messageId
Content-Type: application/json

{
  "content": "Updated message"
}

Response: 200 OK
{ message object }
```

---

## ⚙️ Environment Configuration

Create a `.env` file in the root directory:

```env
# ========== API SERVER ==========
API_PORT=3000
API_HOST=localhost
API_LOG_LEVEL=debug

# ========== EDGE SERVER (WebSocket) ==========
EDGE_PORT=8080
EDGE_HOST=0.0.0.0
EDGE_LOG_LEVEL=info
MAX_CONNECTIONS=10000

# ========== DATABASE (PostgreSQL) ==========
DB_HOST=localhost
DB_PORT=5432
DB_NAME=chat
DB_USER=chat
DB_PASSWORD=chat
DB_SSL=false
DB_POOL_SIZE=20

# ========== CACHE (Redis) ==========
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_TTL=3600

# ========== MESSAGE BROKER (Kafka) ==========
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=realtime-chat
KAFKA_GROUP_ID=chat-workers
KAFKA_SECURITY_PROTOCOL=PLAINTEXT

# ========== APPLICATION ==========
NODE_ENV=development
JWT_SECRET=your-secret-key-change-in-production
JWT_EXPIRY=24h
MESSAGE_BATCH_SIZE=100
MESSAGE_BATCH_TIMEOUT=5000

# ========== LOGGING ==========
LOG_FORMAT=json
LOG_LEVEL=info
```

---

## 🔍 Monitoring & Debugging

### View Service Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f api
docker-compose logs -f edge
docker-compose logs -f worker

# Last 100 lines
docker-compose logs --tail=100 redis
```

### Database Inspection

```bash
# Connect to PostgreSQL
docker-compose exec postgres psql -U chat -d chat

# Common commands
\dt                          # List all tables
SELECT * FROM users;        # View users
SELECT * FROM messages ORDER BY timestamp DESC LIMIT 10;  # Recent messages
\q                          # Exit
```

### Redis Inspection

```bash
# Connect to Redis
docker-compose exec redis redis-cli

# Common commands
KEYS *                       # List all keys
GET room:123:messages        # Get cache value
MONITOR                      # Watch all commands
QUIT                        # Exit
```

### Kafka Inspection

```bash
# List topics
docker-compose exec kafka kafka-topics.sh --list --bootstrap-server localhost:9092

# View messages in topic
docker-compose exec kafka kafka-console-consumer.sh \
  --bootstrap-server localhost:9092 \
  --topic messages \
  --from-beginning

# Consumer groups
docker-compose exec kafka kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --list
```

---

## 📊 Performance Tuning

### Redis Optimization
```env
# Increase connection pool
REDIS_POOL_SIZE=50

# Adjust TTL based on usage
REDIS_TTL=1800  # 30 minutes
```

### Kafka Optimization
```env
# Batch settings for higher throughput
MESSAGE_BATCH_SIZE=500
MESSAGE_BATCH_TIMEOUT=10000

# Consumer group settings
KAFKA_FETCH_MIN_BYTES=1024
KAFKA_FETCH_MAX_BYTES=52428800
```

### PostgreSQL Optimization
```env
# Increase connection pool for high concurrency
DB_POOL_SIZE=50

# Enable SSL for security
DB_SSL=true
```

---

## 🐛 Troubleshooting

### Issue: Services fail to start
```bash
# Solution: Check Docker daemon
docker info

# Solution: Check port conflicts
lsof -i :3000  # Check if port 3000 is in use
lsof -i :8080  # Check if port 8080 is in use

# Solution: Remove dangling containers
docker-compose down -v
docker-compose up -d
```

### Issue: Database connection failed
```bash
# Solution: Verify PostgreSQL is running
docker-compose ps postgres

# Solution: Check database credentials in .env
docker-compose exec postgres psql -U chat -d chat -c "SELECT 1;"

# Solution: Recreate database
docker-compose down -v
docker-compose up postgres -d
```

### Issue: WebSocket connection timeout
```bash
# Solution: Check Edge service logs
docker-compose logs edge

# Solution: Verify port 8080 is accessible
curl -i http://localhost:8080

# Solution: Check firewall settings
sudo ufw allow 8080
```

### Issue: Kafka not processing messages
```bash
# Solution: Check Kafka broker status
docker-compose exec kafka kafka-broker-api-versions.sh --bootstrap-server localhost:9092

# Solution: Verify topic exists
docker-compose exec kafka kafka-topics.sh --list --bootstrap-server localhost:9092

# Solution: Check consumer group lag
docker-compose exec kafka kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 \
  --group chat-workers \
  --describe
```

### Issue: High memory usage
```bash
# Solution: Check Redis memory
docker-compose exec redis redis-cli INFO memory

# Solution: Clear expired keys
docker-compose exec redis redis-cli FLUSHDB

# Solution: Adjust Redis maxmemory policy
# Add to docker-compose.yml:
# redis:
#   command: redis-server --maxmemory 512mb --maxmemory-policy allkeys-lru
```

---

## 📝 Database Schema

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  username VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  avatar_url TEXT,
  status VARCHAR(50) DEFAULT 'offline',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Rooms Table
```sql
CREATE TABLE rooms (
  id UUID PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_private BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Messages Table
```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY,
  room_id UUID REFERENCES rooms(id),
  user_id UUID REFERENCES users(id),
  content TEXT NOT NULL,
  type VARCHAR(50) DEFAULT 'text',
  status VARCHAR(50) DEFAULT 'delivered',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Room Members Table
```sql
CREATE TABLE room_members (
  id UUID PRIMARY KEY,
  room_id UUID REFERENCES rooms(id),
  user_id UUID REFERENCES users(id),
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(room_id, user_id)
);
```

---

## 🚀 Deployment

### Docker Production Build

```dockerfile
# Build image
docker build -t realtime-chat:latest .

# Run container
docker run -d \
  --name realtime-chat \
  -p 3000:3000 \
  -p 8080:8080 \
  --env-file .env.production \
  --network chat-network \
  realtime-chat:latest
```

### Kubernetes Deployment (Future)
- Create separate deployments for API, Edge, and Worker services
- Use StatefulSets for stateful services (Kafka)
- Configure persistent volumes for PostgreSQL and Kafka
- Set up ingress for external access

---

## 📚 Additional Resources

- [Express.js Documentation](https://expressjs.com/)
- [WebSocket (ws) Documentation](https://github.com/websockets/ws)
- [Kafka.js Documentation](https://kafka.js.org/)
- [Redis Documentation](https://redis.io/documentation)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [TypeScript Documentation](https://www.typescriptlang.org/)

---

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 👤 Author

**Satyam Gupta**  
GitHub: [@SatyamGupta17](https://github.com/SatyamGupta17)

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## ❓ Support

For issues and questions:
- Open an issue on GitHub
- Check existing issues for solutions
- Review the Troubleshooting section above

---

**Last Updated**: 2024-01-15  
**Version**: 1.0.0
# Realtime Chat Application

A scalable, real-time chat application built with **Node.js**, **Express**, **WebSocket**, **Kafka**, **PostgreSQL**, and **Redis**. This system is designed to handle concurrent users with message persistence, distributed processing, and high availability.

---

## 📋 Table of Contents

- [System Overview](#system-overview)
- [Architecture](#architecture)
- [Services & Components](#services--components)
- [Prerequisites](#prerequisites)
- [Quick Start with Docker](#quick-start-with-docker)
- [Development Setup](#development-setup)
- [Running the Application](#running-the-application)
- [Message System](#message-system)
- [API Documentation](#api-documentation)
- [Environment Configuration](#environment-configuration)
- [Troubleshooting](#troubleshooting)

---

## 🎯 System Overview

This Realtime Chat application enables users to:
- **Send and receive messages in real-time** using WebSocket connections
- **Store message history** permanently in PostgreSQL
- **Cache recent messages** for quick retrieval using Redis
- **Process messages asynchronously** using Kafka for decoupled services
- **Scale horizontally** with multiple edge servers and worker processes

### Key Features
✅ Real-time bidirectional communication via WebSocket  
✅ Message persistence with PostgreSQL  
✅ In-memory caching with Redis  
✅ Asynchronous message processing with Kafka  
✅ Microservices architecture with API, Edge, and Worker services  
✅ Docker containerization for easy deployment  
✅ TypeScript for type-safe development  

---

## 🏗️ Architecture
