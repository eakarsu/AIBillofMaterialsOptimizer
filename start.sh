#!/bin/bash
set -e

echo "============================================"
echo "   AI Bill of Materials Optimizer"
echo "   Starting Application..."
echo "============================================"

# Load environment
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

BACKEND_PORT=${BACKEND_PORT:-4001}
FRONTEND_PORT=${FRONTEND_PORT:-3001}

# Kill any processes on used ports
echo ""
echo "[1/6] Cleaning up used ports ($BACKEND_PORT, $FRONTEND_PORT)..."
lsof -ti:$BACKEND_PORT 2>/dev/null | xargs kill -9 2>/dev/null || true
lsof -ti:$FRONTEND_PORT 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 1

# Check PostgreSQL
echo "[2/6] Checking PostgreSQL..."
if ! pg_isready -q 2>/dev/null; then
  echo "  Starting PostgreSQL..."
  brew services start postgresql@14 2>/dev/null || brew services start postgresql 2>/dev/null || true
  sleep 2
fi
echo "  PostgreSQL is running."

# Create database if not exists
echo "[3/6] Setting up database..."
psql -U postgres -tc "SELECT 1 FROM pg_database WHERE datname = 'bom_optimizer'" 2>/dev/null | grep -q 1 || \
  createdb -U postgres bom_optimizer 2>/dev/null || true

# Run schema and seed
psql -U postgres -d bom_optimizer -f server/schema.sql -q 2>/dev/null

# Hash password for admin user: admin123
ADMIN_HASH=$(node -e "const bcrypt = require('./server/node_modules/bcryptjs'); bcrypt.hash('admin123', 10).then(h => console.log(h))" 2>/dev/null || echo '')

if [ -n "$ADMIN_HASH" ]; then
  psql -U postgres -d bom_optimizer -c "INSERT INTO users (email, password, name) VALUES ('admin@bomoptimizer.com', '$ADMIN_HASH', 'Admin User') ON CONFLICT (email) DO UPDATE SET password = '$ADMIN_HASH';" -q 2>/dev/null
fi

psql -U postgres -d bom_optimizer -f server/seeds/seed.sql -q 2>/dev/null
echo "  Database schema created and seeded."

# Install dependencies
echo "[4/6] Installing dependencies..."
cd server && npm install --silent 2>/dev/null && cd ..
cd client && npm install --silent 2>/dev/null && cd ..

# Start backend with auto-reload (nodemon)
echo "[5/6] Starting backend on port $BACKEND_PORT..."
cd server && npx nodemon index.js &
BACKEND_PID=$!
cd ..
sleep 2

# Start frontend with HMR (Vite)
echo "[6/6] Starting frontend on port $FRONTEND_PORT..."
cd client && npx vite --port $FRONTEND_PORT --host &
FRONTEND_PID=$!
cd ..

echo ""
echo "============================================"
echo "   Application Started Successfully!"
echo "============================================"
echo ""
echo "   Frontend:  http://localhost:$FRONTEND_PORT"
echo "   Backend:   http://localhost:$BACKEND_PORT"
echo ""
echo "   Login: admin@bomoptimizer.com / admin123"
echo "   (Use 'Auto-Fill Demo Credentials' button)"
echo ""
echo "   Press Ctrl+C to stop all services"
echo "============================================"

# Cleanup on exit
cleanup() {
  echo ""
  echo "Shutting down..."
  kill $BACKEND_PID 2>/dev/null || true
  kill $FRONTEND_PID 2>/dev/null || true
  lsof -ti:$BACKEND_PORT 2>/dev/null | xargs kill -9 2>/dev/null || true
  lsof -ti:$FRONTEND_PORT 2>/dev/null | xargs kill -9 2>/dev/null || true
  echo "All services stopped."
  exit 0
}

trap cleanup SIGINT SIGTERM

# Wait for any process
wait
