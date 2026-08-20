"use client"

import { DocsContentPart1 } from "./docs-content-part1"
import { DocsContentPart2 } from "./docs-content-part2"
import { DocsContentPart3 } from "./docs-content-part3"

/**
 * Tüm API dokümantasyon içeriği — 3 parçaya bölünmüştür:
 *   Part 1: Getting Started, Authentication, Me, Tasks
 *   Part 2: Team, Activity, Analytics, Files
 *   Part 3: Messages, Webhooks, Webhook Events, Örnekler
 */
export function DocsContent() {
  return (
    <>
      <DocsContentPart1 />
      <DocsContentPart2 />
      <DocsContentPart3 />
    </>
  )
}