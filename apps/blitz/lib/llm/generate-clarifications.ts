import { generateText, Output } from 'ai'
import { openrouter } from '@openrouter/ai-sdk-provider'
import { readFile } from 'fs/promises'
import { z } from 'zod'
import { ClarificationListSchema, type ClarificationList } from '../schema'
import { getModelId } from './client'
import { loadPrompt } from './prompts'
import { nowIso } from '../time'

const ClarificationLLMOutputSchema = z.object({
  clarifications: z.array(
    z.object({
      id: z.string().describe('Unique identifier like q1, q2, etc.'),
      question: z.string().describe('The clarifying question.'),
      context: z.string().describe('Why this question matters.'),
      options: z.array(z.string()).describe('Suggested answer options.'),
      assumption: z.string().describe('Default assumption if user skips.'),
    })
  ),
})

type GenerateClarificationsInput = {
  documentPath: string
  documentId: string
}

const buildUserPrompt = (content: string): string => `## Project Document

Analyze this document and identify questions that need answers before generating a technical specification.

<document>
${content}
</document>

## Instructions

1. Read the document carefully
2. Identify what's ambiguous, missing, or assumed
3. Generate 5-15 clarifying questions ordered by impact
4. For each question, provide suggested options and your default assumption

Produce the clarifications now.`

export const generateClarifications = async ({
  documentPath,
  documentId,
}: GenerateClarificationsInput): Promise<ClarificationList> => {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is required to generate clarifications.')
  }

  const content = await readFile(documentPath, 'utf-8')
  const system = await loadPrompt('clarifications.md')

  const { output } = await generateText({
    model: openrouter(getModelId()),
    system,
    output: Output.object({
      schema: ClarificationLLMOutputSchema,
      name: 'clarifications',
      description: 'Clarifying questions to improve spec quality.',
    }),
    prompt: buildUserPrompt(content),
  })

  return ClarificationListSchema.parse({
    id: crypto.randomUUID(),
    document_id: documentId,
    clarifications: output.clarifications,
    generated_at: nowIso(),
  })
}
