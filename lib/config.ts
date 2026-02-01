import dotEnv from "dotenv";

const homePath = process.env["HOME"];
if (!homePath) {
  console.error("Cannot find HOME variable!");
  process.exit(1);
}
const configPath = `${homePath}/.config/gym-analysis`;

const internalConfig = {
  CONFIG_PATH: configPath,
  TOKEN_PATH: `${configPath}/token.json`,
  CREDENTIALS_PATH: `${configPath}/credentials.json`,
};

enum ExpectedEnvFields {
  SHEET_ID = "SHEET_ID",
  WORKOUT_SHEET_NAME = "WORKOUT_SHEET_NAME",
  DATASET1_SHEET_NAME = "DATASET1_SHEET_NAME",
  DATASET2_SHEET_NAME = "DATASET2_SHEET_NAME",
  STRONG_USERNAME = "STRONG_USERNAME",
  STRONG_PASSWORD = "STRONG_PASSWORD",
  STRONG_BASE_PATH = "STRONG_BASE_PATH",
}

dotEnv.config({ path: `${configPath}/user_config`, quiet: true });

const envConfig: { [value in ExpectedEnvFields]: string } = Object.values(
  ExpectedEnvFields
).reduce((cfg: any, field: string) => {
  if (!process.env[field]) {
    console.error(field, "env variable not set!");
    process.exit(1);
  }
  cfg[field] = process.env[field] as string;
  return cfg;
}, {});

export const config = {
  ...internalConfig,
  ...envConfig,
};
