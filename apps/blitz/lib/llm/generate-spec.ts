import { generateText, Output } from 'ai'
import { openrouter } from '@openrouter/ai-sdk-provider'
import { readFile } from 'fs/promises'
import { SpecSchema, type Spec } from '../schema'
import { getModelId } from './client'
import { loadPrompt } from './prompts'
import { nowIso } from '../time'

const SpecDraftSchema = SpecSchema.omit({
  id: true,
  generated_at: true,
  approved_at: true,
})

type GenerateSpecInput = {
  documentPath: string
  guidance?: string
}

// Builds user prompt with chain-of-thought structure
const buildUserPrompt = (content: string, guidance?: string): string => {
  const guidanceSection = guidance
    ? `
## Reviewer Guidance

The following feedback was provided by a human reviewer. Incorporate this into your analysis:

<guidance>
${guidance}
</guidance>
`
    : ''

  return `## Project Document

Analyze this document thoroughly before generating the specification.

<document>
${content}
</document>
${guidanceSection}
## Instructions

1. First, identify what is explicitly stated vs what must be inferred
2. Note any ambiguities or gaps that require reasonable defaults
3. Consider the full lifecycle: development, testing, deployment, operations
4. Generate a complete specification following the schema guidelines

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

  const { output } = await generateText({
    model: openrouter(getModelId()),
    system,
    output: Output.object({
      schema: SpecDraftSchema,
      name: 'spec',
      description: 'Structured project specification derived from the document.',
    }),
    prompt: buildUserPrompt(content, guidance),
  })

  return SpecSchema.parse({
    id: crypto.randomUUID(),
    ...output,
    generated_at: nowIso(),
  })
}
