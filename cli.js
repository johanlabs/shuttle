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
    if (stat && stat.isDirectory()) {
      results = results.concat(await scanDirectory(filePath, relativePath));
    } else {
      const content = await fs.readFile(filePath);
      results.push({
        path: relativePath,
        content: content.toString('base64'),
        encoding: 'base64'
      });
    }
  }
  return results;
}

program.command('push')
  .argument('<target>', 'Path do arquivo ou pasta')
  .option('-w, --watch', 'Monitorar alterações em tempo real')
  .action(async (target, options) => {
    const spinner = ora('Lendo arquivos...').start();
    const absolutePath = path.resolve(target);
    let payload = [];

    if ((await fs.stat(absolutePath)).isDirectory()) {
      payload = await scanDirectory(absolutePath);
    } else {
      const content = await fs.readFile(absolutePath);
      payload.push({ path: path.basename(absolutePath), content: content.toString('base64') });
    }

    spinner.text = 'Aguardando peer...';
    const { id, peerPromise } = await shuttle.push(payload);
    spinner.succeed(`ID: ${id}`);

    const p = await peerPromise;
    console.log('\n✅ Conectado! Transferência inicial concluída.');

    if (options.watch) {
      console.log('👀 Modo Watch ativo. Sincronizando alterações...');
      chokidar.watch(absolutePath, { ignoreInitial: true }).on('all', async (event, filePath) => {
        const relPath = path.relative(absolutePath, filePath) || path.basename(filePath);
        if (event === 'add' || event === 'change') {
          const content = await fs.readFile(filePath);
          p.send(JSON.stringify([{ path: relPath, content: content.toString('base64'), event: 'update' }]));
          console.log(`📤 Atualizado: ${relPath}`);
        }
      });
    }
  });

program.command('pull')
  .argument('<id>', 'ID do Shuttle')
  .action(async (id) => {
    const spinner = ora('Conectando...').start();
    await shuttle.pull(id, async (data) => {
      if (spinner.isSpinning) spinner.succeed('Sincronizado!');
      for (const file of data) {
        const dest = path.resolve(file.path);
        await fs.ensureDir(path.dirname(dest));
        await fs.writeFile(dest, Buffer.from(file.content, 'base64'));
        if (file.event === 'update') console.log(`📥 Alterado: ${file.path}`);
      }
    });
  });

program.parse();