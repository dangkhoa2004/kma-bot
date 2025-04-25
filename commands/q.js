// commands/q.js
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType,
  PermissionsBitField,
} = require("discord.js");
const { askGemini } = require("../utils/gemini"); // Điều chỉnh đường dẫn nếu cần
const { QuickDB } = require("quick.db");
const db = new QuickDB(); // Khởi tạo quick.db

const QNA_CATEGORY_NAME = "❓ Private QnA"; // Tên category chứa các kênh QnA

module.exports = {
  data: new SlashCommandBuilder()
    .setName("q")
    .setDescription("Hỏi Gemini AI một câu hỏi trong kênh riêng của bạn.")
    .addStringOption((option) =>
      option
        .setName("question")
        .setDescription("Câu hỏi bạn muốn hỏi AI")
        .setRequired(true)
    ),

  async execute(interaction, client) {
    const userId = interaction.user.id;
    const guild = interaction.guild;
    const question = interaction.options.getString("question");
    const geminiApiKey = process.env.GEMINI_API_KEY;

    if (!geminiApiKey) {
      console.error("[Q Cmd] Thiếu GEMINI_API_KEY.");
      try {
        return await interaction.reply({
          content: "❌ Lỗi cấu hình: Không tìm thấy API Key cho AI.",
          ephemeral: true,
        });
      } catch (e) {
        console.error("[Q Cmd] Lỗi gửi thông báo thiếu API key:", e);
        return;
      }
    }

    try {
      // Thông báo chờ xử lý (chỉ người dùng thấy)
      await interaction.deferReply({ ephemeral: true });

      let userQnaChannel;
      const channelId = await db.get(`qnaChannel_${userId}`);

      // --- Tìm hoặc Tạo kênh ---
      if (channelId) {
        try {
          userQnaChannel = await guild.channels.fetch(channelId);
          if (!userQnaChannel) {
            // Nếu fetch trả về null/undefined (kênh đã bị xóa)
            console.log(
              `[Q Cmd] Kênh QnA cho user ${userId} (ID: ${channelId}) không tìm thấy, tạo mới.`
            );
            await db.delete(`qnaChannel_${userId}`); // Xóa ID cũ khỏi DB
            await db.delete(`isQnaChannel_${channelId}`); // Xóa cờ check kênh
            userQnaChannel = await createPrivateQnaChannel(
              guild,
              interaction.user
            );
          } else {
            console.log(
              `[Q Cmd] Tìm thấy kênh QnA cho user ${userId}: ${userQnaChannel.name}`
            );
          }
        } catch (error) {
          // Lỗi khi fetch (ví dụ: bot mất quyền truy cập) hoặc kênh bị xóa
          console.error(
            `[Q Cmd] Lỗi khi fetch kênh ${channelId} cho user ${userId}. Tạo kênh mới. Lỗi:`,
            error
          );
          await db.delete(`qnaChannel_${userId}`);
          await db.delete(`isQnaChannel_${channelId}`);
          userQnaChannel = await createPrivateQnaChannel(
            guild,
            interaction.user
          );
        }
      } else {
        console.log(
          `[Q Cmd] Không tìm thấy kênh QnA cho user ${userId}, tạo mới.`
        );
        userQnaChannel = await createPrivateQnaChannel(guild, interaction.user);
      }
      // --- Kết thúc Tìm hoặc Tạo kênh ---

      if (!userQnaChannel) {
        // Nếu việc tạo kênh thất bại
        return await interaction.editReply({
          content:
            "❌ Không thể tạo hoặc tìm thấy kênh QnA riêng cho bạn. Vui lòng liên hệ quản trị viên.",
        });
      }

      // Thông báo cho người dùng biết kênh nào sẽ được sử dụng
      await interaction.editReply({
        content: `✅ Đang xử lý câu hỏi của bạn trong kênh riêng: ${userQnaChannel}`,
      });

      // Gửi câu hỏi và chờ Gemini trả lời trong kênh riêng
      const processingMessage = await userQnaChannel.send(
        `❓ **${interaction.user.username} hỏi:** ${question}\n\n🧠 *Đang lấy câu trả lời từ AI...*`
      );
      await userQnaChannel.sendTyping();

      const aiReply = await askGemini(question, geminiApiKey);

      if (aiReply) {
        const answerEmbed = new EmbedBuilder()
          .setColor(0x0099ff)
          .setTitle(`🧠 Trả lời cho: ${question.substring(0, 240)}...`) // Giới hạn độ dài title
          .setDescription(
            aiReply.length > 4096 ? aiReply.substring(0, 4093) + "..." : aiReply
          ) // Giới hạn Embed Description
          .setFooter({ text: `Được hỏi bởi ${interaction.user.username}` })
          .setTimestamp();

        await processingMessage.edit({
          embeds: [answerEmbed],
          content: `❓ **${interaction.user.username} hỏi:** ${question}`,
        }); // Sửa tin nhắn chờ

        // Xử lý phần còn lại nếu quá dài (gửi tin nhắn thường)
        if (aiReply.length > 4096) {
          const remainingChunks =
            aiReply.substring(4096).match(/[\s\S]{1,2000}/g) || [];
          for (const chunk of remainingChunks) {
            await userQnaChannel.send(chunk).catch(console.error);
          }
        }
      } else {
        console.warn("[Q Cmd] Gemini không trả về nội dung.");
        await processingMessage
          .edit({
            content: `❓ **${interaction.user.username} hỏi:** ${question}\n\n😕 AI không có phản hồi cho câu hỏi này.`,
          })
          .catch(console.error);
      }
    } catch (error) {
      console.error("[Q Cmd] Lỗi tổng thể khi xử lý lệnh /q:", error);
      try {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({
            content: "❌ Đã có lỗi xảy ra khi xử lý yêu cầu của bạn.",
          });
        } else {
          await interaction.reply({
            content: "❌ Đã có lỗi xảy ra khi xử lý yêu cầu của bạn.",
            ephemeral: true,
          });
        }
      } catch (replyError) {
        console.error(
          "[Q Cmd] Lỗi khi gửi thông báo lỗi cuối cùng:",
          replyError
        );
      }
    }
  },
};

/**
 * Hàm tạo kênh QnA riêng cho người dùng
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').User} user
 * @returns {Promise<import('discord.js').TextChannel | null>}
 */
async function createPrivateQnaChannel(guild, user) {
  try {
    // 1. Tìm hoặc tạo Category
    let category = guild.channels.cache.find(
      (c) =>
        c.name === QNA_CATEGORY_NAME && c.type === ChannelType.GuildCategory
    );
    if (!category) {
      console.log(`[QnA Channel] Tạo category: ${QNA_CATEGORY_NAME}`);
      category = await guild.channels.create({
        name: QNA_CATEGORY_NAME,
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          {
            // Mọi người không thấy category
            id: guild.roles.everyone,
            deny: [PermissionsBitField.Flags.ViewChannel],
          },
          {
            // Bot thấy category
            id: guild.client.user.id,
            allow: [PermissionsBitField.Flags.ViewChannel],
          },
          // Thêm các role admin/mod nếu muốn họ thấy category
        ],
      });
    }

    // 2. Tạo kênh riêng trong Category
    const channelName = `qna-${user.id}`; // Đặt tên theo ID cho duy nhất
    console.log(
      `[QnA Channel] Tạo kênh: ${channelName} cho user ${user.username}`
    );
    const newChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: category.id, // Đặt trong category
      topic: `Kênh QnA riêng cho ${user.tag}`,
      permissionOverwrites: [
        {
          // Mọi người không thấy kênh này
          id: guild.roles.everyone,
          deny: [PermissionsBitField.Flags.ViewChannel],
        },
        {
          // Người dùng cụ thể thấy và nhắn được
          id: user.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory, // Cho phép xem lịch sử
          ],
        },
        {
          // Bot thấy và quản lý được
          id: guild.client.user.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ManageMessages, // Có thể cần để sửa/xóa tin nhắn của bot
            PermissionsBitField.Flags.EmbedLinks,
          ],
        },
        // Thêm các role admin/mod nếu muốn họ thấy kênh
      ],
    });

    // 3. Lưu vào DB
    await db.set(`qnaChannel_${user.id}`, newChannel.id);
    // Lưu thêm cờ để check nhanh trong MessageCreate
    await db.set(`isQnaChannel_${newChannel.id}`, user.id);
    console.log(
      `[QnA Channel] Đã lưu kênh ${newChannel.id} cho user ${user.id}`
    );

    // Gửi tin nhắn chào mừng vào kênh mới
    await newChannel.send(
      `👋 Chào ${user}, đây là kênh QnA riêng của bạn với AI. Bạn có thể sử dụng lệnh \`/q\` ở bất kỳ đâu hoặc nhắn tin trực tiếp vào đây để hỏi AI.`
    );

    return newChannel;
  } catch (error) {
    console.error(
      `[QnA Channel] Lỗi nghiêm trọng khi tạo kênh cho user ${user.id}:`,
      error
    );
    return null;
  }
}
