import Phaser from "phaser";
import { Box, canJump } from "./LevelKinematics";

// ─────────────────────────────────────────────────────────────────────────────
// Validador de fase — roda contra uma cena JÁ montada e verifica invariantes que
// garantem que a fase é jogável e justa num roguelite (onde o layout varia por
// seed). A ideia é falhar CEDO (no console, em DEV) se uma variante gerar algo
// injogável: plataforma inalcançável, mesa alta demais bloqueando o corredor,
// inimigo em cima do spawn, boss/saída faltando, ou algo fora dos limites.
//
// Uso (em DEV, no fim de create()):
//   logLevelReport("OpenSpaceV2", validateLevel({ ... }));
//
// É agnóstico de fase: recebe as referências da cena via `LevelSpec`, então
// serve para validar Fases 2–5 depois com o mesmo código.
// ─────────────────────────────────────────────────────────────────────────────

type StaticGroup = Phaser.Physics.Arcade.StaticGroup;
type EnemyGroup = Phaser.Physics.Arcade.Group;

export interface LevelSpec {
  label: string;
  seedVariant: number;
  floorY: number; // Y da superfície do chão
  ceilingY: number; // Y do topo jogável (abaixo do HUD)
  levelWidth: number;
  playerSpawn: { x: number; y: number };
  jumpVel: number; // JUMP_VEL (negativo)
  gravity: number; // GRAVITY
  walkSpeed?: number; // WALK_SPEED (default 200) — alcance horizontal do pulo
  dashBonus?: number; // px extras de alcance por dash aéreo (default 90)
  safeSpawnRadius?: number; // raio livre de inimigos ao redor do spawn (default 160)
  platforms: StaticGroup; // superfícies onde se anda
  furniture: StaticGroup; // corpos sólidos (mesas) que bloqueiam o corredor
  enemies: EnemyGroup[];
  boss?: Phaser.GameObjects.Components.Transform & { active: boolean };
  expectBoss?: boolean; // false p/ fases sem boss por design (ex.: Fase 5 → CEO)
  exit?: { x: number; y: number };
}

export interface LevelCheck {
  name: string;
  ok: boolean;
  detail: string;
  severity: "error" | "warn";
}

export interface LevelReport {
  pass: boolean; // false se houver algum erro (warns não reprovam)
  checks: LevelCheck[];
}

// ── Alcançabilidade encadeada (grafo de pulos plataforma→plataforma) ──────────
// Nó = uma superfície andável (o chão + cada plataforma). Aresta A→B existe se
// dá pra pular de A para B respeitando a cinemática: a altura de subida cabe no
// apex do pulo E o vão horizontal cabe no alcance disponível (tempo no ar × vel.
// horizontal + bônus de dash). BFS a partir do chão marca o que é alcançável.
export interface ReachNode {
  idx: number;
  surfaceY: number;
  left: number;
  right: number;
  isFloor: boolean;
}
export interface ReachResult {
  nodes: ReachNode[];
  reachable: boolean[]; // por nó (índice alinhado com nodes)
  edges: Array<[number, number]>; // arestas percorríveis entre nós alcançáveis (p/ overlay)
}

export function computeReachability(spec: LevelSpec): ReachResult {
  const boxes = spec.platforms
    .getChildren()
    .map(bodyBox)
    .filter((b): b is Box => !!b);
  const nodes: ReachNode[] = boxes.map((b, i) => ({
    idx: i,
    surfaceY: b.top,
    left: b.left,
    right: b.right,
    isFloor: b.left <= 4 && b.right >= spec.levelWidth - 4 && b.top >= spec.floorY - 4,
  }));
  const walk = spec.walkSpeed ?? 200;
  const dashBonus = spec.dashBonus ?? 90; // DASH_SPEED(600) × DASH_MS(0.15)
  const margin = 12;
  const furnBoxes = spec.furniture
    .getChildren()
    .map(bodyBox)
    .filter((b): b is Box => !!b);

  const edges: Array<[number, number]> = [];
  const reachable = nodes.map((n) => n.isFloor); // chão é o ponto de partida
  const queue = nodes.filter((n) => n.isFloor).map((n) => n.idx);
  while (queue.length) {
    const ai = queue.shift()!;
    const a = nodes[ai];
    for (const b of nodes) {
      if (b.idx === ai) continue;
      if (
        canJump(
          a.surfaceY,
          a.left,
          a.right,
          b.surfaceY,
          b.left,
          b.right,
          spec.jumpVel,
          spec.gravity,
          walk,
          dashBonus,
          margin,
          furnBoxes,
        )
      ) {
        if (!reachable[b.idx]) {
          reachable[b.idx] = true;
          queue.push(b.idx);
        }
        edges.push([ai, b.idx]);
      }
    }
  }
  return { nodes, reachable, edges };
}

function bodyBox(obj: Phaser.GameObjects.GameObject): Box | null {
  const body = (obj as { body?: Phaser.Physics.Arcade.StaticBody }).body;
  if (!body) return null;
  return { left: body.x, right: body.x + body.width, top: body.y, bottom: body.y + body.height };
}

function overlaps(a: Box, b: Box): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

export function validateLevel(spec: LevelSpec): LevelReport {
  const checks: LevelCheck[] = [];
  const add = (ok: boolean, name: string, detail: string, severity: "error" | "warn" = "error") =>
    checks.push({ ok, name, detail, severity });

  // Altura/distância máximas de pulo (cinemática): h = v²/2g.
  const maxJumpH = (spec.jumpVel * spec.jumpVel) / (2 * spec.gravity);
  const reachMargin = 12; // px de folga — não exigir o pulo no talo
  const safeR = spec.safeSpawnRadius ?? 160;

  const platforms = spec.platforms.getChildren();
  const furniture = spec.furniture.getChildren();

  // 1. Chão contínuo: existe uma plataforma cobrindo toda a largura no nível do chão.
  const floorSpan = platforms.some((p) => {
    const b = bodyBox(p);
    return b && b.left <= 4 && b.right >= spec.levelWidth - 4 && b.top >= spec.floorY - 4;
  });
  add(
    floorSpan,
    "chão-contínuo",
    floorSpan
      ? "chão cobre 0→levelWidth"
      : "sem plataforma de chão cobrindo toda a largura — jogador pode cair no vazio",
  );

  // 2. Alcançabilidade encadeada: BFS de pulos a partir do chão. Uma plataforma
  //    vale se dá pra chegar nela pulando do chão OU de outra já alcançável
  //    (suporta layouts verticais em escada, não só pulo direto do piso).
  const reach = computeReachability(spec);
  const elevated = reach.nodes.filter((n) => !n.isFloor);
  const isolated = elevated.filter((n) => !reach.reachable[n.idx]);
  add(
    isolated.length === 0,
    "plataformas-alcançáveis",
    isolated.length === 0
      ? `${elevated.length} plataformas, todas alcançáveis (pulo encadeado, apex ${maxJumpH.toFixed(0)}px)`
      : `${isolated.length}/${elevated.length} plataforma(s) ilhada(s) — sem cadeia de pulos até elas`,
  );

  // 3. Mesas (corpos sólidos que descem até o chão) precisam ser "puláveis": o
  // topo delas ≤ altura de pulo, senão bloqueiam o corredor sem saída.
  let blocking = 0;
  for (const f of furniture) {
    const b = bodyBox(f);
    if (!b) continue;
    const reachesFloor = b.bottom >= spec.floorY - 4;
    const topAboveFloor = spec.floorY - b.top;
    if (reachesFloor && topAboveFloor > maxJumpH - reachMargin) blocking++;
  }
  add(
    blocking === 0,
    "mesas-puláveis",
    blocking === 0
      ? `${furniture.length} móveis, nenhum bloqueia o corredor`
      : `${blocking} móvel(is) alto(s) demais para pular por cima — corredor pode ficar intransponível`,
  );

  // 4. Móveis não se sobrepõem (sobreposição de corpos sólidos = armadilha/clipping).
  let overlapPairs = 0;
  const fboxes = furniture.map(bodyBox).filter((b): b is Box => !!b);
  for (let i = 0; i < fboxes.length; i++)
    for (let j = i + 1; j < fboxes.length; j++) if (overlaps(fboxes[i], fboxes[j])) overlapPairs++;
  add(
    overlapPairs === 0,
    "móveis-sem-sobreposição",
    overlapPairs === 0
      ? "nenhum par de móveis sobreposto"
      : `${overlapPairs} par(es) de móveis sobrepostos`,
  );

  // 5. Spawn seguro: nenhum inimigo dentro do raio livre ao redor do jogador.
  const near: string[] = [];
  for (const g of spec.enemies) {
    for (const e of g.getChildren()) {
      const s = e as unknown as { x: number; y: number; active: boolean };
      if (!s.active) continue;
      const d = Phaser.Math.Distance.Between(s.x, s.y, spec.playerSpawn.x, spec.playerSpawn.y);
      if (d < safeR) near.push(d.toFixed(0));
    }
  }
  add(
    near.length === 0,
    "spawn-seguro",
    near.length === 0
      ? `nenhum inimigo a < ${safeR}px do spawn`
      : `${near.length} inimigo(s) dentro do raio seguro (${near.join(",")}px)`,
  );

  // 6. Nada fora dos limites verticais (abaixo do chão ou acima do teto jogável).
  const oob: string[] = [];
  for (const g of spec.enemies) {
    for (const e of g.getChildren()) {
      const s = e as unknown as { x: number; y: number; active: boolean };
      if (!s.active) continue;
      if (s.y > spec.floorY + 20 || s.y < spec.ceilingY - 4)
        oob.push(`(${s.x.toFixed(0)},${s.y.toFixed(0)})`);
    }
  }
  add(
    oob.length === 0,
    "inimigos-nos-limites",
    oob.length === 0
      ? "todos os inimigos dentro dos limites verticais"
      : `${oob.length} inimigo(s) fora: ${oob.slice(0, 4).join(" ")}`,
  );

  // 7. Boss presente, no nível do chão e à esquerda da saída.
  if (spec.boss) {
    const b = spec.boss as unknown as { x: number; y: number; active: boolean };
    const grounded = b.y <= spec.floorY + 20 && b.y >= spec.ceilingY;
    add(
      grounded,
      "boss-posicionado",
      grounded
        ? `boss em (${b.x.toFixed(0)},${b.y.toFixed(0)})`
        : `boss fora do nível jogável (y=${b.y.toFixed(0)})`,
    );
  } else if (spec.expectBoss === false) {
    add(true, "boss-presente", "fase sem boss (por design)");
  } else {
    add(false, "boss-presente", "cena sem boss");
  }

  // 8. Saída (porta da Copa) presente na ponta direita.
  if (spec.exit) {
    const farEnough = spec.exit.x > spec.levelWidth * 0.8;
    add(
      farEnough,
      "saída-presente",
      farEnough
        ? `saída em x=${spec.exit.x.toFixed(0)}`
        : `saída muito à esquerda (x=${spec.exit.x.toFixed(0)})`,
      "warn",
    );
  } else {
    add(false, "saída-presente", "cena sem saída definida", "warn");
  }

  // 9. Ritmo roguelike: inimigos espalhados em ≥3 zonas horizontais (progressão
  //    esquerda→direita), não amontoados num ponto só.
  const zoneCount = 5;
  const zones = new Array(zoneCount).fill(0);
  let totalEnemies = 0;
  for (const g of spec.enemies) {
    for (const e of g.getChildren()) {
      const s = e as unknown as { x: number; active: boolean };
      if (!s.active) continue;
      totalEnemies++;
      const z = Math.min(zoneCount - 1, Math.floor((s.x / spec.levelWidth) * zoneCount));
      zones[z]++;
    }
  }
  const zonesUsed = zones.filter((z) => z > 0).length;
  add(
    totalEnemies > 0 && zonesUsed >= 3,
    "distribuição-inimigos",
    `${totalEnemies} inimigos em ${zonesUsed}/${zoneCount} zonas [${zones.join(",")}]`,
    "warn",
  );

  const pass = checks.every((c) => c.ok || c.severity === "warn");
  return { pass, checks };
}

// ─────────────────────────────────────────────────────────────────────────────
// Overlay visual de debug — desenha o diagnóstico do validador em cima da fase
// montada (tecla V no OpenSpaceV2Scene em DEV). Geometria em coordenadas de
// mundo (scrollFactor 1); painel de texto fixo na câmera (scrollFactor 0).
// Cores: verde = ok/alcançável, vermelho = problema, ciano = player/spawn,
// amarelo = arco de pulo, laranja = zonas.
// ─────────────────────────────────────────────────────────────────────────────
export function drawLevelOverlay(
  scene: Phaser.Scene,
  spec: LevelSpec,
  report: LevelReport,
): Phaser.GameObjects.Container {
  const c = scene.add.container(0, 0).setDepth(995);
  const g = scene.add.graphics().setScrollFactor(1, 1);
  c.add(g);
  const label = (x: number, y: number, t: string, color: string, sf = 1) => {
    const txt = scene.add
      .text(x, y, t, {
        fontFamily: "monospace",
        fontSize: "9px",
        color,
        stroke: "#000",
        strokeThickness: 3,
      })
      .setScrollFactor(sf, sf)
      .setDepth(996);
    c.add(txt);
    return txt;
  };

  const maxJumpH = (spec.jumpVel * spec.jumpVel) / (2 * spec.gravity);
  const margin = 12;

  // Linha do chão + "teto" de pulo (altura máxima alcançável).
  g.lineStyle(1, 0x3388ff, 0.5).lineBetween(0, spec.floorY, spec.levelWidth, spec.floorY);
  g.lineStyle(1, 0xffee44, 0.35);
  for (let x = 0; x < spec.levelWidth; x += 16)
    g.lineBetween(x, spec.floorY - maxJumpH, x + 8, spec.floorY - maxJumpH);
  label(8, spec.floorY - maxJumpH - 12, `teto de pulo (${maxJumpH.toFixed(0)}px)`, "#ffee44");

  // Zonas de dificuldade (5 faixas verticais) + contagem de inimigos.
  const zones = 5,
    zw = spec.levelWidth / zones;
  const zoneCounts = new Array(zones).fill(0);
  for (const grp of spec.enemies)
    for (const e of grp.getChildren()) {
      const s = e as unknown as { x: number; active: boolean };
      if (s.active) zoneCounts[Math.min(zones - 1, Math.floor(s.x / zw))]++;
    }
  g.lineStyle(1, 0xff8844, 0.25);
  for (let z = 1; z < zones; z++) g.lineBetween(z * zw, spec.ceilingY, z * zw, spec.floorY);
  for (let z = 0; z < zones; z++)
    label(z * zw + 6, spec.ceilingY + 4, `Z${z + 1}: ${zoneCounts[z]}`, "#ffaa66");

  // Arestas de pulo (grafo de alcançabilidade encadeada): linhas cinza entre
  // superfícies conectadas por um pulo possível — mostra os caminhos verticais.
  const reach = computeReachability(spec);
  const center = (n: ReachNode) => ({ x: (n.left + n.right) / 2, y: n.surfaceY });
  g.lineStyle(1, 0x8899bb, 0.35);
  for (const [ai, bi] of reach.edges) {
    if (reach.nodes[ai].isFloor && reach.nodes[bi].isFloor) continue;
    const a = center(reach.nodes[ai]),
      bctr = center(reach.nodes[bi]);
    g.lineBetween(a.x, a.y, bctr.x, bctr.y);
  }

  // Plataformas: verde = alcançável (por cadeia de pulos), vermelho = ilhada.
  reach.nodes.forEach((n) => {
    if (n.isFloor) return;
    const b = { left: n.left, right: n.right, top: n.surfaceY };
    const ok = reach.reachable[n.idx];
    g.lineStyle(2, ok ? 0x44ff88 : 0xff3333, 0.9).strokeRect(b.left, b.top, b.right - b.left, 14);
    label(
      b.left,
      b.top - 11,
      `${(spec.floorY - b.top).toFixed(0)}px${ok ? "" : " ⚠ILHADA"}`,
      ok ? "#88ffaa" : "#ff6666",
    );
  });

  // Móveis (mesas): verde = pulável, vermelho = bloqueia o corredor.
  for (const f of spec.furniture.getChildren()) {
    const b = bodyBox(f);
    if (!b) continue;
    const blocks = b.bottom >= spec.floorY - 4 && spec.floorY - b.top > maxJumpH - margin;
    g.lineStyle(1, blocks ? 0xff3333 : 0x44cc88, 0.7).strokeRect(
      b.left,
      b.top,
      b.right - b.left,
      b.bottom - b.top,
    );
  }

  // Spawn do player: raio seguro + arco de pulo (parábola até a distância máx).
  const safeR = spec.safeSpawnRadius ?? 160;
  const sp = spec.playerSpawn;
  g.lineStyle(2, 0x33ddff, 0.9).strokeCircle(sp.x, sp.y, 8);
  g.lineStyle(1, 0x33ddff, 0.4).strokeCircle(sp.x, sp.y, safeR);
  label(sp.x - 18, sp.y - safeR - 12, "SPAWN (raio seguro)", "#66e6ff");
  // arco: v0y=jumpVel, vx=200 (WALK_SPEED); t total até voltar ao chão.
  const vx = 200,
    tTot = (-2 * spec.jumpVel) / spec.gravity;
  g.lineStyle(2, 0xffee44, 0.7);
  g.beginPath();
  for (let i = 0; i <= 24; i++) {
    const t = (i / 24) * tTot;
    const px = sp.x + vx * t;
    const py = sp.y + spec.jumpVel * t + 0.5 * spec.gravity * t * t;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.strokePath();

  // Boss + saída.
  if (spec.boss) {
    const b = spec.boss as unknown as { x: number; y: number };
    g.lineStyle(2, 0xff55aa, 0.9).strokeCircle(b.x, b.y, 12);
    label(b.x - 14, b.y - 40, "BOSS", "#ff88cc");
  }
  if (spec.exit) {
    g.lineStyle(2, 0x66ff66, 0.9).strokeRect(spec.exit.x - 14, spec.exit.y - 24, 28, 48);
    label(spec.exit.x - 14, spec.exit.y - 38, "SAÍDA", "#88ff88");
  }

  // Inimigos: ponto por inimigo ativo.
  g.fillStyle(0xffffff, 0.8);
  for (const grp of spec.enemies)
    for (const e of grp.getChildren()) {
      const s = e as unknown as { x: number; y: number; active: boolean };
      if (s.active) g.fillCircle(s.x, s.y, 3);
    }

  // Painel fixo: resumo PASS/FAIL + checks (scrollFactor 0).
  const pb = scene.add
    .rectangle(6, 40, 300, 8 + report.checks.length * 12 + 16, 0x0a0d12, 0.85)
    .setOrigin(0, 0)
    .setScrollFactor(0)
    .setDepth(996)
    .setStrokeStyle(1, 0x334);
  c.add(pb);
  label(
    12,
    44,
    `LEVEL VALIDATOR — ${report.pass ? "✅ PASS" : "❌ FAIL"}  (V oculta)`,
    report.pass ? "#66ff99" : "#ff6666",
    0,
  );
  report.checks.forEach((ck, i) => {
    const ic = ck.ok ? "✓" : ck.severity === "warn" ? "⚠" : "✗";
    label(
      12,
      58 + i * 12,
      `${ic} ${ck.name}`,
      ck.ok ? "#9fd6b0" : ck.severity === "warn" ? "#ffcc66" : "#ff7777",
      0,
    );
  });

  return c;
}

export function logLevelReport(label: string, report: LevelReport): void {
  const head = report.pass ? "✅ PASS" : "❌ FAIL";

  console.log(`[LevelValidator] ${label}: ${head}`);
  for (const c of report.checks) {
    const icon = c.ok ? "  ✓" : c.severity === "warn" ? "  ⚠" : "  ✗";

    console.log(`${icon} ${c.name}: ${c.detail}`);
  }
}
