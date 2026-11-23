/**
 * sdd-reindex.js — keep .opencode/vector-index/index.db fresh.
 *
 * OpenCode v1 has no `hooks` config; project plugins in .opencode/plugins/ are
 * loaded automatically and emit `file.edited`. We debounce those events and run
 * the dependency-free indexer once per burst.
 *
 * Debounced, best-effort: a failure here never breaks the editor session.
 */

import { execFile } from "node:child_process"

const DEBOUNCE_MS = 1200
const IGNORED = /(^|\/)(node_modules|dist|build|\.git)\//

let timer = null
let running = false
let pending = false

function reindex(worktree) {
  if (running) {
    pending = true
    return
  }
  running = true

  execFile(
    "node",
    [".opencode/vector-index/index.mjs", "build", "--quiet"],
    { cwd: worktree || process.cwd(), timeout: 15000 },
    (error) => {
      running = false
      if (error) {
        // Index is derived data; never surface this as a session error.
        console.warn(`[sdd] reindex skipped: ${error.message}`)
      }
      if (pending) {
        pending = false
        reindex(worktree)
      }
    },
  )
}

export const SddReindex = async ({ worktree, directory }) => {
  const root = worktree || directory || process.cwd()

  return {
    event: async ({ event }) => {
      if (!event || event.type !== "file.edited") return

      const file = event.properties?.file ?? event.properties?.path ?? ""
      if (file && IGNORED.test(file)) return

      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        reindex(root)
      }, DEBOUNCE_MS)
    },
  }
}
