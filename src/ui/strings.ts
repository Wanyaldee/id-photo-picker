import type { ScoringConfig } from "../scoring/config";
import type { ExclusionKey, ItemKey, ReasonKey } from "../scoring/score";
import type { FieldGroup } from "./settingsFields";
import type { FilterKey, SortKey } from "./view";

// All user-facing text lives here so an English version only needs a second
// object of the same shape (CLAUDE.md §4).

const items: Record<ItemKey, string> = {
  focus: "ピント",
  eyes: "目",
  mouth: "口・表情",
  pose: "正面度",
  exposure: "露出",
  composition: "構図",
  resolution: "解像度",
};

const reasons: Record<ReasonKey, string> = {
  blurry: "ピントが甘い",
  eyesClosed: "目が閉じている",
  mouthOpen: "口が開いている",
  strongSmile: "笑顔が強い",
  turnedSideways: "顔が横を向いている",
  lookingUpOrDown: "顔が上下を向いている",
  headTilted: "顔が傾いている",
  tooDark: "顔が暗い",
  tooBright: "顔が明るすぎる",
  overexposed: "白飛びしている",
  underexposed: "黒つぶれしている",
  unevenLight: "片側に影がある",
  notEnoughMargin: "余白が足りない",
  lowResolution: "解像度が足りない",
};

const exclusions: Record<ExclusionKey, string> = {
  noFace: "顔を検出できませんでした",
  multipleFaces: "複数の顔が写っています",
};

const sorts: Record<SortKey, string> = {
  score: "スコアが高い順",
  name: "ファイル名順",
  loaded: "読み込んだ順",
};

const filters: Record<FilterKey, string> = {
  all: "すべて",
  candidates: "候補のみ(除外を隠す)",
  excluded: "除外された写真のみ",
  noFace: "除外: 顔を検出できない",
  multipleFaces: "除外: 複数の顔",
};

const settingGroups: Record<FieldGroup["id"], string> = {
  weights: "重み(総合スコアへの効き方)",
  focus: "ピント",
  eyes: "目",
  mouth: "口・表情",
  pose: "正面度",
  exposure: "露出",
  framing: "構図・解像度・タグ",
};

const settingFields: Record<keyof ScoringConfig, string> = {
  weightFocus: "ピントの重み",
  weightEyes: "目の重み",
  weightMouth: "口・表情の重み",
  weightPose: "正面度の重み",
  weightExposure: "露出の重み",
  weightComposition: "構図の重み",
  weightResolution: "解像度の重み",
  focusSharp: "この鮮明度以上で満点",
  focusBlurry: "この鮮明度以下で0点",
  eyeBlinkOpen: "まばたき度がこれ以下で満点",
  eyeBlinkClosed: "まばたき度がこれ以上で0点",
  eyesClosedMultiplier: "目が閉じた写真の総合スコア倍率",
  jawClosed: "口の開きがこれ以下で満点",
  jawOpen: "口の開きがこれ以上で0点",
  smileAllowed: "笑顔がこれ以下で満点",
  smileTooStrong: "笑顔がこれ以上で0点",
  poseGoodDeg: "顔の向きがこの角度以内で満点(度)",
  poseBadDeg: "顔の向きがこの角度以上で0点(度)",
  lumaTooDark: "顔の明るさがこれ以下で0点",
  lumaGoodMin: "適正な明るさの下限",
  lumaGoodMax: "適正な明るさの上限",
  lumaTooBright: "顔の明るさがこれ以上で0点",
  clippedAllowed: "白飛び・黒つぶれの許容割合",
  clippedBad: "白飛び・黒つぶれが0点になる割合",
  sideImbalanceAllowed: "左右の明るさの差の許容値",
  sideImbalanceBad: "左右の明るさの差が0点になる値",
  cropFitBad: "切り出し枠が写真に収まる割合がこれ以下で0点",
  resolutionBadRatio: "必要な解像度に対する比がこれ以下で0点",
  tagThreshold: "項目の点がこれ未満なら減点理由のタグを出す",
};

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
  close: "閉じる",

  progress: (done: number, total: number) => `読み込み・解析中… ${done} / ${total} 枚`,
  photoCount: (shown: number, total: number) =>
    shown === total ? `${total} 枚` : `${total} 枚中 ${shown} 枚を表示`,
  cancelled: (dropped: number) => `中断しました。未処理の ${dropped} 枚は一覧から外しました。`,
  noImagesFound: "読み込める写真が見つかりませんでした(JPEG / PNG / WebP に対応)。",
  heicSkipped: (count: number) =>
    `HEIC 形式の ${count} 枚は読み込めません。事前に JPEG へ変換してください。`,
  otherSkipped: (count: number) => `写真ではないファイル ${count} 個は読み飛ばしました。`,
  dropFailed: (detail: string) => `ドロップされたファイルを読み取れませんでした: ${detail}`,
  settingsNotSaved:
    "このブラウザでは設定を保存できませんでした。変更はページを閉じると元に戻ります。",

  loading: "解析中",
  decodeFailed: "画像を開けませんでした(破損しているか、対応していない形式です)",
  analysisFailed: "顔の解析に失敗しました",
  excludedLabel: "除外",
  multipleFacesCount: (count: number) => `複数の顔が写っています(${count} 人)`,
  noReasons: "減点なし",

  sortLabel: "並べ替え",
  filterLabel: "表示",
  minScoreLabel: (value: number) => `最低スコア: ${value}`,
  nothingToShow: "この条件に合う写真はありません。",
  finalCheckNote: "スコアは目安です。最後は必ず自分の目で確認して選んでください。",

  detailTitle: "詳細",
  totalScore: "総合スコア",
  itemScores: "項目別スコア",
  itemWeight: (weight: number) => `重み ${weight}`,
  measurements: "測定値",
  imageSize: (width: number, height: number) => `元画像 ${width} × ${height} px`,
  cropSize: (width: number, height: number) => `切り出し枠 ${width} × ${height} px`,
  cropHelp:
    "枠をドラッグして位置を、スライダーかマウスホイールで大きさを調整します。枠の中の点線は、上が頭頂、下があごを合わせる目安です。",
  cropFrameLabel: "切り出し枠(矢印キーで移動、+ と - で大きさを変更)",
  cropSizeSlider: "枠の大きさ",
  cropReset: "自動の位置に戻す",

  exportTitle: "書き出し",
  exportPreviewLabel: "書き出しのプレビュー",
  exportSizeLegend: "サイズ",
  exportSizePrint: "354 × 472 px(30 × 40 mm・300 dpi 相当)",
  exportSizeLarge: (width: number, height: number) => `大きいサイズ ${width} × ${height} px`,
  exportFormatLegend: "形式",
  exportButton: (fileName: string) => `書き出す(${fileName})`,
  exporting: "書き出し中…",
  exportFailed: (detail: string) => `書き出しに失敗しました: ${detail}`,
  exportUpscaleWarning: (width: number) =>
    `枠の幅が ${width} px しかなく、354 px に引き伸ばされます。ぼやけて見えることがあります。`,
  measure: {
    sharpness: "鮮明度(ラプラシアン分散)",
    eyeBlink: "まばたき度",
    jawOpen: "口の開き",
    smile: "笑顔",
    yaw: "左右の向き(度)",
    pitch: "上下の向き(度)",
    roll: "傾き(度)",
    meanLuma: "顔の明るさ(0–255)",
    overexposed: "白飛びの割合",
    underexposed: "黒つぶれの割合",
    sideImbalance: "左右の明るさの差",
  },

  settingsTitle: "採点の設定(重みと閾値)",
  settingsReset: "初期値に戻す",
  settingsNote: "変更はすぐ一覧に反映され、このブラウザに保存されます(保存するのは数値だけです)。",

  items,
  reasons,
  exclusions,
  sorts,
  filters,
  settingGroups,
  settingFields,
} as const;
