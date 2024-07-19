import path from 'path'
import fs from 'fs'
import { OutputPaths } from './constants_and_types/types'

// Get dirname: https://stackoverflow.com/a/64383997
import { fileURLToPath } from 'url'
import { dirname } from 'path'
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Hacky - want to make this path in the root of the project, not in the dist folder
const rootDirectory = path.resolve(__dirname, '../')

/** Creates a new folder for this run */
export function setupFolders (): OutputPaths {
  // Get the current timestamp
  const currentRun = `run_${new Date().toISOString().replace(/[:.]/g, '-')}`

  // Define paths for the base 'output', the run folder 'run_{timestamp}',
  const baseOutputDir = path.join(rootDirectory, 'output')
  const runFolder = path.join(baseOutputDir, currentRun)
  const generatedFolder = path.join(runFolder, 'generated')
  const rawFolder = path.join(runFolder, 'raw')

  // Function to create directories
  function createDirectory (directoryPath: string): void {
    if (!fs.existsSync(directoryPath)) {
      fs.mkdirSync(directoryPath, { recursive: true })
    }
  }

  // Create directories - handles directories that already exist.
  createDirectory(baseOutputDir)
  createDirectory(runFolder)
  createDirectory(generatedFolder)
  createDirectory(rawFolder)

  // Return the paths for the raw and generated folders
  return { raw: rawFolder, generated: generatedFolder }
}
