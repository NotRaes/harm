const readline = require('readline');
const os = require('os');
const config = require('../../../config.js');

// ── ansi helpers ──

const c = {
    reset: '\x1b[0m',
    bold: '\x1b[1m',
    dim: '\x1b[2m',
    white: '\x1b[38;2;240;240;240m',
    gray: '\x1b[38;2;120;120;120m',
    green: '\x1b[38;2;100;220;130m',
    yellow: '\x1b[38;2;250;180;50m',
    red: '\x1b[38;2;240;70;70m',
};

const accent = s => `${c.white}${c.bold}${s}${c.reset}`;
const muted  = s => `${c.gray}${s}${c.reset}`;
const ok     = s => `${c.green}${s}${c.reset}`;
const warn   = s => `${c.yellow}${s}${c.reset}`;
const err    = s => `${c.red}${s}${c.reset}`;

class Start {
    constructor() {
        this.rl = null;
        this.client = null;
    }

    static init() {
        const instance = new Start();
        instance.setupLogger();
        instance.catchErrors();
        return instance;
    }

    catchErrors() {
        process.on('unhandledRejection', (reason) => {
            const msg = reason instanceof Error ? reason.message : String(reason);
            if (!msg || msg === '{}' || msg === '[object Object]') return;
            console.error('[unhandled rejection]', msg);
        });
        process.on('uncaughtException', (e) => {
            console.error('[uncaught exception]', e.message);
        });
        process.setMaxListeners(0);
    }

    setupLogger() {
        const _log = console.log.bind(console);
        const _err = console.error.bind(console);
        const _warn = console.warn.bind(console);

        const ts = () => {
            const d = new Date();
            return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
        };

        const fmt = (args) => args.map(a => typeof a === 'object' ? (a instanceof Error ? a.message : JSON.stringify(a, null, 2)) : String(a)).join(' ');

        const write = (fn, prefix, text) => {
            if (this.rl) {
                readline.clearLine(process.stdout, 0);
                readline.cursorTo(process.stdout, 0);
            }
            fn(`${prefix}${text}`);
            if (this.rl) this.rl.prompt(true);
        };

        console.log  = (...a) => write(_log,  muted(` · [${ts()}] `), fmt(a));
        console.error = (...a) => write(_err,  err(` · [${ts()}] `),  err(fmt(a)));
        console.warn  = (...a) => write(_warn, warn(` · [${ts()}] `), warn(fmt(a)));
    }

    attachClient(client) {
        if (!process.stdin.isTTY) return;
        this.client = client;

        process.stdout.write('\x1Bc');
        process.stdout.write(`\n  ${accent('harm')} ${muted('·')} ${ok('online')} ${muted('·')} ${accent(client.user?.tag)} ${muted('·')} ${accent(`${client.guilds.cache.size} servers`)}\n`);
        process.stdout.write(`  ${muted(`prefix: ${config.prefix} · commands: ${client.commandHandler?.commands?.size || 0} · ping: ${client.ws.ping >= 0 ? client.ws.ping + 'ms' : '...'}`)}\n\n`);

        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
            completer: (line) => {
                const cmds = ['help', 'status', 'reload', 'eval', 'say', 'guilds', 'portal', 'prefix', 'clear', 'exit'];
                const hits = cmds.filter(c => c.startsWith(line.trim()));
                return [hits.length ? hits : cmds, line];
            },
            prompt: `${c.gray}harm ${c.dim}>${c.reset} `
        });
        this.rl = rl;
        rl.prompt();

        rl.on('line', async (raw) => {
            const input = raw.trim();
            if (!input) return rl.prompt();

            const parts = input.split(/\s+/);
            const cmd = parts.shift().toLowerCase();
            const args = parts;

            try {
                await this.run(cmd, args, client);
            } catch (e) {
                console.error(e.message);
            }

            rl.prompt();
        }).on('close', () => process.exit(0));
    }

    async run(cmd, args, client) {
        switch (cmd) {
            case 'help':
            case '?':
                console.log([
                    `${accent('help')}       show this menu`,
                    `${accent('status')}     memory, ping, uptime`,
                    `${accent('reload')}     hot-reload all commands`,
                    `${accent('guilds')}     list connected servers`,
                    `${accent('portal')}     ${muted('<guild_id>')} generate invite`,
                    `${accent('prefix')}     ${muted('<guild_id> [new]')} view/set prefix`,
                    `${accent('say')}        ${muted('<target> <msg>')} send message`,
                    `${accent('eval')}       ${muted('<code>')} evaluate js`,
                    `${accent('clear')}      clear terminal`,
                    `${accent('exit')}       shutdown`,
                ].join('\n'));
                break;

            case 'status':
            case 'stats': {
                const mem = process.memoryUsage();
                const heap = Math.round(mem.heapUsed / 1024 / 1024);
                const rss = Math.round(mem.rss / 1024 / 1024);
                const up = Math.floor(process.uptime());
                const h = Math.floor(up / 3600), m = Math.floor((up % 3600) / 60), s = up % 60;
                const ping = client.ws.ping >= 0 ? `${client.ws.ping}ms` : '...';
                const users = client.guilds.cache.reduce((a, g) => a + (g.memberCount || 0), 0);
                console.log([
                    `${muted('ping')}     ${accent(ping)}`,
                    `${muted('uptime')}   ${accent(`${h}h ${m}m ${s}s`)}`,
                    `${muted('memory')}   ${accent(`${heap}mb`)} heap · ${accent(`${rss}mb`)} rss`,
                    `${muted('cache')}    ${accent(client.guilds.cache.size)} guilds · ${accent(users)} users · ${accent(client.channels.cache.size)} channels`,
                    `${muted('commands')} ${accent(client.commandHandler?.commands?.size || 0)} loaded`,
                    `${muted('runtime')}  node ${process.version} · ${os.platform()} ${os.arch()}`,
                ].join('\n'));
                break;
            }

            case 'reload': {
                if (!client.commandHandler) return console.warn('no command handler.');
                client.commandHandler.commands.clear();
                client.commandHandler.aliases.clear();
                client.commandHandler.loadCommands();
                console.log(ok(`reloaded ${client.commandHandler.commands.size} commands.`));
                break;
            }

            case 'guilds':
            case 'servers': {
                const sub = (args[0] || 'list').toLowerCase();
                if (sub === 'list') {
                    for (const g of client.guilds.cache.values()) {
                        console.log(`${accent(g.name)} ${muted(`(${g.id})`)} · ${g.memberCount} members`);
                    }
                } else if (sub === 'info' && args[1]) {
                    const g = client.guilds.cache.get(args[1]);
                    if (!g) return console.warn(`guild "${args[1]}" not found.`);
                    console.log(`${accent(g.name)} · ${g.id}\nowner: ${g.ownerId} · members: ${g.memberCount} · channels: ${g.channels.cache.size} · roles: ${g.roles.cache.size}`);
                } else if (sub === 'find' && args[1]) {
                    const q = args.slice(1).join(' ').toLowerCase();
                    const found = client.guilds.cache.filter(g => g.name.toLowerCase().includes(q) || g.id === q);
                    if (!found.size) return console.warn('no matches.');
                    for (const g of found.values()) console.log(`${accent(g.name)} ${muted(`(${g.id})`)} · ${g.memberCount}`);
                } else if (sub === 'leave' && args[1]) {
                    const g = client.guilds.cache.get(args[1]);
                    if (!g) return console.warn(`guild "${args[1]}" not found.`);
                    await g.leave();
                    console.log(ok(`left "${g.name}".`));
                } else {
                    console.log(muted('guilds <list|info|find|leave>'));
                }
                break;
            }

            case 'portal': {
                if (!args[0]) return console.log(muted('portal <guild_id>'));
                const g = client.guilds.cache.get(args[0]);
                if (!g) return console.warn('guild not found.');
                const ch = g.channels.cache.find(c => c.isTextBased() && c.permissionsFor(g.members.me)?.has('CreateInstantInvite'));
                if (!ch) return console.warn('no suitable channel.');
                const inv = await ch.createInvite({ maxAge: 0, maxUses: 1 }).catch(() => null);
                if (inv) console.log(ok(inv.url));
                else console.warn('failed to create invite.');
                break;
            }

            case 'prefix': {
                if (!args[0]) return console.log(muted('prefix <guild_id> [new|reset]'));
                if (!args[1]) {
                    const cur = client.db?.getGuildPrefix(args[0]) || config.prefix;
                    console.log(`prefix for ${args[0]}: ${accent(cur)}`);
                } else if (args[1] === 'reset') {
                    if (client.db) await client.db.setGuildPrefix(args[0], null);
                    console.log(ok(`reset to "${config.prefix}".`));
                } else {
                    if (args[1].length > 5) return console.warn('max 5 characters.');
                    if (client.db) await client.db.setGuildPrefix(args[0], args[1]);
                    console.log(ok(`set to "${args[1]}".`));
                }
                break;
            }

            case 'say': {
                if (args.length < 2) return console.log(muted('say <channel_or_user_id> <message>'));
                let dest = client.channels.cache.get(args[0]) || await client.channels.fetch(args[0]).catch(() => null);
                if (!dest) {
                    const u = client.users.cache.get(args[0]) || await client.users.fetch(args[0]).catch(() => null);
                    if (u) dest = await u.createDM().catch(() => null);
                }
                if (!dest?.isTextBased()) return console.warn('invalid target.');
                await dest.send(args.slice(1).join(' '));
                console.log(ok('sent.'));
                break;
            }

            case 'eval': {
                if (!args.length) return console.log(muted('eval <code>'));
                const code = args.join(' ');
                try {
                    const bot = client.harm || client;
                    const db = client.db;
                    let res = eval(code);
                    if (res instanceof Promise) res = await res;
                    console.log(typeof res === 'object' ? require('util').inspect(res, { depth: 1, colors: true }) : String(res));
                } catch (e) {
                    console.error(e.message);
                }
                break;
            }

            case 'clear':
            case 'cls':
                process.stdout.write('\x1Bc');
                break;

            case 'exit':
            case 'quit':
                console.log(muted('shutting down...'));
                await client.destroy();
                process.exit(0);
                break;

            default:
                console.warn(`unknown command "${cmd}". type "help".`);
        }
    }
}

module.exports = Start;