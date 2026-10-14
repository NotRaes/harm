/*======Variables for the bot======*/
const { harm } = require('./structures/harm');
const config = require('./config.js');

/*======Initialise the bot======*/
const bot = new harm(config);
bot.init();
