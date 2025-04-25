// utils/channelRestrictions.js

/**
 * Kiểm tra xem lệnh '!q' có được phép chạy trong kênh hiện tại không.
 * Nếu không được phép, nó sẽ gửi tin nhắn cảnh báo và trả về true.
 * @param {import('discord.js').Message} message Đối tượng Message từ Discord.js
 * @param {string} commandName Tên lệnh đã được chuyển thành chữ thường.
 * @param {string | undefined} qnaChannelId ID của kênh QnA được chỉ định (từ .env).
 * @returns {Promise<boolean>} Trả về true nếu lệnh bị chặn (ở sai kênh), false nếu được phép tiếp tục.
 */
const checkAskCommandChannel = async (message, commandName, qnaChannelId) => {
  console.log(
    `[CheckChan] Đang kiểm tra: cmd='${commandName}', msgChan='${message.channel.id}', expectedQnaChan='${qnaChannelId}'`
  );
  const shouldBlock =
    commandName === "q" && qnaChannelId && message.channel.id !== qnaChannelId;
  console.log(
    `[CheckChan] Điều kiện chặn (q && qnaId && current !== qnaId): ${shouldBlock}`
  ); // <--- Log kết quả điều kiện

  if (shouldBlock) {
    console.log(
      `[CheckChan] Lệnh !q bị chặn trong kênh ${message.channel.id}. Gửi cảnh báo...`
    ); // <--- Log khi chặn
    try {
      const qnaChannelLink = `<#${qnaChannelId}>`;
      await message.reply(
        `Lệnh \`!q\` chỉ có thể sử dụng trong kênh ${qnaChannelLink}. Vui lòng thử lại ở đó.`
      );
      console.log(`[CheckChan] Đã gửi cảnh báo thành công.`); // <--- Log gửi thành công
    } catch (replyError) {
      console.error(
        `[CheckChan] Lỗi khi gửi cảnh báo giới hạn kênh:`,
        replyError
      ); // <--- Log lỗi gửi
    }
    return true; // Lệnh bị chặn
  }

  console.log(
    `[CheckChan] Lệnh '${commandName}' được phép chạy trong kênh ${message.channel.id}.`
  ); // <--- Log khi không chặn
  return false; // Lệnh không bị chặn
};
/**
 * Kiểm tra xem lệnh '!lich' có được phép chạy trong kênh hiện tại không.
 * @param {import('discord.js').Message} message
 * @param {string} commandName
 * @param {string | undefined} calenChannelId
 * @returns {Promise<boolean>} true nếu bị chặn, false nếu được phép
 */
const checkCalendarCommandChannel = async (
  message,
  commandName,
  calenChannelId
) => {
  console.log(
    `[CheckChan] Đang kiểm tra: cmd='${commandName}', msgChan='${message.channel.id}', expectedCalenChan='${calenChannelId}'`
  );

  const shouldBlock =
    commandName === "calendar" &&
    calenChannelId &&
    message.channel.id !== calenChannelId;
  console.log(
    `[CheckChan] Điều kiện chặn (calendar && calenId && current !== calenId): ${shouldBlock}`
  );

  if (shouldBlock) {
    console.log(
      `[CheckChan] Lệnh !lich bị chặn trong kênh ${message.channel.id}. Gửi cảnh báo...`
    );
    try {
      const calenChannelLink = `<#${calenChannelId}>`;
      await message.reply(
        `Lệnh \`!lich\` chỉ có thể sử dụng trong kênh ${calenChannelLink}. Vui lòng thử lại ở đó.`
      );
      console.log(`[CheckChan] Đã gửi cảnh báo thành công.`);
    } catch (replyError) {
      console.error(
        `[CheckChan] Lỗi khi gửi cảnh báo giới hạn kênh:`,
        replyError
      );
    }
    return true;
  }

  console.log(
    `[CheckChan] Lệnh '${commandName}' được phép chạy trong kênh ${message.channel.id}.`
  );
  return false;
};

module.exports = {
  checkAskCommandChannel,
  checkCalendarCommandChannel,
};
