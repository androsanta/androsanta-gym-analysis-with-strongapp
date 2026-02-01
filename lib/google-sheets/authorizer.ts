import { promises as fs } from "fs";
import prompts from "prompts";
import { google, GoogleApis } from "googleapis";
import { config } from "../config";

const SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

export const createAuth = async () => {
  try {
    const credentials = await fs.readFile(config.CREDENTIALS_PATH);
    return createOAuth2Client(JSON.parse(credentials.toString()));
  } catch {
    throw new Error(
      `Cannot open credentials.json file on path ${config.CREDENTIALS_PATH}`
    );
  }
};

export type OAuth2Client = typeof GoogleApis.prototype.auth.OAuth2.prototype;

async function createOAuth2Client(credentials: any) {
  const { client_secret, client_id, redirect_uris } = credentials.web;
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    redirect_uris[0]
  );

  try {
    // Check if we have previously stored a token.
    const token = await fs.readFile(config.TOKEN_PATH);
    oAuth2Client.setCredentials(JSON.parse(token.toString()));
    return oAuth2Client;
  } catch {
    return await getNewToken(oAuth2Client);
  }
}

async function getNewToken(oAuth2Client: OAuth2Client) {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
  });
  console.log("Authorize this app by visiting this url:", authUrl);

  const promptResult = await prompts({
    type: "text",
    name: "code",
    message: "Enter the code from that page here:",
  });
  const code = promptResult?.code;
  if (!code) {
    process.exit(1);
  }

  const { tokens } = await oAuth2Client.getToken(code);
  oAuth2Client.setCredentials(tokens);
  await fs.mkdir(config.CONFIG_PATH, { recursive: true });
  await fs.writeFile(config.TOKEN_PATH, JSON.stringify(tokens));
  console.log("Token stored to", config.TOKEN_PATH);

  return oAuth2Client;
}
