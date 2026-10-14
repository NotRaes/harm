# Harm — Agent Instructions & Aesthetics Standard

## 1. Project Overview & Identity

You are working on **Harm**, a high-tier, aesthetic Discord bot and dashboard built with:

- **Runtime**: Node.js (CommonJS: `require` / `module.exports`)
- **Discord Framework**: `discord.js` v14 (`^14.25.1`)
- **Command Architecture**: Prefix-based commands (default `,`, dynamic per-guild prefix via `client.db.getGuildPrefix()`, bot mention support)
- **Primary UI Engine**: **Discord Components V2** (`ContainerBuilder`, `TextDisplayBuilder`, `SeparatorBuilder`, `SectionBuilder`, `MediaGalleryBuilder`, `ThumbnailBuilder`, `ActionRowBuilder`, `ButtonBuilder`, `MessageFlags.IsComponentsV2`) with graceful fallback to `EmbedBuilder`
- **Database Engine**: SQLite with WAL mode (`sqlite` + `sqlite3`) managed through `client.db` ([DatabaseManager](file:///c:/Users/Jaii/Desktop/harm/src/structures/utils/helpers/database.js))
- **Audio Engine**: Lavalink v4 via `lavalink-client` (`client.lavalink`, `client.music`)
- **Canvas / Media**: `@napi-rs/canvas` with custom fonts loaded from `src/structures/utils/assets/fonts/`
- **Website Docs**: React 19 + Tailwind v4 + Vite in [`website/`](file:///c:/Users/Jaii/Desktop/harm/website), synced via `sync_commands.js`

> **Note on Naming**: Harm is the official identity of the bot (`package.json` names the bot `harm`).

---

## 2. Directory & Architecture Map

```text
c:/Users/Jaii/Desktop/harm/
├── package.json                         # Dependencies & scripts (start, dev)
├── start.bat                            # Auto-restart script (node --watch src/index.js)
├── sync_commands.js                     # Synchronizes src/commands/ into website docs
├── src/
│   ├── index.js                         # Entry point (initializes harm client)
│   ├── config.js                        # Master configuration (tokens, prefix, colors, emojis, presence)
│   ├── structures/
│   │   ├── harm.js                      # Core bot client class
│   │   ├── kyoto.js                     # Compatibility shim exporting { harm, kyoto }
│   │   ├── command.js                   # CommandHandler (loading, cooldowns, typing, zod parsing)
│   │   ├── event.js                     # EventHandler (dynamic event loader)
│   │   └── utils/
│   │       ├── builder.js               # Notice builders (deny, warn, approved, say) & help UI
│   │       ├── assets/                  # Fonts, banners, icons, on add/
│   │       ├── data/                    # SQLite database (cases.db) & JSON storage
│   │       ├── helpers/                 # welcomeDM.js, database.js, music.js, voiceMasterHelper.js, etc.
│   │       └── workers/                 # Background workers (voicecleaner.js)
│   ├── commands/                        # Commands categorized into folders
│   │   ├── economy/
│   │   ├── fun/
│   │   ├── honeypot/
│   │   ├── info/                        # invite.js, avatar.js, banner.js, serverinfo.js, userinfo.js
│   │   ├── music/
│   │   ├── owner/
│   │   ├── soundboard/
│   │   ├── utility/                     # invites.js, embed.js, quote.js, steal.js, nuke.js
│   │   └── voicemaster/
│   └── events/                          # Discord Gateway events (messagecreate, interactioncreate, etc.)
└── website/                             # Vite React documentation website
    └── src/data/kyotoCommands.js        # Generated command metadata database
```

---

## 3. The Visual Standard & Aesthetics Trinity

Kyoto’s visual signature is defined by three reference implementations:
1. **`welcomedm` ([welcomeDM.js](file:///c:/Users/Jaii/Desktop/kyoto/src/structures/utils/helpers/welcomeDM.js))** — The gold standard for **Components V2 Layout, Hero UI, Tone of Voice & Media Hierarchy**.
2. **`invite` ([invite.js](file:///c:/Users/Jaii/Desktop/kyoto/src/commands/info/invite.js))** — The standard for **Command-level Components V2 with Embed Fallback**.
3. **`invites` ([invites.js](file:///c:/Users/Jaii/Desktop/kyoto/src/commands/utility/invites.js))** — The standard for **Data Displays, Metrics, Leaderboards & Embed Composition**.

---

### The Kyoto / Harm Aesthetic DNA (Examined from `welcomedm`)

To ensure any new card, command, or flow feels authentically Kyoto/Harm, strictly follow these core aesthetic tenets:

#### 1. Calm, Lowercase Tone of Voice
- **Everything is lowercase by default**: Commands, descriptions, headers, button labels, and system notices are written in lowercase (e.g., `welcome to harm!`, `do you like freebies?`, `join discord`, `invite harm`, `bonus invites added.`). Every user-facing string, error, and parameter hint must be lowercase; the only exceptions are Discord IDs, mentions, and unavoidable third-party external URLs.
- **No shouting, no corporate stiffness**: Avoid ALL-CAPS, exclamation spam (`!!!`), or stiff corporate greetings. Speak casually, confidently, and warmly.
- **Subtle emphasis**: Use bolding sparingly on key nouns or perks (`**harm**`, `**giveaways**`, `**discord**`, `**extra goodies**`, `**quickstart**`).
- **Tone Guardrail & Vocabulary Blacklist**:
  - **Forbidden Vocabulary**: Never use grandiose, dramatic, or pretentious RPG words (e.g., `sanctum`, `ethereal`, `realm`, `ascension`, `divine`, `sovereign`, `tome`, `mystic`).
  - **Tone Profile**: Grounded, sleek, casual, and streetwise-minimalist. Speak like a modern aesthetic developer/curator, not a fantasy narrator.

#### 2. Dark Mode Immersion (`#2b2d31`)
- Base accent is always `0x2b2d31` / `#2b2d31` (`config.colors.c`).
- It seamlessly melds into Discord's native dark interface. Never use loud, high-saturation colors (like Discord's default blurple `#5865F2` or random neon colors) for primary cards or containers.

#### 3. Atmospheric Hero Media (Wide Glowing Banners)
- **Always use the master template**: The authentic base banner is located in `src/structures/utils/assets/banners/_true_base.png` (600x99). Never approximate or fake it with artificial canvas radial gradients.
- **Pre-baked Banners**: Hero banners in core categories (`banner.png`, `giveaways.png`, `help.png`, `utility.png`, `info.png`, `honeypot.png`, `fun.png`, etc.) are pre-rendered from this template.
- **Dynamic Banners**: When generating new banners via canvas, draw `_true_base.png` as the background using `loadImage()` and render lowercase spaced serif typography centered in white (`Cinzel` or `Zen Antique` font, e.g., `h a r m`, `g i v e a w a y s`, `d e m o`).
- **Mandatory Bottom Anchor Placement for All Commands**: Banners in all command containers **must be placed below the content, not above**. Summit banners are strictly reserved for Welcome DM onboarding. In every in-guild command container (diagnostics, hubs, dashboards, utility, metrics), the glowing banner is anchored at the **base** of the card body (directly above the single separator and action row). This ensures text and metrics are instantly visible without being pushed off screen by large graphics.

#### 4. Asymmetric Accessories (Section + Thumbnail)
- `welcomedm` pairs promotional text blocks with a right-aligned accessory thumbnail (`duck_phone.png`) via `SectionBuilder.setThumbnailAccessory()`.
- This asymmetric layout prevents card fatigue, creating a distinct, boutique Discord feel rather than plain stacked text boxes.

#### 5. Breathable Micro-Copy (Subtext Rhythm & Dashboard Simplicity)
- **Calm, Compact Text (Max 5–8 Lines)**: Never dump 20+ lines of raw technical telemetry, verbose diagnostic lists, or all subcommand guides into a single main card. That causes ugly visual clutter.
- **Progressive Disclosure**: Keep the primary dashboard overview breathable and focused. Use select menus or ephemeral views to reveal deeper subcommands, guides, and diagnostics on demand.
- Information is broken down line-by-line using `-# ` subtext.

#### 6. Notice vs. Container Discipline (Anti-Bloat Rule)
- **Never wrap one-shot actions or toggles in giant containers**: Commands that perform an action, toggle a setting, or execute a single task (such as `,lock uwu @user`, `,lock reset`, `,prefix !`, `,honeypot toggle`, adding a bonus invite) **MUST** use lightweight `build.approved`, `build.warn`, or `build.deny` notices.
- Giant Components V2 containers with glowing media banners are **strictly reserved for flagship interactive hubs and dashboards** (e.g. running `,honeypot`, `,work`, `,card`, `,profile`, `,voicemaster` with no arguments). Wrapping quick actions in 300px containers with banners makes the bot look clunky and bloated.

#### 7. Multi-Container Pacing (Two Separate Containers, Not a Bloated Monolith)
- `welcomedm` is **two separate, lightweight containers** delivered sequentially (with a 600ms cadence), **NOT** a single huge 3-divider monolithic card:
  - **Container 1 (Identity & Quickstart)**: `banner.png` → Separator → Welcome Greeting → Separator → Quickstart block. (No accessory, no buttons).
  - **Container 2 (Community & CTA)**: `giveaways.png` → Separator → Promo Section with right-aligned Thumbnail Accessory (`duck_phone.png`) → Separator → ActionRow Link Buttons.
- **Anti-Pattern**: Do NOT combine every element of `welcomedm` (summit banner, greeting, quickstart, thumbnail accessory, action row) into a single overloaded card with 3+ dividers. Keep individual command cards clean, focused, and breathable (aim for 1–2 separators per container).

---

### Standard A: Components V2 Hero Containers (`honeypot`, `work`, `voicemaster`, `invite`)

When building hero cards, feature overviews, welcome flows, or interactive command displays:
- **Take inspiration, do not blindly clone**: `welcomedm` provides aesthetic direction (colors, tone, typography, subtext rhythm), but individual commands should arrange components to best suit their data.
- **Mandatory Layout for All In-Guild Command Containers**:
  Banners MUST be anchored at the bottom, never at the top. The universal command container layout is:

```text
┌────────────────────────────────────────────────────────┐
│  Section with Thumbnail Accessory                      │
│  - Header & Subtext (### title + -# description)       │
│  - Data Metrics & Telemetry (calm 3-5 lines max)       │
├────────────────────────────────────────────────────────┤
│  MediaGallery (Wide glowing banner at base)            │
├────────────────────────────────────────────────────────┤
│  Separator (Divider: true, Spacing: Small)             │
├────────────────────────────────────────────────────────┤
│  ActionRow (Select Menu and/or Action Buttons)         │
└────────────────────────────────────────────────────────┘
```

#### 3. Asset Resolution Pattern
Never hardcode single relative paths for media files. Follow `WelcomeDMHelper`'s candidate-path resolver:
```javascript
function getBannerAttachment() {
    const candidatePaths = [
        path.resolve(__dirname, '../../structures/utils/assets/on add/banner.png'),
        path.resolve(__dirname, '../assets/on add/banner.png'),
        path.resolve(__dirname, '../../../assets/on add/banner.png'),
        path.resolve(__dirname, '../../assets/on add/banner.png')
    ];
    for (const candidate of candidatePaths) {
        if (fs.existsSync(candidate)) {
            return new AttachmentBuilder(candidate, { name: 'banner.png' });
        }
    }
    return null;
}
```

#### 4. Discord Typography Mastery & Typing Tricks

Kyoto/Harm relies on specific Discord-native markdown styling tricks to achieve its sleek, muted, modern look. Always use the following typing conventions:

##### A. Subtext (`-# `)
Discord's `-# ` prefix renders muted, small gray typography.
- **When TO use**:
  - Description body directly below a header:
    ```markdown
    ### [welcome to **harm**!](https://discord.gg/eqwcPU2mfS)
    -# thanks for adding harm to your server! your members can now use all of harm's commands with the `,` prefix — no setup needed.
    ```
  - Quickstart blocks, guides, and bullet points:
    ```markdown
    -# **quickstart**:
    -# `,help` — list of all available commands
    -# `,prefix <new>` — customize the server prefix
    ```
  - Explanatory notes and contextual help:
    ```markdown
    -# **note:** **you** or *others* can also mention <@1490995846626545674> at any time if they forget the prefix.
    ```
  - Pagination counters & parameter legend in Components V2:
    ```markdown
    -# **subcommand 1 of 5** • parameters in `<>` are required, `[]` are optional.
    ```
- **When NOT to use**:
  - Never wrap top-level titles or headers in `-# `. Headers must remain prominent (`### ` or `## `).
  - Never use `-# ` inside `build.deny` / `build.warn` / `build.approved` notice embeds (keep notices standard text for punchy readability).

##### B. Masked Anchor Headers (`### [title](url)`)
- In Discord Components V2, placing a markdown link inside a `### ` header renders glowing blue interactive header text:
  ```markdown
  ### [invite **harm**](https://discord.com/oauth2/authorize?client_id=1490995846626545674)
  ### [welcome to **harm**!](https://discord.gg/eqwcPU2mfS)
  ```
- **When TO use**: At the summit of hero containers (`welcomeDM`, `invite`, external links) where clicking navigates directly to the invite or server.
- **When NOT to use**: For standard informational text displays that don't lead to a destination URL (use `### lowercase title?` or `## Title` instead).

##### C. ANSI Escape Code Blocks (```ansi)
Discord supports 16-color ANSI code blocks. Kyoto uses ANSI syntax blocks in `build.help`:
```javascript
const ansiCode = `\`\`\`ansi\n\u001b[0;32mSyntax:\u001b[0m  ${syntaxText}\n\u001b[0;31mExample:\u001b[0m ${exampleText}\n\`\`\``;
```
- **Color Palette**:
  - Green (`\u001b[0;32m`): Syntax definitions, success indicators, command prefixes.
  - Red (`\u001b[0;31m`): Examples, parameters, highlights.
  - Blue (`\u001b[0;34m`): Category names, counters.
  - Gray / Subdued (`\u001b[0;30m`): Secondary metadata.
  - Reset (`\u001b[0m`): **Mandatory** at the end of every colored span.
- **When TO use**: Command syntax displays, interactive help menus, technical parameters, and code previews.
- **When NOT to use**: Conversational dialogs, notices, or descriptions.

##### D. Inline Badges & Interpuncts
- Backtick inline code (`` `code` ``) for prefixes, command names, arguments, and numeric metrics:
  ```markdown
  **joined** `+18` · **left** `-4` · **fake** `0` · **bonus** `0`
  ```
- Use the middle dot (`·`) or em dash (`─`) for clean separation rather than pipes (`|`) or slashes (`/`).

##### E. Dynamic Timestamps & Mentions
- Relative time: `<t:${Math.floor(Date.now() / 1000)}:R>` → `"3 minutes ago"` / `"in 2 hours"`
- Short date/time: `<t:${Math.floor(Date.now() / 1000)}:f>` → `"October 8, 2026 6:30 PM"`
- User mentions in notices: `<@${user.id}>**:**` (Notice the bold colon directly after the mention).

##### F. Blockquotes (`>` and `>>>`)
- Single line quote (`> `): Used for suggestions or quick tips (e.g., `> did you mean `,help`?`).
- Multi-line quote (`>>> `): Used for message quotation commands (`quote.js`) or multiline citations.

#### 5. Section with Thumbnail Accessory
For highlighted promos or user cards with a small right-aligned thumbnail (like the duck accessory or user avatar):
```javascript
const section = new SectionBuilder()
    .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `### do you like freebies?\n` +
            `-# join dc to get freebies like \`${p}gen fm\`.\n` +
            `-# we often host **giveaways** and drop exclusive perks on our [**discord**](${supportUrl}).\n` +
            `-# don't miss out on **extra goodies**!`
        )
    )
    .setThumbnailAccessory(new ThumbnailBuilder().setURL('attachment://duck_phone.png'));
container.addSectionComponents(section);
```

#### 6. Action Row & Buttons
- Clean link buttons or primary action buttons with brand emojis:
  ```javascript
  const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setLabel('join discord')
          .setEmoji('<:discord_logo:1529300434374758481>')
          .setURL(supportUrl),
      new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setLabel('invite harm')
          .setEmoji(config.emojis?.harm || '<:harmsdio:1556221836507742278>')
          .setURL(inviteUrl)
  );
#### 7. Divider & Separator Discipline (Discord Components V2 Native Dividers)

Never use markdown text dashes (such as `---` or `-----------------`) inside containers. Always use native Discord Components V2 separators:

```javascript
new SeparatorBuilder()
    .setDivider(true)
    .setSpacing(SeparatorSpacingSize.Small)
```

##### The Divider Budget (0, 1, or 2 Dividers — Never 3)
A single container must **never feel chopped-up or cluttered**. Follow this strict divider budget:

1. **0 Dividers**:
   - Short status messages, notices, or single-phrase confirmation cards.
2. **1 Divider**:
   - **Bottom-Anchored Cards (Ping, Metrics, Utilities)**: `[Header + Metrics Section with Thumbnail]` → `[Bottom Banner]` → `Divider` → `[ActionRow]`. (Only 1 divider right before the buttons).
   - **Simple Action Cards**: `[Content Body]` → `Divider` → `[ActionRow]`.
   - **Summit Read-Only Cards**: `[Summit Banner]` → `Divider` → `[Content Body]`.
3. **2 Dividers (Maximum for a Single Container)**:
   - **Summit Hero with CTA**: `[Summit Banner]` → `Divider` → `[Promo Section with Thumbnail]` → `Divider` → `[ActionRow Link Buttons]` (like `welcomeDM` Container 2).
   - **Summit Hero with Sub-Block**: `[Summit Banner]` → `Divider` → `[Welcome Greeting]` → `Divider` → `[Quickstart List]` (like `welcomeDM` Container 1).
4. **3 Dividers is a Strict Anti-Pattern**:
   - A single container must **never have 3 or more dividers**. If you find yourself placing 3 dividers, the card is either:
     - **Sandwiching a banner**: Placing dividers both above and below an image creates ugly horizontal rails.
     - **Chopping coupled text**: Splitting a header from the metrics or text that directly belongs to it.
     - **Overloaded with two jobs**: If a command actually has two distinct messages or phases, **split it into two separate containers**!

##### When to Break a Command into Multiple Containers (2+ Embeds)
Do not force everything into one bloated card. Split into two sequential containers when:
1. **Two Distinct Conceptual Phases**: Like `welcomeDM`, where Container 1 handles bot identity & quickstart, while Container 2 handles community perks, giveaways, and action links.
2. **Setup / Wizard Workflows**: Container 1 displays active server state / diagnostic report; Container 2 displays actionable configuration buttons / select menus.
3. **Paced Cadence**: When delivering multiple containers, send them sequentially with a calm delay (`await new Promise(r => setTimeout(r, 600));`). Each container must be lightweight with at most 1–2 dividers.

##### When NOT to Place a Components V2 Divider (Anti-Patterns):
1. **Never Sandwich Media Banners (The Rail Anti-Pattern)**:
   - **Never** place a divider immediately above AND immediately below a media banner (`Separator -> MediaGallery -> Separator`). Banners already have stark contrast and natural borders.
2. **Never at Container Perimeters**:
   - Never add a divider as the very first component in a container (before the banner/header).
   - Never add a divider as the very last component in a container (after buttons/footers).
   - Containers already have native padding and borders; edge dividers create ugly empty gutters.
3. **Never Between Tightly-Coupled Text Elements**:
   - Never place a divider between a header (`### title`) and its accompanying metrics or description (`-# text`). Keep them unified in a single `SectionBuilder` or adjacent `TextDisplayBuilder`.
   - Never place a divider between an explanatory label and the ANSI code block directly illustrating it.
4. **Never Consecutively (Double Dividers)**:
   - Never place two `SeparatorBuilder` components back-to-back.
5. **Never Between Closely Related Action Rows**:
   - If a container has a Select Menu row and a Button row, keep them grouped without an intervening separator.
6. **Never Use Markdown Fake Dividers**:
   - Strictly prohibit text-based dividers (`---`, `____`, `========`) inside container text displays. Use native `SeparatorBuilder`.

#### 8. Mandatory Embed Fallback (`invite.js` Pattern)
Every Components V2 response **must** be wrapped in a `try / catch` that gracefully falls back to `EmbedBuilder`:
```javascript
try {
    return await message.reply({
        components: [container],
        files,
        flags: MessageFlags.IsComponentsV2
    });
} catch (err) {
    const fallbackEmbed = new EmbedBuilder()
        .setColor(config.colors.c || '#2b2d31')
        .setDescription(fallbackMarkdown);
    if (attachment) fallbackEmbed.setImage(`attachment://${attachment.name}`);
    return await message.reply({ embeds: [fallbackEmbed], components: [row], files }).catch(() => {});
}
```

#### 9. Interactive Component Collectors & Author-Lock Guard

When building interactive menus (buttons, dropdowns, carousels):
- **Author-Only Interaction Guard**: Always restrict interaction strictly to the command invoker. Never allow other users to hijack the menu:
  ```javascript
  const collector = replyMsg.createMessageComponentCollector({
      time: 30000 // 30s to 60s lifecycle
  });

  collector.on('collect', async i => {
      if (i.user.id !== message.author.id) {
          return i.reply({
              content: 'only the command author can control this menu.',
              ephemeral: true
          }).catch(() => {});
      }

      // Handle transitions (e.g. prev, next, dropdown selects)...

      // Always re-apply IsComponentsV2 flag when updating Components V2 containers:
      await i.update({
          components: [updatedContainer],
          flags: MessageFlags.IsComponentsV2
      }).catch(() => {});
  });

  collector.on('end', async (_, reason) => {
      if (reason === 'deleted') return;
  });
  ```

---

### Standard B: Metric & Data Embeds (`invites`)

When displaying user statistics, server records, leaderboards, or profile cards:

#### 1. Color & Thumbnail
- Base Color: Always `config.colors.c` (`#2b2d31`).
- Thumbnail: User avatar (`targetUser.displayAvatarURL({ size: 1024, dynamic: true })`) or guild icon.

#### 2. Header & Subtitle
- Wing or star accents:
  ```javascript
  `${e.leftwing || '✦'} **invites** ${e.rightwing || '✦'}`
  `*invitation tracking and referral metrics.*`
  ```

#### 3. Structured Data Rows
- Clear labeled fields with backticked values:
  ```markdown
  **user** <@user_id>
  **total invites** `14`
  **joined** `+18` · **left** `-4`
  **fake** `0` · **bonus** `0`
  ```

#### 4. Leaderboard Rows
```markdown
`1.` <@user_id> ─ `42 invites`
+48 joined · -6 left · ~0 fake · ✨0 bonus
```

---

### Standard C: Notice & Status Embeds ([builder.js](file:///c:/Users/Jaii/Desktop/kyoto/src/structures/utils/builder.js))

For brief feedback, warnings, and permission failures, use the static methods in `src/structures/utils/builder.js`:

```javascript
// Approval / Success (Color: #2b2d31)
message.reply({ embeds: [build.approved(message.author, 'bonus invites added.')] });

// Warning / Missing Args (Color: #FAA81A)
message.reply({ embeds: [build.warn(message.author, 'syntax: ,invites add @user <amount>')] });

// Denial / Permission Error (Color: #ED4245)
message.reply({ embeds: [build.deny(message.author, 'you need the Manage Server permission.')] });

// Neutral Information (Color: #2b2d31)
message.reply({ embeds: [build.say(message.author, 'status message.')] });
```

Notice format produced:
`<emoji> <@user>**:** <message>`

---

## 4. Command Architecture & Standards

Every command must be a class extending the standard bot lifecycle:

```javascript
const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const build = require('../../structures/utils/builder.js');
const config = require('../../config.js');

class FeatureCommand {
    constructor(bot) {
        this.bot = bot;
        this.name = 'feature';
        this.aliases = ['feat', 'f'];
        this.description = 'concise lowercase description of feature.';
        this.syntax = ',feature <required> [optional]';
        this.example = ',feature test';
        this.category = 'utility';
        this.cooldown = 3;                     // seconds
        this.permissions = [];                 // e.g. ['ManageGuild'] or []
        this.subcommands = ['add', 'remove'];  // subcommands list (used in help & sync)
        this.ownerOnly = false;                // optional
        this.noTyping = false;                 // optional
        this.noAutoDelete = false;             // set true if category is not auto-kept
    }

    async execute(message, args, commandName) {
        // 1. Validate arguments using build.warn
        if (!args[0]) {
            return message.reply({
                embeds: [build.warn(message.author, `syntax: \`${this.syntax}\``)]
            });
        }

        // 2. Perform database or service logic via message.client.db
        // ...

        // 3. Return response using approved notice or Components V2 container
        return message.reply({
            embeds: [build.approved(message.author, 'feature executed successfully.')]
        });
    }
}

module.exports = FeatureCommand;
```

### Auto-Deletion Lifecycle
The command handler automatically cleans up command messages and responses after 5 seconds **unless**:
- The command category is in `keepCategories`: `['voicemaster', 'soundboard', 'info', 'utility', 'fun', 'music', 'honeypot', 'owner', 'economy', 'admin', 'moderation', 'security']`.
- Or the command instance specifies `this.noAutoDelete = true`.

### Dynamic Guild Prefix Standard
**Never hardcode the prefix `,` inside command code or user-facing strings.**
Guilds can configure custom prefixes via `client.db.setGuildPrefix(guildId, newPrefix)`.
Always dynamically resolve the guild prefix at the beginning of `execute()`:
```javascript
const p = (message.guild && message.client.db)
    ? (message.client.db.getGuildPrefix(message.guild.id) || config.prefix)
    : config.prefix;
```
Use this variable `p` across all:
- Argument warnings (`syntax: \`${p}command <arg>\``)
- Description copy, quickstarts, and subtext
- Embed titles, examples, and button callbacks

### Subcommands Architecture & Auto-Help Carousel
Kyoto organizes multi-action commands under single parent classes rather than splintering into separate commands:

1. **Subcommands Declaration**:
   Define `this.subcommands` and optionally `this.subcommandDetails` in the constructor:
   ```javascript
   this.subcommands = ['top', 'add', 'remove', 'reset'];
   this.subcommandDetails = {
       add: {
           description: 'add bonus invites to a server member.',
           syntax: ',invites add @user <amount>',
           example: ',invites add @user 5'
       }
   };
   ```
2. **Automated Help Carousel**:
   When a user invokes `,help <command>`, Kyoto inspects `this.subcommands`:
   - Automatically builds an interactive Components V2 carousel (Page 0: Overview, Page 1: Subcommands Index, Pages 2..N: Individual Subcommand Details).
   - Generates pagination controls (`help_prev`, `help_next`) and a dropdown toggle (`help_dots`) that opens a `StringSelectMenuBuilder` listing all subcommands.
3. **Dedicated Subcommand Lookups**:
   If a user executes `,help <command> <subcommand>` (e.g. `,help invites add`), Kyoto skips the carousel and executes `build.helpSubcommand()`, rendering an instant focused card for that specific subcommand.
4. **Command vs. Subcommand Discipline (Strict Anti-Pattern)**:
   - **Never create standalone command files for actions that are already subcommands of a parent command.** (e.g. do NOT create `uwulock.js`, `freakylock.js`, `drunklock.js` when `lock.js` already provides `lock uwu`, `lock freaky`, `lock drunk`).
   - Creating wrapper command files pollutes the registry, inflates category counts, and causes broken entries like `drunklock └ subcommands: lock` in `,help`.
   - If shorthand invocations are desired (e.g. allowing `,uwulock @user`), register them as **aliases on the parent command** and route them via `commandName` in `execute(message, args, commandName)`.

### The All-in-One Dashboard Standard (Flagship Commands)
For complex multi-action systems (e.g., `,honeypot`, `,work`, `,card`, `,profile`):
1. **Dual Access Model**:
   - **CLI Mode**: Direct subcommands (e.g. `,work shift`, `,honeypot status`) execute immediate, lightweight actions for power users.
   - **Dashboard Mode**: Invoking the parent command with no arguments (e.g. `,work`, `,honeypot`) **must not** error or print a generic help text. Instead, it must launch a rich, all-in-one Components V2 interactive dashboard.
2. **Dashboard Structure**:
   - **Live Telemetry & State**: The container displays current user or guild state (e.g., career dossier, cooldown timers, active trap status).
   - **StringSelectMenu Navigation**: A select menu listing all major actions/sub-actions with clear lowercase descriptions.
   - **Tactile Quick-Action Buttons**: 2–4 immediate action buttons (e.g., `clock in`, `view jobs`, `open card`).
3. **Author-Only Guard**: Always lock dashboard component collectors strictly to `message.author.id`.

---

## 5. Database Architecture (`client.db`)

All persistent storage resides in SQLite via [DatabaseManager](file:///c:/Users/Jaii/Desktop/harm/src/structures/utils/helpers/database.js) at `src/structures/utils/data/cases.db`:

1. **Single Access Point**: All database queries go through `message.client.db` (or `bot.db`). Never instantiate independent `sqlite3` handles in commands.
2. **Schema Registration**: Register new tables in `DatabaseManager._init()` inside `src/structures/utils/helpers/database.js`.
3. **In-Memory Caches**: For hot data paths (prefixes, toggles, blacklists), maintain in-memory `Map` or `Set` caches within `DatabaseManager`.
4. **Parameterized Queries**: Always use `?` placeholders with `this.db.run()`, `this.db.get()`, or `this.db.all()`.

---

## 6. Website Synchronization Protocol

The bot's documentation frontend at [`website/`](file:///c:/Users/Jaii/Desktop/kyoto/website) reads its live command registry from `website/src/data/kyotoCommands.js`.

Whenever you add, modify, or delete a command or alter its metadata:
1. Ensure `name`, `description`, `syntax`, `example`, `permissions`, `aliases`, and `subcommands` are up-to-date in the command class.
2. Run the synchronization script:
   ```powershell
   node sync_commands.js
   ```
3. Verify that the output confirms successful generation of `website/src/data/kyotoCommands.js`.

---

## 7. Golden Rules for Kyoto Agents

### NEVER
- **Do not convert JavaScript to TypeScript** or rewrite working CommonJS code.
- **Do not convert prefix commands to slash commands** unless explicitly instructed.
- **Do not downgrade Components V2** to standard embeds where Components V2 is already in use.
- **Do not invent bright, saturated, or cartoonish embed styles**; respect the `#2b2d31` dark, sleek, lowercase aesthetic.
- **Do not omit the Embed fallback** when writing new Components V2 messages.
- **Do not cram welcomedm into a monolithic 3-divider card**: `welcomedm` is two separate cards. For standalone commands, do not overload a single card with every single component.
- **Do not place banners at the summit of command containers**: All in-guild commands MUST use the bottom-anchor layout (header/metrics at top, glowing banner anchored at base above the separator and action row). Summit banners are reserved exclusively for Welcome DM onboarding.
- **Do not wrap one-shot actions or toggles in Components V2 containers**: One-shot commands, setting updates, and status toggles (e.g. `,lock`, `,prefix`, adding bonus invites, whitelisting) must use lightweight `build.approved`, `build.warn`, or `build.deny` notices. Never construct a 300px container with banners for quick actions.
- **Do not clutter dashboards with diagnostic text dumps**: Keep the main container card under 6–8 lines of calm, high-level summary. Subcommand documentation, setup diagnostics, and advanced tools belong in select menu transitions or ephemeral cards.
- **Do not substitute random unrelated emojis**: If an emoji (such as refresh, play, trash) does not exist in `config.emojis`, **never** pick an arbitrary custom emoji (e.g. using `extend` `├` for refresh). Inform the user that the emoji is missing from `config.js` and use clean text.
- **Do not use universal / unicode emojis**: Never use standard colorful Unicode emojis (such as 🍯, ⚡, 🔨, 🌪️, ⏳, 🚨, 🧹, ⚙️, 🗑️, 🔒, 🛡️, ⚠️, ✖️, ✅, ❌) in command cards, buttons, select menus, titles, or notices. The user designs and uploads custom Kyoto brand emojis later. Rely strictly on calm typography or verified custom Kyoto brand emojis from `config.emojis`.
- **Do not install new packages** without verifying if native Node.js or existing dependencies (`discord.js`, `@napi-rs/canvas`, `sqlite3`, `zod`, `lavalink-client`) can fulfill the requirement.
- **Do not hard-code** credentials, tokens, emojis, or colors that are defined in [config.js](file:///c:/Users/Jaii/Desktop/kyoto/src/config.js).
- **Do not modify unrelated files** when addressing a specific feature or bug.
- **Do not leave dead code or orphaned schema**: When a feature is retired or replaced, purge all corresponding database tables, in-memory cache maps/sets, startup queries, and unused event hooks immediately.
- **Do not use fantasy/RPG vocabulary**: Never use "sanctum", "ethereal", "realm", "ascension", or similar grandiose/pretentious terms; maintain a grounded, casual, lowercase modern tone.

### ALWAYS
- **Study the Trinity first**: Reference `welcomedm`, `invite`, and `invites` for layout, hierarchy, and styling before coding any user-facing UI.
- **Anchor media banners at the bottom of command containers**: In all Components V2 command containers, place the banner below the text/metrics and immediately above the action row separator.
- **Reserve full containers for flagship interactive hubs**: Only full multi-action dashboards (like `,honeypot`, `,work`, `,card`, `,profile`, `,voicemaster`) should render Components V2 containers.
- **Inform the user of missing emojis**: If an action needs an emoji not present in `config.emojis`, alert the user so they can provide the emoji ID rather than guessing a replacement.
- **Keep card dividers minimal**: Aim for 1 to 2 separators per container to maintain breathing room.
- **Check asset paths**: Use candidate-path scanning for attachments.
- **Use builder notices**: Use `build.approved`, `build.warn`, and `build.deny` for short feedback messages.
- **Validate syntax**: Run `node -c <file>` on any modified JavaScript file before finishing.
- **Run command sync**: Execute `node sync_commands.js` after touching public bot commands.
