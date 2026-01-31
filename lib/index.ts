import { StrongService } from "./strong-service";
import { CsvParser } from "./csv-parser";

async function main() {
  const strongService = new StrongService();
  const csvStringForWorkoutLogs =
    await strongService.generateCsvOfWorkoutLogs();

  const csvParser = new CsvParser();
  csvParser.createDataSetsFromCsvString(csvStringForWorkoutLogs);
}

main().catch((e) => console.error(e));
