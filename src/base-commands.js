const {SlashCommandBuilder}=require('discord.js');
const definitions=[
  {
    "options": [],
    "name": "help",
    "description": "See the bot’s features and setup commands.",
    "type": 1
  },
  {
    "options": [
      {
        "type": 1,
        "name": "set",
        "description": "Create or replace a sticky message.",
        "options": [
          {
            "channel_types": [
              0,
              5
            ],
            "name": "channel",
            "description": "Channel for the sticky message",
            "required": true,
            "type": 7
          },
          {
            "type": 3,
            "name": "message",
            "description": "Text to keep at the bottom",
            "required": true,
            "max_length": 2000
          }
        ]
      },
      {
        "type": 1,
        "name": "remove",
        "description": "Remove a channel’s sticky message.",
        "options": [
          {
            "channel_types": [
              0,
              5
            ],
            "name": "channel",
            "description": "Channel to remove the sticky from",
            "required": true,
            "type": 7
          }
        ]
      }
    ],
    "name": "sticky",
    "description": "Keep a message at the bottom of a channel.",
    "type": 1
  },
  {
    "options": [
      {
        "type": 1,
        "name": "view",
        "description": "View a moderation case and log delivery status.",
        "options": [
          {
            "min_value": 1,
            "type": 4,
            "name": "number",
            "description": "Case number",
            "required": true
          }
        ]
      },
      {
        "type": 1,
        "name": "history",
        "description": "View a member’s recent moderation cases.",
        "options": [
          {
            "name": "user",
            "description": "Member",
            "required": true,
            "type": 6
          }
        ]
      },
      {
        "type": 1,
        "name": "reason",
        "description": "Correct a case reason while preserving the previous text.",
        "options": [
          {
            "min_value": 1,
            "type": 4,
            "name": "number",
            "description": "Case number",
            "required": true
          },
          {
            "type": 3,
            "name": "reason",
            "description": "Corrected reason",
            "required": true,
            "max_length": 1000
          }
        ]
      },
      {
        "type": 1,
        "name": "void",
        "description": "Void a case without deleting its history; Administrator permission required.",
        "options": [
          {
            "min_value": 1,
            "type": 4,
            "name": "number",
            "description": "Case number",
            "required": true
          }
        ]
      }
    ],
    "name": "case",
    "description": "View moderation cases, member history and reason corrections.",
    "contexts": [
      0
    ],
    "type": 1
  },
  {
    "options": [
      {
        "type": 3,
        "name": "reason",
        "description": "Reason for the ban",
        "required": true,
        "max_length": 1000
      },
      {
        "name": "proof",
        "description": "Upload a screenshot as evidence",
        "required": true,
        "type": 11
      },
      {
        "name": "user",
        "description": "Select the user; their ID is filled automatically",
        "required": false,
        "type": 6
      },
      {
        "type": 3,
        "name": "user_id",
        "description": "If they cannot be selected, paste their Discord ID",
        "required": false,
        "max_length": 20,
        "min_length": 17
      },
      {
        "type": 3,
        "name": "duration",
        "description": "Ban duration; defaults to Permanent",
        "required": false,
        "max_length": 100
      }
    ],
    "name": "banlog",
    "description": "Record a Discord ban with screenshot proof; does not issue a ban.",
    "type": 1
  },
  {
    "options": [
      {
        "name": "member",
        "description": "Member to ban",
        "required": true,
        "type": 6
      },
      {
        "type": 3,
        "name": "reason",
        "description": "Why they are being banned",
        "required": false,
        "max_length": 500
      }
    ],
    "name": "ban",
    "description": "Ban a member from this server.",
    "type": 1
  },
  {
    "options": [
      {
        "type": 3,
        "name": "user_id",
        "description": "Discord user ID of the banned member",
        "required": true,
        "max_length": 20,
        "min_length": 17
      },
      {
        "type": 3,
        "name": "reason",
        "description": "Optional note",
        "required": false,
        "max_length": 500
      }
    ],
    "name": "unban",
    "description": "Remove a ban using the member’s Discord user ID.",
    "type": 1
  },
  {
    "options": [
      {
        "name": "member",
        "description": "Member to kick",
        "required": true,
        "type": 6
      },
      {
        "type": 3,
        "name": "reason",
        "description": "Why they are being kicked",
        "required": false,
        "max_length": 500
      }
    ],
    "name": "kick",
    "description": "Remove a member from this server.",
    "type": 1
  },
  {
    "options": [
      {
        "name": "member",
        "description": "Member to timeout",
        "required": true,
        "type": 6
      },
      {
        "max_value": 40320,
        "min_value": 1,
        "type": 4,
        "name": "minutes",
        "description": "Duration in minutes (1–40320)",
        "required": true
      },
      {
        "type": 3,
        "name": "reason",
        "description": "Why they are being timed out",
        "required": false,
        "max_length": 500
      }
    ],
    "name": "timeout",
    "description": "Temporarily stop a member from chatting.",
    "type": 1
  },
  {
    "options": [
      {
        "name": "member",
        "description": "Member to untimeout",
        "required": true,
        "type": 6
      },
      {
        "type": 3,
        "name": "reason",
        "description": "Optional note",
        "required": false,
        "max_length": 500
      }
    ],
    "name": "untimeout",
    "description": "Remove a member’s timeout.",
    "type": 1
  },
  {
    "options": [
      {
        "name": "user",
        "description": "Member to warn",
        "required": true,
        "type": 6
      },
      {
        "type": 3,
        "name": "reason",
        "description": "Reason for the warning",
        "required": true,
        "max_length": 500
      }
    ],
    "name": "warn",
    "description": "Warn a member, DM them and notify the server leads.",
    "type": 1
  },
  {
    "options": [
      {
        "name": "member",
        "description": "Member whose warnings to view",
        "required": true,
        "type": 6
      }
    ],
    "name": "warnings",
    "description": "View a member’s saved warnings.",
    "type": 1
  },
  {
    "options": [
      {
        "max_value": 100,
        "min_value": 1,
        "type": 4,
        "name": "amount",
        "description": "Number of messages to delete",
        "required": true
      }
    ],
    "name": "clear",
    "description": "Delete recent messages in this channel (up to 100).",
    "type": 1
  },
  {
    "options": [
      {
        "max_value": 21600,
        "min_value": 0,
        "type": 4,
        "name": "seconds",
        "description": "Delay between messages (0–21600)",
        "required": true
      }
    ],
    "name": "slowmode",
    "description": "Set this channel’s slowmode.",
    "type": 1
  },
  {
    "options": [],
    "name": "lock",
    "description": "Stop @everyone from sending messages here.",
    "type": 1
  },
  {
    "options": [],
    "name": "unlock",
    "description": "Allow @everyone to send messages here again.",
    "type": 1
  },
  {
    "options": [
      {
        "name": "member",
        "description": "Server member to ban",
        "required": true,
        "type": 6
      },
      {
        "type": 3,
        "name": "duration",
        "description": "Examples: 30m, 2h, 7d, 1w; maximum 365 days",
        "required": true,
        "max_length": 30
      },
      {
        "type": 3,
        "name": "reason",
        "description": "Reason for the temporary ban",
        "required": true,
        "max_length": 350
      }
    ],
    "name": "tempban",
    "description": "Ban a member temporarily and automatically lift this ban when it expires.",
    "type": 1
  },
  {
    "options": [
      {
        "max_value": 900,
        "min_value": 1,
        "type": 4,
        "name": "messages",
        "description": "Number of messages",
        "required": true
      }
    ],
    "name": "purge",
    "description": "Delete messages in this channel.",
    "type": 1
  }
];
module.exports={commands:definitions.map(d=>{const b=new SlashCommandBuilder().setName(d.name).setDescription(d.description); b.options=(d.options||[]).map(o=>({toJSON:()=>o})); return b;})};
