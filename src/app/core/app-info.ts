/** App version shown in the settings; bumped by release-please, must match package.json (checked by a test). */
export const APP_VERSION = '0.4.0'; // x-release-please-version

/** Set at build time with `--define` (angular.json, deploy workflow); undefined in release builds. */
declare const GRYND_BUILD: string | undefined;

/**
 * Where this build runs: `<channel>` or `<channel>.<commit>`, e.g. `dev` (ng serve), `main.abc1234`
 * (staging) or `pr-31.abc1234` (PR preview). Empty for releases.
 */
export const BUILD_LABEL = typeof GRYND_BUILD === 'string' ? GRYND_BUILD : '';

/** Version as shown in the app, with the build label as SemVer build metadata: `0.4.0+pr-31.abc1234`. */
export function displayVersion(version = APP_VERSION, build = BUILD_LABEL): string {
  return build ? `${version}+${build}` : version;
}

/** Page title with the build channel in front (`pr-31 · Grynd`), so a preview tab is not taken for the app. */
export function displayTitle(title: string, build = BUILD_LABEL): string {
  const channel = build.split('.')[0];
  return channel ? `${channel} · ${title}` : title;
}
