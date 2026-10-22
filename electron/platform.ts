import path from 'node:path';
import type { AppStatus } from '../shared/contracts';

export type DesktopPlatform = AppStatus['platform'];
export const DESKTOP_FILE_NAME = 'app.clipbox.desktop.desktop';
export const AUTOSTART_OWNER_MARKER = 'X-ClipBox-Managed=true';

interface LinuxEnvironment {
  APPIMAGE?: string;
  APPDIR?: string;
  XDG_CONFIG_HOME?: string;
  XDG_SESSION_TYPE?: string;
  WAYLAND_DISPLAY?: string;
}

const unsafePathCharacters = /[\x00-\x1f\x7f]/;

export function isWayland(platform: DesktopPlatform, env: LinuxEnvironment): boolean {
  return platform === 'linux' && (env.XDG_SESSION_TYPE?.toLowerCase() === 'wayland' || Boolean(env.WAYLAND_DISPLAY));
}

export function linuxAutostartPath(home: string, configHome?: string): string {
  if (!path.posix.isAbsolute(home) || unsafePathCharacters.test(home)) throw new Error('사용자 홈 경로가 올바르지 않습니다.');
  const config = configHome && path.posix.isAbsolute(configHome) && !unsafePathCharacters.test(configHome)
    ? configHome : path.posix.join(home, '.config');
  return path.posix.join(config, 'autostart', DESKTOP_FILE_NAME);
}

/** AppImage executables inside the transient FUSE mount must not enter autostart. */
export function linuxStartupExecutable(execPath: string, env: LinuxEnvironment): string | null {
  const executable = env.APPIMAGE || execPath;
  if (!path.posix.isAbsolute(executable) || unsafePathCharacters.test(executable) || executable.includes('=')) return null;
  const normalized = path.posix.normalize(executable);
  if (normalized.split('/').some(component => component.startsWith('.mount_'))) return null;
  const appDirectory = env.APPDIR ? path.posix.normalize(env.APPDIR).replace(/\/$/, '') : null;
  if (!env.APPIMAGE && appDirectory && (normalized === appDirectory || normalized.startsWith(appDirectory + '/'))) return null;
  return normalized;
}

/** Desktop Entry Exec quoting includes both string escaping and argument quoting. */
export function quoteDesktopExec(executable: string): string {
  if (!path.posix.isAbsolute(executable) || unsafePathCharacters.test(executable) || executable.includes('=')) throw new Error('자동 시작 실행 경로가 올바르지 않습니다.');
  const argument = executable.replace(/%/g, '%%').replace(/["`$\\]/g, character => '\\' + character);
  return '"' + argument.replace(/\\/g, '\\\\') + '"';
}

export function linuxAutostartEntry(executable: string): string {
  return [
    '[Desktop Entry]', 'Type=Application', 'Version=1.0', 'Name=ClipBox',
    'Comment=Local clipboard history manager',
    `Exec=${quoteDesktopExec(executable)} --hidden`,
    'Icon=app.clipbox.desktop', 'Terminal=false', 'StartupNotify=false',
    'X-GNOME-Autostart-enabled=true', AUTOSTART_OWNER_MARKER, '',
  ].join('\n');
}

export function autoStartAvailable(platform: DesktopPlatform, packaged: boolean, execPath: string, env: LinuxEnvironment): boolean {
  if (!packaged) return false;
  return platform !== 'linux' || linuxStartupExecutable(execPath, env) !== null;
}

export function platformNotice(platform: DesktopPlatform, env: LinuxEnvironment): string | null {
  if (isWayland(platform, env)) {
    return 'Wayland 단축키는 app.clipbox.desktop.desktop 실행 항목 설치가 필요하며, 데스크톱 포털 승인을 요청할 수 있습니다. 등록 표시만으로 실제 키 연결이 보장되지는 않습니다. 백그라운드 클립보드 수집과 팝업 위치·포커스도 데스크톱 환경에 따라 제한됩니다. 창을 닫으면 작업 표시줄로 최소화합니다.';
  }
  if (platform === 'linux') return 'Linux의 트레이 표시는 데스크톱 환경에 따라 달라집니다. 백그라운드 실행을 켠 상태에서 창을 닫으면 작업 표시줄로 최소화하여 다시 열 수 있게 유지합니다.';
  return null;
}
