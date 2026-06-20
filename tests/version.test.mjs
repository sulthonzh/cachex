import { describe, it } from 'node:test';
import assert from 'node:assert';
import { VERSION } from '../dist/index.js';

describe('VERSION', () => {
  it('should export VERSION constant', () => {
    assert.strictEqual(typeof VERSION, 'string');
    assert.match(VERSION, /^\d+\.\d+\.\d+$/);
  });

  it('should be 1.1.0', () => {
    assert.strictEqual(VERSION, '1.1.0');
  });
});

describe('CLI --version flag', () => {
  it('should accept --version flag', async () => {
    const { spawn } = await import('child_process');
    const proc = spawn('node', ['dist/cli.js', '--version'], {
      cwd: process.cwd(),
      env: process.env
    });
    
    let output = '';
    proc.stdout.on('data', (data) => { output += data; });
    proc.stderr.on('data', (data) => { output += data; });
    
    await new Promise((resolve) => {
      proc.on('close', resolve);
    });
    
    assert.strictEqual(output.trim(), '1.1.0');
  });

  it('should accept -V flag', async () => {
    const { spawn } = await import('child_process');
    const proc = spawn('node', ['dist/cli.js', '-V'], {
      cwd: process.cwd(),
      env: process.env
    });
    
    let output = '';
    proc.stdout.on('data', (data) => { output += data; });
    proc.stderr.on('data', (data) => { output += data; });
    
    await new Promise((resolve) => {
      proc.on('close', resolve);
    });
    
    assert.strictEqual(output.trim(), '1.1.0');
  });

  it('should accept version command', async () => {
    const { spawn } = await import('child_process');
    const proc = spawn('node', ['dist/cli.js', 'version'], {
      cwd: process.cwd(),
      env: process.env
    });
    
    let output = '';
    proc.stdout.on('data', (data) => { output += data; });
    proc.stderr.on('data', (data) => { output += data; });
    
    await new Promise((resolve) => {
      proc.on('close', resolve);
    });
    
    assert.strictEqual(output.trim(), '1.1.0');
  });
});