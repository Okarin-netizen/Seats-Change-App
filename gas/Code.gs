/**
 * 席替えアンケート：提出を受け取って Google スプレッドシートに保存するプログラム
 *
 * 使い方は README の「Google スプレッドシートで提出を受け取る」を見てください。
 * スプレッドシートの「拡張機能 → Apps Script」にこのファイルの中身を貼り付けて、
 * 下の TEACHER_KEY を自分だけが知っている合言葉に変えてから「ウェブアプリ」としてデプロイします。
 */

// 教員用ページから提出一覧を読むときの合言葉（生徒には教えないでください）
const TEACHER_KEY = "ここを合言葉に変える";

const SHEET_NAME = "提出";
const HEADER = ["受信日時", "回", "出席番号", "名前", "前から(列)", "左から(マス)", "提出日時"];

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

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    // 名前の先頭が = などでも数式にならないよう ' を付ける
    const safeName = /^[=+\-@]/.test(name) ? "'" + name : name;
    // 提出日時は日付に自動変換されないよう文字列のまま保存する
    const submittedAt = String(data.submittedAt || "").slice(0, 40);
    getSheet_().appendRow([new Date(), round, number, safeName, row, col, submittedAt ? "'" + submittedAt : ""]);
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
  if (p.key !== TEACHER_KEY) return json_({ ok: false, error: "合言葉が違います" });

  const round = toInt_(p.round, 1, 99);
  const values = getSheet_().getDataRange().getValues().slice(1);
  const submissions = values
    .filter(v => !round || Number(v[1]) === round)
    .map(v => ({
      round: Number(v[1]),
      number: Number(v[2]),
      name: String(v[3]).replace(/^'/, ""),
      choice: { row: Number(v[4]), col: Number(v[5]) },
      submittedAt: v[6] instanceof Date ? v[6].toISOString()
        : v[6] ? String(v[6]) : new Date(v[0]).toISOString(),
    }));
  return json_({ ok: true, submissions: submissions });
}
