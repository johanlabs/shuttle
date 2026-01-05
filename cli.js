#!/usr/bin/env node

const { Command } = require('commander');
const Shuttle = require('./shuttle');
const fs = require('fs-extra');
const path = require('path');
const ora = require('ora');

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

program
  .name('shuttle')
  .description('P2P File & Data Transport')
  .version('0.2.0');

program.command('push')
  .argument('<target>', 'Path do arquivo ou pasta')
  .action(async (target) => {
    const spinner = ora('Lendo arquivos...').start();
    try {
      const absolutePath = path.resolve(target);
      const stats = await fs.stat(absolutePath);
      let payload = [];

      if (stats.isDirectory()) {
        payload = await scanDirectory(absolutePath);
      } else {
        const content = await fs.readFile(absolutePath);
        payload.push({
          path: path.basename(absolutePath),
          content: content.toString('base64'),
          encoding: 'base64'
        });
      }

      spinner.text = 'Estabelecendo túnel P2P...';
      const id = await shuttle.push(payload);
      spinner.succeed(`Snapshot pronto! ID: ${id}`);
      console.log('\nAguardando peer conectar para transferir...');
    } catch (err) {
      spinner.fail('Erro no push: ' + err.message);
      process.exit(1);
    }
  });

program.command('pull')
  .argument('<id>', 'ID gerado pelo push')
  .action(async (id) => {
    const spinner = ora('Conectando ao peer...').start();
    try {
      const files = await shuttle.pull(id);
      spinner.text = 'Recebendo e reconstruindo arquivos...';

      for (const file of files) {
        const dest = path.resolve(file.path);
        await fs.ensureDir(path.dirname(dest));
        await fs.writeFile(dest, Buffer.from(file.content, 'base64'));
      }

      spinner.succeed(`Transferência concluída: ${files.length} arquivo(s) extraídos.`);
      process.exit(0);
    } catch (err) {
      spinner.fail('Erro no pull: ' + err.message);
      process.exit(1);
    }
  });

program.parse();