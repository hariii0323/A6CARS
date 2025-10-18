
# A6CARS - Full repository

Folders:
- backend/  -> Node.js + Express backend
- frontend/ -> Vite + React + Tailwind frontend

## Quick start
1. Start MySQL and create DB:
   - `mysql -u root -p < backend/schema.sql`
2. Backend:
   - cd backend
   - cp .env.example .env   (edit values)
   - npm install
   - npm start
3. Frontend:
   - cd frontend
   - npm install
   - npm run dev

 ## Development
 - Start MySQL (the project uses a local Docker container in dev). Ensure it is reachable on host port 3307.
 - Start backend: cd backend && npm install && npm run start
 - Start frontend: cd frontend && npm install && npm run dev

 Recommended dev start order
 - Start the DB first (Docker):
    - docker run --name a6cars-db -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=A6 -p 3307:3306 -d mysql:8
 - Wait for DB to be ready (the repo includes a helper):
    - cd scripts && DB_HOST=127.0.0.1 DB_PORT=3307 ./wait-for-db.sh
 - Then start backend and frontend:
    - cd backend && npm install && npm run start
    - cd frontend && npm install && npm run dev

 Testing & CI
 - The backend Jest tests truncate relevant tables and seed an admin user before running. In CI you can run:
    - cd backend && npm ci && npm test
 - A lightweight GitHub Actions workflow is included in `.github/workflows/ci.yml` which starts MySQL service and runs the test suite.

Default DB name: A6
Auth: JWT (send Authorization: Bearer <token>)
