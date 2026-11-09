// The single source of truth for the game version shown to players (Home footer, Early Access
// notice). Bump it here only.
export const APP_VERSION = '1.5';

/** "V1.5" — how the version is displayed. */
export const versionLabel = (): string => `V${APP_VERSION}`;
