// dsh-skill-review-quiz — ships the `review-quiz` skill as a bundled skill provider.
//
// The bundle carries the skill body and its resource files under assets/review-quiz/;
// this plugin registers them on the skill registry so they appear in the session
// catalog next to the user's own local skills.
import { readFile } from 'node:fs/promises'
import { join, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

export const name = 'review-quiz-skills'
export const inject = ['skills']

const PROVIDER = 'dsh-review-quiz'
const SKILL_NAMES = ['review-quiz']
// Bundled skills rank below project and user roots (100-500), so a user's own copy wins.
const SKILL_RANK = 600

/** Read `key: value` (or a `|` / `>` block scalar) out of a frontmatter block. */
function readField(block, key) {
  const lines = block.split(/\r?\n/)
  for (let i = 0; i < lines.length; i += 1) {
    const match = new RegExp(`^${key}:\\s*(.*)$`).exec(lines[i])
    if (!match) continue
    let value = match[1].trim()
    if (value === '|' || value === '>' || value === '|-' || value === '>-') {
      const collected = []
      for (let j = i + 1; j < lines.length; j += 1) {
        if (lines[j].trim() === '' || /^\s+\S/.test(lines[j])) {
          collected.push(lines[j].trim())
          continue
        }
        break
      }
      return collected.join(value.startsWith('>') ? ' ' : '\n').trim()
    }
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    return value
  }
  return undefined
}

function parseSkill(raw, path) {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/u.exec(raw)
  if (frontmatter?.[1] === undefined) {
    throw new Error(`${PROVIDER}: ${path} has no YAML frontmatter`)
  }
  const description = readField(frontmatter[1], 'description')
  if (typeof description !== 'string' || description.length === 0) {
    throw new Error(`${PROVIDER}: ${path} has no description`)
  }
  return {
    description,
    content: raw.slice(frontmatter[0].length).trim(),
  }
}

/** A missing file stays missing until it appears; other read errors are retried. */
function persistentReadFailure(error) {
  const code = error instanceof Error && 'code' in error ? error.code : undefined
  return code === 'ENOENT' || code === 'ENOTDIR'
}

/**
 * Register the bundled `review-quiz` skill. The skill file is read on catalog
 * discovery and again on every load, so editing the file needs no rebuild.
 * @param ctx - Context carrying the skill registry.
 */
export function apply(ctx) {
  const assetRoot = fileURLToPath(new URL('./assets/', import.meta.url))
  const reportedFailures = new Map()

  async function readSkill(skillName, signal) {
    const path = join(assetRoot, skillName, 'SKILL.md')
    let raw
    try {
      raw = await readFile(path, { encoding: 'utf8', signal })
    } catch (error) {
      if (signal?.aborted === true) throw error
      return failed(skillName, error, persistentReadFailure(error))
    }
    let skill
    try {
      skill = parseSkill(raw, path)
    } catch (error) {
      return failed(skillName, error, true)
    }
    reportedFailures.delete(skillName)
    return { kind: 'loaded', ...skill }
  }

  function failed(skillName, error, persistent) {
    const failure = String(error)
    if (reportedFailures.get(skillName) !== failure) {
      reportedFailures.set(skillName, failure)
      ctx.logger?.warn?.(`${PROVIDER}: skill "${skillName}" is unavailable: ${failure}`)
    }
    return { kind: 'failed', error, persistent }
  }

  ctx.skills.registerProvider((control) => ({
    name: PROVIDER,
    async list(options) {
      const reads = await Promise.all(
        SKILL_NAMES.map(async (skillName) => ({
          skillName,
          read: await readSkill(skillName, options.signal),
        })),
      )
      const candidates = []
      for (const { skillName, read } of reads) {
        if (read.kind === 'failed') continue
        const directory = join(assetRoot, skillName)
        candidates.push({
          name: skillName,
          description: read.description,
          invocation: { modelInvocable: true, userInvocable: true },
          provider: PROVIDER,
          source: 'bundled',
          rank: SKILL_RANK,
          resourceBase: { kind: 'directory', path: directory.split(sep).join('/') },
          locator: join(directory, 'SKILL.md'),
        })
      }
      return {
        candidates,
        complete: reads.every(({ read }) => read.kind === 'loaded' || read.persistent),
      }
    },
    async get(candidate, options) {
      const { rank: _rank, locator: _locator, ...summary } = candidate
      const read = await readSkill(candidate.name, options.signal)
      if (read.kind === 'failed') {
        if (!read.persistent) throw read.error
        control.invalidate()
        return
      }
      return { ...summary, content: read.content }
    },
  }))
}
