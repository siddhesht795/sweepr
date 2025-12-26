import { describe, it, expect } from 'vitest';
import { formatBytes } from '../src/utils/helpers.js';
import { mergeOptions } from '../src/utils/config.js';

// Suite 1: Testing file size formatting
describe('Utility: formatBytes', () => {
  
  it('should return "0 Bytes" for 0', () => {
    expect(formatBytes(0)).toBe('0 Bytes');
  });

  it('should convert bytes to KB correctly', () => {
    // 1024 bytes = 1 KB
    expect(formatBytes(1024)).toBe('1 KB');
  });

  it('should convert bytes to MB correctly', () => {
    // 1024 * 1024 = 1 MB
    expect(formatBytes(1048576)).toBe('1 MB');
  });

  it('should handle decimal precision', () => {
    // 1500 bytes is approx 1.46 KB
    expect(formatBytes(1500)).toBe('1.46 KB');
  });
});

// Suite 2: Testing configuration priority logic
describe('Utility: mergeOptions', () => {
  
  it('CLI flags should override config defaults', () => {
    const config = { days: 30, dryRun: false };
    const cliFlags = { days: 90, dryRun: true };
    
    const result = mergeOptions(cliFlags, config);
    
    // Should use the CLI values
    expect(result.days).toBe(90);
    expect(result.dryRun).toBe(true);
  });

  it('Config file should be used if CLI flag is missing', () => {
    const config = { days: 60, dryRun: true };
    const cliFlags = { }; // User ran command without flags
    
    const result = mergeOptions(cliFlags, config);
    
    // Should use the Config values
    expect(result.days).toBe(60);
    expect(result.dryRun).toBe(true);
  });

  it('Hard defaults should work if Config and CLI are missing', () => {
    const config = {}; // Empty config file
    const cliFlags = {}; // No flags
    
    const result = mergeOptions(cliFlags, config);
    
    // Should fall back to code defaults
    expect(result.days).toBe('30');
    expect(result.dryRun).toBe(false);
  });
});