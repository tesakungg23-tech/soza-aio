const { Client, GatewayIntentBits, Collection } = require('discord.js');
require('dotenv').config();
const config = require('./config.json');
const colors = require('./UI/colors/colors');
const loadLogHandlers = require('./logHandlers');
const { Partials } = require('discord.js');
const client = new Client({
    intents: Object.keys(GatewayIntentBits).map((a) => {
        return GatewayIntentBits[a];
    }),
    partials: [Partials.Channel]
});

client.commands = new Collection();
require('events').defaultMaxListeners = 100;


const loadEvents = require('./handlers/events');


loadEvents(client);


require('./handlers/security')(client);
require('./handlers/applications')(client);
require('./handlers/server');
require('./handlers/economyScheduler')(client);
require('./handlers/embedScheduler')(client);
require('./handlers/embedBuilderModals')(client);
require('./handlers/giveawayHandler')(client);
require('./handlers/serverStatsHandler')(client);
const boostHandler = require('./handlers/boostHandler');
boostHandler(client);
const ModMailHandler = require('./handlers/modMailHandler');
const LevelingHandler = require('./handlers/levelingHandler');
let levelingHandler;
const ReactionRoleHandler = require('./handlers/reactionRoleHandler');
const ModalHandler = require('./handlers/reactionRolemodalHandler');
const reactionRoleHandler = new ReactionRoleHandler(client);
const modalHandler = new ModalHandler(client);

const afkButtonHandler = require('./handlers/afkHandler');
const BirthdayHandlers = require('./handlers/birthdayHandlers');
new BirthdayHandlers(client);
client.on('interactionCreate', afkButtonHandler.execute);

client.once('ready', async () => {
    console.log(`[ CORE ] Bot Name: ${client.user.tag}`);
    console.log(`[ CORE ] Client ID: ${client.user.id}`);
    loadLogHandlers(client);
    new ModMailHandler(client);
    levelingHandler = new LevelingHandler(client);
    try {
        await require('./handlers/commands')(client, config, colors);
    } catch (error) {
        console.log(`${colors.red}[ ERROR ]${colors.reset} ${colors.red}${error}${colors.reset}`);
    }
});

client.login(process.env.TOKEN || config.token).catch((error) => {
    console.error('[ CORE ] Discord login failed:', error);
    process.exitCode = 1;
});

module.exports = client;
