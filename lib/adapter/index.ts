import * as dateFns from "date-fns";
import { CsvParser } from "../csv-parser";
import { StrongService } from "../strong-service";
import {
  DataSet1RowObj,
  DataSet2Obj,
  DataSet2RowObj,
  ExerciseAndMuscleGroup,
} from "./types";
import { WorkoutsObject } from "../csv-parser/types";
import { GoogleSheetsService } from "../google-sheets/google-sheets-service";
import { ExerciseAndMuscleGroupRawData } from "../google-sheets/types";

export class Adapter {
  private createDataSet1(workoutsObject: WorkoutsObject): DataSet1RowObj[] {
    return Object.values(workoutsObject).flatMap((workoutObj) => {
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
    });
  }

  private createDataSet2(
    workoutsObject: WorkoutsObject,
    exerciseAndMuscleGroup: ExerciseAndMuscleGroup
  ): DataSet2RowObj[] {
    const dataSet2Obj = Object.values(workoutsObject)
      .map((workoutObj) => {
        // Associazione giorno del workout con il lunedì della relativa settimana
        const uniqueWeekDate = dateFns.startOfWeek(workoutObj.date, {
          weekStartsOn: 1,
        });
        const formattedDate = dateFns.format(uniqueWeekDate, "dd/MM/yyyy");
        return { ...workoutObj, date: formattedDate };
      })
      .reduce((acc, curr) => {
        Object.entries(curr.exercises).forEach(
          ([exerciseName, exerciseDetails]) => {
            const currentMuscleGroup = exerciseAndMuscleGroup[exerciseName];
            if (!currentMuscleGroup) {
              console.warn(
                "[Adapter] No muscle group for exercise",
                exerciseName
              );
              return;
            }

            const repsSum = exerciseDetails
              .map((e) => e[0])
              .reduce((acc, curr) => acc + curr, 0);

            if (!acc[curr.date]) {
              acc[curr.date] = {};
            }

            currentMuscleGroup.mainMuscleGroups?.forEach((mainMuscleGroup) => {
              if (!acc[curr.date][mainMuscleGroup]) {
                acc[curr.date][mainMuscleGroup] = 0;
              }
              acc[curr.date][mainMuscleGroup] += repsSum;
            });

            currentMuscleGroup.secondaryMuscleGroups?.forEach(
              (secondaryMuscleGroup) => {
                if (!acc[curr.date][secondaryMuscleGroup]) {
                  acc[curr.date][secondaryMuscleGroup] = 0;
                }
                acc[curr.date][secondaryMuscleGroup] += repsSum / 2;
              }
            );
          }
        );

        return acc;
      }, {} as DataSet2Obj);

    return Object.entries(dataSet2Obj).map(([date, entry]) => {
      return {
        date,
        muscleGroupsVolume: entry,
      };
    });
  }

  private formatExerciseAndMuscleGroupData(
    rawData: ExerciseAndMuscleGroupRawData
  ): ExerciseAndMuscleGroup {
    return rawData.exercisesName.reduce((acc, curr, index) => {
      acc[curr] = {
        mainMuscleGroups: rawData.mainMuscleGroups[index],
        secondaryMuscleGroups: rawData.secondaryMuscleGroups[index],
      };
      return acc;
    }, {} as ExerciseAndMuscleGroup);
  }

  public async updateDataSetsOnGoogleSheets() {
    const strongService = new StrongService();
    const csvStringForWorkoutLogs =
      await strongService.generateCsvOfWorkoutLogs();

    const csvParser = new CsvParser();
    const workoutsObject = csvParser.getWorkoutsObject(csvStringForWorkoutLogs);

    const googleSheetsService = new GoogleSheetsService();
    const exerciseAndMuscleGroupRawData =
      await googleSheetsService.getExerciseAndMuscleGroupRawData();
    const exerciseAndMuscleGroup = this.formatExerciseAndMuscleGroupData(
      exerciseAndMuscleGroupRawData
    );

    const dataSet1 = this.createDataSet1(workoutsObject);
    googleSheetsService.writeDataSet1(
      dataSet1.map((e) => [e.date, e.exercise, e.weight, e.volume1, e.volume2])
    );

    const dataSet2 = this.createDataSet2(
      workoutsObject,
      exerciseAndMuscleGroup
    );
    const allMuscleGroups = [
      ...new Set(
        Object.values(exerciseAndMuscleGroup).flatMap((e) => [
          ...e.mainMuscleGroups,
          ...(e.secondaryMuscleGroups || []),
        ])
      ),
    ].sort();
    const dataSet2Header = ["Date", ...allMuscleGroups];
    const dataSet2Values = dataSet2.map((obj) => [
      obj.date,
      ...allMuscleGroups.map((mg) => obj.muscleGroupsVolume[mg]),
    ]);
    googleSheetsService.writeDataSet2([dataSet2Header, ...dataSet2Values]);
  }
}
