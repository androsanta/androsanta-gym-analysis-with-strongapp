import { readFileSync } from "fs";
import { parse } from "csv-parse/sync";
import _ from "lodash";
import * as dateFns from "date-fns";
import path from "path";
import { isNumberInString } from "../utils";
import { createAuth } from "../google-sheets/authorizer";
import { google } from "googleapis";
import { config } from "../config";

export class CsvParser {
  // HEADER
  private static EXPECTED_HEADER = [
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

  private checkHeader(csvFileStringCleaned: string) {
    // HEADER CHECK
    const parseResultToCheckHeader: String[][] = parse(csvFileStringCleaned, {
      delimiter: ";",
    });
    if (!_.isEqual(CsvParser.EXPECTED_HEADER, parseResultToCheckHeader[0])) {
      throw new Error("Header is different from expected!");
    }
  }

  public createDataSetsFromCsvString(csvString: string) {
    console.log("[CsvParser] start");

    // const csvFileString = readFileSync(
    //   path.resolve(__dirname, "../strong_final_export.csv")
    // ).toString();
    const csvFileStringCleaned = csvString.replaceAll(`1'30"`, `1'30`);
    this.checkHeader(csvFileStringCleaned);

    // PARSE
    type Header = (typeof CsvParser.EXPECTED_HEADER)[number];
    const parseResult: Record<Header, string>[] = parse(csvFileStringCleaned, {
      delimiter: ";",
      columns: true,
    });

    // COMPUTING
    console.log("Total number of rows:", parseResult.length);
    const minDate = dateFns.parse(
      "2026-01-01 00:00:00",
      "yyyy-MM-dd HH:mm:ss",
      new Date()
    );
    const filtered = parseResult
      .map((result) => {
        // 2020-09-14 16:08:49
        const date = dateFns.parse(
          result.Date,
          "yyyy-MM-dd HH:mm:ss",
          new Date()
        );
        return { ...result, Date: date };
      })
      .filter((result) => {
        return dateFns.isAfter(result.Date, minDate);
      });

    console.log("Number of rows (filtered):", filtered.length);

    const allExercises = [
      ...new Set(filtered.map((result) => result["Exercise Name"])),
    ];
    console.log("Number of exercises (filtered):", allExercises.length);

    type WorkoutsObject = {
      [key: string]: {
        date: Date;
        exercises: Record<string, [number, number][]>;
      };
    };
    const workoutsObject = filtered.reduce((acc, curr) => {
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

    // console.log(workoutsObject);

    // @TODO dall'oggetto workouts, iterare due volte per:
    // - DONE generare lista righe per Data set 1 - Date	Exercise	Weight	Volume#1	Volume#2
    // - generare lista righe per Data set 2 - Date	<exercise1> <exercise2> <exercise3> ...

    type DataSet1RowObj = {
      date: string;
      exercise: string;
      weight: number;
      volume1: number;
      volume2: number;
    };
    const dataSet1: DataSet1RowObj[] = Object.values(workoutsObject).flatMap(
      (workoutObj) => {
        const workoutDate = dateFns.format(workoutObj.date, "dd/MM/yyyy");
        return Object.entries(workoutObj.exercises).map(
          ([exerciseName, exerciseDetails]) => {
            return {
              date: workoutDate,
              exercise: exerciseName,
              // use weight of last set
              weight: exerciseDetails[exerciseDetails.length - 1][1],
              volume1: exerciseDetails.length,
              volume2: exerciseDetails.reduce((acc, curr) => {
                // use fake weight of 1 if real weight is 0 (i.e. exercise has only bodyweight)
                return acc + curr[0] * Math.max(curr[1], 1);
              }, 0),
            } as DataSet1RowObj;
          }
        );
      }
    );

    console.log("data set 1", dataSet1.length);

    type DataSet2Obj = {
      [date: string]: { [exerciseName: string]: number };
    };
    // const dataSet2: DataSet2Obj = null;
    // const auth = await createAuth();
    // const sheets = google.sheets({ version: "v4", auth });

    // const gymSheet = await sheets.spreadsheets.values.get({
    //   spreadsheetId: config.SHEET_ID,
    //   // range: "Analisi!C2:C",
    // });

    // console.log("here", gymSheet);
    //@TODO generare nuove credentials oauth

    // si può fare sia con questo codice mettendo forEach
    // sia con un reduce
    // in ogni caso serve una mappa per associare exercizio a gruppo muscolare
    // const dataSet2 = Object.values(workoutsObject).flatMap((workoutObj) => {
    //   // @TODO format in modo da avere il giorno di inizio settimana (LUNEDI)
    //   const workoutDate = dateFns.format(workoutObj.date, "dd/MM/yyyy");
    //   // const row: DataSet2RowObj = {
    //   //   date: workoutDate,
    //   //   values:
    //   // }
    //   return Object.entries(workoutObj.exercises).map(
    //     ([exerciseName, exerciseDetails]) => {
    //       return {
    //         date: workoutDate,
    //         values: exerciseDetails.reduce((acc, curr) => {
    //           // use fake weight of 1 if real weight is 0 (i.e. exercise has only bodyweight)
    //           return acc + curr[0] * Math.max(curr[1], 1);
    //         }, 0),
    //       } as DataSet2RowObj;
    //     }
    //   );
    // });

    // @TODO gestire associazione esercizio <--> gruppo muscolare

    // const allExercises = [
    //   ...new Set(filtered.map((result) => result["Exercise Name"])),
    // ];
    // console.log(allExercises);

    // todo
    // raggruppare per data (reduce)
    // calcolare il volume per gruppo muscolare per settimana (excel?)

    // excel -> grafico a linee (una linea per ogni gruppo muscolare), che mostra l'andamento settimanale del volume di allenamento

    console.log("[CsvParser] end");
  }
}
