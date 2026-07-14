import Phaser from "phaser";

/**
 * Sprite library — centraliza o acesso a TODOS os sprites do jogo via um
 * único atlas de textura (`/assets/atlas.{png,json}`), eliminando o
 * rebind de textura por frame que causava o flickering.
 *
 * Mecânica do problema: cada sprite animado trocava de textura a cada frame
 * (`setTexture("tex-player-walk3")`), e cada chave era uma textura WebGL
 * separada. Com centenas de texturas intercaladas por profundidade, o batch
 * do Phaser fazia flush/rebind constantemente — um rebind que cai no meio do
 * frame aparece como flicker. Lendo todos os frames de UM único atlas, a
 * troca por frame vira apenas mudança de coordenada UV (zero rebind).
 *
 * Convenção de nomes: a chave lógica `tex-player-walk3` corresponde ao frame
 * `player-walk3` no atlas (mesmo nome do PNG, sem o prefixo `tex-`). Chaves
 * que não existem no atlas (texturas geradas em runtime como `tex-mesa-body`,
 * backgrounds `bg-*`) caem de volta para sua própria textura standalone.
 */

export const ATLAS_KEY = "sprites";

let atlasFrames: Set<string> | null = null;

/**
 * Indexa os nomes de frame do atlas carregado. Chamar uma vez após o atlas
 * estar disponível (BootScene.create).
 */
export function initSpriteLibrary(scene: Phaser.Scene): void {
  _resolveCache.clear();
  if (!scene.textures.exists(ATLAS_KEY)) {
    atlasFrames = new Set();
    return;
  }
  // getFrameNames() exclui o frame "__BASE"; é exatamente o que queremos.
  atlasFrames = new Set(scene.textures.get(ATLAS_KEY).getFrameNames());
}

// Cache de resolução por chave (resolveSprite roda a cada frame nas animações).
const _resolveCache = new Map<string, [string, string?]>();

// Override de frame por runtime (arte refeita pela IA online, salva no Supabase
// Storage e aplicada por cima do atlas — sem re-empacotar). Injetado por
// SpriteOverrides p/ não acoplar SpriteLibrary ao supabase. Dado um nome de frame
// do atlas, retorna a KEY de textura standalone do override, ou undefined.
let _overrideResolver: ((frame: string) => string | undefined) | null = null;
export function setSpriteOverrideResolver(
  fn: ((frame: string) => string | undefined) | null,
): void {
  _overrideResolver = fn;
  _resolveCache.clear();
}

/**
 * Candidatos de nome de frame para uma chave lógica, em ordem de prioridade.
 * A nomenclatura das chaves `tex-*` não bate 1:1 com os frames do atlas (que
 * usam o nome do PNG de origem), então testamos os padrões conhecidos:
 *   player:        tex-player-walk3  → player-walk3        (strip)
 *   enemy/boss:    tex-estagiario-X  → enemy-estagiario-X  (prefixo enemy-)
 *                  tex-gerente-X     → enemy-gerente-X
 *   objetos:       tex-baia          → obj-baia
 *                  tex-cafe-machine  → obj-cafe-machine-idle
 *                  tex-obj-impressora→ obj-impressora-idle
 *   itens:         tex-postit        → item-postit
 *   npc:           tex-faxineiro     → npc-faxineiro
 *   tiles:         tex-floor         → tile-floor
 * O primeiro candidato que existir de fato no atlas vence; nada batendo cai
 * para a textura standalone (geradas em runtime, backgrounds, vr/coffee etc).
 */

/**
 * Mapeamento explícito de chave-stripped → frame do atlas para casos que não
 * seguem nenhum dos padrões automáticos de candidateFrames. Exportado para que
 * código externo possa injetar entradas sem editar este arquivo:
 *   import { EXPLICIT_ALIASES } from "@/game/systems/SpriteLibrary";
 *   EXPLICIT_ALIASES["meu-sprite"] = "obj-meu-sprite-idle";
 */
export const EXPLICIT_ALIASES: Record<string, string> = {
  "planta-deco": "obj-planta-empresa-idle",
  "bebedouro-deco": "obj-bebedouro-idle",
  "pilha-docs": "obj-pilha-papel-idle",
  "caixa-papel": "obj-caixa-arquivos-idle",
  "mesa-deco": "obj-mesa-idle",
  coffee: "item-coffee-cup",
  postit: "item-postit-active0",
  convite: "item-convite-idle0",
  email: "item-email-idle0",
  ceo: "boss-ceo-idle0",
};

function candidateFrames(stripped: string): string[] {
  const candidates: string[] = [];
  const alias = EXPLICIT_ALIASES[stripped];
  if (alias) candidates.push(alias);
  candidates.push(
    stripped,
    `${stripped}-idle`,
    `enemy-${stripped}`,
    `obj-${stripped}`,
    `obj-${stripped}-idle`,
    `item-${stripped}`,
    `npc-${stripped}`,
    `tile-${stripped}`,
  );
  return candidates;
}

/**
 * Resolve uma chave lógica (`tex-player-walk3`) para uma tupla
 * `[textura, frame?]`. Chaves servidas pelo atlas roteiam para a textura
 * compartilhada; o resto cai para sua textura standalone.
 */
export function resolveSprite(key: string): [string, string?] {
  const cached = _resolveCache.get(key);
  if (cached) return cached;

  let result: [string, string?] = [key];
  if (atlasFrames && atlasFrames.size) {
    const stripped = key.startsWith("tex-") ? key.slice(4) : key;
    for (const frame of candidateFrames(stripped)) {
      const ovr = _overrideResolver?.(frame);
      if (atlasFrames.has(frame)) {
        // Override de runtime (IA online): se houver arte refeita p/ este frame,
        // usa a textura standalone do override em vez do frame do atlas.
        result = ovr ? [ovr] : [ATLAS_KEY, frame];
        break;
      }
      // Frame VIRTUAL: não existe no atlas, mas há override (frame NOVO adicionado
      // pelo multi-frame do LAB, ex.: enemy-facilitador-walk2). Serve o override —
      // é o que permite o jogo ciclar frames além do atlas empacotado.
      if (ovr) {
        result = [ovr];
        break;
      }
    }
  }
  _resolveCache.set(key, result);
  return result;
}

/** true se a chave é servida pelo atlas (e não por uma textura standalone). */
export function isAtlasKey(key: string): boolean {
  return resolveSprite(key)[0] === ATLAS_KEY;
}

/**
 * Define a textura de um game object a partir de uma chave lógica, pulando a
 * atualização quando já exibe exatamente aquela textura+frame. Substitui o
 * padrão `if (obj.texture.key !== key) obj.setTexture(key)` de forma
 * consciente de atlas (onde texture.key é sempre "sprites" e o que muda é o
 * frame). Retorna true se a textura mudou.
 */
export function applyTexture(
  obj: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image,
  key: string,
): boolean {
  const [tex, frame] = resolveSprite(key);
  const sameTex = obj.texture.key === tex;
  const sameFrame = frame === undefined || obj.frame.name === frame;
  if (sameTex && sameFrame) return false;
  obj.setTexture(tex, frame);
  return true;
}

/** scene.add.image via biblioteca de sprites (resolve atlas vs standalone). */
export function addImage(
  scene: Phaser.Scene,
  x: number,
  y: number,
  key: string,
): Phaser.GameObjects.Image {
  return scene.add.image(x, y, ...resolveSprite(key));
}

/** scene.add.sprite via biblioteca de sprites. */
export function addSprite(
  scene: Phaser.Scene,
  x: number,
  y: number,
  key: string,
): Phaser.GameObjects.Sprite {
  return scene.add.sprite(x, y, ...resolveSprite(key));
}

/**
 * Retorna um array de chaves de frame do atlas para um dado prefixo e lista de
 * estados de animação, com `countPerState` frames por estado (numerados 0-based).
 *
 * Usa a mesma lógica de resolução de resolveSprite: para cada chave lógica
 * `tex-<prefixo>-<estado><n>` o frame resolvido do atlas é adicionado ao array.
 * Frames não encontrados no atlas são omitidos silenciosamente.
 *
 * @example
 * getAnimFrames("estagiario", ["idle","walk","hurt"], 2)
 * // → ["enemy-estagiario-idle0","enemy-estagiario-idle1",
 * //    "enemy-estagiario-walk0","enemy-estagiario-walk1",
 * //    "enemy-estagiario-hurt0","enemy-estagiario-hurt1"]
 */
export function getAnimFrames(
  prefix: string,
  stateNames: string[],
  countPerState: number,
): string[] {
  const frames: string[] = [];
  for (const state of stateNames) {
    for (let i = 0; i < countPerState; i++) {
      const logicalKey = `tex-${prefix}-${state}${i}`;
      const [tex, frame] = resolveSprite(logicalKey);
      // Only include frames that resolved to the atlas (not standalone fallbacks).
      if (tex === ATLAS_KEY && frame !== undefined) {
        frames.push(frame);
      }
    }
  }
  return frames;
}

/**
 * Aplica textura+frame a um Phaser.Physics.Arcade.Sprite usando resolveSprite e
 * define a origem nos pés (0.5, 1) — padrão de ancoragem de todos os inimigos.
 *
 * @param sprite - O sprite a ser configurado (deve estar criado previamente).
 * @param texKey - Chave lógica `tex-*` do sprite inicial (e.g. `tex-estagiario-idle0`).
 */
export function bindEnemySprite(sprite: Phaser.Physics.Arcade.Sprite, texKey: string): void {
  const [tex, frame] = resolveSprite(texKey);
  sprite.setTexture(tex, frame);
  sprite.setOrigin(0.5, 1);
}

/**
 * Verifica se os frames padrão de um prefixo de inimigo existem no atlas e emite
 * console.warn para cada frame ausente. Útil para detectar assets faltando cedo
 * (chamar no create() da cena).
 *
 * Frames verificados: `<prefixo>-idle0`, `<prefixo>-walk0`, `<prefixo>-hurt0`
 * (usando a lógica completa de resolveSprite, incluindo EXPLICIT_ALIASES e
 * prefixos automáticos como `enemy-`).
 *
 * @returns Array de chaves de frame que NÃO foram encontradas no atlas.
 */
export function warnMissing(scene: Phaser.Scene, prefix: string): string[] {
  const standardStates = ["idle0", "walk0", "hurt0"];
  const missing: string[] = [];

  for (const state of standardStates) {
    const logicalKey = `tex-${prefix}-${state}`;
    const [tex, frame] = resolveSprite(logicalKey);

    let found = false;
    if (tex === ATLAS_KEY && frame !== undefined) {
      // Confirmed in atlas via resolveSprite's own index.
      found = true;
    } else if (scene.textures.exists(tex)) {
      // Standalone texture (runtime-generated or loaded separately).
      found = true;
    }

    if (!found) {
      const candidateLabel = frame !== undefined ? `${tex}[${frame}]` : logicalKey;
      console.warn(
        `[SpriteLibrary] warnMissing: frame not found for "${logicalKey}" ` +
          `(resolved candidate: "${candidateLabel}")`,
      );
      missing.push(logicalKey);
    }
  }

  return missing;
}
