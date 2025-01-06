// These are all types because I wanted to pass by reference and allow for 'global' states. 
// Kinda messy way around OOP. Probably points at a flaw in my general design..

export type OutputPaths = {
  raw: string
  generated: string
}
export type TranscriptionDataObject = {
  partialData: string
  finalData: string
}
export type RespondingState = { isResponding: boolean }
