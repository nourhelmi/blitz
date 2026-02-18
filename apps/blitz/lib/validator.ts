import { execFile } from 'child_process'
import type { Task, Spec } from './schema'
import { logInfo } from './logger'

export type ValidationResult = {
  valid: boolean
  issues: string[]
}

/**
 * Validate that a task actually produced meaningful changes.
 * Uses git diff on the working directory to check what files were modified.
 */
export const validateTaskCompletion = async (
  task: Task,
  spec: Spec
): Promise<ValidationResult> => {
  const issues: string[] = []
  const cwd = spec.working_directory ?? process.cwd()

  // Get the list of modified files from git
  const diff = await getWorkingDiff(cwd)

  // Check that expected files were actually modified
  if (task.files_likely_touched && task.files_likely_touched.length > 0 && diff.length > 0) {
    const untouched = task.files_likely_touched.filter(
      (expected) => !diff.some((modified) => matchesFile(modified, expected))
    )

    if (untouched.length > 0 && untouched.length === task.files_likely_touched.length) {
      issues.push(
        `None of the expected files were modified: ${untouched.join(', ')}`
      )
    } else if (untouched.length > 0) {
      await logInfo('validator.partial_match', {
        task_id: task.id,
        untouched: untouched.join(', '),
      })
    }
  }

  return {
    valid: issues.length === 0,
    issues,
  }
}

const getWorkingDiff = (cwd: string): Promise<string[]> =>
  new Promise((resolve) => {
    // Show both staged and unstaged changes
    execFile('git', ['diff', '--name-only', 'HEAD'], { cwd }, (error, stdout) => {
      if (error) {
        resolve([])
        return
      }
      resolve(stdout.toString().split('\n').filter(Boolean))
    })
  })

const matchesFile = (actual: string, expected: string): boolean => {
  if (actual === expected) return true
  if (actual.endsWith(expected) || expected.endsWith(actual)) return true
  const actualName = actual.split('/').pop()
  const expectedName = expected.split('/').pop()
  return actualName === expectedName
}
