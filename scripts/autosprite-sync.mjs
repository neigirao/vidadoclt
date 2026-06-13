/**
 * autosprite-sync.mjs
 *
 * Envia sprites do jogo para AutoSprite API, gera animações e baixa os sprite sheets.
 *
 * Uso: node scripts/autosprite-sync.mjs
 *
 * Requer: Node.js 18+ (fetch nativo)
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');
const SPRITES_DIR = join(ROOT, 'public/assets/sprites');
const OUT_DIR = join(ROOT, 'public/assets/sprites');

const API_KEY = process.env.AUTOSPRITE_KEY;
if (!API_KEY) {
  console.error('❌ Set AUTOSPRITE_KEY env var before running:\n   export AUTOSPRITE_KEY=vspk_...');
  process.exit(1);
}
const BASE_URL = 'https://www.autosprite.io/api/v1';

const headers = {
  'x-api-key': API_KEY,
  'Content-Type': 'application/json',
};

// ─── Sprites a processar ───────────────────────────────────────────────────────
// Define cada personagem: qual PNG base usar, quais animações gerar e o prompt
// que descreve o estilo visual para o AutoSprite manter consistência.

const CHARACTERS = [
  {
    name: 'player',
    file: 'player-idle.png',
    prompt: 'office worker with glasses, white shirt, dark tie, dark pants, pixel art, retro game style',
    animations: [
      { kind: 'walk' },
      { kind: 'run' },
      { kind: 'jump' },
      { kind: 'attack' },
      { kind: 'idle' },
    ],
    outPrefix: 'player',
  },
  {
    name: 'estagiario',
    file: 'enemy-estagiario.png',
    prompt: 'young intern with green hoodie and headphones, pixel art, retro game enemy',
    animations: [
      { kind: 'walk' },
      { kind: 'attack' },
      { kind: 'idle' },
    ],
    outPrefix: 'enemy-estagiario',
  },
  {
    name: 'analista',
    file: 'enemy-analista.png',
    prompt: 'tired office analyst with thick glasses and white shirt, pixel art, retro game enemy',
    animations: [
      { kind: 'walk' },
      { kind: 'attack' },
      { kind: 'idle' },
    ],
    outPrefix: 'enemy-analista',
  },
  {
    name: 'facilitador',
    file: 'enemy-facilitador.png',
    prompt: 'cheerful workshop facilitator with blue polo shirt holding clipboard, pixel art, retro game enemy',
    animations: [
      { kind: 'walk' },
      { kind: 'attack' },
      { kind: 'idle' },
    ],
    outPrefix: 'enemy-facilitador',
  },
  {
    name: 'scrum',
    file: 'enemy-scrum.png',
    prompt: 'agile coach with yellow vest covered in sticky notes, holding coffee cup, pixel art, retro game enemy',
    animations: [
      { kind: 'walk' },
      { kind: 'attack' },
      { kind: 'idle' },
    ],
    outPrefix: 'enemy-scrum',
  },
  {
    name: 'coordenador',
    file: 'enemy-coordenador.png',
    prompt: 'corporate coordinator in full suit with ID badge and lanyard, arms crossed, pixel art, retro game enemy',
    animations: [
      { kind: 'walk' },
      { kind: 'attack' },
      { kind: 'idle' },
    ],
    outPrefix: 'enemy-coordenador',
  },
  {
    name: 'senior',
    file: 'enemy-senior.png',
    prompt: 'exhausted senior analyst, large rumpled shirt with coffee stain, pixel art, retro game enemy',
    animations: [
      { kind: 'walk' },
      { kind: 'attack' },
      { kind: 'idle' },
    ],
    outPrefix: 'enemy-senior',
  },
  {
    name: 'gerente',
    file: 'enemy-gerente.png',
    prompt: 'imposing manager boss in dark suit with red tie, phone in hand, pixel art, retro game boss',
    animations: [
      { kind: 'walk' },
      { kind: 'attack' },
      { kind: 'idle' },
      { kind: 'run' },
    ],
    outPrefix: 'enemy-gerente',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function apiGet(path) {
  const res = await fetch(`${BASE_URL}${path}`, { headers });
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}: ${await res.text()}`);
  return res.json();
}

async function uploadImage(filePath) {
  // Step 1: request upload URL
  const { upload_url, character_id } = await apiPost('/characters/upload-url', {
    filename: basename(filePath),
    content_type: 'image/png',
  });

  // Step 2: PUT the image to the presigned URL
  const fileData = readFileSync(filePath);
  const uploadRes = await fetch(upload_url, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/png' },
    body: fileData,
  });
  if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.status}`);

  return character_id;
}

async function pollJob(jobId, maxWaitMs = 300_000) {
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    const job = await apiGet(`/jobs/${jobId}`);
    console.log(`  ⏳ Job ${jobId}: ${job.status}`);
    if (job.status === 'completed') return job;
    if (job.status === 'failed') throw new Error(`Job ${jobId} failed: ${job.error}`);
    await sleep(5000); // poll every 5s
  }
  throw new Error(`Job ${jobId} timed out after ${maxWaitMs / 1000}s`);
}

async function downloadFile(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(destPath, buf);
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function processCharacter(char) {
  const filePath = join(SPRITES_DIR, char.file);
  if (!existsSync(filePath)) {
    console.warn(`  ⚠️  File not found: ${char.file} — skipping`);
    return;
  }

  console.log(`\n📦 Processing: ${char.name} (${char.file})`);

  // 1. Upload existing image OR create from prompt
  let characterId;
  try {
    console.log('  📤 Uploading existing sprite...');
    characterId = await uploadImage(filePath);
    console.log(`  ✅ Uploaded → character ID: ${characterId}`);
  } catch (e) {
    // Fallback: create from prompt if upload endpoint differs
    console.log(`  ↩️  Upload failed (${e.message}), creating from prompt...`);
    const created = await apiPost('/characters', {
      name: char.name,
      prompt: char.prompt,
    });
    characterId = created.id || created.character_id;
    console.log(`  ✅ Created → character ID: ${characterId}`);
  }

  // 2. Request sprite sheet with animations
  console.log(`  🎬 Requesting animations: ${char.animations.map(a => a.kind).join(', ')}`);
  const sheet = await apiPost(`/characters/${characterId}/spritesheets`, {
    animations: char.animations,
    style: 'pixel_art',
    background: 'transparent',
  });

  const jobId = sheet.job_id || sheet.id;
  console.log(`  ⚙️  Job started: ${jobId}`);

  // 3. Poll for completion
  const completed = await pollJob(jobId);

  // 4. Download results
  const downloadUrl = completed.download_url || completed.result?.url;
  if (downloadUrl) {
    const outPath = join(OUT_DIR, `${char.outPrefix}-sheet.png`);
    await downloadFile(downloadUrl, outPath);
    console.log(`  💾 Saved: ${char.outPrefix}-sheet.png`);

    // Save JSON atlas if available
    if (completed.atlas_url || completed.result?.atlas_url) {
      const atlasPath = join(OUT_DIR, `${char.outPrefix}-sheet.json`);
      await downloadFile(completed.atlas_url || completed.result.atlas_url, atlasPath);
      console.log(`  💾 Saved: ${char.outPrefix}-sheet.json`);
    }
  } else {
    console.warn('  ⚠️  No download URL in response:', JSON.stringify(completed, null, 2));
  }
}

async function main() {
  console.log('🎮 AutoSprite Sync — A Vida do CLT\n');

  // Check account first
  try {
    const account = await apiGet('/account');
    console.log(`✅ Account: ${account.email || account.name || 'OK'}`);
    console.log(`💳 Credits: ${account.credits ?? account.balance ?? 'unknown'}\n`);
  } catch (e) {
    console.error('❌ Account check failed:', e.message);
    process.exit(1);
  }

  // Process each character
  const failed = [];
  for (const char of CHARACTERS) {
    try {
      await processCharacter(char);
    } catch (e) {
      console.error(`  ❌ Failed ${char.name}: ${e.message}`);
      failed.push(char.name);
    }
  }

  // Repack atlas
  console.log('\n🗜️  Repacking texture atlas...');
  try {
    execSync('node scripts/pack-atlas.mjs', { cwd: ROOT, stdio: 'inherit' });
  } catch (e) {
    console.error('Atlas repack failed:', e.message);
  }

  console.log('\n✅ Done!');
  if (failed.length) console.warn(`⚠️  Failed: ${failed.join(', ')}`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
