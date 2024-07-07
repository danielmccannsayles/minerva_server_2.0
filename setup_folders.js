import path from "path";
import fs from "fs";

// Get dirname: https://stackoverflow.com/a/64383997
import { fileURLToPath } from "url";
import { dirname } from "path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/** Creates a new folder for this run */
export function setupFolders() {
  // Get the current timestamp
  const currentRun = `run_${new Date().toISOString().replace(/[:.]/g, "-")}`;

  // Define paths for the base 'output', the run folder 'run_{timestamp}',
  const baseOutputDir = path.join(__dirname, "output");
  const runFolder = path.join(baseOutputDir, currentRun);
  const generatedFolder = path.join(runFolder, "generated");
  const rawFolder = path.join(runFolder, "raw");

  // Function to create directories
  function createDirectory(directoryPath) {
    if (!fs.existsSync(directoryPath)) {
      fs.mkdirSync(directoryPath, { recursive: true });
      console.log(`Directory created: ${directoryPath}`);
    }
  }

  // Create directories - handles directories that already exist.
  createDirectory(baseOutputDir);
  createDirectory(runFolder);
  createDirectory(generatedFolder);
  createDirectory(rawFolder);

  // Return the paths for the raw and generated folders
  return { raw: rawFolder, generated: generatedFolder };
}
