/**
 * useDrivePicker — Google Drive File Picker integration.
 *
 * Opens the native Google Drive Picker UI, obtains a short-lived OAuth access
 * token with drive.readonly scope via Google Identity Services (GIS), and
 * returns the selected file's metadata together with the token so the caller
 * can immediately pass them to `importFromDrive`.
 *
 * Setup requirements (one-time, in Google Cloud Console):
 *   1. Enable "Google Drive API" and "Google Picker API"
 *   2. Create an OAuth 2.0 Client ID (Web application)
 *   3. Create a public API key (restrict to Picker API)
 *   4. Set env vars:
 *        NEXT_PUBLIC_GOOGLE_CLIENT_ID   — OAuth client ID
 *        NEXT_PUBLIC_GOOGLE_PICKER_API_KEY — Picker API key
 *
 * The hook lazy-loads the Google `gapi` and `accounts` scripts on first use
 * so there is zero overhead for users who never click the Drive button.
 */

"use client"

import { useCallback } from "react"

export interface DrivePickerResult {
  fileId: string
  fileName: string
  mimeType: string
  /** Short-lived OAuth access token (drive.readonly scope, ~1 h TTL). */
  accessToken: string
}

// Minimal typings for the Google Picker API loaded at runtime.
// We don't add @types/google.picker because the googleapis package
// (already in package.json) doesn't ship those types and we only
// need a tiny subset here.
declare global {
  interface Window {
    gapi: {
      load: (lib: string, cb: () => void) => void
      client: { setApiKey: (key: string) => void }
    }
    google: {
      accounts: {
        oauth2: {
          initTokenClient: (cfg: {
            client_id: string
            scope: string
            callback: (resp: { access_token?: string; error?: string }) => void
          }) => { requestAccessToken: () => void }
        }
      }
      picker: {
        PickerBuilder: new () => GooglePickerBuilder
        DocsView: new () => GoogleDocsView
        Action: { PICKED: string; CANCEL: string }
        ViewId: { DOCS: string }
      }
    }
  }

  interface GooglePickerBuilder {
    addView(view: GoogleDocsView): GooglePickerBuilder
    setOAuthToken(token: string): GooglePickerBuilder
    setDeveloperKey(key: string): GooglePickerBuilder
    setCallback(cb: (data: GooglePickerData) => void): GooglePickerBuilder
    enableFeature(feature: string): GooglePickerBuilder
    build(): { setVisible: (v: boolean) => void }
  }

  interface GoogleDocsView {
    setIncludeFolders(v: boolean): GoogleDocsView
    setSelectFolderEnabled(v: boolean): GoogleDocsView
  }

  interface GooglePickerData {
    action: string
    docs?: Array<{
      id: string
      name: string
      mimeType: string
    }>
  }
}

// ---------------------------------------------------------------------------
// Script loaders (idempotent — safe to call multiple times)
// ---------------------------------------------------------------------------

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve()
      return
    }
    const s = document.createElement("script")
    s.src = src
    s.async = true
    s.onload = () => resolve()
    s.onerror = () => reject(new Error(`Failed to load script: ${src}`))
    document.head.appendChild(s)
  })
}

async function loadGapi(): Promise<void> {
  await loadScript("https://apis.google.com/js/api.js")
  await new Promise<void>((resolve) => window.gapi.load("picker", resolve))
}

async function loadGis(): Promise<void> {
  await loadScript("https://accounts.google.com/gsi/client")
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useDrivePicker() {
  const openPicker = useCallback((): Promise<DrivePickerResult | null> => {
    return new Promise(async (resolve, reject) => {
      const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
      const apiKey = process.env.NEXT_PUBLIC_GOOGLE_PICKER_API_KEY

      if (!clientId || !apiKey) {
        reject(
          new Error(
            "Google Drive entegrasyonu yapılandırılmamış. " +
              "NEXT_PUBLIC_GOOGLE_CLIENT_ID ve NEXT_PUBLIC_GOOGLE_PICKER_API_KEY " +
              "env değişkenlerini ayarlayın.",
          ),
        )
        return
      }

      // Load both libraries in parallel
      try {
        await Promise.all([loadGapi(), loadGis()])
      } catch (err) {
        reject(err)
        return
      }

      // Step 1: Obtain an OAuth access token via GIS
      const tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: "https://www.googleapis.com/auth/drive.readonly",
        callback: (tokenResponse) => {
          if (tokenResponse.error || !tokenResponse.access_token) {
            reject(new Error(tokenResponse.error ?? "OAuth token alınamadı"))
            return
          }

          const accessToken = tokenResponse.access_token

          // Step 2: Build and show the Picker
          const docsView = new window.google.picker.DocsView()
            .setIncludeFolders(false)
            .setSelectFolderEnabled(false)

          const picker = new window.google.picker.PickerBuilder()
            .addView(docsView)
            .setOAuthToken(accessToken)
            .setDeveloperKey(apiKey)
            .setCallback((data: GooglePickerData) => {
              if (data.action === window.google.picker.Action.PICKED && data.docs?.length) {
                const doc = data.docs[0]
                resolve({
                  fileId: doc.id,
                  fileName: doc.name,
                  mimeType: doc.mimeType,
                  accessToken,
                })
              } else if (data.action === window.google.picker.Action.CANCEL) {
                resolve(null)
              }
            })
            .build()

          picker.setVisible(true)
        },
      })

      tokenClient.requestAccessToken()
    })
  }, [])

  return { openPicker }
}