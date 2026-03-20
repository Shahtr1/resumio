# Resumio - File Upload Application

Resumio is a modern file upload application built with Spring Boot (backend) and Angular (frontend), featuring resumable uploads with Redis for session management.

## 🚀 Quick Start

### Prerequisites

Before running the application, ensure you have the following installed:

- **Docker** (version 20.10 or later)
- **Docker Compose** (version 2.0 or later)

### Running the Application

1. **Clone or download** this repository to your local machine

2. **Navigate to the project root**:

   ```bash
   cd resumio
   ```

3. **Start all services**:

   ```bash
   docker-compose up --build
   ```

   This command will:
   - Build the Spring Boot backend
   - Build the Angular frontend
   - Start Redis database
   - Set up networking between services
   - Start all containers

4. **Access the application**:
   - Open your browser and go to: **http://localhost:8081**
   - The application will load the Angular frontend
   - File uploads are handled through the resumable upload system

### Stopping the Application

To stop all services:

```bash
docker-compose down
```

To stop and remove all data (including uploaded files):

```bash
docker-compose down -v
```

## 📁 Project Structure

```
resumio/
├── backend/              # Spring Boot application
│   ├── src/
│   ├── pom.xml
│   └── Dockerfile
├── frontend/             # Angular application
│   ├── src/
│   ├── package.json
│   ├── Dockerfile
│   └── nginx.conf
├── docker-compose.yml    # Docker orchestration
├── uploads/              # Persistent file storage (created at runtime)
└── README.md
```

## 🔧 Services

- **Frontend (Port 8081)**: Angular SPA served by nginx
- **Backend (Port 8080)**: Spring Boot REST API
- **Redis (Port 6379)**: Session storage for upload state

## 📤 File Upload Features

- **Resumable uploads**: Files are split into 5MB chunks
- **Progress tracking**: Real-time upload progress
- **Session management**: Upload state persisted in Redis
- **Large file support**: Handles files up to 100MB+ (nginx configured for large payloads)
- **Hash verification**: SHA-256 verification for data integrity

## 🛠️ Development

### Prerequisites for Development

- **Java 17** or later
- **Node.js 20** or later
- **npm** or **yarn**
- **Maven** 3.6+

### Manual Development Setup

#### Backend Development

```bash
cd backend
mvn clean install
mvn spring-boot:run
```

Access at: http://localhost:8080

#### Frontend Development

```bash
cd frontend
npm install
npm start
```

Access at: http://localhost:4200

### Building for Production

#### Backend

```bash
cd backend
mvn clean package -DskipTests
```

#### Frontend

```bash
cd frontend
npm run build
```

## 🔍 Troubleshooting

### Common Issues

**Port already in use:**

- Ensure ports 8080, 8081, and 6379 are available
- On Windows, port 80 may require admin privileges (we use 8081 instead)

**Build failures:**

- Ensure Docker has sufficient resources (4GB+ RAM recommended)
- Clear Docker cache: `docker system prune -a`

**Upload failures:**

- Check browser console for CORS errors
- Verify all containers are running: `docker ps`
- Check container logs: `docker-compose logs [service-name]`

**File not found errors:**

- Ensure the `uploads/` directory exists and is writable
- Check file permissions in the container

### Logs

View logs for all services:

```bash
docker-compose logs
```

View logs for specific service:

```bash
docker-compose logs backend
docker-compose logs frontend
docker-compose logs redis
```

### Data Persistence

- Uploaded files are stored in the `./uploads/` directory on your host machine
- Redis data persists across container restarts (stored in Docker volume)
- To reset all data: `docker-compose down -v`

## 📋 API Endpoints

- `POST /upload/init` - Initialize upload session
- `PUT /upload/chunk` - Upload file chunk
- `POST /upload/complete` - Complete upload and verify
- `GET /upload/status/{uploadId}` - Check upload status

## 🏗️ Architecture

- **Frontend**: Angular with TypeScript, served by nginx
- **Backend**: Spring Boot with Redis integration
- **Database**: Redis for session management
- **File Storage**: Local filesystem with resumable uploads
- **Networking**: Docker Compose with service discovery

## 📄 License

This project is for educational and demonstration purposes.

## IDE

Use one of these approaches:

- Open `backend/` alone when working only on the API.
- Open the repository root when you want both frontend and backend in one workspace.

Do not add a Maven `pom.xml` at the repository root unless you intentionally want a Java multi-module build.
