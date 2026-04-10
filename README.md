# SaiyoniX School ERP

**Project Overview**
SaiyoniX School ERP is a full-stack K-12 school management platform built for large-scale operations. The backend provides role-based APIs for core school workflows such as admissions, academics, attendance, timetable, and finance.

**Architecture**
The system follows a three-tier architecture.
- Web dashboard for admin and staff
- Mobile apps for students, parents, and teachers
- Backend REST API with PostgreSQL

**Tech Stack**
- Backend: Node.js, Express, TypeScript
- Database: PostgreSQL with Prisma ORM
- Auth: JWT + RBAC
- Testing: Vitest
- Docs: Swagger (OpenAPI)

**Folder Structure**
- `backend/` API server, Prisma schema, tests
- `docs/` product and roadmap documentation
- `frontend/` frontend application

**Setup Instructions**
1. Clone the repo.
2. Install dependencies.
3. Create the `.env` file.
4. Run migrations.
5. Run seed.
6. Start the server.
7. Run tests.

```bash
cd backend
npm install
```

```bash
cp ../.env.example .env
```

```bash
npx prisma migrate dev
npx prisma db seed
```

```bash
npm run dev
```

```bash
npm run typecheck
npx vitest run
```

**How To Run Setup Securely**
1. Copy `.env.example` to `.env`.
2. Fill in all required values, including database and bootstrap passwords.
3. Run `npm run setup` from `backend/`.
