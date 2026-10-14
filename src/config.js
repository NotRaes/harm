module.exports = {
    /*
                                        harm
                                ✦ ──────────── ✦ 
    */
    /*
           variables
       ✦ ──────────── ✦ 
    */
    /* token required == */ token: "",
    /* prefix required == */ prefix: ",",
    /* owner(s) == */ owners: ['837940598287237161'],
    /* typing delay(1000=1) == */ delay: 0,

    /* dashboard & discord oauth2 */
    clientId: "1490995846626545674",
    clientSecret: "lI6NydgA2_ewYLA78gu0C_dooyv_d40U",
    redirectUri: "http://localhost:3001/api/auth/callback",
    apiPort: 3001,
    supportGuildId: "1555845452790767677",
    supportInvite: "https://discord.gg/eqwcPU2mfS",

    /* lavalink v4 audio server */
    lavalink: {
        host: "localhost",
        port: 2333,
        authorization: "youshallnotpass",
        secure: false,
        id: "harm-lavalink"
    },


    /*
            colors
       ✦ ──────────── ✦ 
    */
    colors: {
        c: "#2b2d31",  // main color
        wc: "#FAA81A", // warning color
        cc: "#ED4245", // critical color
        ic: "#5865F2", // info color
    },

    /*
            status
       ✦ ──────────── ✦
    */

    /* types: 0 = playing, 1 = streaming, 2 = listening, 3 = watching, 4 = custom, 5 = competing */
    /* link to be youtube or twitch for streaming (type 1) */
    /* placeholders supported: {prefix}, {guilds}, {users}, {channels} */
    presence: {
        status: 'online', // 'online' | 'idle' | 'dnd' | 'invisible'
        interval: 30000, // rotation delay in milliseconds (15s)
        activities: [
            {
                name: 'listening to beyonce',
                type: 1,
                url: 'https://www.youtube.com/watch?v=Mv5f9Q2LJYM'
            },
            {
                name: 'listening to bruno mars',
                type: 1,
                url: 'https://www.youtube.com/watch?v=MRSaiAREnwI&list=RDMRSaiAREnwI&start_radio=1'
            },
            {
                name: 'listening to lana del rey',
                type: 1,
                url: 'https://www.youtube.com/watch?v=jvm6DpqqbLk&list=RDjvm6DpqqbLk&start_radio=1'
            },
            {
                name: 'watching global prefix {prefix}',
                type: 1,
                url: 'https://www.youtube.com/watch?v=Q6978DnF8C4&list=RDQ6978DnF8C4&start_radio=1'
            }
        ]
    },

    /*
           emojis
       ✦ ──────────── ✦
    */

    emojis: {
        premium: "<:harm_premium:1558810882795114536>",
        standard: "<:harm_standard:1558811340385026119>",
        wand: "<:harm_wand:1558744356075085824>",
        mail: "<:harm_mail:1558744358990381076>",
        support: "<:harm_support:1558744361083215972>",
        eye: "<:eeye:1483784989861478400>", // not in uploaded screenshots (kept from esh)
        al: "<:harm_left:1559172028714586202>",
        ar: "<:harm_right:1559172031315189790>",
        first: "<:harm_first:1559172034158661642>",
        last: "<:harm_last:1559172036964786196>",
        gengar: "<:blackgengar:1555842822463295488>",
        blackgengar: "<:blackgengar:1555842822463295488>",
        cancel: "<:harm_deny:1558811268608167939>",
        deny: "<:harm_deny:1558811268608167939>",
        denycancel: "<:harm_deny:1558811268608167939>",
        dots: "<:harm_dots:1559172039489884191>",
        extend: "<:extend:1555842833100054539>",
        extender: "<:extender:1555842836144848967>",
        approve: "<:harm_tick:1558811267014066366>",
        tick: "<:harm_tick:1558811267014066366>",
        tired: "<:tired:1483784332970688586>", // not in uploaded screenshots (kept from esh)
        warn: "<:harm_warn:1558811265097531412>",
        harm: "<:harmsdio:1556221836507742278>",
        dio: "<:harmsdio:1556221836507742278>",
        harmsdio: "<:harmsdio:1556221836507742278>",
        leftwing: "<a:leftwing:1555842838330089522>",
        rightwing: "<a:rightwing:1555842840607596624>",
        lockvc: "<:lockvc:1558818774772089003>",
        unlockvc: "<:unlockvc:1558818815226421308>",
        ghostvc: "<:ghostvc:1558818754664865842>",
        revealvc: "<:revealvc:1558818801930477709>",
        claimvc: "<:claimvc:1558818741213462529>",
        renamevc: "<:renamevc:1558818794728591512>",
        limitvc: "<:limitvc:1558818767893696608>",
        permitvc: "<:permitvc:1558818781382443101>",
        rejectvc: "<:rejectvc:1558818788332273754>",
        transfervc: "<:transfervc:1558818808351952898>",
        infovc: "<:infovc:1558818761405104218>",
        deletevc: "<:deletevc:1558818747769159680>",
        calendar: "<:calendar:1558818700457672778>",
        idcard: "<:idcard:1558818721156567040>",
        card: "<a:card:1555845967381528586>",
        members: "<:entries:1558198887599050882>",
        channels: "<:channels:1558818707281547304>",
        roles: "<:roles:1558818727821185074>",
        coin: "<:coin:1558818714055479421>",
        crown: "<:gw_crown:1558198883883028621>",
        boost: "<:boost:1558818693629214760>",
        streak: "<:streak:1558818734582399007>",
        gift: "<:gift:1558198880296898630>",
        gw_gift: "<:gift:1558198880296898630>",
        gw_crown: "<:gw_crown:1558198883883028621>",
        entries: "<:entries:1558198887599050882>",
        gw_entries: "<:entries:1558198887599050882>",
        trophy: "<:trophy:1558198891248095366>",
        gw_trophy: "<:trophy:1558198891248095366>",
        cheers: "<:cheers:1558198895190741013>",
        gw_cheers: "<:cheers:1558198895190741013>"
    }
}
