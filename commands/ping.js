export default {
    name: 'ping',
    description: 'Simple ping-pong health check',
    execute(message, args) {
        message.channel.send('pong!');
    },
};
