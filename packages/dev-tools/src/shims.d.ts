declare module "html" {
  export function prettyPrint(
    value: string,
    options?: Record<string, unknown>,
  ): string;
}
