import path from "path";
import { fileURLToPath } from "url";

// Project root (the folder that contains index.js), regardless of where
// `node` was started from.
export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DATA_DIR = path.join(ROOT_DIR, "data");
