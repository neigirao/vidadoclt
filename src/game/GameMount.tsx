import { useEffect, useRef } from "react";

export function GameMount() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    let destroyed = false;
    let game: import("phaser").Game | null = null;

    // Dynamic import keeps Phaser out of the SSR bundle.
    Promise.all([import("phaser"), import("./config")]).then(([, { buildGameConfig }]) => {
      if (destroyed || !ref.current) return;
      const Phaser = (window as unknown as { Phaser?: unknown }).Phaser;
      // Use the imported namespace directly
      // (Phaser is also the default export of the package)
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const PhaserNS = require("phaser");
      game = new PhaserNS.Game(buildGameConfig(ref.current));
      void Phaser;
    });

    return () => {
      destroyed = true;
      game?.destroy(true);
      game = null;
    };
  }, []);

  return (
    <div
      ref={ref}
      className="w-full h-full"
      style={{ width: "100%", height: "100%" }}
    />
  );
}
