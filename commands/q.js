// commands/q.js (KHÔNG dùng quick.db)
const {
  SlashCommandBuilder,
  EmbedBuilder,
  ChannelType,
  PermissionsBitField,
} = require("discord.js");
const { askGemini } = require("../utils/gemini"); // Điều chỉnh đường dẫn nếu cần

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
        // Đảm bảo trả lời tương tác dù có lỗi
        if (interaction.deferred || interaction.replied) {
          return await interaction.editReply({
            content: "❌ Lỗi cấu hình: Không tìm thấy API Key cho AI.",
          });
        } else {
          return await interaction.reply({
            content: "❌ Lỗi cấu hình: Không tìm thấy API Key cho AI.",
            ephemeral: true,
          });
        }
      } catch (e) {
        console.error("[Q Cmd] Lỗi gửi thông báo thiếu API key:", e);
        return;
      }
    }

    try {
      // Thông báo chờ xử lý (chỉ người dùng thấy)
      if (!interaction.replied && !interaction.deferred) {
        await interaction.deferReply({ ephemeral: true });
      }

      let userQnaChannel;
      const expectedChannelName = `qna-${userId}`; // Tên kênh mong đợi

      // --- Tìm hoặc Tạo kênh (Logic mới không dùng DB) ---
      // 1. Tìm Category
      let category = guild.channels.cache.find(
        (c) =>
          c.name === QNA_CATEGORY_NAME && c.type === ChannelType.GuildCategory
      );
      if (!category) {
        console.log(`[Q Cmd] Category "${QNA_CATEGORY_NAME}" không tồn tại, đang tạo...`);
        // Tạo category nếu chưa có
        category = await createQnaCategory(guild);
        if (!category) {
            throw new Error("Không thể tạo QnA category."); // Lỗi nghiêm trọng nếu không tạo được category
        }
      }

      // 2. Tìm kênh theo TÊN trong category
      userQnaChannel = category.children.cache.find(
        (c) => c.name === expectedChannelName && c.type === ChannelType.GuildText
      );

      // 3. Nếu không tìm thấy, tạo kênh mới
      if (!userQnaChannel) {
        console.log(
          `[Q Cmd] Không tìm thấy kênh "${expectedChannelName}" cho user ${userId}. Tạo mới...`
        );
        userQnaChannel = await createPrivateQnaChannel(
          guild,
          interaction.user,
          category // Truyền category đã tìm/tạo vào
        );
      } else {
        console.log(
          `[Q Cmd] Tìm thấy kênh QnA "${userQnaChannel.name}" cho user ${userId}.`
        );
      }
      // --- Kết thúc Tìm hoặc Tạo kênh ---

      if (!userQnaChannel) {
        // Nếu việc tạo kênh vẫn thất bại (ví dụ do thiếu quyền)
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
          content: `❓ **${interaction.user.username} hỏi:** ${question}`, // Giữ lại câu hỏi gốc
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
        // Đảm bảo luôn cố gắng phản hồi tương tác
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply({
            content: `❌ Đã có lỗi xảy ra khi xử lý yêu cầu của bạn: ${error.message}`, // Thêm thông tin lỗi nếu có thể
          });
        } else {
          // Nếu chưa defer/reply, thì reply ephemeral
          await interaction.reply({
            content: `❌ Đã có lỗi xảy ra khi xử lý yêu cầu của bạn: ${error.message}`,
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

// --- HÀM HELPER ---

/**
 * Hàm tạo Category chứa kênh QnA nếu chưa có
 * @param {import('discord.js').Guild} guild
 * @returns {Promise<import('discord.js').CategoryChannel | null>}
 */
async function createQnaCategory(guild) {
  try {
    console.log(`[QnA Category] Tạo category: ${QNA_CATEGORY_NAME}`);
    const category = await guild.channels.create({
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
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ManageChannels], // Bot cần quyền quản lý để tạo kênh con
        },
        // Thêm các role admin/mod nếu muốn họ thấy category (tùy chọn)
        // {
        //   id: 'ADMIN_ROLE_ID',
        //   allow: [PermissionsBitField.Flags.ViewChannel],
        // },
      ],
    });
    return category;
  } catch (error) {
    console.error(`[QnA Category] Lỗi khi tạo category "${QNA_CATEGORY_NAME}":`, error);
    return null;
  }
}


/**
 * Hàm tạo kênh QnA riêng cho người dùng (KHÔNG dùng DB)
 * @param {import('discord.js').Guild} guild
 * @param {import('discord.js').User} user
 * @param {import('discord.js').CategoryChannel} category Kênh category để tạo kênh con trong đó
 * @returns {Promise<import('discord.js').TextChannel | null>}
 */
async function createPrivateQnaChannel(guild, user, category) {
  // Kiểm tra category hợp lệ
  if (!category || category.type !== ChannelType.GuildCategory) {
      console.error("[QnA Channel] Category không hợp lệ để tạo kênh con.");
      return null;
  }

  const channelName = `qna-${user.id}`; // Tên kênh theo ID user
  try {
    console.log(
      `[QnA Channel] Tạo kênh: ${channelName} cho user ${user.username} trong category ${category.name}`
    );
    const newChannel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      parent: category.id, // Đặt trong category đã cung cấp
      topic: `Kênh QnA riêng cho ${user.tag}`,
      permissionOverwrites: [
        {
          id: guild.roles.everyone,
          deny: [PermissionsBitField.Flags.ViewChannel],
        },
        {
          id: user.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory, // Cho phép xem lịch sử
            PermissionsBitField.Flags.EmbedLinks, // Cho phép xem embed
          ],
        },
        {
          id: guild.client.user.id,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ManageMessages, // Cần để sửa/xóa tin nhắn chờ
            PermissionsBitField.Flags.EmbedLinks,
          ],
        },
         // Thêm các role admin/mod nếu muốn họ thấy kênh (tùy chọn)
      ],
    });

    console.log(
      `[QnA Channel] Đã tạo kênh ${newChannel.name} (${newChannel.id})`
    );

    // Gửi tin nhắn chào mừng vào kênh mới
    await newChannel.send(
      `👋 Chào ${user}, đây là kênh QnA riêng của bạn với AI. Bạn có thể sử dụng lệnh \`/q\` ở bất kỳ đâu hoặc nhắn tin trực tiếp vào đây để hỏi AI.`
    ).catch(e => console.warn(`[QnA Channel] Không gửi được tin nhắn chào mừng vào kênh ${newChannel.id}: ${e.message}`));

    return newChannel;
  } catch (error) {
    console.error(
      `[QnA Channel] Lỗi nghiêm trọng khi tạo kênh "${channelName}" cho user ${user.id}:`,
      error
    );
    return null;
  }
} 