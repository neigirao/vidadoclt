// Tipos mínimos do runner nativo do Bun (bun:test) — o registro npm do
// sandbox bloqueia @types/bun, então declaramos só a superfície usada nos
// testes. O bun executa os testes com seu transpiler próprio; isto existe
// apenas para o tsc/editor.
declare module "bun:test" {
  type TestFn = () => void | Promise<void>;
  export function describe(name: string, fn: TestFn): void;
  export function it(name: string, fn: TestFn): void;
  export function test(name: string, fn: TestFn): void;

  interface Matchers {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toBeNull(): void;
    toBeDefined(): void;
    toBeGreaterThan(n: number): void;
    toBeGreaterThanOrEqual(n: number): void;
    toBeLessThan(n: number): void;
    toBeLessThanOrEqual(n: number): void;
    toBeCloseTo(n: number, digits?: number): void;
    toContain(item: unknown): void;
    not: Matchers;
  }
  export function expect(value: unknown): Matchers;
}
