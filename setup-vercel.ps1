# Vercel Deployment Setup Script for Windows

Write-Host "🚀 Setting up Vercel Postgres deployment..." -ForegroundColor Cyan
Write-Host ""

# Check if .env.local exists
if (-not (Test-Path ".env.local")) {
    Write-Host "⚠️  .env.local not found" -ForegroundColor Yellow
    Write-Host "📋 Creating from example..."
    Copy-Item ".env.local.example" ".env.local"
    Write-Host "✓ Created .env.local" -ForegroundColor Green
    Write-Host ""
    Write-Host "⚠️  IMPORTANT: Edit .env.local with your Vercel Postgres credentials!" -ForegroundColor Yellow
    Write-Host "   Get them from: Vercel Dashboard → Storage → Postgres → .env.local tab"
    Write-Host ""
    Write-Host "Opening .env.local in notepad..."
    notepad .env.local
    Write-Host ""
    Read-Host "Press Enter after updating .env.local"
}

Write-Host ""
Write-Host "📦 Installing dependencies..."
bun install

Write-Host ""
Write-Host "🗄️  Initializing database..."
bun run db:init

Write-Host ""
Write-Host "✅ Setup complete!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Next steps:"
Write-Host "  1. Verify database at: Vercel Dashboard → Storage → Postgres"
Write-Host "  2. Test locally: bun dev"
Write-Host "  3. Deploy: vercel --prod"
Write-Host ""
Write-Host "🔑 Default admin credentials:" -ForegroundColor Cyan
Write-Host "   Email: admin@example.com"
Write-Host "   Password: admin123"
Write-Host "   ⚠️  CHANGE THIS AFTER FIRST LOGIN!" -ForegroundColor Yellow
