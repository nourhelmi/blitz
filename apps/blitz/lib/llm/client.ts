export const getModelId = (): string => {
  const model = process.env.BLITZ_MODEL
  if (!model) throw new Error('BLITZ_MODEL is required for OpenRouter.')
  return model
}
