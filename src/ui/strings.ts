// All user-facing text lives here so an English version only needs a second
// object of the same shape (CLAUDE.md §4).
export const strings = {
  appTitle: "証明写真セレクター",
  appLead: "たくさんの写真から、証明写真に向く候補を絞り込みます。",
  privacyNote: "写真はこの端末の外に出ません。すべてブラウザの中で処理します。",
  usageNote:
    "履歴書などの用途向けです。パスポートやマイナンバーカードなど、加工が禁止される用途には使えません。",

  dropHint: "ここに写真またはフォルダをドラッグ&ドロップ",
  dropFormats: "JPEG / PNG / WebP に対応しています",
  chooseFiles: "ファイルを選ぶ",
  chooseFolder: "フォルダを選ぶ",
  clearAll: "すべて消す",
  cancel: "中断",

  progress: (done: number, total: number) => `読み込み中… ${done} / ${total} 枚`,
  photoCount: (count: number) => `${count} 枚`,
  cancelled: (dropped: number) => `中断しました。未処理の ${dropped} 枚は一覧から外しました。`,
  noImagesFound: "読み込める写真が見つかりませんでした(JPEG / PNG / WebP に対応)。",
  heicSkipped: (count: number) =>
    `HEIC 形式の ${count} 枚は読み込めません。事前に JPEG へ変換してください。`,
  otherSkipped: (count: number) => `写真ではないファイル ${count} 個は読み飛ばしました。`,
  dropFailed: (detail: string) => `ドロップされたファイルを読み取れませんでした: ${detail}`,

  loading: "読み込み中",
  decodeFailed: "画像を開けませんでした(破損しているか、対応していない形式です)",
} as const;
