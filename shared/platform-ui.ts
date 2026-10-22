import type { AppStatus } from './contracts';

export type DesktopPlatform = AppStatus['platform'];
type KeyInput = Pick<KeyboardEvent, 'key' | 'code' | 'ctrlKey' | 'altKey' | 'metaKey' | 'shiftKey'>;
export type RecordedShortcut = { kind: 'cancel' | 'modifier' } | { kind: 'error'; message: string } | { kind: 'shortcut'; accelerator: string };

/** Display Electron accelerators without confusing physical Control and Command. */
export function shortcutLabel(accelerator: string, platform: DesktopPlatform): string {
  const mac = platform === 'darwin';
  const labels: Record<string, string> = {
    CommandOrControl: mac ? '⌘' : 'Ctrl', CmdOrCtrl: mac ? '⌘' : 'Ctrl',
    Command: '⌘', Cmd: '⌘', Control: 'Ctrl', Ctrl: 'Ctrl',
    Alt: mac ? 'Option' : 'Alt', Option: mac ? 'Option' : 'Alt',
    Shift: 'Shift', Super: mac ? '⌘' : 'Super', Meta: mac ? '⌘' : 'Super',
    Up: '↑', Down: '↓', Left: '←', Right: '→',
  };
  return accelerator.split('+').map(part => labels[part] ?? part).join(' + ');
}

export function primaryModifier(event: Pick<KeyInput, 'ctrlKey' | 'metaKey'>, platform: DesktopPlatform): boolean {
  return platform === 'darwin' ? event.metaKey : event.ctrlKey;
}

export function recordShortcut(event: KeyInput, platform: DesktopPlatform): RecordedShortcut {
  if (event.key === 'Escape') return { kind: 'cancel' };
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(event.key)) return { kind: 'modifier' };
  if (!(event.ctrlKey || event.altKey || event.metaKey)) return {
    kind: 'error', message: platform === 'darwin' ? '⌘, Ctrl 또는 Option을 포함한 조합을 눌러 주세요.' : 'Ctrl 또는 Alt를 포함한 조합을 눌러 주세요.',
  };
  const key = event.code.startsWith('Key') ? event.code.slice(3) : event.code.startsWith('Digit') ? event.code.slice(5) : event.key === ' ' ? 'Space' : event.key;
  if (!/^(?:[A-Z0-9]|F(?:[1-9]|1[0-9]|2[0-4])|Space|Home|End|PageUp|PageDown|Insert|Delete|ArrowUp|ArrowDown|ArrowLeft|ArrowRight)$/i.test(key)) return { kind: 'error', message: '영문, 숫자, 기능 키 또는 방향 키를 사용해 주세요.' };
  const modifiers = platform === 'darwin'
    ? [...(event.metaKey ? ['CommandOrControl'] : []), ...(event.ctrlKey ? ['Control'] : [])]
    : event.ctrlKey || event.metaKey ? ['CommandOrControl'] : [];
  return { kind: 'shortcut', accelerator: [...modifiers, ...(event.altKey ? ['Alt'] : []), ...(event.shiftKey ? ['Shift'] : []), key.replace('Arrow', '')].join('+') };
}

export function platformLabels(platform: DesktopPlatform) {
  return {
    startup: platform === 'win32' ? 'Windows 시작 시 자동 실행' : '로그인 시 자동 실행',
    startupConsent: platform === 'win32' ? 'Windows 시작 시 ClipBox 실행' : '로그인 시 ClipBox 실행',
    startupDescription: platform === 'win32' ? '컴퓨터를 켜면 ClipBox가 함께 실행됩니다.' : '이 계정에 로그인하면 ClipBox가 함께 실행됩니다.',
    background: platform === 'darwin' ? '창을 닫아도 메뉴 막대에 유지' : platform === 'linux' ? '창을 닫아도 백그라운드에서 유지' : '앱을 닫아도 트레이에 유지',
    backgroundDescription: platform === 'linux' ? '창을 닫으면 작업 표시줄로 최소화해 계속 접근할 수 있게 합니다.' : '창을 닫은 뒤에도 백그라운드에서 실행합니다.',
    shortcutFallback: platform === 'darwin' ? '메뉴 막대에서도 빠른 기록을 열 수 있어요.' : platform === 'linux' ? '기록 관리 창의 ‘빠른 기록 열기’ 버튼을 사용할 수 있어요.' : '트레이에서도 빠른 기록을 열 수 있어요.',
    deleteKey: platform === 'darwin' ? '⌫' : 'Del',
  };
}

export const autoStartUnavailable = '현재 실행 환경에서는 자동 실행을 지원하지 않습니다. 설치한 앱에서 설정해 주세요.';
