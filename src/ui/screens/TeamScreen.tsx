import { useEffect, useState } from 'react';
import { CAT_ORDER } from '../../config/cats';
import { TEAM_MIN, TEAM_SIZE } from '../../config/collection';
import type { CatId } from '../../game/types';
import { t, useLang } from '../../i18n';
import { saveStore, useSave } from '../../save/store';
import { setTeam as validTeam } from '../../game/collection';
import { TEAM_TUTORIAL_ID, teamTutorialCat, teamTutorialStep } from '../../tutorial/teamTutorial';
import { TUTORIALS } from '../../config/unlocks';
import type { Screen } from '../App';
import { CatPreview } from '../components/CatPreview';
import { Stars } from '../components/Stars';

/**
 * Battle team: TEAM_SIZE species that random summons choose from. Tap a team member to
 * select it, then tap any owned cat to swap it in. Saved immediately — except during the
 * Edit Team tutorial, where changes are a draft until the player taps "Confirm team".
 */
export function TeamScreen({ go, back, practice = false }: { go: (s: Screen) => void; back: Screen; practice?: boolean }) {
  useLang();
  const save = useSave();
  const [slot, setSlot] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);
  // Tutorial replay: practise with a cat outside the team (a trial cat if every owned cat is in it).
  const [practiceCat] = useState<CatId | null>(() => (practice ? practiceTeamCat(save) : null));
  const owned = CAT_ORDER.filter((id) => save.collection[id] || id === practiceCat);
  // Edit Team tutorial (first new cat): fixed for this visit, with a draft team.
  const [tut, setTut] = useState(() => practiceCat ?? teamTutorialCat(save));
  const [draft, setDraft] = useState<CatId[] | null>(() => (tut ? [...save.team] : null));
  const [practiceDone, setPracticeDone] = useState(false);
  const team = draft ?? save.team;
  const step = tut ? teamTutorialStep(team, tut, slot) : null;
  // Bring the highlighted target into view at each tutorial step.
  useEffect(() => {
    if (step) document.querySelector('.team .coach-target, .team .team-confirm.spotlit')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [step]);
  const apply = (next: CatId[]): boolean => {
    if (!draft) return saveStore.setTeam(next);
    // Practice drafts may hold the trial cat; they are never saved.
    if (practice ? next.length < TEAM_MIN || next.length > TEAM_SIZE : !validTeam({ ...save, team }, next).ok) return false;
    setDraft(next);
    return true;
  };

  const flash = (m: string) => {
    setNote(m);
    window.setTimeout(() => setNote(null), 1400);
  };

  const pickCat = (id: CatId) => {
    const next = [...team];
    const at = next.indexOf(id);
    if (slot === null) {
      if (at >= 0) setSlot(at);
      else if (next.length < TEAM_SIZE) {
        // An empty slot: add this species.
        if (apply([...next, id]) && !draft) flash(t('team.saved'));
      } else if (tut) flash(t('teamTut.pickSlotFirst'));
      return;
    }
    if (at === slot) {
      setSlot(null);
      return;
    }
    if (at >= 0)
      [next[at], next[slot]] = [next[slot], next[at]]; // reorder
    else next[slot] = id;
    if (apply(next) && !draft) flash(t('team.saved'));
    setSlot(null);
  };

  const remove = (i: number) => {
    if (apply(team.filter((_, k) => k !== i)) && !draft) flash(t('team.saved'));
    setSlot(null);
  };
  const canRemove = team.length > TEAM_MIN;

  // Tutorial: complete only when the confirmed team really contains the new cat.
  const confirm = () => {
    if (!tut || !draft) return;
    if (!draft.includes(tut)) {
      flash(t('teamTut.notYet', { cat: t(`cat.${tut}.name`) }));
      return;
    }
    if (practice) {
      // Practice only: the real team is left exactly as it was.
      setPracticeDone(true);
      return;
    }
    if (!saveStore.setTeam(draft)) return;
    saveStore.markSeen(TEAM_TUTORIAL_ID);
    saveStore.setTutorial(TUTORIALS.team, 'done');
    flash(t('teamTut.done', { cat: t(`cat.${tut}.name`) }));
    setTut(null);
    setDraft(null);
  };
  const skip = () => {
    if (practice) return go(back);
    if (!window.confirm(t('teamTut.skipConfirm'))) return;
    saveStore.markSeen(TEAM_TUTORIAL_ID); // the team itself stays exactly as it was (the draft is dropped)
    saveStore.setTutorial(TUTORIALS.team, 'skipped');
    setTut(null);
    setDraft(null);
  };

  return (
    <div className="screen team">
      <div className="topbar">
        {tut ? (
          <>
            {/* Leaving without confirming keeps the old team; the tutorial comes back next time. */}
            <button className="btn btn-small" onClick={() => go(back)}>
              {t('common.back')}
            </button>
            <button className={`btn btn-small btn-primary team-confirm ${step === 'confirm' ? 'spotlit' : ''}`} onClick={confirm}>
              {t('teamTut.confirm')}
            </button>
          </>
        ) : (
          <button className="btn btn-small" onClick={() => go(back)}>
            {t('team.done')}
          </button>
        )}
      </div>
      <h2 className="center">{t('team.title')}</h2>
      {practice && <p className="practice-tag center">{t('practice.teamBadge')}</p>}
      <p className="muted small center">{t('team.hint', { min: TEAM_MIN, n: TEAM_SIZE })}</p>
      <div className={`team-slots ${step === 'slot' ? 'coach-target' : ''}`}>
        {team.map((id, i) => (
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
        {team.length < TEAM_SIZE && <div className="team-slot empty">＋</div>}
      </div>
      <p className="muted tiny center">{t('team.tapSlot')}</p>
      <div className="team-pool">
        {owned.map((id) => {
          const inTeam = team.includes(id);
          return (
            <button
              key={id}
              className={`pool-card owned ${inTeam ? 'in-team' : ''} ${step === 'cat' && id === tut ? 'coach-target' : ''}`}
              onClick={() => pickCat(id)}
            >
              <div className="pool-art">
                <CatPreview type={id} level={1} loadout={save.equipped} size={54} animate={false} />
              </div>
              <div className="pool-name">{t(`cat.${id}.name`)}</div>
              <Stars n={save.collection[id]?.stars ?? 1} size={10} />
              <div className="tiny muted">{inTeam ? t('team.inTeam') : !save.collection[id] ? t('practice.trial') : t(`cat.${id}.role`)}</div>
            </button>
          );
        })}
      </div>
      <p className="muted tiny center">{t('team.tutorialNote')}</p>
      {tut && step && (
        <div className="team-coach" role="status" aria-live="polite">
          <CatPreview type={tut} level={1} loadout={save.equipped} size={44} />
          <div className="team-coach-text">
            <b>
              {t(practice ? 'practice.teamKicker' : 'teamTut.kicker')} · {['slot', 'cat', 'confirm'].indexOf(step) + 1}/3
            </b>
            <span>{t(`teamTut.step.${step}`, { cat: t(`cat.${tut}.name`) })}</span>
          </div>
          <button className="link-btn tiny" onClick={skip}>
            {t(practice ? 'practice.exit' : 'teamTut.skip')}
          </button>
        </div>
      )}
      {practiceDone && (
        <div className="overlay practice-end" role="dialog" aria-modal="true">
          <div className="panel">
            <h2>{t('practice.teamDoneTitle')}</h2>
            <p className="muted">{t('practice.teamDoneBody')}</p>
            <button className="btn btn-primary" onClick={() => go(back)}>
              {t('practice.exit')}
            </button>
          </div>
        </div>
      )}
      {note && <div className="toast-inline">{note}</div>}
    </div>
  );
}

/** Edit Team practice: an owned cat that is not in the team, else any cat outside it (trial, never saved). */
export function practiceTeamCat(save: { team: CatId[]; collection: Partial<Record<CatId, unknown>> }): CatId | null {
  const out = CAT_ORDER.filter((id) => !save.team.includes(id));
  return out.find((id) => save.collection[id]) ?? out[0] ?? null;
}
