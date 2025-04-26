require("dotenv").config();

const { Client, GatewayIntentBits, Events, Collection, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionsBitField, EmbedBuilder } = require("discord.js");
const fs = require("fs");
const path = require("path");
const { askGemini } = require("./utils/gemini");
const { checkAskCommandChannel, checkCalendarCommandChannel } = require("./utils/channelRestrictions");
const { getAllUserRepos, createSingleRepoEmbed } = require('./utils/githubHelper');
const { generateCommitEmbedsArray, COMMIT_EMBED_COLOR } = require('./utils/githubCommitsHelper.js'); // Correct casing

const logInfo = (msg) => console.log(`✅ [INFO] ${msg}`);
const logWarn = (msg) => console.warn(`⚠️ [WARN] ${msg}`);
const logError = (msg, error) => { console.error(`❌ [ERROR] ${msg}`); if (error) console.error(error); };

const discordToken = process.env.DISCORD_TOKEN;
const geminiApiKey = process.env.GEMINI_API_KEY;
const qnaChannelId = process.env.QNA_CHANNEL_ID;
const calenChannelId = process.env.CALEN_CHANNEL_ID;
const githubRepoChannelId = process.env.GITHUB_CHANNEL_ID;
const githubCommitsChannelId = process.env.COMMITS_CHANNEL_ID;
const githubToken = process.env.GITHUB_TOKEN;

const REPO_EMBED_COLOR = 0x5865f2;
const REPO_REFRESH_BUTTON_ID = 'refresh-github-repos';
const REPO_DISPLAY_LIMIT = 10;
const COMMIT_REFRESH_BUTTON_ID = 'refresh-github-commits';
const COMMIT_DISPLAY_LIMIT = 15;

if (!discordToken) { logError("DISCORD_TOKEN is not set."); process.exit(1); }
if (!githubRepoChannelId) { logWarn("GITHUB_CHANNEL_ID (Repo List) is not set."); }
if (!githubCommitsChannelId) { logWarn("COMMITS_CHANNEL_ID (Recent Commits) is not set."); }
if (!githubToken) { logWarn("GITHUB_TOKEN is not set. GitHub API requests might be rate limited."); }

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.commands = new Collection();
const commandsPath = path.join(__dirname, "commands");
if (fs.existsSync(commandsPath)) {
  const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith(".js") && !['github.js', 'repo.js', 'khoarepos.js', 'q.js'].includes(file));
  for (const file of commandFiles) {
      const filePath = path.join(commandsPath, file);
      try {
          const command = require(filePath);
          if (command && typeof command.name === 'string' && typeof command.execute === 'function') {
              if (command.name !== 'repo' && command.name !== 'github' && command.name !== 'khoarepos') {
                  client.commands.set(command.name, command);
                  logInfo(`Loaded message command: !${command.name}`);
              }
          }
      } catch (error) {
          logError(`Error loading command ${file}:`, error);
      }
  }
} else { logWarn("Directory 'commands' does not exist."); }

async function findOldBotEmbedMessages(channel, embedColor, buttonId = null) {
    const messageMap = new Map();
    const messagesToDelete = [];
    if (!channel || channel.type !== ChannelType.GuildText) return { messageMap, messagesToDelete };

    try {
        const messages = await channel.messages.fetch({ limit: 100 });
        messages.forEach(msg => {
            let isTargetEmbed =
                msg.author.id === client.user.id &&
                msg.embeds.length > 0 &&
                msg.embeds[0].color === embedColor;

            let isTargetButton =
                buttonId &&
                msg.author.id === client.user.id &&
                msg.components.length > 0 &&
                msg.components[0]?.components[0]?.customId === buttonId;

            if (isTargetEmbed) {
                messagesToDelete.push(msg);
            } else if (isTargetButton) {
                messagesToDelete.push(msg);
            }
        });
    } catch (error) {
        logError(`[Clear Channel] Error fetching old messages in channel ${channel.id}:`, error);
    }
    return { messagesToDelete };
}

async function clearOldMessages(channel, messagesToDelete) {
    let deletedCount = 0;
    if (!channel || messagesToDelete.length === 0) return deletedCount;
    logInfo(`[Clear Channel] Deleting ${messagesToDelete.length} old messages in channel ${channel.name}...`);
    try {
        const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
        const recentMessages = messagesToDelete.filter(msg => msg.createdTimestamp > twoWeeksAgo);
        if (recentMessages.length > 0) {
            await channel.bulkDelete(recentMessages, true).catch(err => logWarn(`[Clear Channel] Bulk delete failed (likely missing messages): ${err.message}`));
            deletedCount += recentMessages.length;
        }
        const oldMessages = messagesToDelete.filter(msg => msg.createdTimestamp <= twoWeeksAgo);
        if (oldMessages.length > 0) {
             for (const msg of oldMessages) {
                 try {
                    await msg.delete();
                    deletedCount++;
                 } catch (e) {
                    logWarn(`[Clear Channel] Could not delete old message ${msg.id}: ${e.message}`)
                 }
                 await new Promise(resolve => setTimeout(resolve, 350)); // Slightly increased delay
            }
        }
        logInfo(`[Clear Channel] Deleted ${deletedCount} old messages.`);
    } catch (error) {
        if(error.code === 50034) { // DiscordAPIError[50034]: You can only bulk delete messages that are under 14 days old.
             logWarn(`[Clear Channel] Bulk delete failed for older messages in ${channel.name}. Attempting individual deletion again (if any).`);
             // Retry individual deletion for messages bulk delete might have missed if error was specifically 50034
             const messagesToRetry = messagesToDelete.filter(msg => recentMessages.every(rm => rm.id !== msg.id)); // Filter out ones already attempted in bulk
              for (const msg of messagesToRetry) {
                 try { await msg.delete(); deletedCount++; } catch (e) { logWarn(`[Clear Channel] Retry delete failed ${msg.id}: ${e.message}`) }
                 await new Promise(resolve => setTimeout(resolve, 350));
              }

        } else {
            logError(`[Clear Channel] Error cleaning up messages in channel ${channel.id}:`, error);
        }
    }
    return deletedCount;
}

async function updateGitHubReposLogic(channel) {
    if (!channel || channel.type !== ChannelType.GuildText) { logWarn(`[GitHub Repo] Invalid channel provided (${githubRepoChannelId}).`); return; }
    logInfo(`[GitHub Repo] Starting Edit/Add/Delete update for channel: ${channel.name}`);
    let processedCount = 0, createdCount = 0, editedCount = 0, deletedCount = 0;
    const delayMs = 600; // Increase delay further

    try {
        const { messagesToDelete: oldRepoEmbedMessages } = await findOldBotEmbedMessages(channel, REPO_EMBED_COLOR);
        const existingMessagesMap = new Map();
        oldRepoEmbedMessages.forEach(msg => {
            if(msg.embeds[0]?.url) existingMessagesMap.set(msg.embeds[0].url, msg);
        });

        const { repos: allNewRepos, username: targetUsername } = await getAllUserRepos(githubToken);
        const totalRepos = allNewRepos.length;
        const reposToProcess = allNewRepos.slice(0, REPO_DISPLAY_LIMIT);

        for (const repo of reposToProcess) {
            if (!repo || !repo.html_url) continue;
            const newEmbed = createSingleRepoEmbed(repo);
            const repoUrl = repo.html_url;
            const existingMessage = existingMessagesMap.get(repoUrl);

            if (existingMessage) {
                try {
                    await existingMessage.edit({ embeds: [newEmbed] });
                    editedCount++;
                    existingMessagesMap.delete(repoUrl);
                } catch (editError) { logError(`[GitHub Repo] Edit error ${repo.name}:`, editError); }
            } else {
                try {
                    await channel.send({ embeds: [newEmbed] });
                    createdCount++;
                } catch (sendError) { logError(`[GitHub Repo] Send error ${repo.name}:`, sendError); }
            }
            processedCount++;
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
        logInfo(`[GitHub Repo] Processed ${processedCount} repos (Created: ${createdCount}, Edited: ${editedCount}).`);

        const messagesToDeleteDirectly = Array.from(existingMessagesMap.values());
        if (messagesToDeleteDirectly.length > 0) {
            deletedCount += await clearOldMessages(channel, messagesToDeleteDirectly);
        }

        const { messagesToDelete: oldControlButtons } = await findOldBotEmbedMessages(channel, null, REPO_REFRESH_BUTTON_ID);
        await clearOldMessages(channel, oldControlButtons);

        await new Promise(resolve => setTimeout(resolve, 300));

        const refreshButton = new ButtonBuilder().setCustomId(REPO_REFRESH_BUTTON_ID).setLabel('Refresh Repositories').setStyle(ButtonStyle.Primary).setEmoji('🔄');
        const row = new ActionRowBuilder().addComponents(refreshButton);
        let controlMessageContent = `Hiển thị ${reposToProcess.length}/${totalRepos} repositories của **${targetUsername}** (sắp xếp theo ngày tạo, cũ nhất trước).`;
        if (totalRepos > REPO_DISPLAY_LIMIT) {
             const userReposUrl = `https://github.com/${targetUsername}?tab=repositories`;
             controlMessageContent += `\n🔗 **[Xem tất cả ${totalRepos} repositories trên GitHub](${userReposUrl})**`;
        }
        await channel.send({ content: controlMessageContent, components: [row] });
        logInfo(`[GitHub Repo] Sent new repo control message.`);

    } catch (error) {
        logError(`[GitHub Repo] Critical update error (${channel.id}):`, error);
        try { await channel.send(`❌ Repo list update error: ${error.message}`); }
        catch (sendError) { logError(`Failed to send error to Repo channel ${channel.id}`, sendError); }
    }
}

async function updateRecentCommits(channel) {
    if (!channel || channel.type !== ChannelType.GuildText) { logWarn(`[GitHub Commit] Invalid channel provided (${githubCommitsChannelId}).`); return; }
    logInfo(`[GitHub Commit] Starting commit update for channel: ${channel.name}`);
    try {
        const { messagesToDelete: oldCommitMessages } = await findOldBotEmbedMessages(channel, COMMIT_EMBED_COLOR, COMMIT_REFRESH_BUTTON_ID);
        await clearOldMessages(channel, oldCommitMessages);
        await new Promise(resolve => setTimeout(resolve, 500));

        const { embeds: commitEmbedsArray, displayCount, username } = await generateCommitEmbedsArray(githubToken, COMMIT_DISPLAY_LIMIT);

        // logInfo(`[GitHub Commit] Sending ${commitEmbedsArray.length} new commit embeds...`); // Giảm log
        for (let i = 0; i < commitEmbedsArray.length; i++) {
            try {
                await channel.send({ embeds: [commitEmbedsArray[i]] });
            } catch (sendErr) { logError(`[GitHub Commit] Send error for commit embed #${i + 1}:`, sendErr); }
            await new Promise(resolve => setTimeout(resolve, 350)); // Tăng delay nhẹ
        }
        logInfo(`[GitHub Commit] Sent ${commitEmbedsArray.length} commit embeds.`);

        const refreshButton = new ButtonBuilder().setCustomId(COMMIT_REFRESH_BUTTON_ID).setLabel('Refresh Commits').setStyle(ButtonStyle.Success).setEmoji('🔄');
        const row = new ActionRowBuilder().addComponents(refreshButton);
        const controlMessageContent = `Hiển thị ${displayCount} commit gần đây nhất của **${username}**.`;

        await channel.send({ content: controlMessageContent, components: [row] });
        logInfo(`[GitHub Commit] Sent new commit control message.`);

    } catch (error) {
        logError(`[GitHub Commit] Critical update error (${channel.id}):`, error);
        try { await channel.send(`❌ Commit list update error: ${error.message}`); }
        catch (sendError) { logError(`Failed to send error to Commit channel ${channel.id}`, sendError); }
    }
}

client.once(Events.ClientReady, async (c) => {
  logInfo(`Bot logged in as ${c.user.tag}`);
  if (githubRepoChannelId) {
    try {
        const repoChannel = await client.channels.fetch(githubRepoChannelId);
        if (repoChannel && repoChannel.type === ChannelType.GuildText) {
           const perms = repoChannel.permissionsFor(c.user);
           const requiredPerms = [ PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.ManageMessages, PermissionsBitField.Flags.EmbedLinks ];
           if (!perms || !perms.has(requiredPerms)) {
                logWarn(`Bot lacks necessary permissions in Repo List channel ${repoChannel.name}.`);
           } else {
                await updateGitHubReposLogic(repoChannel);
           }
        } else { logWarn(`Repo List channel (${githubRepoChannelId}) not found or not a text channel.`); }
    } catch (error) { logError(`Error handling Repo List channel (${githubRepoChannelId}) on ready:`, error); }
  }

  if (githubCommitsChannelId) {
      try {
          const commitChannel = await client.channels.fetch(githubCommitsChannelId);
          if (commitChannel && commitChannel.type === ChannelType.GuildText) {
             const perms = commitChannel.permissionsFor(c.user);
             const requiredPerms = [ PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.ManageMessages, PermissionsBitField.Flags.EmbedLinks ];
             if (!perms || !perms.has(requiredPerms)) {
                  logWarn(`Bot lacks necessary permissions in Commits channel ${commitChannel.name}.`);
             } else {
                  await updateRecentCommits(commitChannel);
             }
          } else { logWarn(`Commits channel (${githubCommitsChannelId}) not found or not a text channel.`); }
      } catch (error) { logError(`Error handling Commits channel (${githubCommitsChannelId}) on ready:`, error); }
  }
});

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot || !message.guild) return;

    if (message.content.startsWith("!")) {
        const args = message.content.slice(1).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();
        const command = client.commands.get(commandName);

        if (command) {
        try {
            if (qnaChannelId && await checkAskCommandChannel(message, commandName, qnaChannelId)) return;
            if (calenChannelId && await checkCalendarCommandChannel(message, commandName, calenChannelId)) return;
            await command.execute(message, args, client);
        } catch (error) {
            logError(`Error executing !${commandName}:`, error);
            await message.reply("❌ Command execution error.").catch(() => {});
        }
        }
        return;
    }

    if ( qnaChannelId && geminiApiKey && message.channel.id === qnaChannelId ) {
        message.channel.sendTyping();
        try {
        const aiReply = await askGemini(message.content.trim(), geminiApiKey);
        if (aiReply) {
            const chunks = aiReply.match(/[\s\S]{1,2000}/g) || [];
            for (let i = 0; i < chunks.length; i++) {
            i === 0
                ? await message.reply(chunks[i]).catch(console.error)
                : await message.channel.send(chunks[i]).catch(console.error);
            }
        } else {
            logWarn("[QnA] Gemini returned no content.");
            await message.reply("😕 AI had no response.").catch(()=>{});
        }
        } catch (error) {
        logError("[QnA] Error getting response from Gemini:", error);
        await message.reply("❌ AI query error.").catch(() => {});
        }
    }
});

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isButton()) return;

    if (interaction.customId === REPO_REFRESH_BUTTON_ID && interaction.channelId === githubRepoChannelId) {
        logInfo(`[INTERACTION] Repo refresh button pressed by ${interaction.user.tag}`);
        try {
            await interaction.reply({ content: '🔄 Refreshing repositories...', ephemeral: true });
            await updateGitHubReposLogic(interaction.channel);
            logInfo(`[INTERACTION] Repo refresh complete.`);
            await interaction.editReply({ content: '✅ Repositories refreshed!' }).catch(()=>{});
        } catch (error) {
             logError(`[INTERACTION] Repo refresh button error:`, error);
             try { await interaction.editReply({ content: `❌ Repo refresh error: ${error.message}` }).catch(()=>{}); }
             catch(e) { console.error("Cannot send repo interaction error reply"); }
        }
        return;
    }

    if (interaction.customId === COMMIT_REFRESH_BUTTON_ID && interaction.channelId === githubCommitsChannelId) {
        logInfo(`[INTERACTION] Commit refresh button pressed by ${interaction.user.tag}`);
        try {
            await interaction.reply({ content: '🔄 Refreshing commits...', ephemeral: true });
            await updateRecentCommits(interaction.channel);
            logInfo(`[INTERACTION] Commit refresh complete.`);
            await interaction.editReply({ content: '✅ Commits refreshed!' }).catch(()=>{});
        } catch (error) {
             logError(`[INTERACTION] Commit refresh button error:`, error);
             try { await interaction.editReply({ content: `❌ Commit refresh error: ${error.message}` }).catch(()=>{}); }
             catch(e) { console.error("Cannot send commit interaction error reply"); }
        }
        return;
    }
});

client.on(Events.Error, (error) => logError("Client Error:", error));
client.on(Events.Warn, (warning) => logWarn(`Client Warn: ${warning}`));

client.login(discordToken);