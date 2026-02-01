import { parse } from "csv-parse/sync";
import _ from "lodash";
import * as dateFns from "date-fns";
import { isNumberInString } from "../utils";
import { CsvRecord, WorkoutsObject } from "./types";

export class CsvParser {
  // HEADER
  public static EXPECTED_HEADER = [
    "Workout #",
    "Date",
    "Workout Name",
    "Duration (sec)",
    "Exercise Name",
    "Set Order",
    "Weight (kg)",
    "Reps",
    "RPE",
    "Distance (meters)",
    "Seconds",
    "Notes",
    "Workout Notes",
  ] as const;

  private static minDate = dateFns.parse(
    "2026-01-01 00:00:00",
    "yyyy-MM-dd HH:mm:ss",
    new Date()
  );

  private checkHeader(csvString: string) {
    // HEADER CHECK
    const parseResultToCheckHeader: String[][] = parse(csvString, {
      delimiter: ";",
    });
    if (!_.isEqual(CsvParser.EXPECTED_HEADER, parseResultToCheckHeader[0])) {
      throw new Error("Header is different from expected!");
    }
  }

  private parseCsv(csvString: string): CsvRecord[] {
    const parseResult: CsvRecord[] = parse(csvString, {
      delimiter: ";",
      columns: true,
    });
    console.log("[CsvParser] Total number of rows:", parseResult.length);
    return parseResult;
  }

  private getExerciseList(records: CsvRecord[]): string[] {
    const allExercises = [
      ...new Set(records.map((result) => result["Exercise Name"])),
    ];
    console.log(
      "[CsvParser] Number of exercises (filtered):",
      allExercises.length
    );
    return allExercises;
  }

  private filterCsvEntriesByDate(
    records: CsvRecord[],
    minDate: Date
  ): CsvRecord[] {
    const filtered = records.filter((result) => {
      return dateFns.isAfter(result.Date, minDate);
    });
    console.log("[CsvParser] Number of rows (filtered):", filtered.length);
    return filtered;
  }

  private createWorkoutsObject(records: CsvRecord[]): WorkoutsObject {
    return records
      .map((result) => {
        // 2020-09-14 16:08:49
        const date = dateFns.parse(
          result.Date,
          "yyyy-MM-dd HH:mm:ss",
          new Date()
        );
        return { ...result, Date: date };
      })
      .reduce((acc, curr) => {
        if (!isNumberInString(curr["Set Order"])) {
          return acc;
        }

        const workoutNumber = curr["Workout #"];
        const exerciseName = curr["Exercise Name"];

        if (!acc[workoutNumber]) {
          acc[workoutNumber] = { date: curr.Date, exercises: {} };
        }

        const exercisesObj = acc[workoutNumber].exercises;

        if (!exercisesObj[exerciseName]) {
          exercisesObj[exerciseName] = [];
        }

        const exerciseList = exercisesObj[exerciseName];
        try {
          exerciseList.push([Number(curr.Reps), Number(curr["Weight (kg)"])]);
        } catch (e) {
          console.error("Error handling row", curr);
        }

        return acc;
      }, {} as WorkoutsObject);
  }

  public getWorkoutsObject(csvString: string): WorkoutsObject {
    console.log("[CsvParser] start");

    // This line fix format for this specific case -> 1'30"
    const csvFileStringCleaned = csvString.replaceAll(`1'30"`, `1'30`);

    this.checkHeader(csvFileStringCleaned);
    const records = this.parseCsv(csvFileStringCleaned);
    const recordsFiltered = this.filterCsvEntriesByDate(
      records,
      CsvParser.minDate
    );
    const exercises = this.getExerciseList(recordsFiltered);
    const workoutsObject = this.createWorkoutsObject(recordsFiltered);

    console.log("[CsvParser] end");
    return workoutsObject;
  }
}
