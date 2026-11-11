import { useSyncExternalStore } from 'react';

// Guided tours of the real menus (V1.6): Shop + Encyclopedia (after 1-4) and Recruitment
// (after 2-5). Each step spotlights a real element on a real screen. A 'tap' step only moves on
// when the player taps that element (the rest of the screen is blocked), 'next' / 'finish' steps
// use the coach bubble's button. A tour ends ONLY by finishing it or by the visible
// Skip Tutorial button — tapping outside or closing nothing counts as completion.

export type TourId = 'shopCats' | 'recruit';
export type TourScreen = 'home' | 'shop' | 'cats' | 'catProfile' | 'recruit';

export interface TourStep {
  screen: TourScreen;
  /** CSS selector of the element to spotlight (the first visible match). */
  target: string;
  /** i18n key of the coach text. */
  textKey: string;
  action: 'tap' | 'next' | 'finish';
}

export const TOURS: Record<TourId, TourStep[]> = {
  shopCats: [
    { screen: 'home', target: '[data-feature="shop"]', textKey: 'tour.shopCats.openShop', action: 'tap' },
    { screen: 'shop', target: '.shop-grid, .shop-items, .skin-grid', textKey: 'tour.shopCats.shopInfo', action: 'next' },
    { screen: 'shop', target: '.topbar .btn', textKey: 'tour.shopCats.backHome', action: 'tap' },
    { screen: 'home', target: '[data-feature="encyclopedia"]', textKey: 'tour.shopCats.openCats', action: 'tap' },
    { screen: 'cats', target: '.collection-card.met', textKey: 'tour.shopCats.pickCat', action: 'tap' },
    { screen: 'catProfile', target: '.star-card', textKey: 'tour.shopCats.stars', action: 'finish' },
  ],
  recruit: [
    { screen: 'home', target: '[data-feature="recruit"]', textKey: 'tour.recruit.open', action: 'tap' },
    { screen: 'recruit', target: '.can-pill', textKey: 'tour.recruit.cans', action: 'next' },
    { screen: 'recruit', target: '.recruit-btn', textKey: 'tour.recruit.draw', action: 'next' },
    { screen: 'recruit', target: '.recruit-guarantee', textKey: 'tour.recruit.odds', action: 'next' },
    { screen: 'recruit', target: '.recruit-pool', textKey: 'tour.recruit.pool', action: 'finish' },
  ],
};

export interface TourState {
  id: TourId;
  step: number;
  /** 'onboarding' records done/skipped in the save; 'replay' never changes the save. */
  mode: 'onboarding' | 'replay';
}

let current: TourState | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const tourStore = {
  get: (): TourState | null => current,
  start(id: TourId, mode: TourState['mode'], step = 0): void {
    current = { id, step, mode };
    emit();
  },
  /** Advance; returns true when the tour just finished. */
  next(): boolean {
    if (!current) return false;
    if (current.step >= TOURS[current.id].length - 1) {
      current = null;
      emit();
      return true;
    }
    current = { ...current, step: current.step + 1 };
    emit();
    return false;
  },
  stop(): void {
    current = null;
    emit();
  },
  subscribe(l: () => void): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useTour(): TourState | null {
  return useSyncExternalStore(tourStore.subscribe, tourStore.get, tourStore.get);
}
