import { useState } from "react";
import { CHAPTERS } from "../../config/chapters";
import { ENEMIES } from "../../config/enemies";
import {
  ENEMY_DEX,
  SECRET_ENEMIES,
  isEnemyDiscovered,
  type DexEntry,
} from "../../game/enemyDex";
import type { EnemyId } from "../../game/types";
import { has, t } from "../../i18n";
import type { SaveData } from "../../save/store";
import { useBackHandler } from "../backNav";
import { FoePreview } from "./CatPreview";
import { GameIcon } from "./GameIcon";

/** World pixels per board tile (speeds are shown in tiles per second). */
const TILE = 50;

/** Has the player reached the chapter this enemy first appears in? (silhouettes only from there) */
const chapterOpen = (e: DexEntry, save: SaveData) => {
  const ch = CHAPTERS.find((c) => c.id === e.chapterId);
  return (
    !!ch &&
    ch.stages.some((s) => save.unlocked.includes(s.id) || s.id in save.cleared)
  );
};

/**
 * Enemies section of the Encyclopedia (V1.6.4): a reference for mice already met. Unmet regular
 * mice of a chapter the player has reached show as silhouettes; unmet bosses, the secret enemy and
 * later-chapter mice show only "?". All numbers come from the real enemy config.
 */
export function EnemyDex({ save }: { save: SaveData }) {
  const [open, setOpen] = useState<EnemyId | null>(null);
  useBackHandler(() => (setOpen(null), true), open !== null);
  const met = ENEMY_DEX.filter((e) => isEnemyDiscovered(e.id, save));
  return (
    <>
      <div className="dex-count muted small center">
        {t("dex.found", { n: met.length, total: ENEMY_DEX.length })}
      </div>
      {met.length === 0 && (
        <p className="muted small center">{t("dex.empty")}</p>
      )}
      <div className="collection-grid enemy-grid">
        {ENEMY_DEX.map((e) => {
          const found = isEnemyDiscovered(e.id, save);
          const def = ENEMIES[e.id];
          const silhouette =
            !found &&
            !def.isBoss &&
            !SECRET_ENEMIES.has(e.id) &&
            chapterOpen(e, save);
          return (
            <button
              key={e.id}
              className={`collection-card enemy-card ${found ? "met" : "unknown"} ${def.isBoss ? "boss" : ""}`}
              disabled={!found}
              data-enemy={found ? e.id : undefined}
              onClick={() => found && setOpen(e.id)}
              aria-label={found ? t(`enemy.${e.id}.name`) : t("dex.notMet")}
            >
              <div className="enemy-portrait">
                {found || silhouette ? (
                  <span className={silhouette ? "silhouette" : ""}>
                    <FoePreview enemy={e.id} size={78} />
                  </span>
                ) : (
                  <span className="enemy-unknown">?</span>
                )}
              </div>
              <div className="collection-name">
                {found ? t(`enemy.${e.id}.name`) : t("dex.unknown")}
              </div>
              {found ? (
                <KindBadge id={e.id} />
              ) : (
                <div className="collection-state">{t("dex.notMet")}</div>
              )}
            </button>
          );
        })}
      </div>
      {open && <EnemySheet id={open} onClose={() => setOpen(null)} />}
    </>
  );
}

function KindBadge({ id }: { id: EnemyId }) {
  const def = ENEMIES[id];
  const kind = SECRET_ENEMIES.has(id)
    ? "secret"
    : def.isBoss
      ? "boss"
      : def.elite
        ? "elite"
        : "enemy";
  return (
    <span className={`dex-badge dex-${kind}`}>
      {kind === "elite" ? t(`elite.role.${def.elite}`) : t(`dex.kind.${kind}`)}
    </span>
  );
}

function EnemySheet({ id, onClose }: { id: EnemyId; onClose: () => void }) {
  const def = ENEMIES[id];
  const entry = ENEMY_DEX.find((e) => e.id === id)!;
  const secret = SECRET_ENEMIES.has(id);
  const mystery = t("intro.mystery");
  const traits =
    [
      def.slowImmune && t("dex.trait.slowImmune"),
      def.loops && t("dex.trait.loops"),
    ]
      .filter(Boolean)
      .join(" · ") || t("dex.trait.none");
  const rows: [string, string][] = [
    [
      t("dex.hp"),
      secret
        ? mystery
        : `${def.hp}${def.shield ? ` + ${t("dex.shield")} ${def.shield}` : ""}`,
    ],
    [t("dex.armor"), secret ? mystery : String(def.armor)],
    [
      t("dex.speed"),
      secret
        ? mystery
        : t("dex.speedValue", { v: (def.speed / TILE).toFixed(2) }),
    ],
    [t("dex.damage"), secret ? mystery : String(def.baseDamage)],
    [t("dex.traits"), secret ? mystery : traits],
    [t("dex.firstSeen"), t("dex.stage", { s: entry.firstStage })],
  ];
  return (
    <div
      className="overlay enemy-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="enemy-sheet-name"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="panel enemy-sheet-card">
        <div className="intro-art">
          <FoePreview enemy={id} size={104} />
        </div>
        <h2 id="enemy-sheet-name" className="intro-name">
          {t(`enemy.${id}.name`)}
        </h2>
        <KindBadge id={id} />
        <table className="info-stats enemy-stats">
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k}>
                <td>{k}</td>
                <td className={v === mystery ? "mystery" : ""}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <dl className="intro-facts">
          <dt className="bad">{t("intro.watchOut")}</dt>
          <dd className={secret ? "mystery" : ""}>
            {secret ? mystery : t(`enemy.${id}.strength`)}
          </dd>
          <dt>{t("intro.behavior")}</dt>
          <dd className={secret ? "mystery" : ""}>
            {secret ? mystery : t(`enemy.${id}.behavior`)}
          </dd>
          {(secret || has(`enemy.${id}.tip`)) && (
            <>
              <dt className="good">{t("intro.tip")}</dt>
              <dd className={secret ? "mystery" : ""}>
                {secret ? mystery : t(`enemy.${id}.tip`)}
              </dd>
            </>
          )}
        </dl>
        {!secret && <p className="muted tiny">{t("dex.baseNote")}</p>}
        <button className="btn btn-primary" onClick={onClose}>
          <GameIcon name="next" size={16} /> {t("dex.close")}
        </button>
      </div>
    </div>
  );
}
