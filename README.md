
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

Default DB name: A6
Auth: JWT (send Authorization: Bearer <token>)
