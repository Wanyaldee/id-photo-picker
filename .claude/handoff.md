# 作業引き継ぎ (context-handoff)

- リポジトリ: /home/ko200/id-photo-picker
- ブランチ: main
- 理由: レート制限 5h が 90% に到達
- 記録日時: 2026-11-14T08:06:03.009Z

## 目的

`~/id-photo-picker`(証明写真セレクター)を `CLAUDE.md` の §7 マイルストーン順に実装する。大量の写真から証明写真向きの候補を採点して並べ、3:4 にトリミングして書き出す Web アプリで、すべてブラウザ内で完結させる(写真を外部送信しない、アクセス解析なし)。GitHub で MIT 公開する予定。

進め方の決まり(ユーザー指定):

- マイルストーンごとに動作確認してコミットする。
- 設計判断は `docs/adr/NNNN-*.md` に英語で残す(Context / Decision / Reason(実コード付き)/ Alternatives rejected / Consequences / Verification の6節、ログは実物を貼る)。
- ユーザーへの報告は日本語、コード・コミット・ADR は英語。
- ツールチェーンは **Vite+(`vp`)**(ユーザーの明示指示)。`vp check --fix` / `vp test run` / `vp build` を使う。
- コミット末尾に `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>` を付ける。

## 完了したこと

コミット済み(`main`、push はしていない):

| マイルストーン | コミット | 内容 |
|---|---|---|
| 1 土台 | `03e1d03` | Vite+ / Preact / TS strict、ビルド時 CSP `<meta>`、CI、README 雛形、LICENSE、ADR 0001 |
| 2 読み込みと一覧 | `369eeac` | Worker 2本でデコード、サムネのみ保持、進捗と中断、ADR 0002 |
| 3 顔解析とスコア | `91c32e2` | MediaPipe FaceLandmarker、純粋関数の採点、設定スライダー(localStorage)、並べ替え・フィルタ、ADR 0003 |
| 4 トリミングと書き出し | `d2db94f` | ドラッグ・ズーム可能な 3:4 枠、354×472 と大サイズ、PNG/JPEG、ADR 0004 |
| 5 背景処理 | `ba5cfa5` | selfie_multiclass_256x256 + マスク後処理(穴埋め・切れ端除去)、実寸プレビュー、失敗時は「そのまま」に戻す、ADR 0005 |

§8 の未決事項はすべてユーザーが回答済み: Preact / 数百枚まで / HEIC 非対応 / リポジトリ名 `id-photo-picker` / README 日本語のみ / 背景モデルは multiclass + 穴埋め。

マイルストーン6(公開準備)は作業中で、以下は**作業ツリーにあるが未コミット**:

- **計測送信の発見と対処**: `@mediapipe/tasks-vision` 1.0.0 以降は利用状況の計測値を60秒ごとに `odml.pa.googleapis.com/v1/log` へ送信する。次の三重の対策を入れた。
  - `0.10.35` に厳密固定(`npm install --save-exact`)。
  - `src/analysis/networkGuard.ts` を追加し、両 Worker の最初の import にした(自オリジン以外への fetch を拒否、XHR / WebSocket / EventSource / WebTransport を削除)。
  - `tests/privacy.test.ts` を追加(バージョン固定、バンドル内に http(s) エンドポイントなし、Worker のガード import を検査)。
- WASM のコピーを `postinstall` から `vite.config.ts` の `copyMediapipeWasm` プラグイン(`buildStart`)へ移し、`scripts/` を削除した。
- `@types/node` を devDependency に追加し、`tsconfig.json` の `types` に `"node"` を追加した。
- `.github/workflows/deploy.yml`(Pages)、`public/THIRD_PARTY_NOTICES.txt`、`public/mediapipe/LICENSE-APACHE-2.0.txt`、`tests/fixtures/README.md` を追加した。
- フッターにライセンス表記へのリンクを追加した(`App.tsx` / `strings.ts` / `styles.css`)。
- `CLAUDE.md` §2 に固定ルールを追記し、ADR 0003 に版の注記を入れた。
- `docs/images/screenshot-list.png` と `screenshot-detail.png` を撮影した(キャンバスで描いた合成イラストのみ)。

0.10.35 固定後の検証結果(`vp build` + `vp preview`、ヘッドレス Chromium):

- 15枚の採点結果は固定前と同じ。354×472 の書き出し、背景差し替え、失敗時フォールバックも動作した。
- 75秒待機しても他オリジンへのリクエストは0件だった。
- Worker 内から `fetch("https://example.com/")` は `Blocked network request to another origin` で拒否され、同一オリジンは 200 だった。
- `vp test run` は 12ファイル 77件合格、`vp check` は警告なしだった。
- ただし、どちらも最後のフッター追加などの編集より前の実行で、**その後は再実行していない**。

## 残っていること

1. 最後の編集後に `vp check --fix` / `vp test run` / `vp build` を再実行する。
2. `README.md` を完成させる(現状はマイルストーン1の雛形で「開発中」表記のまま)。入れる内容:
   - 使い方、採点項目の説明、スクリーンショット2枚(合成イラストである旨)。
   - プライバシー(Network タブで確認できる旨、MediaPipe を計測なしの版に固定している旨)。
   - 制限: 履歴書等向け、HEIC 非対応、背景は物の多い場所で残りが出る、DPI メタデータなし。
   - 第三者ライセンスへのリンク。
3. `docs/adr/0006-no-telemetry.md` を書く(`CLAUDE.md`、`public/mediapipe/README.md`、`networkGuard.ts`、`privacy.test.ts` から既に参照されているが**未作成**)。Pages デプロイ設定と WASM コピー方式の変更もここに含める。未検証として残す点:
   - ページの `<meta>` CSP が Worker に適用されるかは未検証(適用されないというのは推測)。
   - GitHub Actions は未実行。
   - Firefox / Safari は未確認。
4. `docs/images/screenshot-detail.png` を目視確認する(背景「そのまま」で撮り直したが、撮り直し後は見ていない)。
5. マイルストーン6をコミットする。
6. **GitHub への公開(リポジトリ作成・push・Pages 有効化)はユーザーの確認を取ってから**。`gh` は Wanyaldee でログイン済み。Pages はリポジトリ設定で Source を「GitHub Actions」にする必要がある(推測: 初回は手動設定が必要)。
7. 最終報告でユーザーに伝えること:
   - 計測送信の発見と 0.10.35 固定の判断(ユーザーに相談せず決めたので、明示して了承を得る)。
   - 閉じた目・開いた口は実写で未検証で、合成イラストとユニットテストのみ。
   - 笑顔の閾値は未調整(サンプル全員が「笑顔が強い」判定)。
   - 実際のスマホ写真や本人写真では未検証。

## 次の一手

`cd ~/id-photo-picker && vp check --fix && vp test run && vp build` を実行して現状が通ることを確認し、続けて `docs/adr/0006-no-telemetry.md` と `README.md` を書いてマイルストーン6をコミットする。その後、GitHub へ公開してよいかをユーザーに確認する。

## 関連ファイル

リポジトリ(`/home/ko200/id-photo-picker`):

- `CLAUDE.md` — 仕様と決定事項(§8 は全決定済み、§2 に MediaPipe 固定ルール)
- `vite.config.ts` — CSP meta、WASM コピー、worker format `es`、テスト設定
- `package.json` — scripts は `check` / `fix` / `test` / `build` / `dev` / `preview`
- `src/analysis/` — `photoWorker.ts`, `faceAnalyzer.ts`, `processPhotos.ts`, `lanes.ts`, `networkGuard.ts`, `config.ts`, `messages.ts`
- `src/scoring/` — `config.ts`(重み・閾値), `score.ts`, `pixels.ts`, `pose.ts`, `types.ts`
- `src/crop/` — `autoCrop.ts`, `frame.ts`, `export.ts`
- `src/background/` — `backgroundWorker.ts`, `replaceBackground.ts`, `mask.ts`, `config.ts`, `messages.ts`
- `src/ui/` — `App.tsx`, `Loader.tsx`, `PhotoGrid.tsx`, `ViewControls.tsx`, `SettingsPanel.tsx`, `Detail.tsx`, `CropEditor.tsx`, `ExportPanel.tsx`, `strings.ts`(全文言), `settings.ts`, `settingsFields.ts`, `view.ts`, `files.ts`, `photo.ts`, `styles.css`
- `tests/*.test.ts` — 12ファイル(`privacy.test.ts` 含む)、`tests/fixtures/README.md`
- `docs/adr/0001`〜`0005`(0006 は未作成)、`docs/images/`
- `public/mediapipe/` — `models/`(2モデル、コミット対象), `wasm/`(git 管理外), `README.md`, `LICENSE-APACHE-2.0.txt`
- `public/THIRD_PARTY_NOTICES.txt`
- `.github/workflows/ci.yml`, `deploy.yml`

リポジトリ外の検証用具(`/tmp/claude-1000/-home-ko200/6e7c0156-c1b7-4303-9e9f-bf35802300d0/scratchpad/`、セッション限りで消える可能性あり):

- `e2e/` — Playwright スクリプト: `lib.mjs`, `synth.mjs`(合成イラスト生成), `m2`〜`m5.mjs`, `m5fail.mjs`, `m6net.mjs`, `shots.mjs`(README 用スクリーンショット)
- `faces/` — パブリックドメインの NASA ポートレート5枚(コミット禁止)
- `libs/` — ヘッドレス Chromium 用の不足ライブラリ。実行時は `LD_LIBRARY_PATH=<scratchpad>/libs/usr/lib/x86_64-linux-gnu` が必要
- 検証は `vp preview --port 4173 --strictPort` で配信した `http://localhost:4173/` に対して行う(プレビューサーバーは起動したままのはずだが、止まっていれば再起動する)
