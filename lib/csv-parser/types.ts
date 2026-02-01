import { CsvParser } from "./index";

export type Header = (typeof CsvParser.EXPECTED_HEADER)[number];

export type CsvRecord = Record<Header, string>;

export interface WorkoutsObject {
  [workoutNumber: string]: {
    date: Date;
    exercises: Record<string, [reps: number, weight: number][]>;
  };
}
