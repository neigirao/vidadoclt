import { useEffect, useRef } from "react";

export function GameMount() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    let destroyed = false;
    let game: import("phaser").Game | null = null;

    Promise.all([import("phaser"), import("./config")]).then(([PhaserMod, { buildGameConfig }]) => {
      if (destroyed || !ref.current) return;
      const Phaser = PhaserMod.default ?? PhaserMod;
      game = new Phaser.Game(buildGameConfig(ref.current));
    });

    return () => {
      destroyed = true;
      game?.destroy(true);
      game = null;
    };
  }, []);

  return <div ref={ref} className="w-full h-full" style={{ width: "100%", height: "100%" }} />;
}
