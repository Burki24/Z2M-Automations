/** Headless Linux CI has no guaranteed GPU; normal application launches retain their renderer settings. */
export function configureSmokeRendering(application: {disableHardwareAcceleration(): void}, options: {smoke: boolean; platform: string; ci: boolean}): boolean {
  if (!options.smoke || options.platform !== 'linux' || !options.ci) return false;
  application.disableHardwareAcceleration();
  return true;
}

export function smokeCaptureEnabled(argv: readonly string[]): boolean {
  return argv.includes('--smoke-test') && !argv.includes('--smoke-no-capture');
}
