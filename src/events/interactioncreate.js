const GiveawayHelper = require('../structures/utils/helpers/giveaway.js');
const VoiceMasterHelper = require('../structures/utils/helpers/voiceMasterHelper.js');

class InteractionCreateEvent {
    constructor(client) {
        this.name = 'interactionCreate';
        this.once = false;
        this.client = client;
    }

    async execute(interaction) {
        if (!interaction) return;

        const customId = interaction.customId || '';

        // VoiceMaster buttons, modals, and user select menus
        if (customId.startsWith('vm_')) {
            return await VoiceMasterHelper.handleInteraction(interaction);
        }

        // Button interactions
        if (interaction.isButton()) {
            // Giveaway Buttons
            if (customId.startsWith('gw_enter_') || customId.startsWith('gw_view_')) {
                return await GiveawayHelper.handleInteraction(interaction);
            }
        }
    }
}

module.exports = InteractionCreateEvent;
