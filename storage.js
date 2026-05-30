import { useEffect, useState } from "react";

/**
 * localStorage-backed React state.
 *
 * Reads once on mount, writes back on every change. Failures (quota,
 * private mode) are swallowed — the app still works in-memory.
 *
 * @template T
 * @param {string} key
 * @param {T} initialValue
 * @returns {[T, (v: T | ((prev: T) => T)) => void]}
 */
export function useLocalStorage(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return initialValue;
      return JSON.parse(raw);
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore quota / disabled storage — in-memory state is the
      // source of truth for the rest of the session.
    }
  }, [key, value]);

  return [value, setValue];
}

/**
 * localStorage key registry. Matches the keys in the v2 spec so the
 * existing-data migration story stays trivial.
 */
export const STORAGE_KEYS = Object.freeze({
  customers: "bb-calc-customers",
  teams: "bb-calc-teams",
  weeks: "bb-calc-weeks",
});

// ---------------------------------------------------------------------------
// Data shape (JSDoc — gives editor hovers without committing to TypeScript)
// ---------------------------------------------------------------------------

/**
 * @typedef {Object} Customer
 * @property {string} id
 * @property {string} name
 */

/**
 * @typedef {Object} Team
 * @property {string} id
 * @property {string} name
 */

/**
 * @typedef {Object} GameResult
 * @property {boolean} won           — Did the handicap-giving side win?
 * @property {number} scoreDiff      — Margin from the handicap-giving side. positive=勝ち, 0=引分, negative=負け.
 * @property {boolean} draw
 */

/**
 * @typedef {Object} Game
 * @property {string} id
 * @property {string} teamId            — ハンデを出している側（強いチーム）
 * @property {string | null} [opponentTeamId] — 対戦相手チーム。null/未設定 = 旧データ後方互換
 * @property {string} handicap          — "0" (スクラッチ) / "0.3" / "1" / "1.5" / "1半" / "1半3" 形式
 * @property {GameResult | null} result — null = まだ未入力
 */

/** @typedef {"give" | "receive"} BetSide */

/**
 * @typedef {Object} Bet
 * @property {string} customerId
 * @property {string} gameId
 * @property {number} points
 * @property {BetSide} side
 */

/**
 * @typedef {Object} DayData
 * @property {Game[]} games
 * @property {Bet[]} bets
 */

/**
 * @typedef {Object} WeekData
 * @property {DayData} monday
 * @property {DayData} tuesday
 * @property {DayData} wednesday
 * @property {DayData} thursday
 * @property {DayData} friday
 * @property {DayData} saturday
 * @property {DayData} sunday
 */

/** @returns {DayData} */
export function emptyDay() {
  return { games: [], bets: [] };
}

/** @returns {WeekData} */
export function emptyWeek() {
  return {
    monday: emptyDay(),
    tuesday: emptyDay(),
    wednesday: emptyDay(),
    thursday: emptyDay(),
    friday: emptyDay(),
    saturday: emptyDay(),
    sunday: emptyDay(),
  };
}

/** Generates a short opaque id. Not a real uuid — collision-resistant enough for one-device usage. */
export function makeId(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}
