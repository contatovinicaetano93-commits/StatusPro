/**
 * Tiny circuit breaker for ERP calls.
 * Opens after `threshold` failures; half-open after `cooldownMs`.
 */
export class CircuitBreaker {
  private failures = 0;
  private openedAt: number | null = null;

  constructor(
    private readonly threshold = 3,
    private readonly cooldownMs = 30_000,
  ) {}

  canRequest(): boolean {
    if (this.openedAt == null) return true;
    if (Date.now() - this.openedAt >= this.cooldownMs) return true;
    return false;
  }

  success() {
    this.failures = 0;
    this.openedAt = null;
  }

  failure() {
    this.failures += 1;
    if (this.failures >= this.threshold) {
      this.openedAt = Date.now();
    }
  }
}
