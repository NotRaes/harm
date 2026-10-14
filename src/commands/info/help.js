const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  AttachmentBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  SectionBuilder,
  ThumbnailBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  MediaGalleryBuilder,
  MediaGalleryItemBuilder,
  MessageFlags
} = require('discord.js');
const path = require('path');
const fs = require('fs');
const build = require('../../structures/utils/builder.js');
const config = require('../../config.js');

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) =>
    Array.from({ length: b.length + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[a.length][b.length];
}

class HelpCommand {
  constructor() {
    this.name = 'help';
    this.aliases = ['h', 'commands', 'cmds'];
    this.description = 'consult the system directives.';
    this.cooldown = 3;
  }

  async execute(message, args) {
    const client = message.client;
    const prefix = (message.guild && client.db) ? (client.db.getGuildPrefix(message.guild.id) || config.prefix || ',') : (config.prefix || ',');
    const color = config.colors.c;

    let jumpToCategory = null;

    if (args && args.length > 0) {
      const cmdName = args[0].toLowerCase();
      const subName = args.length > 1 ? args.slice(1).join(' ').toLowerCase() : null;

      // Check if arg is a category name first (when no subcommand requested)
      const knownCats = new Set();
      for (const [, cmd] of client.commandHandler.commands) {
        const cat = (cmd.category || 'other').toLowerCase().trim();
        if (cat === 'owner' && !config.owners.includes(message.author.id)) continue;
        knownCats.add(cat);
      }

      if (!subName && knownCats.has(cmdName)) {
        jumpToCategory = cmdName;
      } else {
        // Try exact command/alias lookup
        let command = client.commandHandler.commands.get(cmdName);
        if (!command) {
          const aliasName = client.commandHandler.aliases.get(cmdName);
          if (aliasName) command = client.commandHandler.commands.get(aliasName);
        }

        if (command) {
          if (subName && Array.isArray(command.subcommands)) {
            const matchedSub = command.subcommands.find(s => s.toLowerCase().includes(subName) || s.toLowerCase().split(' ').slice(1).join(' ').startsWith(subName));
            if (matchedSub) {
              return build.helpSubcommand(message, command, matchedSub);
            }
          }
          return build.help(message, command);
        } else {
          // Fuzzy search fallback
          const allNames = [...client.commandHandler.commands.keys()];
          let best = null, bestDist = Infinity;
          for (const name of allNames) {
            const d = levenshtein(cmdName, name);
            if (d < bestDist) { bestDist = d; best = name; }
          }
          const suggestion = best && bestDist <= 3 ? `\n> did you mean \`${config.prefix}${best}\`?` : '';
          return message.reply(build.warnBox('nothing found', `\`${cmdName}\` is not a recognised command.${suggestion}`));
        }
      }
    }

    const categories = {};
    for (const [name, command] of client.commandHandler.commands) {
      const category = command.category || 'other';
      const normCat = category.toLowerCase().trim();
      if (normCat === 'owner' && !config.owners.includes(message.author.id)) continue;
      if (!categories[normCat]) categories[normCat] = { name: category, commands: [] };
      categories[normCat].commands.push(command);
    }

    const sortedCats = Object.values(categories).sort((a, b) => a.name.localeCompare(b.name));
    const e = config.emojis;
    const bannerDir = path.resolve(__dirname, '../../structures/utils/assets/banners');
    const helpBannerPath = path.join(bannerDir, 'help.png');
    // ── pre-cache all banner files once (zero disk I/O on button clicks) ──
    const _helpBannerExists = fs.existsSync(helpBannerPath);
    const _bannerCache = new Map(); // page index → { path, name } or null
    _bannerCache.set(0, _helpBannerExists ? { path: helpBannerPath, name: 'help.png' } : null);

    const MAX_PARENT_PER_PAGE = 5;
    const categoryEmbeds = [];
    const categoryStartIndices = new Map();
    let globalPageCounter = 1;

    sortedCats.forEach(cat => {
      const catKey = cat.name.toLowerCase().trim();
      const mainCmdObjs = cat.commands.filter(cmd => !cmd.parent);
      const mainCmds = [...new Set(mainCmdObjs.map(cmd => cmd.name))].sort();

      // Total action count across the entire category
      let totalCatActionCount = 0;
      const noSubLines = [];
      const withSubLines = [];

      for (const mainCmd of mainCmds) {
        const cmdObj = mainCmdObjs.find(cmd => cmd.name === mainCmd);
        if (cmdObj && Array.isArray(cmdObj.subcommands) && cmdObj.subcommands.length > 0) {
          totalCatActionCount += cmdObj.subcommands.length;
          const rawActions = cmdObj.subcommands.map(sub => {
            const cleaned = sub.replace(new RegExp('^' + mainCmd + '\\s+', 'i'), '').trim();
            return cleaned.split(/\s+/)[0];
          }).filter(Boolean);
          const uniqueActions = [...new Set(rawActions)];
          const highlightedSubs = uniqueActions.map(action => `\`${action}\``).join(' • ');
          withSubLines.push(`\`${mainCmd}\`\n${e.extender} *subcommands:* ${highlightedSubs}`);
        } else {
          totalCatActionCount += 1;
          noSubLines.push(`\`${mainCmd}\``);
        }
      }

      const categoryName = cat.name.charAt(0).toUpperCase() + cat.name.slice(1);
      const categoryDesc = this.getCategoryDescription(catKey, totalCatActionCount);

      // Pre-resolve category banner
      const catBannerName = `${catKey}.png`;
      const catPath = path.join(bannerDir, catBannerName);
      let catBanner = null;
      if (fs.existsSync(catPath)) {
        catBanner = { path: catPath, name: catBannerName };
      } else if (_helpBannerExists) {
        catBanner = { path: helpBannerPath, name: 'help.png' };
      }

      // Chunk parent commands (max 5 per page)
      // If there are no parent commands, 1 chunk (empty) handles showing singular commands
      const parentChunks = [];
      if (withSubLines.length === 0) {
        parentChunks.push([]);
      } else {
        for (let i = 0; i < withSubLines.length; i += MAX_PARENT_PER_PAGE) {
          parentChunks.push(withSubLines.slice(i, i + MAX_PARENT_PER_PAGE));
        }
      }

      const totalChunks = parentChunks.length;
      categoryStartIndices.set(catKey, globalPageCounter);

      parentChunks.forEach((chunkParents, chunkIdx) => {
        let description = '';

        // Singular commands are shown first on the first embed only
        if (chunkIdx === 0 && noSubLines.length > 0) {
          description += `> ${noSubLines.join(', ')}`;
        }

        if (chunkParents.length > 0) {
          if (description) description += '\n\n';
          description += chunkParents.join('\n\n');
        }

        description = description.trim();

        // If sole page (only 1 page for this category), do not show redundant page numbering
        const isSole = totalChunks <= 1;
        const pageHeader = isSole
          ? `*${categoryDesc}*\n\n`
          : `*${categoryDesc} • page ${chunkIdx + 1} of ${totalChunks}*\n\n`;

        const embed = new EmbedBuilder()
          .setColor(color)
          .setDescription(
            `${e.leftwing || '✦'} **__${cat.name.toLowerCase()}__ [${totalCatActionCount}]** ${e.rightwing || '✦'}\n` +
            pageHeader +
            (description || '>>> *no commands registered.*')
          );

        if (catBanner) {
          embed.setImage(`attachment://${catBanner.name}`);
        }

        _bannerCache.set(globalPageCounter, catBanner);
        categoryEmbeds.push(embed);
        globalPageCounter++;
      });
    });

    const totalCategories = Object.keys(categories).length;
    const totalCommands = Object.values(categories)
      .flatMap(cat => cat.commands)
      .filter(cmd => !cmd.parent)
      .map(cmd => cmd.name)
      .filter((v, i, a) => a.indexOf(v) === i)
      .length;

    const supportUrl = config.supportInvite || 'https://discord.gg/eqwcPU2mfS';
    const helpEmbed = new EmbedBuilder()
      .setColor(color)
      .setThumbnail(client.user.displayAvatarURL({ size: 1024, dynamic: true }))
      .setDescription(
        `${e.leftwing || '✦'} **harm** ${e.rightwing || '✦'}\n` +
        `[__**${totalCommands} commands · ${totalCategories} categories**__](${supportUrl})\n\n` +
        `> ${e.al} go back 1 page.\n` +
        `> ${e.ar} go forward 1 page.\n` +
        `> ${e.dots} choose a category.\n` +
        `> ${e.cancel ? `${e.cancel} ` : ''}close this menu.\n\n` +
        `__***note***__**:** *you can join our [support server](${supportUrl}) to get help.*`.toLowerCase()
      );

    const homeBanner = _bannerCache.get(0);
    if (homeBanner) helpEmbed.setImage(`attachment://${homeBanner.name}`);

    const homeRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('arrow_left')
        .setEmoji(config.emojis.al)
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId('arrow_right')
        .setEmoji(config.emojis.ar)
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId('show_dropdown')
        .setEmoji(config.emojis.dots)
        .setStyle(ButtonStyle.Secondary),

      new ButtonBuilder()
        .setCustomId('help_close')
        .setEmoji(config.emojis.cancel)
        .setStyle(ButtonStyle.Secondary)
    );

    const categoryOptions = [
      new StringSelectMenuOptionBuilder()
        .setLabel('home')
        .setDescription('return to overview')
        .setValue('page_0')
    ];

    sortedCats.forEach(cat => {
      const catKey = cat.name.toLowerCase().trim();
      const startIdx = categoryStartIndices.get(catKey) || 1;
      const cmdCount = cat.commands.filter(c => !c.parent).length;
      categoryOptions.push(
        new StringSelectMenuOptionBuilder()
          .setLabel(cat.name.toLowerCase())
          .setDescription(`${cmdCount} commands`)
          .setValue(`page_${startIdx}`)
      );
    });

    const dropdownRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('help_category_select')
        .setPlaceholder('choose a category...')
        .addOptions(categoryOptions.slice(0, 25))
    );

    const pages = [helpEmbed, ...categoryEmbeds];
    const totalPages = pages.length;
    let currentPage = 0;
    if (jumpToCategory) {
      const catIdx = categoryStartIndices.get(jumpToCategory);
      if (catIdx !== undefined && catIdx < totalPages) currentPage = catIdx;
    }
    let dropdownOpen = false;

    const timeoutText = (page) => `page ${page}/${totalPages} • 30s timeout`;

    // cached file getter — no fs calls, just reads from the pre-resolved map
    const getPageFiles = (page) => {
      const banner = _bannerCache.get(page);
      return banner ? [new AttachmentBuilder(banner.path, { name: banner.name })] : [];
    };

    const initialFiles = getPageFiles(currentPage);
    const sendOptions = {
      embeds: [pages[currentPage].setFooter({ text: timeoutText(currentPage + 1) })],
      components: [homeRow]
    };
    if (initialFiles.length > 0) {
      sendOptions.files = initialFiles;
    }

    const sent = await message.channel.send(sendOptions);

    const helpMessageId = sent.id;

    const collector = sent.createMessageComponentCollector({ time: 30000 });

    const updateMenu = async (interaction) => {
      const pageFiles = getPageFiles(currentPage);
      const updateOptions = {
        embeds: [pages[currentPage].setFooter({ text: timeoutText(currentPage + 1) })],
        components: dropdownOpen ? [homeRow, dropdownRow] : [homeRow]
      };
      if (pageFiles.length > 0) updateOptions.files = pageFiles;
      await interaction.update(updateOptions);
    };

    collector.on('collect', async (interaction) => {
      try {
        if (interaction.user.id !== message.author.id) {
          await interaction.reply({ content: "menu is already taken.", flags: MessageFlags.Ephemeral });
          return;
        }

        collector.resetTimer();

        if (interaction.isButton()) {
          if (interaction.customId === 'arrow_left') {
            currentPage = (currentPage - 1 + totalPages) % totalPages;
            await updateMenu(interaction);
            collector.resetTimer();
            return;
          } else if (interaction.customId === 'arrow_right') {
            currentPage = (currentPage + 1) % totalPages;
            await updateMenu(interaction);
            collector.resetTimer();
            return;
          } else if (interaction.customId === 'show_dropdown') {
            dropdownOpen = !dropdownOpen;
            await updateMenu(interaction);
            collector.resetTimer();
            return;
          } else if (interaction.customId === 'help_close') {
            collector.stop('closed');
            return sent.delete().catch(() => {});
          } else {
            return;
          }
        } else if (interaction.isStringSelectMenu()) {
          if (interaction.customId === 'help_category_select') {
            const selectedValue = interaction.values[0];
            if (selectedValue.startsWith('page_')) {
              const pageIdx = parseInt(selectedValue.replace('page_', ''), 10);
              if (isNaN(pageIdx) || pageIdx < 0 || pageIdx >= totalPages) {
                await interaction.reply({ content: 'invalid page.', flags: MessageFlags.Ephemeral });
                return;
              }
              currentPage = pageIdx;
              dropdownOpen = false;
              await updateMenu(interaction);
              return;
            }
          }
        }
      } catch (err) {
        console.error('help menu interaction error>', err);
      }
    });

    collector.on('end', async (_, reason) => {
      if (reason === 'closed') return;
      const disabledButtonRow = new ActionRowBuilder().addComponents(
        homeRow.components.map(button =>
          ButtonBuilder.from(button).setDisabled(true)
        )
      );
      await sent.edit({ components: [disabledButtonRow] }).catch(() => { });
    });
  }

  getCategoryDescription(categoryName, commandCount) {
    const descriptions = {
      'economy': `currency and trading • ${commandCount} commands`,
      'fun': `mini-games and fun commands • ${commandCount} commands`,
      'honeypot': `automated spam-bot defense • ${commandCount} commands`,
      'info': `general information and stats • ${commandCount} commands`,
      'moderation': `server moderation tools • ${commandCount} commands`,
      'security': `server defense and security • ${commandCount} commands`,
      'utility': `productive utilities • ${commandCount} commands`,
      'admin': `server administration • ${commandCount} commands`,
      'music': `music playback and controls • ${commandCount} commands`,
      'soundboard': `custom soundboard sounds • ${commandCount} commands`,
      'voicemaster': `join to create voice channels • ${commandCount} commands`
    };
    return descriptions[categoryName] || `commands • ${commandCount} commands`;
  }
}

module.exports = HelpCommand;
