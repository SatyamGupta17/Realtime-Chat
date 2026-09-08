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
