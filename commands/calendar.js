const { EmbedBuilder } = require("discord.js");
const ical = require("node-ical");
const ICS_URL =
  "https://calendar.google.com/calendar/ical/vi.vietnamese%23holiday%40group.v.calendar.google.com/public/basic.ics";

module.exports = {
  name: "lich",
  description:
    "Gửi mỗi sự kiện 1 Embed riêng, sắp xếp ngày gần nhất lên đầu, layout có khoảng cách rõ",
  async execute(message, args, client) {
    try {
      const response = await fetch(ICS_URL);
      const data = await response.text();
      const events = ical.parseICS(data);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 6);

      const upcomingEvents = [];

      for (let k in events) {
        const ev = events[k];
        if (ev.type === "VEVENT") {
          const eventDate = new Date(ev.start);
          eventDate.setHours(0, 0, 0, 0);
          if (eventDate >= today && eventDate <= nextWeek) {
            upcomingEvents.push({
              date: eventDate,
              summary: ev.summary,
            });
          }
        }
      }

      if (upcomingEvents.length === 0) {
        await message.channel.send("📅 Không có sự kiện nào trong 7 ngày tới.");
        return;
      }

      upcomingEvents.sort((a, b) => a.date - b.date);

      for (const ev of upcomingEvents) {
        const dateStr = `${ev.date.getDate().toString().padStart(2, "0")}/${(
          ev.date.getMonth() + 1
        )
          .toString()
          .padStart(2, "0")}/${ev.date.getFullYear()}`;

        const embed = new EmbedBuilder()
          .setColor("#5865F2")
          .addFields(
            { name: "📅 Ngày", value: `**${dateStr}**`, inline: false },
            { name: "📌 Sự kiện", value: `**${ev.summary}**`, inline: false }
          )
          .setTimestamp(new Date());

        await message.channel.send({ embeds: [embed] });
      }
    } catch (err) {
      console.error("❌ Lỗi khi lấy lịch:", err);
      await message.reply("❌ Đã xảy ra lỗi khi lấy lịch sự kiện.");
    }
  },
};
