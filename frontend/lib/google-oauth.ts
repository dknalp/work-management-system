import { google } from "googleapis"
import fs from "fs/promises"
import path from "path"

type OAuth2Client = InstanceType<typeof google.auth.OAuth2>

const CREDENTIALS_PATH = path.join(process.cwd(), "data", "drive-credentials.json")

export type DriveCredentials = {
  access_token: string
  refresh_token: string
  scope: string
  token_type: string
  expiry_date: number
  email?: string
  connectedAt?: string
}

export function getOAuthClient(): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI ?? "http://localhost:3000/api/auth/google/callback"

  if (!clientId || !clientSecret) {
    throw new Error("GOOGLE_CLIENT_ID ve GOOGLE_CLIENT_SECRET env değişkenleri tanımlanmamış")
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri)
}

export async function loadCredentials(): Promise<DriveCredentials | null> {
  try {
    const raw = await fs.readFile(CREDENTIALS_PATH, "utf-8")
    return JSON.parse(raw) as DriveCredentials
  } catch {
    return null
  }
}

export async function saveCredentials(creds: DriveCredentials): Promise<void> {
  await fs.mkdir(path.dirname(CREDENTIALS_PATH), { recursive: true })
  await fs.writeFile(CREDENTIALS_PATH, JSON.stringify(creds, null, 2), "utf-8")
}

export async function deleteCredentials(): Promise<void> {
  try {
    await fs.unlink(CREDENTIALS_PATH)
  } catch {
    // already gone
  }
}

export async function getAuthorizedClient(): Promise<OAuth2Client | null> {
  const creds = await loadCredentials()
  if (!creds) return null

  const client = getOAuthClient()
  client.setCredentials({
    access_token: creds.access_token,
    refresh_token: creds.refresh_token,
    expiry_date: creds.expiry_date,
    token_type: creds.token_type,
  })

  // Auto-refresh if expired
  client.on("tokens", async (tokens: { access_token?: string | null; expiry_date?: number | null }) => {
    if (tokens.access_token) {
      const updated: DriveCredentials = {
        ...creds,
        access_token: tokens.access_token,
        expiry_date: tokens.expiry_date ?? creds.expiry_date,
      }
      await saveCredentials(updated)
    }
  })

  return client
}

export function getAuthUrl(): string {
  const client = getOAuthClient()
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [
      "https://www.googleapis.com/auth/drive.readonly",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
  })
}

export async function exchangeCodeForTokens(
  code: string
): Promise<DriveCredentials & { email: string }> {
  const client = getOAuthClient()
  const { tokens } = await client.getToken(code)

  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error("Token alınamadı — refresh_token eksik (consent prompt gerekebilir)")
  }

  client.setCredentials(tokens)
  const oauth2 = google.oauth2({ version: "v2", auth: client })
  const { data } = await oauth2.userinfo.get()

  const creds: DriveCredentials & { email: string } = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    scope: tokens.scope ?? "",
    token_type: tokens.token_type ?? "Bearer",
    expiry_date: tokens.expiry_date ?? Date.now() + 3600_000,
    email: data.email ?? "",
    connectedAt: new Date().toISOString(),
  }

  await saveCredentials(creds)
  return creds
}