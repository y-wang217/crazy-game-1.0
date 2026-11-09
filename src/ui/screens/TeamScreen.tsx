import { useState } from 'react';
import { CAT_ORDER } from '../../config/cats';
import { TEAM_MIN, TEAM_SIZE } from '../../config/collection';
import type { CatId } from '../../game/types';
import { t, useLang } from '../../i18n';
import { saveStore, useSave } from '../../save/store';
import type { Screen } from '../App';
import { CatPreview } from '../components/CatPreview';
import { Stars } from '../components/Stars';

/**
 * Battle team: TEAM_SIZE species that random summons choose from. Tap a team member to
 * select it, then tap any owned cat to swap it in. Saved immediately.
 */
export function TeamScreen({ go, back }: { go: (s: Screen) => void; back: Screen }) {
  useLang();
  const save = useSave();
  const [slot, setSlot] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const owned = CAT_ORDER.filter((id) => save.collection[id]);

  const flash = (m: string) => {
    setNote(m);
    window.setTimeout(() => setNote(null), 1400);
  };

  const pickCat = (id: CatId) => {
    const team = [...save.team];
    const at = team.indexOf(id);
    if (slot === null) {
      if (at >= 0) setSlot(at);
      else if (team.length < TEAM_SIZE) {
        // An empty slot: add this species.
        if (saveStore.setTeam([...team, id])) flash(t('team.saved'));
      }
      return;
    }
    if (at === slot) {
      setSlot(null);
      return;
    }
    if (at >= 0) [team[at], team[slot]] = [team[slot], team[at]]; // reorder
    else team[slot] = id;
    if (saveStore.setTeam(team)) flash(t('team.saved'));
    setSlot(null);
  };

  const remove = (i: number) => {
    const team = save.team.filter((_, k) => k !== i);
    if (saveStore.setTeam(team)) flash(t('team.saved'));
    setSlot(null);
  };
  const canRemove = save.team.length > TEAM_MIN;

  return (
    <div className="screen team">
      <div className="topbar">
        <button className="btn btn-small" onClick={() => go(back)}>
          {t('team.done')}
        </button>
      </div>
      <h2 className="center">{t('team.title')}</h2>
      <p className="muted small center">{t('team.hint', { min: TEAM_MIN, n: TEAM_SIZE })}</p>
      <div className="team-slots">
        {save.team.map((id, i) => (
          <div key={id} className="team-slot-wrap">
            <button className={`team-slot ${slot === i ? 'on' : ''}`} onClick={() => setSlot(slot === i ? null : i)}>
              <CatPreview type={id} level={1} loadout={save.equipped} size={56} animate={slot === i} />
              <span className="team-slot-name">{t(`cat.${id}.name`)}</span>
              <Stars n={save.collection[id]?.stars ?? 1} size={10} />
            </button>
            {canRemove && (
              <button className="team-remove" onClick={() => remove(i)} aria-label={t('team.remove', { cat: t(`cat.${id}.name`) })}>
                ✕
              </button>
            )}
          </div>
        ))}
        {save.team.length < TEAM_SIZE && <div className="team-slot empty">＋</div>}
      </div>
      <p className="muted tiny center">{t('team.tapSlot')}</p>
      <div className="team-pool">
        {owned.map((id) => {
          const inTeam = save.team.includes(id);
          return (
            <button key={id} className={`pool-card owned ${inTeam ? 'in-team' : ''}`} onClick={() => pickCat(id)}>
              <div className="pool-art">
                <CatPreview type={id} level={1} loadout={save.equipped} size={54} animate={false} />
              </div>
              <div className="pool-name">{t(`cat.${id}.name`)}</div>
              <Stars n={save.collection[id]?.stars ?? 1} size={10} />
              <div className="tiny muted">{inTeam ? t('team.inTeam') : t(`cat.${id}.role`)}</div>
            </button>
          );
        })}
      </div>
      <p className="muted tiny center">{t('team.tutorialNote')}</p>
      {note && <div className="toast-inline">{note}</div>}
    </div>
  );
}
