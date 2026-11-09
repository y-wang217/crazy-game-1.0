import { CHAPTER_REWARDS } from '../../config/collection';
import type { ChapterGrant } from '../../game/collection';
import type { CosmeticLoadout } from '../../game/types';
import { t, useLang } from '../../i18n';
import { saveStore } from '../../save/store';
import { CatReveal } from './CatReveal';
import { GameIcon } from './GameIcon';

/** Chapter-completion reward: the new cat's entrance + profile (or the fragment fallback). */
export function ChapterReward({ grant, loadout, onClose }: { grant: ChapterGrant; loadout: CosmeticLoadout; onClose: () => void }) {
  useLang();
  const close = () => {
    saveStore.markSeen(`cat:${grant.cat}`); // the reveal is this cat's first-time introduction
    onClose();
  };
  const kicker = `${t('chapterReward.title')} · ${t('result.chapter', { n: grant.chapterNumber })}`;
  if (grant.kind === 'fragments') {
    return (
      <div className="overlay reveal-overlay">
        <div className="panel chapter-reward">
          <div className="intro-kicker gold">{kicker}</div>
          <GameIcon name="fragment" size={56} />
          <h2>{t('chapterReward.fragments', { n: grant.fragments, cat: t(`cat.${grant.cat}.name`) })}</h2>
          <button className="btn btn-primary" onClick={onClose}>
            {t('chapterReward.continue')}
          </button>
        </div>
      </div>
    );
  }
  const orig = CHAPTER_REWARDS[grant.chapterId]?.cat;
  return (
    <div className="overlay reveal-overlay">
      <CatReveal
        cat={grant.cat}
        loadout={loadout}
        kicker={kicker}
        closeLabel={t('chapterReward.continue')}
        onClose={close}
        extra={
          <div className="chapter-reward-note">
            <b>{t('chapterReward.joined', { cat: t(`cat.${grant.cat}.name`) })}</b>
            {grant.substituted && orig && <div className="muted tiny">{t('chapterReward.substituted', { orig: t(`cat.${orig}.name`) })}</div>}
            <div className="muted tiny">{t('chapterReward.hint')}</div>
          </div>
        }
      />
    </div>
  );
}
