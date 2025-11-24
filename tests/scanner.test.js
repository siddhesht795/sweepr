import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as scanner from '../src/core/scanner.js';
import fs from 'fs/promises';
import path from 'path';

// 1. Hijack the File System module
vi.mock('fs/promises');

// 2. Helper to create fake directory entries (Dirent)
// This mimics what fs.readdir returns
const createDirent = (name, isDir = false) => ({
  name,
  isDirectory: () => isDir,
  isFile: () => !isDir,
});

describe('Core: Scanner Logic', () => {
  
  afterEach(() => {
    vi.restoreAllMocks(); // Clean up after each test
  });

  it('should find targets and correctly identify "Smart Inactivity"', async () => {
    /* --- THE SCENARIO ---
    simulating a project structure:
    /projects/my-app/node_modules  (Target)
    /projects/my-app/index.js      (Old code file: 2020)
    /projects/my-app/README.md     (New text file: 2024)
    
    EXPECTATION: The scanner should report the date as 2020 (Old),
    completely ignoring the 2024 README.*/

    const ROOT_DIR = '/projects';
    const OLD_DATE = new Date('2020-01-01');
    const NEW_DATE = new Date('2024-01-01');

    // --- MOCKING fs.readdir (The Folder Structure) ---
    fs.readdir.mockImplementation(async (dirPath) => {
      // If scanning root...
      if (dirPath === ROOT_DIR) {
        return [createDirent('my-app', true)];
      }
      // If scanning the project folder...
      if (dirPath === path.join(ROOT_DIR, 'my-app')) {
        return [
          createDirent('node_modules', true), // The target
          createDirent('index.js', false),    // Code file
          createDirent('README.md', false)    // Non-code file
        ];
      }
      return []; // Empty elsewhere
    });

    // --- MOCKING fs.stat (The Timestamps) ---
    fs.stat.mockImplementation(async (filePath) => {
      if (filePath.endsWith('index.js')) return { mtime: OLD_DATE };
      if (filePath.endsWith('README.md')) return { mtime: NEW_DATE };
      
      // Default timestamp for folders
      return { mtime: OLD_DATE };
    });

    // --- RUN THE TEST ---
    const isNodeTarget = (p, name) => name === 'node_modules';
    const results = await scanner.findTargets(ROOT_DIR, isNodeTarget);

    // --- ASSERTIONS ---
    expect(results).toHaveLength(1);
    
    const project = results[0];
    expect(project.path).toContain('node_modules');
    
    // CRITICAL CHECK: Did it ignore the README?
    // The project mtime should be the OLD date, not the NEW one.
    expect(project.mtime).toEqual(OLD_DATE); 
    expect(project.mtime).not.toEqual(NEW_DATE);
  });

  it('should recurse into subdirectories to find nested projects', async () => {
    // --- SCENARIO ---
    // /work/client-a/backend/node_modules
    // We need to ensure it digs down 2 levels to find it.

    fs.readdir.mockImplementation(async (dir) => {
      if (dir === '/work') return [createDirent('client-a', true)];
      if (dir === '/work/client-a') return [createDirent('backend', true)];
      if (dir === '/work/client-a/backend') return [createDirent('node_modules', true)];
      return [];
    });

    // Mock basic stats
    fs.stat.mockResolvedValue({ mtime: new Date() });

    const isNodeTarget = (p, name) => name === 'node_modules';
    const results = await scanner.findTargets('/work', isNodeTarget);

    expect(results).toHaveLength(1);
    expect(results[0].path).toContain('backend/node_modules'); // Use / or \ depending on OS, toContain handles it partially
  });
  
  it('should ignore folders in the IGNORE_DIRS list (Performance)', async () => {
    // --- SCENARIO ---
    // /work/dist/node_modules
    // 'dist' is in our global IGNORE list. The scanner should STOP there 
    // and NOT find the node_modules inside it.

    fs.readdir.mockImplementation(async (dir) => {
      if (dir === '/work') return [createDirent('dist', true)];
      if (dir === '/work/dist') return [createDirent('node_modules', true)]; // Should never be reached
      return [];
    });

    fs.stat.mockResolvedValue({ mtime: new Date() });

    const isNodeTarget = (p, name) => name === 'node_modules';
    const results = await scanner.findTargets('/work', isNodeTarget);

    // Should find nothing because 'dist' blocked the path
    expect(results).toHaveLength(0);
  });
});