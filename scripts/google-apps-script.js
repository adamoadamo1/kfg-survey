// ============================================================
// GOOGLE APPS SCRIPT — KFG Positioning Survey
// ============================================================
//
// SETUP:
// 1. Create a new Google Sheet
// 2. Create two tabs: "Responses" and "Transcripts"
//
// 3. "Responses" tab headers (Row 1):
//    A: timestamp | B: name | C: role | D: q1_core | E: q1_stories |
//    F: q1_language | G: q1_confirmed | H: q2_core | I: q2_stories |
//    J: q2_language | K: q2_confirmed | L: q3_core | M: q3_stories |
//    N: q3_language | O: q3_confirmed | P: q4_core | Q: q4_stories |
//    R: q4_language | S: q4_confirmed | T: q5_core | U: q5_stories |
//    V: q5_language | W: q5_confirmed | X: completed
//
// 4. "Transcripts" tab headers (Row 1):
//    A: timestamp | B: name | C: role | D: question | E: question_title |
//    F: transcript | G: exchange_count
//
// 5. Go to Extensions > Apps Script
// 6. Paste this entire script
// 7. Click Deploy > New Deployment
// 8. Set type to "Web app"
// 9. Set "Execute as" to your Google account
// 10. Set "Who has access" to "Anyone"
// 11. Deploy and copy the URL
// 12. Set that URL as GOOGLE_SCRIPT_URL in Vercel env vars
// ============================================================

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    if (data.type === "response") {
      var sheet = ss.getSheetByName("Responses");
      sheet.appendRow([
        new Date().toISOString(),
        data.name || "",
        data.role || "",
        data.q1_core || "",
        data.q1_stories || "",
        data.q1_language || "",
        data.q1_confirmed || "",
        data.q2_core || "",
        data.q2_stories || "",
        data.q2_language || "",
        data.q2_confirmed || "",
        data.q3_core || "",
        data.q3_stories || "",
        data.q3_language || "",
        data.q3_confirmed || "",
        data.q4_core || "",
        data.q4_stories || "",
        data.q4_language || "",
        data.q4_confirmed || "",
        data.q5_core || "",
        data.q5_stories || "",
        data.q5_language || "",
        data.q5_confirmed || "",
        data.completed || false,
      ]);
    }

    else if (data.type === "transcript") {
      var sheet = ss.getSheetByName("Transcripts");
      sheet.appendRow([
        new Date().toISOString(),
        data.name || "",
        data.role || "",
        data.question || "",
        data.question_title || "",
        data.transcript || "",
        data.exchange_count || 0,
      ]);
    }

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
