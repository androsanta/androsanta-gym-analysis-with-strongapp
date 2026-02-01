import axios from "axios";
import * as dateFns from "date-fns";
import { config } from "../config";
import {
  Cell,
  CellType,
  Log,
  LoginResponse,
  LogsAndMeasurements,
  LogType,
  Measurement,
  PurpleCellSetGroup,
  UserDetailsResponse,
} from "./types";

import fs from "fs";
import path from "path";

axios.defaults.withCredentials = true;

const basePath = config.STRONG_BASE_PATH;

const API = {
  login: "/auth/login",
  refresh: "/auth/login/refresh",
  userDetails: (userId: string) => `/api/users/${userId}`,
};

export class StrongService {
  private accessToken?: string;
  private refreshToken?: string;
  private tokenExpiration?: Date;

  private userId?: string;

  private get defaultHeaders(): Record<string, string> {
    const map: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "applicatoin/json",
      "User-Agent": "Strong Android",
      "X-Client-Build": "601049",
      "X-Client-Platform": "android",
    };

    if (this.accessToken) {
      map["Authorization"] = "Bearer " + this.accessToken;
    }

    return map;
  }

  private async loginAPI() {
    console.log("[API] loginAPI - start");
    const res = await axios({
      method: "post",
      url: basePath + API.login,
      headers: this.defaultHeaders,
      data: {
        usernameOrEmail: config.STRONG_USERNAME,
        password: config.STRONG_PASSWORD,
      },
    });
    console.log("[API] loginAPI - end");
    return res.data as LoginResponse;
  }

  private async refreshAPI() {
    console.log("[API] refreshAPI - start");
    const res = await axios({
      method: "post",
      url: basePath + API.refresh,
      headers: this.defaultHeaders,
      data: {
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
      },
    });
    console.log("[API] refreshAPI - end");
    return res.data as LoginResponse;
  }

  private async userDetailsAPI(continuationToken?: string) {
    console.log("[API] userDetailsAPI - start");

    if (!this.userId) {
      throw new Error("Tried to invoke userDetailsAPI without a userId");
    }

    // La query deve essere in questo formato specifico, con continuation vuoto
    let query =
      "?include=log&include=measurement&include=tag&include=widget&include=template&include=folder&continuation=&limit=500";
    if (continuationToken) {
      query = `?include=log&include=measurement&include=tag&include=widget&include=template&include=folder&continuation=${continuationToken}&limit=500`;
    }

    const res = await axios({
      method: "get",
      url: basePath + API.userDetails(this.userId) + query,
      headers: this.defaultHeaders,
      data: {
        accessToken: this.accessToken,
        refreshToken: this.refreshToken,
      },
    });
    console.log("[API] userDetailsAPI - end");
    return res.data as UserDetailsResponse;
  }

  private async checkAuthentication() {
    try {
      const loginOrRefresh = async () => {
        if (!this.accessToken && !this.refreshToken) {
          console.log("checkAuthentication -> login flow");
          return this.loginAPI();
        }

        if (
          this.tokenExpiration &&
          dateFns.isAfter(new Date(), this.tokenExpiration)
        ) {
          console.log("checkAuthentication -> refresh flow");
          return this.refreshAPI();
        }

        console.log("checkAuthentication -> already authenticated flow");
      };

      const result = await loginOrRefresh();

      if (result) {
        this.accessToken = result.accessToken;
        this.refreshToken = result.refreshToken;
        this.userId = result.userId;
        this.tokenExpiration = dateFns.addSeconds(new Date(), result.expiresIn);
      }
    } catch (e) {
      console.error("Authentication error", e);
    }
  }

  private async getWorkoutLogsAndMeasurements(): Promise<LogsAndMeasurements> {
    console.log("[StrongService] getWorkoutLogsAndMeasurements start");
    await this.checkAuthentication();

    const extractContinuationToken = (href: string): string | undefined => {
      const parsedUrl = new URL(basePath + href);
      return parsedUrl.searchParams.get("continuation") ?? undefined;
    };

    const workoutLogs: Log[] = [];
    const measurementMap: Record<string, Measurement> = {};
    let continuationToken: string | undefined = undefined;
    let i = 0;

    while (true) {
      console.log("Getting user details, step", i);

      const response = await this.userDetailsAPI(continuationToken);
      if (response._embedded?.log?.length) {
        workoutLogs.push(...response._embedded.log);
      }
      response._embedded?.measurement?.forEach((measurement) => {
        measurementMap[measurement._links.self.href] = measurement;
      });

      let extractedContToken = !!response._links?.next?.href
        ? extractContinuationToken(response._links.next.href)
        : undefined;

      if (!extractedContToken || extractedContToken === continuationToken) {
        break;
      }

      console.log("Continuing with new continuation token", extractedContToken);
      continuationToken = extractedContToken;
      i++;
    }

    console.log("[StrongService] getWorkoutLogsAndMeasurements end");
    return { workoutLogs, measurementMap };
  }

  private static formatCellNumber(str: string | undefined) {
    if (!str) {
      return "";
    }

    try {
      const n = Number.parseFloat(str);
      let prec = 1;
      if (String(n).includes(".")) {
        prec = Math.min(String(n).split(".")[1].length, 2);
      }
      return n.toFixed(prec);
    } catch {
      return "";
    }
  }

  private static isCellSetOfGeneralWorkoutNote(
    cellSetGroupSingle: PurpleCellSetGroup
  ) {
    return (
      cellSetGroupSingle.cellSets.length === 1 &&
      cellSetGroupSingle.cellSets[0].cells.length === 1 &&
      cellSetGroupSingle.cellSets[0].cells[0].cellType === CellType.Note
    );
  }

  private static getGeneralWorkoutNote(
    cellSetGroup: PurpleCellSetGroup[]
  ): string {
    const res = cellSetGroup.find((group) =>
      StrongService.isCellSetOfGeneralWorkoutNote(group)
    );
    return res?.cellSets[0].cells[0].value || "";
  }

  private generateCsvRowsOfWorkoutLogs(
    logsAndMeasurements: LogsAndMeasurements
  ) {
    const { workoutLogs: logs, measurementMap } = logsAndMeasurements;

    return logs
      .filter(
        (log) =>
          log.logType === LogType.Workout && !!log.startDate && !!log.endDate
      )
      .sort((a, b) => {
        const aDate = dateFns.parseISO(a.startDate).getTime();
        const bDate = dateFns.parseISO(b.startDate).getTime();
        return aDate - bDate;
      })
      .flatMap((log, index) => {
        const workoutNumber = index + 1;
        const workoutDate = dateFns.format(
          dateFns.parseISO(log.startDate),
          "yyyy-MM-dd HH:mm:ss"
        );
        const workoutName = log.name?.custom || log.name?.en;
        const workoutDuration = dateFns.differenceInSeconds(
          dateFns.parseISO(log.endDate),
          dateFns.parseISO(log.startDate)
        );
        const workoutNotes = StrongService.getGeneralWorkoutNote(
          log._embedded.cellSetGroup
        );

        // cellSetGroup -> esercizi del singolo workout/log
        return log._embedded.cellSetGroup
          .filter(
            (group) => !StrongService.isCellSetOfGeneralWorkoutNote(group)
          )
          .flatMap((exerciseLog) => {
            const exerciseName = !!exerciseLog._links.measurement?.href
              ? measurementMap[exerciseLog._links.measurement.href].name.en
              : undefined;

            let setOrderCount = 1;
            const getSetOrder = (cells: Cell[]) => {
              const cellTypes = cells.map((cell) => cell.cellType);
              if (cellTypes.includes(CellType.Reps)) {
                return setOrderCount++;
              }
              if (cellTypes.includes(CellType.Duration)) {
                return setOrderCount++;
              }
              if (cellTypes.includes(CellType.Note)) {
                return "Note";
              }
              if (cellTypes.includes(CellType.RESTTimer)) {
                return "Rest Timer";
              }
            };

            return exerciseLog.cellSets
              .filter((cellSet) => !cellSet.isHidden && cellSet.isCompleted)
              .map((cellSet) => {
                const setOrder = getSetOrder(cellSet.cells);

                let weight: string = "",
                  reps: string = "",
                  rpe: string = "",
                  distance: string = "",
                  durationSeconds: string = "",
                  notes: string = "";

                cellSet.cells.forEach((cell) => {
                  switch (cell.cellType) {
                    case CellType.WeightedBodyweight:
                    case CellType.AssistedBodyweight:
                    case CellType.BarbellWeight:
                    case CellType.DumbbellWeight:
                    case CellType.OtherWeight:
                      weight =
                        StrongService.formatCellNumber(cell.value) || "0.0";
                      break;
                    case CellType.Distance:
                      distance =
                        StrongService.formatCellNumber(cell.value) || "0.0";
                      break;
                    case CellType.Reps:
                      reps = cell.value || "";
                      break;
                    case CellType.Rpe:
                      rpe = StrongService.formatCellNumber(cell.value);
                      if (rpe === "0.0") {
                        rpe = "";
                      }
                      break;
                    case CellType.Note:
                      notes = cell.value || "";
                      break;
                    case CellType.Duration:
                    case CellType.RESTTimer:
                      durationSeconds = StrongService.formatCellNumber(
                        cell.value
                      );
                      break;
                  }
                });

                return [
                  //   "Workout #",
                  workoutNumber,
                  //   "Date",
                  workoutDate,
                  //   "Workout Name",
                  workoutName,
                  //   "Duration (sec)",
                  workoutDuration,
                  //   "Exercise Name",
                  exerciseName,
                  //   "Set Order",
                  setOrder,
                  //   "Weight (kg)",
                  weight,
                  //   "Reps",
                  reps,
                  //   "RPE",
                  rpe,
                  //   "Distance (meters)",
                  distance,
                  //   "Seconds",
                  durationSeconds,
                  //   "Notes",
                  notes,
                  //   "Workout Notes",
                  workoutNotes,
                ];
              });
          });
      });
  }

  public async generateCsvOfWorkoutLogs() {
    console.log("[StrongService] generateCsvOfWorkoutLogs start");

    let logsAndMeasurements: LogsAndMeasurements;
    if (process.env.GYM_ANALYSIS_LOCAL === "true") {
      const mocked = JSON.parse(
        fs
          .readFileSync(path.join(__dirname, "../../mocked-data.json"))
          .toString()
      );
      logsAndMeasurements = {
        workoutLogs: mocked._embedded.log,
        measurementMap: mocked._embedded.measurement.reduce((acc, curr) => {
          acc[curr._links.self.href] = curr;
          return acc;
        }, {}),
      };
    } else {
      logsAndMeasurements = await this.getWorkoutLogsAndMeasurements();
    }

    const csvRows = this.generateCsvRowsOfWorkoutLogs(logsAndMeasurements);
    const CSV_HEADER =
      '"Workout #";"Date";"Workout Name";"Duration (sec)";"Exercise Name";"Set Order";"Weight (kg)";"Reps";"RPE";"Distance (meters)";"Seconds";"Notes";"Workout Notes"\n';
    const finalCsv =
      CSV_HEADER +
      csvRows.map((ent) => ent.map((e) => `"${e}"`).join(";")).join("\n");

    console.log("[StrongService] generateCsvOfWorkoutLogs end");
    return finalCsv;
  }
}
