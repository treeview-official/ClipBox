import { useEffect, useState } from 'react';
import { ArrowLeft, Check, Download, FileClock, LoaderCircle, Mail, RefreshCw } from 'lucide-react';
import type { AppStatus, UpdateState } from '../shared/contracts';
import { RELEASE_NOTES, SUPPORT_EMAIL } from '../shared/releases';

const api = window.clipbox!;
export function SupportContact() {
  const [error, setError] = useState('');
  return <div className="support-contact"><Mail size={19} /><div><strong>요청사항·오류 문의</strong><p>더 편해졌으면 하는 점을 알려 주세요.</p><button className="email-link" onClick={() => void api.openSupport().catch(() => setError('메일 앱이 없다면 이 주소로 직접 보내 주세요.'))}>{SUPPORT_EMAIL}</button>{error && <p role="status">{error}</p>}</div></div>;
}

export function UpdatePanel({ version, installDisabled = false }: { version: string; installDisabled?: boolean }) {
  const [update, setUpdate] = useState<UpdateState>({ phase: 'idle', currentVersion: version, progress: 0, downloadedBytes: 0, message: '버튼을 눌러 최신 버전을 확인하세요.' });
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);
  useEffect(() => {
    let active = true;
    const off = api.onUpdate(state => { if (active) setUpdate(state); });
    void api.readUpdate().then(state => { if (active) setUpdate(state); }).catch(() => { if (active) setError('업데이트 상태를 불러오지 못했습니다.'); });
    return () => { active = false; off(); };
  }, []);
  async function run(operation: () => Promise<unknown>) {
    setPending(true); setError('');
    try { await operation(); setUpdate(await api.readUpdate()); }
    catch (err) { setError(err instanceof Error ? err.message : '요청을 완료하지 못했습니다. 다시 시도해 주세요.'); }
    finally { setPending(false); }
  }
  const working = ['checking', 'downloading', 'opening'].includes(update.phase);
  const format = update.release?.format;
  const installHelp = format === 'dmg' ? 'DMG를 열고 ClipBox를 응용 프로그램으로 옮겨 교체합니다.' : format === 'exe' ? 'Windows 설치 프로그램을 열어 업데이트합니다.' : format === 'tar.gz' ? '압축 파일을 새 폴더에 풀어 새 버전을 실행합니다.' : 'Linux 소프트웨어 설치 앱을 열어 업데이트합니다.';
  return <section className="update-panel" aria-label="프로그램 업데이트">
    <div className="update-heading"><span className="update-icon"><RefreshCw size={21} /></span><div><h3>프로그램 업데이트</h3><p>현재 버전 <strong>v{version}</strong>{update.release && <> · 공개 최신 버전 <strong>v{update.release.version}</strong></>}</p></div>{update.phase === 'current' && <span className="up-to-date"><Check size={14} />최신 상태</span>}</div>
    <p className={`update-message${update.phase === 'error' || error ? ' update-error' : ''}`} role="status" aria-live="polite">{error || update.message}</p>
    {update.phase === 'downloading' && <div className="download-progress"><progress aria-label="업데이트 다운로드 진행률" value={update.progress} max={100} /><span>{update.progress}% · {(update.downloadedBytes / 1024 / 1024).toFixed(1)} / {((update.release?.bytes ?? 0) / 1024 / 1024).toFixed(1)} MB</span></div>}
    {['available', 'ready', 'opening'].includes(update.phase) && <p className="update-instruction">{installHelp} 기존 기록과 설정은 유지됩니다.{update.phase === 'ready' && ' 설치 파일을 열면 ClipBox가 종료됩니다.'}</p>}
    {installDisabled && update.phase === 'ready' && <p className="update-instruction">설치하기 전에 아래 저장 버튼으로 변경한 설정을 저장해 주세요.</p>}
    <div className="update-actions">
      {update.phase === 'available' ? <button className="button primary" disabled={pending} onClick={() => void run(api.downloadUpdate)}><Download size={16} />업데이트 다운로드</button>
        : update.phase === 'ready' ? <button className="button primary" disabled={pending || installDisabled} onClick={() => void run(api.installUpdate)}><Download size={16} />앱 종료 후 설치</button>
        : update.phase === 'downloading' ? <><span><LoaderCircle className="spin" size={17} />다운로드 중</span><button className="button" onClick={() => void api.cancelUpdate().catch(() => setError('다운로드를 취소하지 못했습니다.'))}>다운로드 취소</button></>
        : <button className="button" disabled={pending || working || update.phase === 'opened'} onClick={() => void run(api.checkUpdate)}><RefreshCw size={16} className={working ? 'spin' : ''} />{update.phase === 'checking' ? '업데이트 확인 중' : update.phase === 'error' ? '다시 확인' : '업데이트 확인'}</button>}
      {['available', 'ready'].includes(update.phase) && <button className="button subtle" disabled={pending} onClick={() => void run(api.checkUpdate)}>다시 확인</button>}
      {update.phase === 'ready' && <button className="button subtle" disabled={pending} onClick={() => void run(api.showUpdateFile)}>파일 위치 열기</button>}
    </div>
    <p className="update-privacy">확인·다운로드를 요청할 때만 GitHub에 연결합니다. 클립보드 기록은 전송하지 않습니다.</p>
    {update.release?.notes && <details className="remote-release-notes"><summary>GitHub 최신 배포 안내 · v{update.release.version}</summary><pre>{update.release.notes}</pre></details>}
  </section>;
}

export function ReleaseNotesPage({ status, onBack }: { status: AppStatus; onBack: () => void }) {
  return <section className="release-page"><div className="page-heading"><div><div className="eyebrow">WHAT’S NEW</div><h2>패치노트</h2><p>ClipBox가 조금씩 더 편해지는 기록.</p></div><button className="button subtle back-button" onClick={onBack}><ArrowLeft size={16} />기록으로</button></div><div className="release-scroll">
    <UpdatePanel version={status.version} />
    <div className="release-timeline">{RELEASE_NOTES.map(release => <article className="release-card" key={release.version}><div className="release-marker"><FileClock size={19} /></div><div className="release-card-body"><div className="release-meta"><strong>v{release.version}</strong><time>{release.date}</time>{release.version === status.version && <span>현재 설치 버전</span>}</div><h3>{release.title}</h3><ul>{release.changes.map(change => <li key={change}>{change}</li>)}</ul></div></article>)}</div>
    <SupportContact />
  </div></section>;
}
