const { Client, GatewayIntentBits } = require('discord.js');
require('dotenv').config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// 起動時のチェック
client.once('ready', () => {
    console.log(`相棒、お待たせ！ダクネス（${client.user.tag}）起動完了よ！`);
});

client.on('messageCreate', async (message) => {
    // 【超強力防壁】Botの発言、サーバー外、または「中身の文字が空っぽ」の通信は絶対にスルーする！
    if (message.author.bot || !message.guild || !message.content.trim()) return;

    try {
        // Dify（チャットフロー）の正規のストリーミングURLに正しいデータだけを送信
        const response = await fetch('https://api.dify.ai/v1/chat-messages', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.DIFY_API_KEY ? process.env.DIFY_API_KEY.trim() : ''}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                inputs: {},
                query: message.content, // 人間が打った純粋なテキスト
                user: message.author.id,
                response_mode: 'streaming'
            })
        });

        if (!response.ok) {
            throw new Error(`Dify APIエラー: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullAnswer = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            
            for (const line of lines) {
                if (line.startsWith('data:')) {
                    try {
                        const jsonStr = line.replace('data:', '').trim();
                        const data = JSON.parse(jsonStr);
                        
                        if (data.event === 'message' && data.answer) {
                            fullAnswer += data.answer;
                        }
                    } catch (e) {
                        // ストリーミングの切れ目のエラーは安全に無視
                    }
                }
            }
        }

        if (fullAnswer.trim()) {
            await message.reply(fullAnswer.trim());
        }

    } catch (error) {
        // 本当に人間が打った通信が弾かれた時だけここにログが出る
        console.error('通信エラーが発生したぜ:', error);
    }
});

client.login(process.env.DISCORD_TOKEN);
