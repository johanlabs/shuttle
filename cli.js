#!/usr/bin/env node

const { Command } = require('commander');
const Shuttle = require('./shuttle');
const fs = require('fs-extra');
const path = require('path');
const ora = require('ora');
const chokidar = require('chokidar');

const program = new Command();
const shuttle = new Shuttle();

async function scanDirectory(dir, baseDir = '') {
  let results = [];
  const list = await fs.readdir(dir);
  for (const file of list) {
    const filePath = path.join(dir, file);
    const relativePath = path.join(baseDir, file);
    const stat = await fs.stat(filePath);
    if (stat.isDirectory()) {
      results = results.concat(await scanDirectory(filePath, relativePath));
    } else {
      const content = await fs.readFile(filePath);
      results.push({ path: relativePath, content: content.toString('base64') });
    }
  }
  return results;
}

program.command('push')
  .argument('<target>')
  .option('--live', 'Manter sincronização ativa (one-way)')
  .option('--allow-changes', 'Permitir propostas de mudanças do pull')
  .option('--auto-accept', 'Aceitar automaticamente mudanças propostas')
  .action(async (target, options) => {
    const spinner = ora('Lendo arquivos...').start();
    const absolutePath = path.resolve(target);
    let payload = [];

    if (!(await fs.exists(absolutePath))) {
      spinner.fail('Caminho não encontrado');
      process.exit(1);
    }

    if ((await fs.stat(absolutePath)).isDirectory()) {
      payload = await scanDirectory(absolutePath);
    } else {
      const content = await fs.readFile(absolutePath);
      payload.push({ path: path.basename(absolutePath), content: content.toString('base64') });
    }

    spinner.text = 'Aguardando peer...';
    const { id, peerPromise } = await shuttle.push(payload, { live: options.live, allowChanges: options.allowChanges, autoAccept: options.autoAccept, root: absolutePath });
    spinner.succeed(`ID: ${id}`);

    const p = await peerPromise;

    if (options.live) {
      chokidar.watch(absolutePath, { ignoreInitial: true }).on('change', async (filePath) => {
        const rel = path.relative(absolutePath, filePath);
        const content = await fs.readFile(filePath);
        p.send(JSON.stringify({ t: 'update', path: rel, content: content.toString('base64') }));
      });
    }
  });

program.command('pull')
  .argument('<id>')
  .option('--live', 'Receber atualizações contínuas')
  .action(async (id, options) => {
    const spinner = ora('Conectando...').start();
    let root = process.cwd();
    let peerRef;

    await shuttle.pull(id, async (data) => {
      if (spinner.isSpinning) spinner.succeed('Recebido');
      for (const file of data) {
        const dest = path.resolve(file.path);
        await fs.ensureDir(path.dirname(dest));
        await fs.writeFile(dest, Buffer.from(file.content, 'base64'));
      }
    }, { live: options.live, onPeer: (p) => { peerRef = p; } });

    if (options.live) {
      chokidar.watch(root, { ignoreInitial: true }).on('change', async (filePath) => {
        const rel = path.relative(root, filePath);
        const content = await fs.readFile(filePath);
        if (peerRef) {
          peerRef.send(JSON.stringify({ t: 'propose-change', path: rel, content: content.toString('base64') }));
        }
      });
    }
  });

program.parse();