import cron from "node-cron";
import { Adapter } from "../adapter";

console.log("[cron] init");

// “At 11:00 on Monday, Tuesday, Thursday, and Friday.”
// cron.schedule("0 11 * * 1,2,4,5", async () => {
cron.schedule("* * * * *", async () => {
  try {
    console.log("[cron] start");
    const adapter = new Adapter();
    await adapter.updateDataSetsOnGoogleSheets();
    console.log("[cron] end");
  } catch (e) {
    console.error("[cron] error");
    console.error(e);
  }
});
