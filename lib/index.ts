import { Adapter } from "./adapter";

async function main() {
  const adapter = new Adapter();
  adapter.updateDataSetsOnGoogleSheets();
}

main().catch((e) => console.error(e));
