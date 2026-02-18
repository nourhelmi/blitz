import { generateText, Output } from 'ai'
import { openrouter } from '@openrouter/ai-sdk-provider'
import { readFile } from 'fs/promises'
import { z } from 'zod'
import { SpecSchema, TechStackEntrySchema, ClarificationListSchema, type Spec } from '../schema'
import { getModelId } from './client'
import { loadPrompt } from './prompts'
import { nowIso } from '../time'
import { getClarificationsPath } from '../paths'
import { readJsonFile } from '../storage'

const SpecLLMOutputSchema = z.object({
  project: z.string().describe('Project name.'),
  version: z.string().describe('Spec version string.'),
  summary: z.string().describe('High-level project summary.'),
  goals: z.array(z.string()).describe('Primary outcomes the project targets.'),
  architecture: z
    .object({
      overview: z.string().describe('Concise architecture overview.'),
      tech_stack: z.array(TechStackEntrySchema).describe('Grouped tech stack items.'),
      key_components: z
        .array(
          z.object({
            name: z.string().describe('Component name.'),
            description: z.string().describe('What this component does.'),
            responsibilities: z.array(z.string()).describe('Key responsibilities.'),
          })
        )
        .describe('Major components that will be built.'),
    })
    .describe('System architecture details.'),
  constraints: z.array(z.string()).describe('Non-negotiable constraints.'),
  conventions: z.array(z.string()).describe('Coding or product conventions.'),
  init_script: z.string().describe('Commands to start locally.'),
  working_directory: z.string().describe('Root working directory.'),
  phases: z
    .array(
      z.object({
        id: z.string().describe('Phase identifier.'),
        name: z.string().describe('Short phase name.'),
        description: z.string().describe('Phase scope and deliverables.'),
        depends_on: z.array(z.string()).describe('Phase IDs that must finish first.'),
      })
    )
    .describe('Ordered project phases with dependencies.'),
})

type GenerateSpecInput = {
  documentPath: string
  guidance?: string
}

// Builds user prompt with chain-of-thought structure
const buildUserPrompt = (content: string, guidance?: string, decisions?: string): string => {
  const guidanceSection = guidance
    ? `
## Reviewer Guidance

The following feedback was provided by a human reviewer. Incorporate this into your analysis:

<guidance>
${guidance}
</guidance>
`
    : ''

  const decisionsSection = decisions
    ? `
## Pre-Spec Decisions

The following decisions were made by the user during a clarification phase. These are HARD CONSTRAINTS that must be reflected in the spec. Do not override or ignore these answers:

<decisions>
${decisions}
</decisions>
`
    : ''

  return `## Project Document

Analyze this document thoroughly before generating the specification.

<document>
${content}
</document>
${guidanceSection}${decisionsSection}
## Instructions

1. First, identify what is explicitly stated vs what must be inferred
2. Note any ambiguities or gaps that require reasonable defaults
3. Consider the full lifecycle: development, testing, deployment, operations
4. Generate a complete specification following the schema guidelines
${decisions ? '5. Ensure all pre-spec decisions above are reflected as constraints or architecture choices' : ''}

Produce the structured spec now.`
}

export const generateSpec = async ({
  documentPath,
  guidance,
}: GenerateSpecInput): Promise<Spec> => {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is required to generate specs.')
  }

  const content = await readFile(documentPath, 'utf-8')
  const system = await loadPrompt('spec-generation.md')

  // Load clarification answers if they exist
  let decisions: string | undefined
  try {
    const clarifications = await readJsonFile(
      getClarificationsPath(),
      ClarificationListSchema,
      null as unknown as ReturnType<typeof ClarificationListSchema.parse>
    )
    if (clarifications?.approved_at && clarifications.clarifications.length > 0) {
      decisions = clarifications.clarifications
        .map((c) => `Q: ${c.question}\nA: ${c.answer ?? c.assumption ?? 'Not specified'}`)
        .join('\n\n')
    }
  } catch {
    // No clarifications file — that's fine
  }

  const { output } = await generateText({
    model: openrouter(getModelId()),
    system,
    output: Output.object({
      schema: SpecLLMOutputSchema,
      name: 'spec',
      description: 'Structured project specification derived from the document.',
    }),
    prompt: buildUserPrompt(content, guidance, decisions),
  })

  return SpecSchema.parse({
    id: crypto.randomUUID(),
    ...output,
    generated_at: nowIso(),
  })
}
