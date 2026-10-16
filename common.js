// 生徒用・教員用で共通の処理
//
// 座席の配置（layout）は { rows, cols, off } で表す。
// row, col は 1 始まりで、row=1 が教卓側（前）、col=1 が教室の左。
// off は席を置かないマス（通路・空き）の "row-col" の Set。
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

  key(row, col) {
    return `${row}-${col}`;
  },

  makeLayout(rows, cols, off) {
    const layout = {
      rows: this.clampSize(rows, this.DEFAULT_ROWS),
      cols: this.clampSize(cols, this.DEFAULT_COLS),
      off: new Set(),
    };
    for (const k of off || []) {
      const [r, c] = String(k).split("-").map(Number);
      if (r >= 1 && r <= layout.rows && c >= 1 && c <= layout.cols) layout.off.add(this.key(r, c));
    }
    return layout;
  },

  // URL の ?rows=6&cols=6&off=1-3,2-3 から座席の配置を読む
  layoutFromUrl() {
    const params = new URLSearchParams(location.search);
    if (!params.has("rows") && !params.has("cols") && !params.has("off")) return null;
    const off = (params.get("off") || "").split(",").filter(Boolean);
    return this.makeLayout(params.get("rows"), params.get("cols"), off);
  },

  layoutToQuery(layout) {
    const params = new URLSearchParams({ rows: layout.rows, cols: layout.cols });
    let q = params.toString();
    if (layout.off.size) q += "&off=" + [...layout.off].join(",");
    return q;
  },

  isSeat(layout, row, col) {
    return row >= 1 && row <= layout.rows && col >= 1 && col <= layout.cols &&
      !layout.off.has(this.key(row, col));
  },

  // 通路を数えずに、その列で左から何番目の席か
  seatIndexInRow(layout, row, col) {
    let n = 0;
    for (let c = 1; c <= col; c++) {
      if (!layout.off.has(this.key(row, c))) n++;
    }
    return n;
  },

  seatLabel(layout, row, col) {
    return `前から${row}列目・左から${this.seatIndexInRow(layout, row, col)}番目`;
  },

  seatShortLabel(layout, row, col) {
    return `${row}-${this.seatIndexInRow(layout, row, col)}`;
  },
};
