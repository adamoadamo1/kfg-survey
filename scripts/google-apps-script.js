// ============================================================
// GOOGLE APPS SCRIPT — KFG Positioning Survey
// ============================================================
//
// SETUP:
// 1. Create a new Google Sheet
// 2. Create one tab: "Responses"
//
// 3. "Responses" tab headers (Row 1):
//    A: timestamp | B: name | C: role | D: q1_what_is_kfg |
//    E: q2_who_matters | F: q3_what_replaces | G: q4_whats_different |
//    H: q5_ten_second_belief
//
// 4. Go to Extensions > Apps Script
// 5. Paste this entire script
// 6. Click Deploy > New Deployment
// 7. Set type to "Web app"
// 8. Set "Execute as" to your Google account
// 9. Set "Who has access" to "Anyone"
// 10. Deploy and copy the URL
// 11. Set that URL as GOOGLE_SCRIPT_URL in Vercel env vars
// ============================================================

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName("Responses");

    sheet.appendRow([
      new Date().toISOString(),
      data.name || "",
      data.role || "",
      data.q1 || "",
      data.q2 || "",
      data.q3 || "",
      data.q4 || "",
      data.q5 || "",
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ status: "success" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: "error", message: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: "ok", message: "KFG Survey endpoint is live." }))
    .setMimeType(ContentService.MimeType.JSON);
}
