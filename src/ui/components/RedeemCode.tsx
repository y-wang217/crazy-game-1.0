import { useRef, useState, type FormEvent } from "react";
import { useBackHandler } from '../backNav';
import type { CodeReward } from "../../config/redeemCodes";
import { getLang, t, useLang } from "../../i18n";
import { saveStore, useSave, type RedeemResult } from "../../save/store";
import { GameIcon } from "./GameIcon";
import { CanIcon, CoinIcon } from "./Icons";

/** One line of feedback per granted reward (fallback when a code has no custom message). */
function rewardText(r: CodeReward): string {
  switch (r.type) {
    case "fishCoins":
      return t("redeem.reward.fishCoins", { n: r.amount });
    case "cans":
      return t("redeem.reward.cans", { n: r.amount });
    case "fragments":
      return t("redeem.reward.fragments", {
        n: r.amount,
        cat: t(`cat.${r.cat}.name`),
      });
    case "cosmetic":
      return t("redeem.reward.cosmetic", { name: t(`cosmetic.${r.id}.name`) });
    case "testAccess":
      return t("redeem.testAccessOn");
  }
}

/**
 * Redeem Code (兌換碼) dialog. It only reads the code registry through the save store, so adding,
 * changing or disabling codes never touches this UI. A short lock stops one press (double tap,
 * Enter + click) from being processed twice; deliberate repeats of unlimited codes still work.
 */
export function RedeemCode({ onClose }: { onClose: () => void }) {
  useLang();
  const save = useSave();
  const [code, setCode] = useState("");
  const [result, setResult] = useState<{ r: RedeemResult; n: number } | null>(
    null,
  );
  const busy = useRef(false);
  useBackHandler(() => (onClose(), true));
  const count = useRef(0);

  const submit = (e?: FormEvent) => {
    e?.preventDefault();
    if (busy.current) return;
    busy.current = true;
    window.setTimeout(() => (busy.current = false), 450);
    const r = saveStore.redeemCode(code);
    count.current += 1;
    setResult({ r, n: count.current });
  };

  let message = "";
  if (result) {
    const r = result.r;
    if (r.ok) {
      const custom = r.def.message?.[getLang() === "en" ? "en" : "zh"];
      message =
        custom ??
        (r.granted.length
          ? r.granted.map(rewardText).join(" ")
          : t("redeem.nothingNew"));
    } else message = t(`redeem.error.${r.error}`);
  }

  return (
    <div
      className="shop-intro redeem-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="redeem-title"
    >
      <form className="panel shop-intro-card redeem-card" onSubmit={submit}>
        <h2 id="redeem-title">
          <GameIcon name="gift" size={22} /> {t("redeem.title")}
        </h2>
        <p className="muted small">{t("redeem.hint")}</p>
        <input
          className="redeem-input"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder={t("redeem.placeholder")}
          aria-label={t("redeem.title")}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={40}
        />
        <button type="submit" className="btn btn-primary redeem-btn">
          {t("redeem.button")}
        </button>
        {result && (
          <div
            key={result.n}
            className={`redeem-msg ${result.r.ok ? "ok" : "err"}`}
            role="status"
            aria-live="polite"
          >
            {message}
          </div>
        )}
        <div className="redeem-wallet">
          <span className="coin-pill" title={t("currency.coins")}>
            <CoinIcon /> {save.fishCoins}
          </span>
          <span className="coin-pill can-pill" title={t("currency.cans")}>
            <CanIcon /> {save.cans}
          </span>
        </div>
        <button type="button" className="btn btn-small" onClick={onClose}>
          {t("common.close")}
        </button>
      </form>
    </div>
  );
}
