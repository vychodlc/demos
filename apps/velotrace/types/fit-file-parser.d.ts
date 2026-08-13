declare module 'fit-file-parser' {
  export default class FitParser {
    constructor(options?: Record<string, unknown>);
    parseAsync(buffer: Buffer): Promise<{ sessions?: Record<string, unknown>[]; records?: Record<string, unknown>[] }>;
  }
}
