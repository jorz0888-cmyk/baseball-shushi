# 野球収支計算機

プロ野球の試合結果とハンデで顧客ごとの収支をポイント計算する PWA。
B収支計算機と同じ技術スタック・デザイントーン。

## 技術
- React 19 + Vite 8
- localStorage（端末内のみ、データ共有なし）
- PWA (offline-capable via `sw.js`、ホーム画面追加対応)

## 開発
```bash
npm install
npm run dev       # 開発サーバ (http://localhost:5173)
npm run build     # 本番ビルド → dist/
npm run preview   # ビルドのプレビュー
```

## 検証
```bash
npm run verify             # ハンデ + 集計 + 精算の全テストを実行 (248 件)
npm run verify:handicap    # ハンデ換算ロジックを v2 仕様書の表で確認 (177)
npm run verify:aggregate   # 1日 / 1週間集計の end-to-end 検証 (35)
npm run verify:settle      # 週間精算 + B収支式の検証 (36)
```

## Vercel へのデプロイ

1. `git init` 済みのこのディレクトリを GitHub などに push
2. https://vercel.com/new で「Import Git Repository」を選択
3. Vercel は Vite を自動検出 ── 設定変更不要
   - Framework Preset: Vite
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. 「Deploy」 → 数分で `<project>.vercel.app` の URL が払い出される
5. PWA を試すならスマホで開いて「ホーム画面に追加」

CLI 派は:
```bash
npx vercel        # 初回ログイン + プロジェクト作成
npx vercel --prod # 本番デプロイ
```

## オフライン動作の確認
1. `npm run build && npm run preview` で本番ビルドをローカル起動
2. ブラウザを開いて Service Worker がインストールされたか DevTools の Application タブで確認
3. DevTools の Network タブで Offline に切替
4. ページをリロード → そのままアプリが動く ＝ オフライン OK

`sw.js` の `CACHE_VERSION` を上げると次回ロード時にキャッシュが入れ替わります。

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
- `useInstallPrompt.js` — PWA 「ホーム画面に追加」プロンプトの React フック
- `sw.js` — service worker (production のみ自動登録)
- `manifest.webmanifest` — PWA manifest
- `icon.svg` — アイコン (PWA / favicon 兼用)
- `scripts/verify-*.mjs` — 各ロジックの仕様突合検証 (248 件)

## 操作の流れ
1. **顧客管理**で顧客名を登録
2. **チーム管理**でプロ野球チーム名を登録
3. **日別入力**で
   - 曜日タブを選ぶ
   - 「試合追加」でチーム＋ハンデを設定（試合ごとに変更可）
   - 試合結果（勝/負/引分 + 点差）を「結果」ボタンから入力
   - 各セルに賭けポイント + 出/受 を入力 → 確定値が即時表示
   - 列計（試合別）・行計（顧客別）・全体計が自動計算
4. **週間精算**で
   - 月〜日の日別合計
   - 前半 (月火水) / 後半 (木金土日) 小計
   - 週合計 + プラス合計 / マイナス合計
   - 2分有り合計 (緑) / 2分無し合計 (オレンジ) ── B収支式適用後の値

## 進捗
- [x] Stage 1: scaffold + storage + handicap + week
- [x] Stage 2: 顧客・チーム管理画面
- [x] Stage 3: 日別入力グリッド + ハンデ計算
- [x] Stage 4: 週間精算 + B収支式
- [x] Stage 5: スマホ最適化 + PWA 仕上げ + デプロイ手順

## 今後の拡張案
- CSV / スプレッドシート出力
- 過去の週データの閲覧・比較画面（現状は週ナビで切替のみ）
- チーム別の勝率統計
- 顧客別の収支グラフ
- 月間・年間集計
