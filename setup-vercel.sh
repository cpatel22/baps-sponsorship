#!/bin/bash
# Vercel Deployment Setup Script

echo "🚀 Setting up Vercel Postgres deployment..."
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "⚠️  .env.local not found"
    echo "📋 Creating from example..."
    cp .env.local.example .env.local
    echo "✓ Created .env.local"
    echo ""
    echo "⚠️  IMPORTANT: Edit .env.local with your Vercel Postgres credentials!"
    echo "   Get them from: Vercel Dashboard → Storage → Postgres → .env.local tab"
    echo ""
    read -p "Press Enter after updating .env.local..."
fi

echo ""
echo "📦 Installing dependencies..."
bun install

echo ""
echo "🗄️  Initializing database..."
bun run db:init

echo ""
echo "✅ Setup complete!"
echo ""
echo "📝 Next steps:"
echo "  1. Verify database at: Vercel Dashboard → Storage → Postgres"
echo "  2. Test locally: bun dev"
echo "  3. Deploy: vercel --prod"
echo ""
echo "🔑 Default admin credentials:"
echo "   Email: admin@example.com"
echo "   Password: admin123"
echo "   ⚠️  CHANGE THIS AFTER FIRST LOGIN!"
