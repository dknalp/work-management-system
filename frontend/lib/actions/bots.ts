import { apiClient } from "@/lib/api"

export type Bot = {
  id: string
  name: string
  description: string | null
  key_prefix: string
  owner_id: string
  is_active: boolean
  created_at: string
  last_used_at: string | null
}

export type BotCreateResponse = Bot & { api_key: string }

export async function listBots(): Promise<Bot[]> {
  return apiClient<Bot[]>("/admin/bots")
}

export async function createBot(name: string, description?: string): Promise<BotCreateResponse> {
  return apiClient<BotCreateResponse>("/admin/bots", {
    method: "POST",
    body: JSON.stringify({ name, description }),
  })
}

export async function updateBot(
  id: string,
  data: { name?: string; description?: string; is_active?: boolean }
): Promise<Bot> {
  return apiClient<Bot>(`/admin/bots/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  })
}

export async function deleteBot(id: string): Promise<void> {
  await apiClient(`/admin/bots/${id}`, { method: "DELETE" })
}

export async function regenerateBotKey(id: string): Promise<BotCreateResponse> {
  return apiClient<BotCreateResponse>(`/admin/bots/${id}/regenerate-key`, { method: "POST" })
}
