import { useState } from 'react';
import { findStage } from '../../config/chapters';
import type { RecoveryRecord } from '../../save/battleRecovery';
import { t, useLang } from '../../i18n';
import { GameIcon } from './GameIcon';
import { HeartIcon } from './Icons';

/**
 * Shown when the game opens and an unfinished battle was saved (accidental Back, refresh,
 * closed tab…). Resume continues it paused; Discard (with a confirm) abandons it.
 */
export function RecoveryPrompt({ record, onResume, onDiscard }: { record: RecoveryRecord; onResume: () => void; onDiscard: () => void }) {
  useLang();
  const [confirm, setConfirm] = useState(false);
  const found = findStage(record.stageId);
  const mins = Math.max(0, Math.round((Date.now() - record.savedAt) / 60000));
  return (
    <div className="overlay recover-overlay" role="dialog" aria-modal="true" aria-labelledby="recover-title">
      <div className="panel recover-panel">
        <h2 id="recover-title">{t('recover.title')}</h2>
        <p className="muted">{t('recover.body')}</p>
        <div className="recover-card">
          <div className="recover-stage">
            {t('battle.stage', { id: record.stageId })}
            {found ? ` · ${t(`stage.${record.stageId}`)}` : ''}
          </div>
          <div className="recover-meta">
            <span>{record.preparing ? t('battle.prepShort') : t('battle.wave', { n: record.wave, total: record.totalWaves })}</span>
            <span>
              <HeartIcon size={14} /> {record.baseHp}/{record.maxHp}
            </span>
            <span>{mins < 1 ? t('recover.justNow') : t('recover.minsAgo', { n: mins })}</span>
          </div>
        </div>
        {confirm ? (
          <>
            <p className="recover-warn">{t('recover.discardConfirm')}</p>
            <button className="btn btn-danger" onClick={onDiscard}>
              {t('recover.discardYes')}
            </button>
            <button className="btn btn-secondary" onClick={() => setConfirm(false)}>
              {t('recover.back')}
            </button>
          </>
        ) : (
          <>
            <button className="btn btn-primary" onClick={onResume}>
              <GameIcon name="play" size={18} /> {t('recover.resume')}
            </button>
            <button className="btn btn-secondary" onClick={() => setConfirm(true)}>
              {t('recover.discard')}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
