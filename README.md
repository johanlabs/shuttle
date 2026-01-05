# Shuttle MVP v0.0.1

Uma biblioteca para transferência de payloads P2P via IDs curtos.

## Componentes
1. `server.js`: Servidor de sinalização (Signaling) para conectar os peers.
2. `shuttle.js`: A lógica core que usa WebRTC para criar o túnel direto.
3. `example-push.js`: Script para gerar um ID e disponibilizar um payload.
4. `example-pull.js`: Script para consumir um payload usando um ID.

## Como Testar

### 1. Inicie o servidor de sinalização
```bash
node server.js
```

### 2. Em um novo terminal, envie um payload
```bash
node example-push.js
```
*Anote o ID gerado (ex: ID: AB12CD)*

### 3. Em outro terminal (ou outro PC), receba o payload
```bash
node example-pull.js AB12CD
```