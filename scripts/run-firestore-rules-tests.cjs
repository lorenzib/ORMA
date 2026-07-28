#!/usr/bin/env node
'use strict';

const crypto = require('crypto');
const fs = require('fs');
const https = require('https');
const net = require('net');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const VERSION = '1.21.0';
const EXPECTED_SHA256 = 'c3d3680a89d946a90a027365ea14c26c6472a162bcf37f099bbb1ebd66d25e8e';
const DOWNLOAD_URL =
  `https://storage.googleapis.com/firebase-preview-drop/emulator/cloud-firestore-emulator-v${VERSION}.jar`;
const CACHE_DIR = path.join(ROOT, '.cache', 'firestore-emulator');
const CACHED_JAR = path.join(CACHE_DIR, `cloud-firestore-emulator-v${VERSION}.jar`);
const LOG_PATH = path.join(CACHE_DIR, 'latest.log');
const JAR_PATH = process.env.FIRESTORE_EMULATOR_JAR || CACHED_JAR;
const HOST = '127.0.0.1';
const PORT = 8080;

function sha256(file){
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function download(url, target){
  return new Promise((resolve, reject) => {
    const request = https.get(url, response => {
      if(response.statusCode >= 300 && response.statusCode < 400 && response.headers.location){
        response.resume();
        download(response.headers.location, target).then(resolve, reject);
        return;
      }
      if(response.statusCode !== 200){
        response.resume();
        reject(new Error(`Emulator download failed with HTTP ${response.statusCode}.`));
        return;
      }
      const temporary = `${target}.partial`;
      const stream = fs.createWriteStream(temporary, { mode: 0o600 });
      response.pipe(stream);
      stream.on('finish', () => {
        stream.close(() => {
          fs.renameSync(temporary, target);
          resolve();
        });
      });
      stream.on('error', reject);
    });
    request.on('error', reject);
  });
}

async function ensureJar(){
  fs.mkdirSync(path.dirname(JAR_PATH), { recursive: true });
  if(!fs.existsSync(JAR_PATH)){
    process.stdout.write(`Downloading Firestore Emulator ${VERSION}…\n`);
    await download(DOWNLOAD_URL, JAR_PATH);
  }
  const actual = sha256(JAR_PATH);
  if(actual !== EXPECTED_SHA256){
    throw new Error(
      `Firestore Emulator checksum mismatch: expected ${EXPECTED_SHA256}, received ${actual}.`
    );
  }
}

function javaExecutable(){
  if(process.env.JAVA_HOME){
    return path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java');
  }
  return process.platform === 'win32' ? 'java.exe' : 'java';
}

function waitForPort(child){
  const deadline = Date.now() + 30000;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      if(child.exitCode !== null){
        reject(new Error(`Firestore Emulator exited before becoming ready (${child.exitCode}).`));
        return;
      }
      const socket = net.createConnection({ host: HOST, port: PORT });
      socket.once('connect', () => {
        socket.end();
        resolve();
      });
      socket.once('error', () => {
        socket.destroy();
        if(Date.now() >= deadline){
          reject(new Error('Timed out waiting for the Firestore Emulator.'));
        }else{
          setTimeout(attempt, 150);
        }
      });
    };
    attempt();
  });
}

function runTests(){
  const jestBin = path.join(ROOT, 'node_modules', 'jest', 'bin', 'jest.js');
  return new Promise((resolve, reject) => {
    const test = spawn(process.execPath, [
      jestBin,
      '--runInBand',
      '--testMatch',
      '**/firestore-emulator.spec.cjs',
    ], {
      cwd: ROOT,
      env: {
        ...process.env,
        FIRESTORE_EMULATOR_HOST: `${HOST}:${PORT}`,
      },
      stdio: 'inherit',
    });
    test.once('error', reject);
    test.once('exit', code => resolve(code == null ? 1 : code));
  });
}

async function stop(child){
  if(!child || child.exitCode !== null) return;
  child.kill('SIGTERM');
  await new Promise(resolve => {
    const timer = setTimeout(resolve, 5000);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function main(){
  await ensureJar();
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const log = fs.openSync(LOG_PATH, 'w');
  const emulator = spawn(javaExecutable(), [
    '-jar', JAR_PATH,
    '--host', HOST,
    '--port', String(PORT),
    '--project_id', 'demo-dolopaws',
    '--rules', path.join(ROOT, 'firestore.rules'),
    '--single_project_mode',
    '--single_project_mode_error',
  ], {
    cwd: ROOT,
    stdio: ['ignore', log, log],
  });

  try{
    await waitForPort(emulator);
    process.exitCode = await runTests();
  }finally{
    await stop(emulator);
    fs.closeSync(log);
  }
}

main().catch(error => {
  console.error(error.message || error);
  console.error(`Firestore Emulator log: ${LOG_PATH}`);
  process.exitCode = 1;
});
