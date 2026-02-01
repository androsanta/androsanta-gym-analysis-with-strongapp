export interface DataSet1RowObj {
  date: string;
  exercise: string;
  weight: number;
  volume1: number;
  volume2: number;
}

export interface DataSet2Obj {
  // number value is volume of muscleGroup
  [date: string]: { [muscleGroup: string]: number };
}

export interface DataSet2RowObj {
  date: string;
  muscleGroupsVolume: {
    // number value is volume of muscleGroup
    [muscleGroup: string]: number;
  };
}

export interface ExerciseAndMuscleGroup {
  [exerciseName: string]: {
    mainMuscleGroups: string[];
    secondaryMuscleGroups?: string[];
  };
}
