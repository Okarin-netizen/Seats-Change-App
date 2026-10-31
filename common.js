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

  // "1-3,2-4" のような席のリストを [{row, col}] にする
  parseSeatList(text) {
    return String(text || "").split(",").filter(Boolean).map(k => {
      const [row, col] = k.split("-").map(Number);
      return { row, col };
    }).filter(s => Number.isInteger(s.row) && Number.isInteger(s.col));
  },

  // 生徒用リンクの ?round=2&taken=1-3,2-4&api=... （何回目の調査か・決定済みの席・提出先）
  // second=1：第2希望も集める / hot：前回かぶった席 / prev=5:1-3,6:2-4：出席番号ごとの前回の席
  // maxrow=2&num=5：配慮が必要な生徒の専用リンク（前から2列目までの席だけ選べる）
  surveyFromUrl() {
    const params = new URLSearchParams(location.search);
    const round = parseInt(params.get("round"), 10);
    const maxRow = parseInt(params.get("maxrow"), 10);
    const num = parseInt(params.get("num"), 10);
    const api = params.get("api") || "";
    const prev = new Map();
    for (const item of String(params.get("prev") || "").split(",")) {
      const m = item.match(/^(\d+):(\d+)-(\d+)$/);
      if (m) prev.set(Number(m[1]), this.key(Number(m[2]), Number(m[3])));
    }
    return {
      round: Number.isInteger(round) && round >= 1 ? round : 1,
      taken: this.seatKeySet(params.get("taken")),
      hot: this.seatKeySet(params.get("hot")),
      second: params.get("second") === "1",
      prev,
      maxRow: Number.isInteger(maxRow) && maxRow >= 1 ? maxRow : 0,
      number: Number.isInteger(num) && num >= 1 ? num : 0,
      api: this.isApiUrl(api) ? api : "",
    };
  },

  seatKeySet(text) {
    return new Set(this.parseSeatList(text).map(s => this.key(s.row, s.col)));
  },

  // 左右（通路をはさまない）か前後で隣り合っているか
  isNeighbor(a, b) {
    if (a.row === b.row) return Math.abs(a.col - b.col) === 1;
    if (a.col === b.col) return Math.abs(a.row - b.row) === 1;
    return false;
  },

  // 名簿と照らし合わせるときは空白（全角も）を無視する
  normalizeName(name) {
    return String(name || "").replace(/[\s\u3000]/g, "");
  },

  // 提出先は Google Apps Script のウェブアプリだけを受け付ける
  isApiUrl(url) {
    return /^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(String(url).trim());
  },

  // Google Apps Script へ送る。text/plain にすると事前確認（CORS プリフライト）が起きない
  postToApi(api, data) {
    return this.requestApi(api, { method: "POST", body: JSON.stringify(data) }, "送信に失敗しました");
  },

  async listFromApi(api, key, round) {
    const url = `${api}?action=list&round=${round}&key=${encodeURIComponent(key)}`;
    const body = await this.requestApi(url, {}, "読み込みに失敗しました");
    if (!Array.isArray(body.submissions)) throw new Error("読み込みに失敗しました");
    return body.submissions;
  },

  // 返事が JSON でないとき（デプロイの設定ミスでログイン画面が返るなど）もわかるメッセージにする
  async requestApi(url, options, failMessage) {
    const res = await fetch(url, options);
    let body;
    try {
      body = await res.json();
    } catch (e) {
      throw new Error(`${failMessage}（返事が読めませんでした）`);
    }
    if (!body || !body.ok) throw new Error((body && body.error) || failMessage);
    return body;
  },

  // ファイルとしてダウンロードさせる
  downloadBlob(blob, filename) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  },

  // type は "ok" / "error" / 省略
  showMessage(el, text, type) {
    el.textContent = text;
    el.className = "message " + (type || "");
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
