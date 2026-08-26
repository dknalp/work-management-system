/**
 * Firebase JS SDK initializer for the frontend.
 *
 * Exports `firebaseAuth` — the Firebase Auth instance used by all
 * authentication operations.
 *
 * IMPORTANT: Firebase Auth only works in the browser.  This module exports
 * a lazy getter so that importing it during Next.js SSR / static build does
 * not throw `auth/invalid-api-key` when the NEXT_PUBLIC_FIREBASE_* env vars
 * are empty at build time.  All callers must be client components or must
 * run only in browser context (useEffect, event handlers, etc.).
 *
 * Required env vars (set in .env.local and as docker build args):
 *   NEXT_PUBLIC_FIREBASE_API_KEY
 *   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
 *   NEXT_PUBLIC_FIREBASE_PROJECT_ID
 */

import type { Auth } from "firebase/auth"

let _auth: Auth | null = null

/**
 * Return the Firebase Auth instance, initializing it on first call.
 * Safe to call multiple times — returns the same singleton.
 *
 * Throws if called outside the browser (SSR / build).
 */
function getFirebaseAuth(): Auth {
  if (typeof window === "undefined") {
    // During SSR / static build, return a dummy to prevent crashes.
    // Real auth operations only run in the browser.
    throw new Error(
      "[firebase] Firebase Auth is only available in the browser. " +
        "Make sure all auth calls are inside useEffect or event handlers."
    )
  }

  if (_auth) return _auth

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID

  if (!apiKey || !authDomain || !projectId) {
    throw new Error(
      "[firebase] Missing Firebase config env vars. " +
        "Set NEXT_PUBLIC_FIREBASE_API_KEY, NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN, " +
        "and NEXT_PUBLIC_FIREBASE_PROJECT_ID in .env.local."
    )
  }

  // Lazy import so the module can be loaded on the server without crashing
  const { getApps, initializeApp } = require("firebase/app")
  const { getAuth } = require("firebase/auth")

  const app =
    getApps().length === 0
      ? initializeApp({ apiKey, authDomain, projectId })
      : getApps()[0]

  _auth = getAuth(app)
  return _auth!
}

/**
 * Proxy object that behaves like a Firebase `Auth` instance but defers
 * initialization until the first property access in the browser.
 *
 * Usage is identical to the real `Auth` object:
 *   signInWithEmailAndPassword(firebaseAuth, email, password)
 *   onIdTokenChanged(firebaseAuth, callback)
 */
export const firebaseAuth = new Proxy({} as Auth, {
  get(_target, prop) {
    // During SSR, return a no-op function for any property access so that
    // module-level code (e.g. import side-effects) doesn't throw.
    if (typeof window === "undefined") {
      return () => {}
    }
    const auth = getFirebaseAuth()
    const value = (auth as unknown as Record<string, unknown>)[prop as string]
    return typeof value === "function" ? value.bind(auth) : value
  },
})