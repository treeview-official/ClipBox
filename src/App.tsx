import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertCircle, ArrowDownUp, ArrowLeft, ArrowUpRight, Check, ChevronDown, Clipboard, ClipboardList, Clock3, Database, FileClock, FileText, HardDrive, Image, Info, Keyboard, LayoutGrid, Link2, LoaderCircle, LockKeyhole, Maximize2, Minus, Monitor, Moon, Pause, Play, Search, Settings2, ShieldCheck, Star, Sun, Trash2, Type, X } from 'lucide-react';
import type { AppStatus, ClipDetail, ClipItem, ClipboardKind, ListQuery, ManagerPage, Settings, Stats } from '../shared/contracts';
import { autoStartUnavailable, platformLabels, primaryModifier, recordShortcut, shortcutLabel, type DesktopPlatform } from '../shared/platform-ui';

import { ReleaseNotesPage, SupportContact, UpdatePanel } from './Updates';

type Filter = 'all' | ClipboardKind | 'favorite';
type Notice = { message: string; error: boolean };
type Confirmation = { kind: 'item'; item: ClipItem } | { kind: 'clear'; step: 1 | 2 } | null;
const labels: Record<Filter, string> = { all: '전체 기록', text: '텍스트', image: '이미지', link: '링크', favorite: '즐겨찾기' };
const emptyStats: Stats = { total: 0, text: 0, image: 0, link: 0, favorite: 0, byteSize: 0 };
const PAGE_SIZE = 100;
const api = window.clipbox;

function errorMessage(error: unknown) { return error instanceof Error ? error.message : '작업을 완료하지 못했어요. 잠시 후 다시 시도해 주세요.'; }
function bytes(size: number) {
  if (size < 1024) return `${size.toLocaleString()} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}
function dateLabel(timestamp: number, full = false) {
  const date = new Date(timestamp);
  if (full) return date.toLocaleString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  const time = date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
  if (date.toDateString() === new Date().toDateString()) return `오늘 ${time}`;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${time}`;
}
function KindIcon({ kind, size = 21 }: { kind: Filter; size?: number }) {
  if (kind === 'all') return <LayoutGrid size={size} />;
  if (kind === 'image') return <Image size={size} />;
  if (kind === 'link') return <Link2 size={size} />;
  if (kind === 'favorite') return <Star size={size} />;
  return <Type size={size} />;
}
function Logo({ large = false }: { large?: boolean }) { return <div className={`logo${large ? ' large' : ''}`}><ClipboardList size={large ? 35 : 27} strokeWidth={2.3} /></div>; }
function ImageView({ src, thumbnail = false }: { src?: string; thumbnail?: boolean }) {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [src]);
  if (!src || broken) return <span className={`image-placeholder${thumbnail ? ' thumbnail' : ''}`}><Image size={thumbnail ? 25 : 40} />{!thumbnail && <span>이미지를 표시할 수 없어요</span>}</span>;
  return <img className={thumbnail ? 'thumbnail' : 'preview-image'} src={src} alt={thumbnail ? '클립보드 이미지 미리보기' : '저장된 클립보드 이미지'} onError={() => setBroken(true)} />;
}

function Dialog({ title, children, onClose, className = '' }: { title: string; children: ReactNode; onClose?: () => void; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose); closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const getFocusable = () => [...(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]') ?? [])];
    const timer = window.setTimeout(() => (ref.current?.querySelector<HTMLElement>('[data-autofocus]') ?? getFocusable()[0] ?? ref.current)?.focus(), 20);
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && closeRef.current) { event.preventDefault(); event.stopPropagation(); closeRef.current(); }
      if (event.key === 'Tab') {
        const elements = getFocusable();
        const first = elements[0]; const last = elements[elements.length - 1];
        if (!first) { event.preventDefault(); return; }
        if (event.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handleKey, true);
    return () => { clearTimeout(timer); document.removeEventListener('keydown', handleKey, true); previous?.focus(); };
  }, []);
  return <div className="dialog-backdrop"><div ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} className={`dialog ${className}`}>
    {onClose && <button className="icon-button dialog-close" aria-label="닫기" onClick={onClose}><X size={20} /></button>}
    {children}
  </div></div>;
}

function Titlebar({ quick, status, onAction, onManager }: { quick: boolean; status: AppStatus | null; onAction: (action: 'minimize' | 'maximize' | 'close') => void; onManager: () => void }) {
  const collecting = status?.settings.collectionEnabled && !status.settings.paused;
  return <header className="titlebar">
    <div className="brand"><Logo /><div><h1>ClipBox</h1><p>{quick ? '복사한 모든 것을, 언제든 다시.' : '클립보드 기록 관리'}</p></div></div>
    <div className="titlebar-right">
      {!quick && status && <div className={`status-chip${collecting ? ' active' : ''}`}><span />{collecting ? '기록 중' : status.settings.paused ? '일시정지' : '기록 꺼짐'}</div>}
      {quick && <button className="icon-button manager-link" title="기록 관리 열기" aria-label="기록 관리 열기" onClick={onManager}><ArrowUpRight size={19} /></button>}
      <div className="window-controls"><button aria-label="최소화" onClick={() => onAction('minimize')}><Minus size={17} /></button>{!quick && <button aria-label="최대화 또는 복원" onClick={() => onAction('maximize')}><Maximize2 size={14} /></button>}<button className="window-close" aria-label="창 닫기" onClick={() => onAction('close')}><X size={19} /></button></div>
    </div>
  </header>;
}

function Onboarding({ status, onFinish }: { status: AppStatus; onFinish: (enabled: boolean, autoStart: boolean) => Promise<void> }) {
  const [autoStart, setAutoStart] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function finish(enabled: boolean) { setBusy(true); setError(''); try { await onFinish(enabled, autoStart); } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); } }
  return <Dialog title="ClipBox 시작하기" className="onboarding">
    <div className="onboarding-art"><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="art-chip chip-text"><Type size={23} /></div><div className="art-chip chip-image"><Image size={22} /></div><div className="art-chip chip-link"><Link2 size={22} /></div><Logo large /><span className="local-badge"><LockKeyhole size={12} /> ONLY ON YOUR PC</span></div>
    <div className="eyebrow">반가워요, ClipBox입니다</div><h2>복사한 순간을<br />다시 꺼내 쓰세요.</h2><p className="onboard-intro">텍스트, 링크, 이미지를 한곳에.<br />필요한 기록을 단축키로 빠르게 찾아보세요.</p>
    <div className="privacy-callout"><ShieldCheck size={22} /><div><strong>기록은 이 PC에만 저장돼요</strong><p>서버 전송 없이 로컬에 평문으로 저장합니다. 비밀번호나 인증 토큰도 기록될 수 있으며, 민감한 내용을 자동으로 걸러내지 않습니다. 필요할 때 기록을 일시정지해 주세요.</p></div></div>
    <label className="checkbox-row"><input type="checkbox" checked={autoStart} onChange={e => setAutoStart(e.target.checked)} disabled={busy || !status.autoStartSupported} aria-describedby={!status.autoStartSupported ? 'onboarding-startup-help' : undefined} /><span>{platformLabels(status.platform).startupConsent}</span></label>
    {!status.autoStartSupported && <p id="onboarding-startup-help" className="startup-help">{autoStartUnavailable}</p>}
    {error && <div className="inline-error" role="alert"><AlertCircle size={16} />{error}</div>}
    <button className="button primary full" data-autofocus disabled={busy} onClick={() => void finish(true)}>{busy ? <LoaderCircle className="spin" size={18} /> : <Check size={18} />}동의하고 기록 시작</button>
    <button className="button text-button full" disabled={busy} onClick={() => void finish(false)}>지금은 기록하지 않고 둘러보기</button>
    <p className="fine-print">환경설정에서 언제든 기록을 켜거나 끌 수 있어요.</p>
  </Dialog>;
}

function SettingsPage({ status, stats, onSave, onClear, onBack }: { status: AppStatus; stats: Stats; onSave: (settings: Partial<Settings>) => Promise<AppStatus>; onClear: () => void; onBack: () => void }) {
  const platformText = platformLabels(status.platform);
  const [draft, setDraft] = useState<Settings>(status.settings);
  const [recording, setRecording] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const baseline = useRef(status.settings);
  const dirty = JSON.stringify(draft) !== JSON.stringify(status.settings);
  function change<K extends keyof Settings>(key: K, value: Settings[K]) { setDraft(previous => ({ ...previous, [key]: value })); setSaved(false); setError(''); }
  useEffect(() => {
    const previousSettings = baseline.current;
    baseline.current = status.settings;
    setDraft(previous => {
      const next = { ...previous };
      for (const key of Object.keys(status.settings) as (keyof Settings)[]) {
        if (previous[key] === previousSettings[key]) Object.assign(next, { [key]: status.settings[key] });
      }
      return next;
    });
  }, [status.settings]);
  useEffect(() => {
    if (!recording) return;
    const listener = (event: KeyboardEvent) => {
      event.preventDefault(); event.stopPropagation();
      const result = recordShortcut(event, status.platform);
      if (result.kind === 'cancel') { setRecording(false); return; }
      if (result.kind === 'modifier') return;
      if (result.kind === 'error') { setError(result.message); return; }
      if (result.kind !== 'shortcut') return;
      change('hotkey', result.accelerator);
      setRecording(false);
    };
    document.addEventListener('keydown', listener, true);
    return () => document.removeEventListener('keydown', listener, true);
  }, [recording, status.platform]);
  async function save() {
    setSaving(true); setError(''); setRecording(false);
    const patch: Partial<Settings> = {};
    for (const key of Object.keys(draft) as (keyof Settings)[]) {
      if (draft[key] !== status.settings[key]) Object.assign(patch, { [key]: draft[key] });
    }
    try { const updated = await onSave(patch); setDraft(updated.settings); setSaved(true); }
    catch (err) { setError(errorMessage(err)); } finally { setSaving(false); }
  }
  function toggle(key: 'autoStart' | 'collectionEnabled' | 'trayEnabled' | 'paused') {
    return <button type="button" className={`switch${draft[key] ? ' on' : ''}`} role="switch" aria-checked={draft[key]} aria-label={{ autoStart: platformText.startup, collectionEnabled: '클립보드 기록 자동 저장', trayEnabled: platformText.background, paused: '기록 일시정지' }[key]} disabled={saving || key === 'autoStart' && !status.autoStartSupported} onClick={() => change(key, !draft[key])}><span /></button>;
  }
  function row(icon: ReactNode, title: string, description: string, control: ReactNode) { return <div className="settings-row"><div className="settings-icon">{icon}</div><div className="settings-row-label"><strong>{title}</strong><p>{description}</p></div><div className="settings-control">{control}</div></div>; }
  function group(title: string, description: string, children: ReactNode) { return <section className="settings-group"><div className="settings-group-heading"><h3>{title}</h3><p>{description}</p></div><div className="settings-group-body">{children}</div></section>; }
  return <section className="settings-page">
    <div className="page-heading"><div><div className="eyebrow">MAKE IT YOURS</div><h2>환경설정</h2><p>ClipBox의 동작과 표시 방식을 설정하세요.</p></div><button className="button subtle back-button" onClick={onBack}><ArrowLeft size={16} />기록으로</button></div>
    <div className="settings-scroll">
      {status.platformNotice && <div className="platform-notice" role="note"><Info size={16} /><span>{status.platformNotice}</span></div>}
      {group('일반', '매일 쓰는 앱을 나에게 맞게.', <>
        {row(<Monitor />, platformText.startup, status.autoStartSupported ? platformText.startupDescription : autoStartUnavailable, toggle('autoStart'))}
        {row(<Database />, '클립보드 기록 자동 저장', '복사한 텍스트, 링크, 이미지를 로컬에 저장합니다.', toggle('collectionEnabled'))}
        {row(<HardDrive />, platformText.background, platformText.backgroundDescription, toggle('trayEnabled'))}
        {row(<Pause />, '기록 일시정지', '다시 켤 때까지 새로운 내용을 기록하지 않습니다.', toggle('paused'))}
      </>)}
      {group('단축키', '필요한 순간, 빠르게 열기.', <>{row(<Keyboard />, '빠른 열기 단축키', recording ? '새 키 조합을 누르세요. Esc로 취소합니다.' : '버튼을 누른 다음 원하는 키 조합을 입력하세요.', <button className={`shortcut-recorder${recording ? ' recording' : ''}`} aria-label="빠른 열기 단축키 변경" disabled={saving} onClick={() => { setRecording(v => !v); setError(''); }}>{recording ? '키 조합 입력 중…' : shortcutLabel(draft.hotkey, status.platform)}<Keyboard size={16} /></button>)}
        {status.shortcutError && <div className="setting-alert"><AlertCircle size={16} /><span>{status.shortcutError} 다른 조합으로 변경해 주세요. {platformText.shortcutFallback}</span></div>}</>)}
      {group('저장', '필요한 기록만 오래도록.', <>
        {row(<Database />, '최대 저장 개수', '즐겨찾기를 제외한 일반 기록의 최대 개수입니다.', <div className="select-wrap"><select aria-label="최대 저장 개수" value={draft.maxItems} disabled={saving} onChange={e => change('maxItems', Number(e.target.value) as Settings['maxItems'])}>{[100, 500, 1000, 5000].map(n => <option key={n} value={n}>{n.toLocaleString()}개</option>)}</select><ChevronDown size={16} /></div>)}
        {row(<Clock3 />, '보관 기간', '기한이 지난 기록은 정리하며, 즐겨찾기는 유지합니다.', <div className="select-wrap"><select aria-label="보관 기간" value={draft.retentionDays} disabled={saving} onChange={e => change('retentionDays', Number(e.target.value) as Settings['retentionDays'])}><option value={7}>7일 후 자동 삭제</option><option value={30}>30일 후 자동 삭제</option><option value={90}>90일 후 자동 삭제</option><option value={0}>기간 제한 없음</option></select><ChevronDown size={16} /></div>)}
        {draft.retentionDays === 0 && <p className="settings-note"><Info size={14} />기간 제한이 없으면 디스크 사용량이 늘어날 수 있어요. 최대 저장 개수는 계속 적용됩니다.</p>}
      </>)}
      {group('테마', '편안한 화면으로.', row(draft.theme === 'dark' ? <Moon /> : <Sun />, '화면 테마', '시스템 설정을 따르거나 직접 선택하세요.', <div className="select-wrap"><select aria-label="화면 테마" value={draft.theme} disabled={saving} onChange={e => change('theme', e.target.value as Settings['theme'])}><option value="system">시스템 설정에 따름</option><option value="light">라이트</option><option value="dark">다크</option></select><ChevronDown size={16} /></div>))}
      {group('개인정보', '이 PC 안에서만 안전하게.', <><div className="privacy-setting"><ShieldCheck size={22} /><div><strong>외부 전송 없이, 로컬 저장</strong><p>기록은 이 PC에 평문으로 저장됩니다. 비밀번호, 카드번호, 인증 토큰을 자동으로 제외하지 않으므로 민감한 내용을 복사하기 전에는 기록을 일시정지해 주세요.</p></div></div><div className="danger-setting"><div><strong>전체 기록 삭제</strong><p>즐겨찾기를 포함한 모든 기록과 이미지가 삭제됩니다.</p></div><button className="button danger-outline" onClick={onClear} disabled={saving || stats.total === 0}><Trash2 size={16} />전체 삭제</button></div></>)}
      <UpdatePanel version={status.version} installDisabled={dirty} />
      <SupportContact />
      {group('정보', `ClipBox v${status.version}`, <div className="app-information"><div><span>저장된 기록</span><strong>{stats.total.toLocaleString()}개 · {bytes(stats.byteSize)}</strong></div><div><span>기록 상태</span><strong>{status.settings.collectionEnabled ? status.settings.paused ? '일시정지됨' : '기록 중' : '기록 꺼짐'}</strong></div><div className="storage-path"><span>데이터 저장 위치</span><code>{status.storagePath}</code></div></div>)}
    </div>
    <footer className="settings-footer"><div aria-live="polite">{error ? <span className="save-error"><AlertCircle size={16} />{error}</span> : dirty ? <span className="unsaved-dot">저장하지 않은 변경 사항이 있어요</span> : saved ? <span className="save-success"><Check size={16} />설정을 저장했어요</span> : <span className="settings-hint"><LockKeyhole size={14} />모든 설정은 이 PC에 저장됩니다</span>}</div><div className="settings-actions"><button className="button" disabled={saving || !dirty} onClick={() => { setDraft(status.settings); setError(''); setSaved(false); setRecording(false); }}>취소</button><button className="button primary" disabled={saving || !dirty || recording} onClick={() => void save()}>{saving ? <LoaderCircle size={16} className="spin" /> : <Check size={16} />}{saving ? '저장 중' : '저장'}</button></div></footer>
  </section>;
}

function ClipRow({ item, selected, quick, onSelect, onCopy, onFavorite, onDelete, busy }: { item: ClipItem; selected: boolean; quick: boolean; onSelect: () => void; onCopy: () => void; onFavorite: () => void; onDelete: () => void; busy: boolean }) {
  return <div className={`clip-row${selected ? ' selected' : ''}`} data-clip-id={item.id}>
    <button className="clip-select" aria-label={`${labels[item.kind]}: ${item.kind === 'image' ? '캡처 이미지' : item.previewText}`} aria-pressed={selected} onClick={onSelect} onDoubleClick={onCopy}>
      {item.kind === 'image' && item.thumbnailDataUrl ? <ImageView src={item.thumbnailDataUrl} thumbnail /> : <span className={`kind-icon ${item.kind}`}><KindIcon kind={item.kind} size={23} /></span>}
      <span className="clip-summary"><strong>{item.kind === 'image' ? '캡처 이미지' : item.previewText || '(빈 텍스트)'}</strong><span className="clip-meta"><span className="kind-label">{labels[item.kind]}</span>{item.kind === 'image' && <span>{item.width} × {item.height}</span>}<time dateTime={new Date(item.createdAt).toISOString()}>{dateLabel(item.createdAt)}</time></span></span>
    </button>
    <div className="clip-actions"><button className={`icon-button favorite-button${item.isFavorite ? ' is-favorite' : ''}`} aria-label={item.isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'} aria-pressed={item.isFavorite} disabled={busy} title={item.isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'} onClick={onFavorite}><Star size={19} fill={item.isFavorite ? 'currentColor' : 'none'} /></button>{!quick && <button className="icon-button row-delete" aria-label="기록 삭제" title="기록 삭제" disabled={busy} onClick={onDelete}><Trash2 size={16} /></button>}</div>
  </div>;
}

function DetailPanel({ item, loading, error, busy, platform, onClose, onCopy, onFavorite, onDelete }: { item: ClipDetail | null; loading: boolean; error: string; busy: boolean; platform: DesktopPlatform; onClose: () => void; onCopy: () => void; onFavorite: () => void; onDelete: () => void }) {
  return <aside className={`detail-panel${item || loading || error ? ' has-selection' : ''}`} aria-label="선택한 기록 상세 미리보기">
    <div className="detail-heading"><h2>상세 미리보기</h2>{(item || loading || error) && <button className="icon-button" aria-label="상세 미리보기 닫기" onClick={onClose}><X size={19} /></button>}</div>
    {loading ? <div className="detail-empty"><LoaderCircle className="spin" size={28} /><p>기록을 불러오는 중…</p></div> : error ? <div className="detail-empty"><AlertCircle size={30} /><p>{error}</p></div> : !item ? <div className="detail-empty"><div className="empty-preview-art"><FileText size={34} /><Search size={22} /></div><h3>조금 더 자세히</h3><p>기록을 선택하면<br />내용과 정보를 확인할 수 있어요.</p></div> : <>
      <div className="detail-scroll"><section className="preview-card"><div className="preview-card-heading"><span className={`kind-icon ${item.kind}`}><KindIcon kind={item.kind} size={23} /></span><div><strong>{labels[item.kind]}</strong><p>{dateLabel(item.createdAt)}</p></div><button className={`icon-button favorite-button${item.isFavorite ? ' is-favorite' : ''}`} aria-label={item.isFavorite ? '즐겨찾기 해제' : '즐겨찾기 추가'} aria-pressed={item.isFavorite} disabled={busy} onClick={onFavorite}><Star size={22} fill={item.isFavorite ? 'currentColor' : 'none'} /></button></div><div className={`content-preview ${item.kind}`}>{item.kind === 'image' ? <ImageView src={item.imageDataUrl} /> : <pre>{item.contentText ?? item.previewText}</pre>}</div></section>
      <section className="metadata-card"><h3>추가 정보</h3><dl><div><dt><FileText size={16} />유형</dt><dd>{labels[item.kind]}</dd></div><div><dt><Clock3 size={16} />저장 시간</dt><dd>{dateLabel(item.createdAt, true)}</dd></div>{item.kind !== 'image' && <div><dt><Type size={16} />글자 수</dt><dd>{Array.from(item.contentText ?? '').length.toLocaleString()}자</dd></div>}{item.kind === 'image' && <div><dt><Image size={16} />해상도</dt><dd>{item.width} × {item.height}</dd></div>}<div><dt><HardDrive size={16} />파일 크기</dt><dd>{bytes(item.byteSize)}</dd></div></dl></section></div>
      <div className="detail-actions"><button className="button primary copy-button" onClick={onCopy} disabled={busy}><Clipboard size={19} />클립보드에 복사<kbd>{shortcutLabel('CommandOrControl+C', platform)}</kbd></button><div><button className={`button${item.isFavorite ? ' favorited' : ''}`} onClick={onFavorite} disabled={busy}><Star size={18} fill={item.isFavorite ? 'currentColor' : 'none'} />{item.isFavorite ? '즐겨찾기 해제' : '즐겨찾기'}</button><button className="button danger-text" onClick={onDelete} disabled={busy}><Trash2 size={18} />삭제</button></div><p>복사한 뒤 원하는 곳에서 <kbd>{shortcutLabel('CommandOrControl+V', platform)}</kbd>를 누르세요.</p></div>
    </>}
  </aside>;
}

function ConnectedApp() {
  const quick = new URLSearchParams(window.location.search).get('view') === 'quick' || window.location.hash === '#quick';
  const [page, setPage] = useState<ManagerPage>('history');
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest');
  const [items, setItems] = useState<ClipItem[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [status, setStatus] = useState<AppStatus | null>(null);
  const platform = status?.platform ?? 'win32';
  const copyShortcut = shortcutLabel('CommandOrControl+C', platform);
  const pasteShortcut = shortcutLabel('CommandOrControl+V', platform);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [statusError, setStatusError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ClipDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const [clearText, setClearText] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const loadedCount = useRef(PAGE_SIZE);
  const requestId = useRef(0);
  const showNotice = useCallback((message: string, error = false) => setNotice({ message, error }), []);
  const buildQuery = useCallback((): ListQuery => ({ ...(filter === 'favorite' ? { favorite: true } : filter !== 'all' ? { kind: filter } : {}), query, sort, limit: PAGE_SIZE }), [filter, query, sort]);
  const refresh = useCallback(async (showLoading = false) => {
    const id = ++requestId.current;
    if (showLoading) setLoading(true);
    try {
      const pages = Math.max(1, Math.ceil(loadedCount.current / PAGE_SIZE));
      const results = await Promise.all(Array.from({ length: pages }, (_, index) => api!.list({ ...buildQuery(), offset: index * PAGE_SIZE })));
      if (id !== requestId.current) return;
      const nextItems = results.flatMap(result => result.items);
      setItems(nextItems); setTotal(results[0]!.total); setStats(results[0]!.stats); setLoadError('');
      setSelectedId(previous => previous && nextItems.some(item => item.id === previous) ? previous : quick ? nextItems[0]?.id ?? null : null);
      setRevision(value => value + 1);
    } catch (err) { if (id === requestId.current) setLoadError(errorMessage(err)); }
    finally { if (id === requestId.current) setLoading(false); }
  }, [buildQuery, quick]);
  const refreshStatus = useCallback(async () => { try { setStatus(await api!.readStatus()); setStatusError(''); } catch (err) { setStatusError(errorMessage(err)); } }, []);
  useEffect(() => { const timer = setTimeout(() => setQuery(search), 150); return () => clearTimeout(timer); }, [search]);
  useEffect(() => { loadedCount.current = PAGE_SIZE; setSelectedId(null); void refresh(true); }, [refresh]);
  useEffect(() => { void refreshStatus(); }, [refreshStatus]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = api!.onChanged(() => { clearTimeout(timer); timer = setTimeout(() => { void refresh(); void refreshStatus(); }, 90); });
    return () => { off(); clearTimeout(timer); };
  }, [refresh, refreshStatus]);
  useEffect(() => {
    const offShown = api!.onShown(() => { if (quick) searchRef.current?.focus(); void refresh(); void refreshStatus(); });
    const offNavigate = api!.onNavigate(next => setPage(next));
    return () => { offShown(); offNavigate(); };
  }, [quick, refresh, refreshStatus]);
  useEffect(() => { if (quick && status?.settings.onboarded) searchRef.current?.focus(); }, [quick, status?.settings.onboarded]);
  useEffect(() => { if (!notice) return; const timer = setTimeout(() => setNotice(null), notice.error ? 7000 : 4200); return () => clearTimeout(timer); }, [notice]);
  useEffect(() => { document.documentElement.dataset.theme = status?.effectiveTheme ?? 'light'; }, [status?.effectiveTheme]);
  useEffect(() => {
    let active = true;
    setDetailError('');
    if (!selectedId || quick) { setDetail(null); setDetailLoading(false); return; }
    setDetailLoading(true);
    api!.get(selectedId).then(value => { if (active) setDetail(value); }).catch(err => { if (active) { setDetail(null); setDetailError(errorMessage(err)); } }).finally(() => { if (active) setDetailLoading(false); });
    return () => { active = false; };
  }, [selectedId, quick, revision]);
  useEffect(() => {
    if (!selectedId) return;
    const selected = [...(listRef.current?.querySelectorAll<HTMLElement>('[data-clip-id]') ?? [])].find(element => element.dataset.clipId === selectedId);
    selected?.scrollIntoView({ block: 'nearest' });
  }, [selectedId]);
  async function action(callback: () => Promise<void>, message?: string) {
    if (busy) return;
    setBusy(true);
    try { await callback(); if (message) showNotice(message); }
    catch (err) { showNotice(errorMessage(err), true); }
    finally { setBusy(false); }
  }
  function windowAction(command: 'minimize' | 'maximize' | 'close' | 'hide' | 'quick') { void api!.windowAction(command).catch(err => showNotice(errorMessage(err), true)); }
  function openManager(next: ManagerPage = 'history') { void api!.openManager(next).catch(err => showNotice(errorMessage(err), true)); }
  function recopy(id: string) { void action(async () => { await api!.recopy(id); if (quick) await api!.windowAction('hide'); }, quick ? undefined : '클립보드에 복사했어요. ' + pasteShortcut + '로 붙여넣으세요.'); }
  function favorite(id: string) { void action(async () => { await api!.toggleFavorite(id); await refresh(); }); }
  function askDelete(item: ClipItem) { setConfirmError(''); setConfirmation({ kind: 'item', item }); }
  function closeConfirmation() { if (!busy) { setConfirmation(null); setClearText(''); setConfirmError(''); } }
  async function confirmDelete() {
    if (!confirmation || busy) return;
    setBusy(true); setConfirmError('');
    try {
      if (confirmation.kind === 'item') await api!.remove(confirmation.item.id);
      else { if (clearText !== '전체 삭제') return; await api!.clearAll('DELETE_ALL'); }
      setConfirmation(null); setClearText(''); await refresh(); showNotice('기록을 삭제했어요.');
    } catch (err) { setConfirmError(errorMessage(err)); } finally { setBusy(false); }
  }
  async function loadMore() {
    if (loadingMore || items.length >= total) return;
    const id = requestId.current;
    setLoadingMore(true);
    try { const result = await api!.list({ ...buildQuery(), offset: items.length }); if (id !== requestId.current) return; setItems(previous => [...previous, ...result.items.filter(item => !previous.some(existing => existing.id === item.id))]); loadedCount.current = items.length + result.items.length; setTotal(result.total); setStats(result.stats); }
    catch (err) { showNotice(errorMessage(err), true); } finally { setLoadingMore(false); }
  }
  async function saveSettings(settings: Partial<Settings>) { const updated = await api!.updateSettings(settings); setStatus(updated); await refresh(); return updated; }
  useEffect(() => {
    const nativeCopy = (event: ClipboardEvent) => {
      if (platform !== 'darwin' || confirmation || !status?.settings.onboarded || page !== 'history' || !selectedId) return;
      const target = document.activeElement;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target instanceof HTMLElement && target.isContentEditable || window.getSelection()?.toString()) return;
      event.preventDefault();
      recopy(selectedId);
    };
    const listener = (event: KeyboardEvent) => {
      if (confirmation || !status?.settings.onboarded || page !== 'history' || event.isComposing) return;
      const target = event.target as HTMLElement;
      const editing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target.isContentEditable;
      if (event.key === 'Escape') { if (quick) windowAction('hide'); else if (selectedId) setSelectedId(null); else if (search) setSearch(''); return; }
      if (primaryModifier(event, platform) && event.key.toLowerCase() === 'f') { event.preventDefault(); searchRef.current?.focus(); searchRef.current?.select(); return; }
      if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && (!editing || target === searchRef.current) && !event.ctrlKey && !event.altKey && !event.metaKey) {
        event.preventDefault(); const index = items.findIndex(item => item.id === selectedId); const next = event.key === 'ArrowDown' ? Math.min(index + 1, items.length - 1) : Math.max(index - 1, 0); setSelectedId(items[next]?.id ?? null); return;
      }
      if (event.key === 'Enter' && quick && selectedId && (!editing || target === searchRef.current) && (target === searchRef.current || target === document.body || target.classList.contains('clip-select'))) { event.preventDefault(); recopy(selectedId); return; }
      if (editing || window.getSelection()?.toString()) return;
      if (primaryModifier(event, platform) && event.key.toLowerCase() === 'c' && selectedId) { event.preventDefault(); recopy(selectedId); }
      if ((event.key === 'Delete' || platform === 'darwin' && event.key === 'Backspace') && selectedId) { const selected = items.find(item => item.id === selectedId); if (selected) { event.preventDefault(); askDelete(selected); } }
    };
    document.addEventListener('keydown', listener);
    document.addEventListener('copy', nativeCopy);
    return () => { document.removeEventListener('keydown', listener); document.removeEventListener('copy', nativeCopy); };
  });
  function navigateFilter(next: Filter) { setFilter(next); setPage('history'); }
  const collecting = status?.settings.collectionEnabled && !status.settings.paused;
  const filtered = filter !== 'all' || query.length > 0;
  const countFor = (kind: Filter) => kind === 'all' ? stats.total : stats[kind];
  return <div className={`app-shell${quick ? ' quick-shell' : ''}`}>
    <Titlebar quick={quick} status={status} onAction={windowAction} onManager={() => openManager()} />
    <div className="app-body">
      {!quick && <aside className="sidebar"><nav aria-label="기록 분류">{(['all', 'text', 'image', 'link', 'favorite'] as Filter[]).map(kind => <button key={kind} className={`nav-item${filter === kind && page === 'history' ? ' active' : ''}`} onClick={() => navigateFilter(kind)}><KindIcon kind={kind} size={20} /><span>{labels[kind]}</span><span className="count-badge">{countFor(kind).toLocaleString()}</span></button>)}<div className="nav-divider" /><button className={`nav-item${page === 'settings' ? ' active' : ''}`} onClick={() => setPage('settings')}><Settings2 size={20} /><span>환경설정</span></button><button className={`nav-item${page === 'release-notes' ? ' active' : ''}`} onClick={() => setPage('release-notes')}><FileClock size={20} /><span>패치노트</span></button></nav><div className="sidebar-bottom"><button className="quick-open-button" onClick={() => windowAction('quick')}><Keyboard size={17} /><span>빠른 기록 열기</span><ArrowUpRight size={15} /></button><div className="storage-summary"><Database size={21} /><div><span>저장된 기록</span><strong>{stats.total.toLocaleString()}개 <small>({bytes(stats.byteSize)})</small></strong></div></div><progress aria-label="일반 기록 저장 한도" value={Math.min(Math.max(0, stats.total - stats.favorite), status?.settings.maxItems ?? 1000)} max={status?.settings.maxItems ?? 1000} /><p className="storage-caption"><LockKeyhole size={11} />내 PC에만 저장됩니다</p></div></aside>}
      <main className={`main-content${page !== 'history' && !quick ? ' showing-settings' : ''}`}>
        {page === 'release-notes' && !quick && status ? <ReleaseNotesPage status={status} onBack={() => setPage('history')} /> : page === 'settings' && !quick && status ? <SettingsPage key={`${status.settings.onboarded}`} status={status} stats={stats} onSave={saveSettings} onClear={() => { setClearText(''); setConfirmError(''); setConfirmation({ kind: 'clear', step: 1 }); }} onBack={() => setPage('history')} /> : <>
          <section className="history-list-pane" aria-label="클립보드 기록 목록">
            {!quick && <div className="list-heading"><div><h2>{labels[filter]}</h2><span>{total.toLocaleString()}개의 기록</span></div><span className="local-label"><ShieldCheck size={13} />LOCAL</span></div>}
            <div className="search-toolbar"><div className="search-field"><Search size={20} /><input ref={searchRef} type="search" placeholder={quick ? '복사 기록 검색…' : '기록 검색…'} aria-label="클립보드 기록 검색" value={search} onChange={e => setSearch(e.target.value)} autoComplete="off" spellCheck={false} />{search ? <button className="icon-button" aria-label="검색어 지우기" onClick={() => { setSearch(''); searchRef.current?.focus(); }}><X size={16} /></button> : !quick && <kbd>{shortcutLabel('CommandOrControl+F', platform)}</kbd>}</div><button className={`sort-button${sort === 'oldest' ? ' reversed' : ''}`} aria-label={sort === 'newest' ? '최신 순. 오래된 순으로 변경' : '오래된 순. 최신 순으로 변경'} title={sort === 'newest' ? '최신 순' : '오래된 순'} onClick={() => setSort(previous => previous === 'newest' ? 'oldest' : 'newest')}><ArrowDownUp size={19} /></button></div>
            {quick && <nav className="quick-tabs" aria-label="기록 분류">{(['all', 'text', 'image', 'favorite'] as Filter[]).map(kind => <button key={kind} className={filter === kind ? 'active' : ''} onClick={() => navigateFilter(kind)}><KindIcon kind={kind} size={17} /><span>{kind === 'all' ? '전체' : labels[kind]}</span><span className="tab-count">{countFor(kind).toLocaleString()}</span></button>)}</nav>}
            {(statusError || status?.lastError || status?.shortcutError) && <div className="status-warning" role="status"><AlertCircle size={16} /><span>{statusError || status?.lastError || status?.shortcutError}</span><button aria-label="문제 해결 설정 열기" onClick={() => quick ? openManager('settings') : setPage('settings')}><Settings2 size={16} /></button></div>}
            {status?.platformNotice && <div className="platform-notice" role="note"><Info size={16} /><span>{status.platformNotice}</span></div>}
            {status?.settings.onboarded && !collecting && <div className="collection-banner"><Pause size={16} /><span>{status.settings.paused ? '새로운 기록 수집이 일시정지되었어요.' : '클립보드 기록이 꺼져 있어요.'}</span><button disabled={busy} onClick={() => void action(async () => { await saveSettings({ collectionEnabled: true, paused: false }); })}>{status.settings.paused ? '재개' : '켜기'}<Play size={11} /></button></div>}
            <div ref={listRef} className="clipboard-list" aria-busy={loading}>
              {loading ? <div className="list-loading"><LoaderCircle size={28} className="spin" /><p>기록을 불러오고 있어요</p>{[0, 1, 2, 3].map(n => <div className="skeleton-row" key={n}><span /><div><i /><i /></div></div>)}</div> : loadError ? <div className="empty-state"><div className="empty-icon error"><AlertCircle size={30} /></div><h3>기록을 불러오지 못했어요</h3><p>{loadError}</p><button className="button" onClick={() => { void refresh(true); void refreshStatus(); }}>다시 시도</button></div> : items.length === 0 ? <div className="empty-state"><div className="empty-icon">{filter === 'favorite' ? <Star size={32} /> : filtered ? <Search size={32} /> : <ClipboardList size={34} />}</div><h3>{query ? '검색 결과가 없어요' : filter === 'favorite' ? '오래 간직할 기록을 골라보세요' : filter !== 'all' ? `${labels[filter]} 기록이 아직 없어요` : '복사한 모든 것을, 언제든 다시.'}</h3><p>{query ? '다른 검색어를 입력하거나 전체 기록에서 찾아보세요.' : filter === 'favorite' ? '기록의 별을 누르면 여기에 모아둘 수 있어요.' : collecting ? '텍스트, 링크, 이미지를 복사해 보세요.\nClipBox가 이곳에 차곡차곡 보관할게요.' : '기록을 켜면 이후에 복사하는 내용을\n이 PC에 안전하게 보관할 수 있어요.'}</p>{filtered ? <button className="button subtle" onClick={() => { setSearch(''); setFilter('all'); }}>전체 기록 보기</button> : collecting ? <div className="empty-hint"><kbd>{copyShortcut}</kbd><span>첫 번째 기록을 만들어보세요</span></div> : <button className="button primary" disabled={busy || !status} onClick={() => void action(async () => { await saveSettings({ collectionEnabled: true, paused: false }); })}><Play size={15} />기록 켜기</button>}</div> : <>{items.map(item => <ClipRow key={item.id} item={item} selected={selectedId === item.id} quick={quick} busy={busy} onSelect={() => setSelectedId(item.id)} onCopy={() => recopy(item.id)} onFavorite={() => favorite(item.id)} onDelete={() => askDelete(item)} />)}{items.length < total && <button className="load-more" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? <LoaderCircle className="spin" size={16} /> : <ChevronDown size={16} />}{loadingMore ? '불러오는 중…' : `기록 더 보기 (${items.length.toLocaleString()} / ${total.toLocaleString()})`}</button>}<div className="list-end">{items.length === total ? '모든 기록을 확인했어요' : ''}</div></>}
            </div>
          </section>
          {!quick && <DetailPanel platform={platform} item={detail} loading={detailLoading} error={detailError} busy={busy} onClose={() => setSelectedId(null)} onCopy={() => selectedId && recopy(selectedId)} onFavorite={() => selectedId && favorite(selectedId)} onDelete={() => detail && askDelete(detail)} />}
        </>}
      </main>
    </div>
    {(page === 'history' || quick) && <footer className="app-footer">{quick ? <><span><kbd>↑ ↓</kbd>이동</span><span><kbd>Enter</kbd>복사 후 닫기</span><span><kbd>Esc</kbd>닫기</span><span className="quick-footer-note">붙여넣기는 {pasteShortcut}</span></> : <><span><Info size={13} />단축키</span><span><kbd>{shortcutLabel(status?.settings.hotkey ?? 'CommandOrControl+Shift+V', platform)}</kbd>빠른 기록 열기</span><span><kbd>{copyShortcut}</kbd>선택 기록 복사</span><span><kbd>{platformLabels(platform).deleteKey}</kbd>삭제</span><span className="footer-version">v{status?.version ?? '1.0.0'}</span></>}</footer>}
    {notice && <div className={`toast${notice.error ? ' error' : ''}`} role={notice.error ? 'alert' : 'status'}>{notice.error ? <AlertCircle size={18} /> : <Check size={18} />}<span>{notice.message}</span><button className="icon-button" aria-label="알림 닫기" onClick={() => setNotice(null)}><X size={16} /></button></div>}
    {status && !status.settings.onboarded && <Onboarding status={status} onFinish={async (collectionEnabled, autoStart) => { await saveSettings({ onboarded: true, collectionEnabled, autoStart }); }} />}
    {confirmation && <Dialog title={confirmation.kind === 'item' ? '기록 삭제 확인' : '전체 기록 삭제 확인'} onClose={busy ? undefined : closeConfirmation} className="confirm-dialog"><div className="confirm-icon"><Trash2 size={26} /></div><h2>{confirmation.kind === 'item' ? '이 기록을 삭제할까요?' : confirmation.step === 1 ? '모든 기록을 삭제할까요?' : '마지막으로 확인해 주세요'}</h2><p>{confirmation.kind === 'item' ? '삭제한 기록은 복구할 수 없습니다.' : confirmation.step === 1 ? `즐겨찾기를 포함한 ${stats.total.toLocaleString()}개의 기록과 이미지가 모두 삭제됩니다. 이 작업은 되돌릴 수 없습니다.` : '계속하려면 아래에 ‘전체 삭제’를 정확히 입력해 주세요.'}</p>{confirmation.kind === 'item' ? <div className="delete-preview"><KindIcon kind={confirmation.item.kind} size={18} /><span>{confirmation.item.kind === 'image' ? '캡처 이미지' : confirmation.item.previewText}</span></div> : confirmation.step === 2 ? <input className="confirm-input" autoFocus data-autofocus aria-label="전체 삭제 확인 문구" placeholder="전체 삭제" value={clearText} disabled={busy} onChange={e => setClearText(e.target.value)} autoComplete="off" /> : null}{confirmError && <div className="inline-error" role="alert"><AlertCircle size={16} />{confirmError}</div>}<div className="dialog-actions"><button className="button" disabled={busy} onClick={closeConfirmation}>취소</button><button className="button danger" disabled={busy || confirmation.kind === 'clear' && confirmation.step === 2 && clearText !== '전체 삭제'} onClick={() => { if (confirmation.kind === 'clear' && confirmation.step === 1) setConfirmation({ kind: 'clear', step: 2 }); else void confirmDelete(); }}>{busy && <LoaderCircle className="spin" size={16} />}{confirmation.kind === 'clear' && confirmation.step === 1 ? '계속' : '삭제'}</button></div></Dialog>}
  </div>;
}

export default function App() {
  if (!api) return <div className="unavailable-page"><Logo large /><h1>ClipBox</h1><h2>데스크톱 앱에서 열어 주세요</h2><p>클립보드 기록은 Electron 앱 안에서 사용할 수 있어요.<br />개발 환경에서는 <code>npm run dev</code>로 실행해 주세요.</p></div>;
  return <ConnectedApp />;
}
