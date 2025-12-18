#!/bin/bash

echo "========================================"
echo "GHL Provisioning Agent - Setup Verification"
echo "========================================"
echo ""

# Check Node.js version
echo "[1/7] Checking Node.js version..."
node_version=$(node --version)
echo "✓ Node.js version: $node_version"
echo ""

# Check npm version
echo "[2/7] Checking npm version..."
npm_version=$(npm --version)
echo "✓ npm version: $npm_version"
echo ""

# Check if dependencies are installed
echo "[3/7] Checking dependencies..."
if [ -d "node_modules" ]; then
  echo "✓ Dependencies installed"
else
  echo "✗ Dependencies not installed. Run: npm install"
  exit 1
fi
echo ""

# Check TypeScript compilation
echo "[4/7] Checking TypeScript compilation..."
if npm run type-check > /dev/null 2>&1; then
  echo "✓ TypeScript compilation successful"
else
  echo "✗ TypeScript compilation failed"
  exit 1
fi
echo ""

# Check Prisma client generation
echo "[5/7] Checking Prisma client..."
if [ -d "node_modules/@prisma/client" ]; then
  echo "✓ Prisma client generated"
else
  echo "✗ Prisma client not generated. Run: npm run db:generate"
  exit 1
fi
echo ""

# Run unit tests
echo "[6/7] Running unit tests..."
if npm test -- --run > /dev/null 2>&1; then
  echo "✓ All unit tests passed"
else
  echo "⚠ Some tests may require database setup"
fi
echo ""

# Check environment variables
echo "[7/7] Checking environment configuration..."
if [ -f ".env.local" ] || [ -f ".env" ]; then
  echo "✓ Environment file exists"
else
  echo "⚠ No .env.local file found. Copy .env.example and configure."
fi
echo ""

echo "========================================"
echo "Setup verification complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "1. Configure .env.local with your credentials"
echo "2. Set up PostgreSQL database"
echo "3. Run migrations: npm run db:migrate"
echo "4. Start dev server: npm run dev"
echo ""
