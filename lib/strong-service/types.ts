export interface LogsAndMeasurements {
  workoutLogs: Log[];
  measurementMap: Record<string, Measurement>;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  userId: string;
}

export interface UserDetailsResponse {
  _links?: {
    next?: {
      href?: string;
    };
  };
  _embedded: {
    log?: Log[];
    measurement?: Measurement[];
  };
}

export interface Log {
  _links: LogLinks;
  _embedded: LogEmbedded;
  id: string;
  created: string;
  lastChanged: string;
  name: Name;
  access: Access;
  startDate: string;
  endDate: string;
  logType: LogType;
  timezoneId?: TimezoneID;
}

export interface LogEmbedded {
  cellSetGroup: PurpleCellSetGroup[];
}

export interface PurpleCellSetGroup {
  _links: CellSetGroupLinks;
  _embedded: DropSetRESTTimer;
  id: string;
  cellSets: CellSet[];
  groupIndex?: number;
}

export interface DropSetRESTTimer {}

export interface CellSetGroupLinks {
  measurement?: Folders;
}

export interface Folders {
  href: string;
}

export interface CellSet {
  isHidden?: boolean;
  id: string;
  cells: Cell[];
  isCompleted?: boolean;
}

export interface Cell {
  id: string;
  cellType: CellType;
  value?: string;
}

export enum CellType {
  AssistedBodyweight = "ASSISTED_BODYWEIGHT",
  BarbellWeight = "BARBELL_WEIGHT",
  Distance = "DISTANCE",
  DumbbellWeight = "DUMBBELL_WEIGHT",
  Duration = "DURATION",
  Note = "NOTE",
  OtherWeight = "OTHER_WEIGHT",
  RESTTimer = "REST_TIMER",
  Reps = "REPS",
  Rpe = "RPE",
  WeightedBodyweight = "WEIGHTED_BODYWEIGHT",
}

export interface LogLinks {
  self: Folders;
  user: Folders;
  template?: Folders;
}

export enum Access {
  Private = "PRIVATE",
  Public = "PUBLIC",
}

export enum LogType {
  Workout = "WORKOUT",
}

export interface Name {
  custom?: string;
  en?: string;
}

export enum TimezoneID {
  EuropeRome = "Europe/Rome",
}

export interface Measurement {
  _links: MeasurementLinks;
  id: string;
  created: Date;
  lastChanged: Date;
  name: Instructions;
  cellTypeConfigs: CellTypeConfig[];
  measurementType: MeasurementType;
  instructions?: Instructions;
  media?: Media[];
  isGlobal?: boolean;
}

export interface MeasurementLinks {
  self: Folders;
  user: Folders;
  tag: Folders[];
}

export interface CellTypeConfig {
  cellType: CellType;
  mandatory?: boolean;
  isExponent?: boolean;
}

export interface Instructions {
  en: string;
}

export enum MeasurementType {
  Exercise = "EXERCISE",
}

export interface Media {
  url: string;
  type: Type;
  contentType: ContentType;
}

export enum ContentType {
  ImageJPEG = "image/jpeg",
  ImagePNG = "image/png",
  VideoMp4 = "video/mp4",
}

export enum Type {
  Image = "IMAGE",
  Thumbnail = "THUMBNAIL",
  Video = "VIDEO",
}
