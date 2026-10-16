// 生徒用・教員用で共通の処理
const SeatApp = {
  APP_ID: "seats-change-app",
  VERSION: 1,
  DEFAULT_ROWS: 6,
  DEFAULT_COLS: 6,
  MAX_SIZE: 12,
  RANK_LABELS: ["第1希望", "第2希望", "第3希望"],

  clampSize(value, fallback) {
    const n = parseInt(value, 10);
    if (!Number.isFinite(n) || n < 1) return fallback;
    return Math.min(n, this.MAX_SIZE);
  },

  // URL の ?rows=6&cols=6 から座席表のサイズを読む
  sizeFromUrl() {
    const params = new URLSearchParams(location.search);
    return {
      rows: this.clampSize(params.get("rows"), this.DEFAULT_ROWS),
      cols: this.clampSize(params.get("cols"), this.DEFAULT_COLS),
    };
  },

  // row, col は 1 始まり。row=1 が教卓側（前）、col=1 が教室の左
  seatLabel(row, col) {
    return `前から${row}列目・左から${col}番目`;
  },

  seatShortLabel(row, col) {
    return `${row}-${col}`;
  },
};
