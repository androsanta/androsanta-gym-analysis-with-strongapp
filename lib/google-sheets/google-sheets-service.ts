import { createAuth, OAuth2Client } from "./authorizer";
import { google } from "googleapis";
import { config } from "../config";
import { ExerciseAndMuscleGroupRawData } from "./types";

export class GoogleSheetsService {
  private auth: OAuth2Client;
  private sheetId = config.SHEET_ID;
  private workoutSheetName = config.WORKOUT_SHEET_NAME;
  private dataSet1SheetName = config.DATASET1_SHEET_NAME;
  private dataSet2SheetName = config.DATASET2_SHEET_NAME;

  private async getSpreadSheets() {
    if (!this.auth) {
      console.log("[GoogleSheetsService] creating auth");
      this.auth = await createAuth();
      console.log("[GoogleSheetsService] auth created");
    }

    return google.sheets({ version: "v4", auth: this.auth }).spreadsheets;
  }

  public async getExerciseAndMuscleGroupRawData(): Promise<ExerciseAndMuscleGroupRawData> {
    const spreadSheets = await this.getSpreadSheets();

    const exercisesResponse = await spreadSheets.values.get({
      spreadsheetId: this.sheetId,
      range: `'${this.workoutSheetName}'!C2:C`,
    });
    if (!exercisesResponse.data.values?.flat().length) {
      throw new Error(
        "[GoogleSheetsService] cannot retrieve exercises and muscle group raw data. Status " +
          exercisesResponse.status
      );
    }

    const mainMuscleGroupResponse = await spreadSheets.values.get({
      spreadsheetId: this.sheetId,
      range: `'${this.workoutSheetName}'!F2:F`,
    });
    if (!mainMuscleGroupResponse.data.values?.flat().length) {
      throw new Error(
        "[GoogleSheetsService] cannot retrieve exercises and muscle group raw data. Status " +
          mainMuscleGroupResponse.status
      );
    }

    const secondaryMuscleGroupResponse = await spreadSheets.values.get({
      spreadsheetId: this.sheetId,
      range: `'${this.workoutSheetName}'!G2:G`,
    });
    if (!secondaryMuscleGroupResponse.data.values?.flat().length) {
      throw new Error(
        "[GoogleSheetsService] cannot retrieve exercises and muscle group raw data. Status " +
          secondaryMuscleGroupResponse.status
      );
    }

    return {
      exercisesName: exercisesResponse.data.values?.flat(),
      mainMuscleGroups: mainMuscleGroupResponse.data.values
        ?.flat()
        .map((m) => m.split(",").map((m) => m.trim())),
      secondaryMuscleGroups: secondaryMuscleGroupResponse.data.values
        ?.flat()
        .map((m) => m.split(",").map((m) => m.trim())),
    };
  }

  public async writeDataSet1(
    valuesWithoutHeader: [string, string, number, number, number][]
  ) {
    const spreadSheets = await this.getSpreadSheets();

    const clearResult = await spreadSheets.values.clear({
      spreadsheetId: this.sheetId,
      range: `'${this.dataSet1SheetName}'!A2:E`,
    });

    if (clearResult.status !== 200) {
      throw new Error("[GoogleSheetsService] Error on writeDataSet1: clear");
    }

    const result = await spreadSheets.values.append({
      spreadsheetId: this.sheetId,
      range: `'${this.dataSet1SheetName}'!A2:E`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: valuesWithoutHeader },
    });

    if (result.status !== 200) {
      throw new Error("[GoogleSheetsService] Error on writeDataSet1: write");
    }
  }

  public async writeDataSet2(valuesWithHeader: (string | number)[][]) {
    const spreadSheets = await this.getSpreadSheets();

    const clearResult = await spreadSheets.values.clear({
      spreadsheetId: this.sheetId,
      range: `'${this.dataSet2SheetName}'!A:AA`,
    });

    if (clearResult.status !== 200) {
      throw new Error("[GoogleSheetsService] Error on writeDataSet2: clear");
    }

    const result = await spreadSheets.values.append({
      spreadsheetId: this.sheetId,
      range: `'${this.dataSet2SheetName}'!A:AA`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: valuesWithHeader },
    });

    if (result.status !== 200) {
      throw new Error("[GoogleSheetsService] Error on writeDataSet2: write");
    }
  }
}
