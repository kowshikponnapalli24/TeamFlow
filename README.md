# TeamFlow – AI-Powered Project Management Platform

TeamFlow is a full-stack project management platform designed to help organizations collaborate, manage teams, organize projects, assign tasks, and track progress efficiently. It provides a centralized workspace with role-based access control, task management, project tracking, and notifications.

The platform is built using modern web technologies with a scalable backend architecture and PostgreSQL database.

## Features

### Authentication & Authorization
- User registration and login.
- JWT-based authentication.
- Secure password hashing using bcrypt.
- Role-Based Access Control (RBAC).
- Protected API routes.

### Organization Management
- Create and manage organizations.
- Add and manage organization members.
- Organization-specific workspaces.
- Support for different member roles:
  - Admin
  - Manager
  - Developer

### Team Management
- Create teams within organizations.
- Add organization members to teams.
- Manage team membership.
- Organize development teams.

### Project Management
- Create and manage projects.
- Assign projects to teams.
- Set project start and due dates.
- Track project progress.
- Manage project-specific tasks.

### Task Management
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

### Notifications
- Task assignment notifications.
- Task update notifications.
- Comment notifications.
- Project update notifications.
- Deadline reminders.

### Dashboard
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
| Development | Git, npm |

## Architecture

The application follows a client-server architecture.

```text
              TeamFlow Platform
                     |
          +----------+----------+
          |                     |
      React Client         Express Server
      TypeScript           Node.js
          |                     |
          |                 REST APIs
          |                     |
          +----------+----------+
                     |
               Prisma ORM
                     |
                PostgreSQL
```

## Getting Started

### Prerequisites

Make sure you have installed:

- Node.js
- npm
- PostgreSQL
- Git

### 1. Clone the Repository

```bash
git clone https://github.com/kowshikponnapalli24/TeamFlow.git

cd TeamFlow
```

### 2. Install Dependencies

Install root dependencies:

```bash
npm install
```

Install client dependencies:

```bash
cd client
npm install
cd ..
```

Install server dependencies:

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

Replace the database credentials with your PostgreSQL configuration.

### 4. Set Up the Database

Run Prisma migrations:

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

The application will run at:

- Frontend: http://localhost:5173
- Backend: http://localhost:4000
- Health Check: http://localhost:4000/api/health

## Security

- JWT-based authentication.
- Password hashing with bcrypt.
- Role-based authorization.
- Request validation using Zod.
- HTTP security headers using Helmet.
- Configured Cross-Origin Resource Sharing (CORS).

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
└── package.json
```

*The structure above represents the intended organization; adjust directory names to match the actual repository.*

## Future Enhancements

- AI-powered task recommendations.
- Intelligent project progress prediction.
- AI-generated task summaries.
- Real-time collaboration using WebSockets.
- CI/CD automation.
- Docker-based deployment.
- Automated testing and cloud deployment.

## Learning Outcomes

This project demonstrates practical experience in:

- Full-stack application development.
- REST API design and implementation.
- Authentication and authorization.
- Database modeling and ORM integration.
- Role-based access control.
- Multi-organization application architecture.
- Frontend and backend integration.
- Secure application development.

## Author

**Kowshik Ponnapalli**

Computer Science and Engineering  
IIIT Sri City

- GitHub: https://github.com/kowshikponnapalli24

---

⭐ If you find this project interesting, consider giving it a star!
