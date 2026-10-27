/**
 * 席替えアンケート：提出を受け取って Google スプレッドシートに保存するプログラム
 *
 * 使い方は README の「Google スプレッドシートで提出を受け取る」を見てください。
 * スプレッドシートの「拡張機能 → Apps Script」にこのファイルの中身を貼り付けて、
 * 下の TEACHER_KEY を自分だけが知っている合言葉に変えてから「ウェブアプリ」としてデプロイします。
 */

// 教員用ページから提出一覧を読むときの合言葉（生徒には教えないでください）
const TEACHER_KEY = "ここを合言葉に変える";
// 書き換え忘れの確認用。上の行を一括置換したときに巻き込まれないよう、分けて書いている
const DEFAULT_TEACHER_KEY = "ここを" + "合言葉に変える";

const SHEET_NAME = "提出";
// 第2希望の2列は後から足したので最後に置く（前からあるシートもそのまま使える）
const HEADER = ["受信日時", "回", "出席番号", "名前", "前から(列)", "左から(マス)", "提出日時", "第2希望 前から(列)", "第2希望 左から(マス)"];

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADER);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function toInt_(v, min, max) {
  const n = Number(v);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

// 生徒用ページからの提出
function doPost(e) {
  let data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    data = null;
  }
  if (!data || typeof data !== "object") {
    return json_({ ok: false, error: "データが読めませんでした" });
  }
  const round = toInt_(data.round, 1, 99);
  const number = toInt_(data.number, 1, 999);
  const name = typeof data.name === "string" ? data.name.trim().slice(0, 50) : "";
  const row = data.choice && toInt_(data.choice.row, 1, 12);
  const col = data.choice && toInt_(data.choice.col, 1, 12);
  if (!round || !number || !name || !row || !col) {
    return json_({ ok: false, error: "入力が足りません" });
  }
  // 第2希望は任意
  const row2 = data.choice2 && toInt_(data.choice2.row, 1, 12);
  const col2 = data.choice2 && toInt_(data.choice2.col, 1, 12);

  // 混み合って順番待ちが長いときは、エラーの JSON を返して生徒に送り直してもらう
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    return json_({ ok: false, error: "混み合っています。少し待ってからもう一度送ってください" });
  }
  try {
    // 名前の先頭が = などでも数式にならないよう ' を付ける
    const safeName = /^[=+\-@]/.test(name) ? "'" + name : name;
    // 提出日時は日付に自動変換されないよう文字列のまま保存する
    const submittedAt = String(data.submittedAt || "").slice(0, 40);
    getSheet_().appendRow([new Date(), round, number, safeName, row, col, submittedAt ? "'" + submittedAt : "",
      row2 && col2 ? row2 : "", row2 && col2 ? col2 : ""]);
  } finally {
    lock.releaseLock();
  }
  return json_({ ok: true });
}

// 教員用ページからの読み込み：?action=list&round=1&key=合言葉
function doGet(e) {
  const p = e.parameter || {};
  if (p.action === "ping") return json_({ ok: true });
  if (p.action !== "list") return json_({ ok: false, error: "不明な操作です" });
  // 合言葉が初期値のままだと、README を読んだ人なら誰でも提出一覧を見られてしまう
  if (TEACHER_KEY === DEFAULT_TEACHER_KEY) return json_({ ok: false, error: "TEACHER_KEY が初期値のままです" });
  if (p.key !== TEACHER_KEY) return json_({ ok: false, error: "合言葉が違います" });

  const round = toInt_(p.round, 1, 99);
  const values = getSheet_().getDataRange().getValues().slice(1);
  const submissions = values
    .filter(v => !round || Number(v[1]) === round)
    .map(v => ({
      choice2: v[7] && v[8] ? { row: Number(v[7]), col: Number(v[8]) } : undefined,
      round: Number(v[1]),
      number: Number(v[2]),
      name: String(v[3]).replace(/^'/, ""),
      choice: { row: Number(v[4]), col: Number(v[5]) },
      submittedAt: v[6] instanceof Date ? v[6].toISOString()
        : v[6] ? String(v[6]) : new Date(v[0]).toISOString(),
    }));
  return json_({ ok: true, submissions: submissions });
}
