module.exports = {
    name: 'hello',
    execute(message) {
      message.channel.send(`👋 Xin chào ${message.author.username}`);
    },
  };
  