import { CATS, CAT_ORDER, TARGET_MODES, TARGET_MODE_INFO } from '../../config/cats';
import { useSave } from '../../save/store';
import type { Screen } from '../App';
import { CatPreview } from '../components/CatPreview';

const ATTACK_TEXT: Record<string, string> = {
  projectile: 'Throws yarn balls at one target.',
  combo: 'Rapid multi-hit punches. Weak vs armor, great vs shields.',
  slam: 'Heavy ground slam that splashes nearby mice.',
  snipe: 'One precise long-range shot. Shreds armor.',
  aura: 'No damage. Her elegance slows every mouse nearby.',
};

export function CatsScreen({ go }: { go: (s: Screen) => void }) {
  const save = useSave();
  return (
    <div className="screen cats">
      <div className="topbar">
        <button className="btn btn-small" onClick={() => go({ name: 'home' })}>
          ← Home
        </button>
        <span />
      </div>
      <h2 className="center">The Cat Squad</h2>
      <div className="cat-list">
        {CAT_ORDER.map((id) => {
          const c = CATS[id];
          return (
            <div key={id} className="cat-row">
              <div className="cat-levels">
                <CatPreview type={id} level={1} loadout={save.equipped} size={56} />
                <CatPreview type={id} level={3} loadout={save.equipped} size={56} />
                <CatPreview type={id} level={5} loadout={save.equipped} size={56} />
              </div>
              <div>
                <div className="cat-name">
                  {c.name} <span className="muted small">— {c.title}</span>
                </div>
                <div className="small">{c.personality}</div>
                <div className="small role">
                  <b>{c.role}:</b> {ATTACK_TEXT[c.attack]}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="help-card">
        <h3>How to play</h3>
        <ul className="small">
          <li><b>Summon</b>: spend dried fish for a random cat on a random free tile.</li>
          <li><b>Drag</b> a cat to an empty tile to move it (free, any time).</li>
          <li><b>Drag onto an identical cat</b> (same type & level) to merge into a stronger one.</li>
          <li><b>Tap</b> a cat to cycle its targeting:{' '}
            {TARGET_MODES.map((m) => (
              <span key={m} className="mode-chip" style={{ background: TARGET_MODE_INFO[m].color }}>
                {TARGET_MODE_INFO[m].short} {TARGET_MODE_INFO[m].label}
              </span>
            ))}
          </li>
          <li><b>Treasure chests</b> walk the road — break them for 3 skill choices and fish coins.</li>
        </ul>
      </div>
    </div>
  );
}
