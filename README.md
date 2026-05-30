# 野球収支計算機

プロ野球の試合結果とハンデで顧客ごとの収支をポイント計算する PWA。
B収支計算機と同じ技術スタック・デザイントーン。

## 技術
- React 19 + Vite 8
- localStorage（端末内のみ、データ共有なし）
- PWA (offline-capable via `sw.js`)

## 開発
```bash
npm install
npm run dev       # 開発サーバ (http://localhost:5173)
npm run build     # 本番ビルド → dist/
npm run preview   # ビルドのプレビュー
```

## 検証
```bash
npm run verify             # ハンデ + 集計の全テストを実行
npm run verify:handicap    # ハンデ換算ロジックを v2 仕様書の表で確認
npm run verify:aggregate   # 1日 / 1週間集計の end-to-end 検証
```

## ファイル構成
- `App.jsx` — ルート（5 画面を useState で切替）
- `Home.jsx` / `CustomersScreen.jsx` / `TeamsScreen.jsx` / `DailyInputScreen.jsx` / `WeeklySettlementScreen.jsx` — 各画面
- `ConfirmDialog.jsx` — はい/いいえ モーダル
- `GameResultModal.jsx` — 試合結果（勝/負/引分 + 点差）入力モーダル
- `storage.js` — localStorage hook + データ型 (JSDoc)
- `handicap.js` — ハンデ × 試合結果 → 換算率 + HANDICAP_OPTIONS (UI 用)
- `aggregate.js` — 1日 / 1週間の集計 + fmtPoints
- `settle.js` — 週間精算 + B収支式 (SETTLE_RATES)
- `week.js` — ISO 週 ID ヘルパー (週は月曜始まり)
- `sw.js` — service worker (production のみ自動登録)
- `manifest.webmanifest` — PWA manifest
- `icon.svg` — アイコン (PWA / favicon 兼用)
- `scripts/verify-handicap.mjs` — ハンデ計算の仕様書突合検証
- `scripts/verify-aggregate.mjs` — 集計の end-to-end 検証
- `scripts/verify-settle.mjs` — 週間精算 + B収支式の検証

## 進捗
- [x] Stage 1: scaffold + storage + handicap + week
- [x] Stage 2: 顧客・チーム管理画面
- [x] Stage 3: 日別入力グリッド + ハンデ計算
- [x] Stage 4: 週間精算 + B収支式
- [ ] Stage 5: スマホ最適化 / PWA 仕上げ
