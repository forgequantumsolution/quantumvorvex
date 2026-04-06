#!/usr/bin/env node
/**
 * vercel-build.js — Custom build script for Vercel deployment
 *
 * What it does:
 *  1. If DATABASE_URL is PostgreSQL, patches Prisma schema provider
 *  2. Adds Vercel binary target to Prisma schema
 *  3. Runs prisma generate + prisma db push (creates tables on first deploy)
 *  4. Builds the Vite frontend
 */

import { readFileSync, writeFileSync } from 'fs'
import { execSync } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT      = resolve(__dirname, '..')
const SCHEMA    = resolve(ROOT, 'server/prisma/schema.prisma')

const run = (cmd, cwd = ROOT) => {
  console.log(`\n▶ ${cmd}`)
  execSync(cmd, { stdio: 'inherit', cwd })
}

const log  = (msg) => console.log(`\n✅ ${msg}`)
const warn = (msg) => console.log(`\n⚠️  ${msg}`)

// ── Step 1: Detect database type ──────────────────────────────────────────────
const dbUrl = process.env.DATABASE_URL || ''
const isPostgres = dbUrl.startsWith('postgresql://') || dbUrl.startsWith('postgres://')

if (!dbUrl) {
  console.error('\n❌ ERROR: DATABASE_URL environment variable is not set.')
  console.error('   Add it in Vercel Dashboard → Settings → Environment Variables')
  console.error('   Get a free PostgreSQL URL at: https://neon.tech')
  process.exit(1)
}

// ── Step 2: Patch Prisma schema if PostgreSQL ─────────────────────────────────
let schema = readFileSync(SCHEMA, 'utf8')
let schemaChanged = false

if (isPostgres) {
  if (schema.includes('provider = "sqlite"')) {
    schema = schema.replace('provider = "sqlite"', 'provider = "postgresql"')
    schemaChanged = true
    log('Patched Prisma schema: sqlite → postgresql')
  }
} else {
  warn(`DATABASE_URL does not look like PostgreSQL. Using as-is: ${dbUrl.substring(0, 20)}...`)
}

// ── Step 3: Add Vercel binary target if missing ───────────────────────────────
if (!schema.includes('binaryTargets')) {
  schema = schema.replace(
    'provider = "prisma-client-js"',
    'provider      = "prisma-client-js"\n  binaryTargets = ["native", "rhel-openssl-3.0.x"]'
  )
  schemaChanged = true
  log('Added Vercel binary target to Prisma schema')
}

if (schemaChanged) {
  writeFileSync(SCHEMA, schema)
  log('Prisma schema updated')
}

// ── Step 4: Generate Prisma client ────────────────────────────────────────────
run('npx prisma generate', resolve(ROOT, 'server'))
log('Prisma client generated')

// ── Step 5: Push schema to database (create tables) ──────────────────────────
if (isPostgres) {
  try {
    run('npx prisma db push --skip-generate', resolve(ROOT, 'server'))
    log('Database schema pushed')
  } catch {
    warn('prisma db push failed — tables may already exist, continuing...')
  }
} else {
  warn('Skipping db push for non-PostgreSQL database')
}

// ── Step 6: Build frontend ────────────────────────────────────────────────────
run('npm run build', resolve(ROOT, 'client'))
log('Frontend built successfully')

console.log('\n🚀 Vercel build complete!\n')
