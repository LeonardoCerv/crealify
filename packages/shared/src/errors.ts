export class IntegrationError extends Error {
  constructor(
    public readonly provider: string,
    message: string,
    public readonly status?: number,
    public readonly cause?: unknown,
  ) {
    super(`[${provider}] ${message}`);
    this.name = "IntegrationError";
  }
}

export class NotConfiguredError extends Error {
  constructor(public readonly provider: string) {
    super(`Integration not configured: ${provider}. Add a token in Settings.`);
    this.name = "NotConfiguredError";
  }
}
