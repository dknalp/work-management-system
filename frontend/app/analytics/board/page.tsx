import { redirect } from "next/navigation"

export default function LegacyBoardRedirect() {
  redirect("/board")
}