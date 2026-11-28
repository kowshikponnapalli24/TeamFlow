# TeamFlow – AI-Powered Project Management Platform

TeamFlow is a full-stack project management platform designed to simplify collaboration, team coordination, and project tracking within organizations. It provides a centralized workspace where users can manage organizations, create teams, organize projects, assign tasks, track progress, and receive notifications.

Built using React, TypeScript, Node.js, Express, and PostgreSQL, TeamFlow demonstrates modern full-stack development, secure authentication, role-based access control, containerization, CI/CD automation, and cloud deployment.

## Features

### 1. Authentication & Authorization
- User registration and login.
- JWT-based authentication.
- Secure password hashing using bcrypt.
- Role-Based Access Control (RBAC).
- Protected API routes.

### 2. Organization Management
- Create and manage organizations.
- Add and manage organization members.
- Organization-specific workspaces.
- Support for Admin, Manager, and Developer roles.

### 3. Team Management
- Create teams within organizations.
- Add organization members to teams.
- Manage team membership.
- Organize development teams.

### 4. Project Management
- Create and manage projects.
- Assign projects to teams.
- Set project start and due dates.
- Track project progress.
- Manage project-specific tasks.

### 5. Task Management
- Create, assign, and update tasks.
- Track task status:
  - To Do
  - In Progress
  - In Review
  - Done
  - Blocked
- Set task priorities:
  - Low
  - Medium
  - High
  - Urgent
- Manage task deadlines.
- Add comments and track task activity.

### 6. Notifications
- Task assignment notifications.
- Task update notifications.
- Comment notifications.
- Project update notifications.
- Deadline-related notifications.

### 7. Dashboard
- Centralized project overview.
- Task statistics.
- Project progress tracking.
- Organization-level workspace overview.

## Tech Stack

| Category | Technologies |
|---|---|
| Frontend | React, TypeScript, Vite |
| Styling | CSS |
| Backend | Node.js, Express.js, TypeScript |
| Database | PostgreSQL |
| ORM | Prisma |
| Authentication | JWT, bcrypt |
| Validation | Zod |
| API Testing | Postman |
| Containerization | Docker, Docker Compose |
| CI/CD | GitHub Actions |
| Frontend Hosting | Vercel |
| Backend Hosting | Render |
| Database Hosting | Neon PostgreSQL |
| Version Control | Git, GitHub |

## System Architecture

```text
                  TeamFlow Platform
                         |
              +----------+----------+
              |                     |
         React Client          Express Server
         TypeScript             Node.js
         (Vercel)               (Render)
              |                     |
              |                 REST APIs
              |                     |
              +----------+----------+
                         |
                     Prisma ORM
                         |
                   PostgreSQL
                      (Neon)
```

## Docker & Containerization

TeamFlow supports containerized development and deployment using Docker.

- Dockerized React frontend using Nginx.
- Dockerized Express.js backend.
- PostgreSQL database integration.
- Docker Compose for multi-container orchestration.
- Environment-based configuration.

### Run with Docker

```bash
docker compose up --build
```

Stop containers:

```bash
docker compose down
```

## CI/CD – GitHub Actions

Implemented automated CI workflows using GitHub Actions.

The CI pipeline validates the application through:

- Backend dependency installation and build.
- Frontend dependency installation and build.
- Automated execution on GitHub workflow triggers.
- Build validation to catch integration issues.

Workflow configuration:

```text
.github/workflows/ci.yml
```

## Cloud Deployment

TeamFlow has been deployed using cloud infrastructure.

| Component | Platform |
|---|---|
| Frontend | Vercel |
| Backend | Render |
| Database | Neon PostgreSQL |

The application uses environment variables for deployment configuration and database connectivity.

## Getting Started

### Prerequisites

- Node.js
- npm
- PostgreSQL (for local database setup)
- Git
- Docker (optional)

### 1. Clone the Repository

```bash
git clone https://github.com/kowshikponnapalli24/TeamFlow.git

cd TeamFlow
```

### 2. Install Dependencies

```bash
npm install
```

Install frontend dependencies:

```bash
cd client
npm install
cd ..
```

Install backend dependencies:

```bash
cd server
npm install
cd ..
```

### 3. Configure Environment Variables

Create a `.env` file inside the server directory.

```env
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/teamflow?schema=public"

JWT_SECRET="your_secure_jwt_secret"
PORT=4000
```

Replace the database credentials with your local PostgreSQL configuration.

### 4. Set Up Database

```bash
cd server

npx prisma migrate dev

npx prisma generate
```

### 5. Start the Application

Return to the root directory:

```bash
cd ..

npm run dev
```

Application endpoints:

- Frontend: http://localhost:5173
- Backend: http://localhost:4000
- Health Check: http://localhost:4000/api/health

## Security

- JWT-based authentication.
- Password hashing with bcrypt.
- Role-based authorization.
- Request validation using Zod.
- HTTP security headers using Helmet.
- Configured CORS policies.
- Environment-based secret management.

## Project Structure

```text
TeamFlow/
│
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── pages/
│   │   ├── lib/
│   │   └── App.tsx
│   └── package.json
│
├── server/
│   ├── prisma/
│   ├── src/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── services/
│   │   └── server.ts
│   └── package.json
│
├── .github/
│   └── workflows/
│       └── ci.yml
│
├── docker-compose.yml
├── package.json
└── README.md
```

## Future Enhancements

- AI-powered task recommendations.
- Intelligent project progress prediction.
- AI-generated task summaries.
- Real-time collaboration using WebSockets.
- Automated testing and expanded CI/CD pipelines.

## Key Learning Outcomes

- Full-stack application development.
- REST API design and implementation.
- Authentication and authorization.
- Database modeling and ORM integration.
- Multi-tenant organization architecture.
- Role-based access control.
- Docker containerization and orchestration.
- CI/CD pipeline implementation.
- Cloud deployment and environment configuration.

## Author

**Kowshik Ponnapalli**

Computer Science and Engineering  
IIIT Sri City

- GitHub: [kowshikponnapalli24](https://github.com/kowshikponnapalli24)

---

If you find this project interesting, consider giving it a ⭐!
