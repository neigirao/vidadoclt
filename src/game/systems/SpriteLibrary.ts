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
const EXPLICIT_ALIASES: Record<string, string> = {
  "planta-deco": "obj-planta-empresa-idle",
  "bebedouro-deco": "obj-bebedouro-idle",
  "pilha-docs": "obj-pilha-papel-idle",
  "caixa-papel": "obj-caixa-arquivos-idle",
  "mesa-deco": "obj-mesa-idle",
  coffee: "item-coffee-cup",
  postit: "item-postit-active0",
  convite: "item-convite-idle0",
  email: "item-email-idle0",
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
      if (atlasFrames.has(frame)) {
        result = [ATLAS_KEY, frame];
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
