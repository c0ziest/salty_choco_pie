const {
  Client,
  GatewayIntentBits,
  Partials,
  EmbedBuilder,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  InteractionType,
  ActivityType,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { SlashCommandBuilder } = require("@discordjs/builders");

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

const token = "YOUR_TOKEN_HERE";
const targetServerId = "YOUR_SERVER_ID_HERE";
const targetChannelId = "YOUR_CHANNEL_ID_HERE";
const contributors = ["CONTRIBUTORS_ID_HERE"];

const questionLog = new Map();

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);

  const guild = client.guilds.cache.get(targetServerId);
  if (!guild) return console.error("Target server not found");

  client.user.setPresence({
    activities: [
      {
        name: "YOUR_ACTIVITY_STATUS_HERE",
        type: ActivityType.Listening,
      },
    ],
    status: "online",
  });

  const commandData = new SlashCommandBuilder()
    .setName("질문")
    .setDescription("모달을 열어 질문을 작성합니다.");

  try {
    await guild.commands.create(commandData);
    console.log("Command created");
  } catch (error) {
    console.error("Error creating command:", error);
  }
});

client.on("interactionCreate", async (interaction) => {
  if (interaction.isCommand() && interaction.commandName === "질문") {
    const warningEmbed = new EmbedBuilder()
      .setColor("#ffcc00")
      .setTitle("⚠️ 경고")
      .setDescription("질문을 작성하면 내용이 그대로 전송됩니다. 계속하시겠습니까?");

    const yesButton = new ButtonBuilder()
      .setCustomId("yesButton")
      .setLabel("네")
      .setStyle(ButtonStyle.Success);

    const noButton = new ButtonBuilder()
      .setCustomId("noButton")
      .setLabel("아니요")
      .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder().addComponents(yesButton, noButton);

    await interaction.reply({
      embeds: [warningEmbed],
      components: [row],
      ephemeral: true,
    });
  }

  if (interaction.isButton()) {
    const { customId, user } = interaction;

    if (customId === "yesButton") {
      const modal = new ModalBuilder().setCustomId("질문모달").setTitle("질문 작성");

      const questionInput = new TextInputBuilder()
        .setCustomId("questionInput")
        .setLabel("질문을 입력하세요")
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      const firstActionRow = new ActionRowBuilder().addComponents(questionInput);

      modal.addComponents(firstActionRow);

      await interaction.showModal(modal);
    } else if (customId === "noButton") {
      const cancelEmbed = new EmbedBuilder()
        .setColor("#ff0000")
        .setTitle("❌ 질문 전송이 취소되었습니다.")
        .setDescription("다음에 다시 시도해주세요.");

      await interaction.update({
        embeds: [cancelEmbed],
        components: [],
        ephemeral: true,
      });
    } else if (customId.startsWith("answerButton")) {
      const questionId = customId.split("_")[1];

      const logEntry = questionLog.get(questionId);
      if (!logEntry) {
        console.error(`질문 ID '${questionId}'에 대한 정보를 찾을 수 없습니다.`);
        return;
      }
      const { questionerId } = logEntry;

      try {
        const questioner = await client.users.fetch(questionerId);

        const modal = new ModalBuilder()
          .setCustomId(`답변모달_${questionId}`)
          .setTitle("질문에 답변하기");

        const answerInput = new TextInputBuilder()
          .setCustomId("answerInput")
          .setLabel("답변을 입력하세요")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true);

        const firstActionRow = new ActionRowBuilder().addComponents(answerInput);

        modal.addComponents(firstActionRow);

        await interaction.showModal(modal);
      } catch (error) {
        console.error(`질문자 '${questionerId}'에게 DM을 보내는 중 오류 발생:`, error);

        const dmErrorEmbed = new EmbedBuilder()
          .setColor("#ff0000")
          .setTitle("🚫 DM 전송 오류")
          .setDescription("질문자에게 DM을 보내는 중 오류가 발생했습니다.");

        await interaction.reply({
          embeds: [dmErrorEmbed],
          ephemeral: true,
        });
      }
    } else if (customId.startsWith("rejectButton")) {
      const questionId = customId.split("_")[1];

      const logEntry = questionLog.get(questionId);
      if (!logEntry) {
        console.error(`질문 ID '${questionId}'에 대한 정보를 찾을 수 없습니다.`);
        return;
      }
      const { questionerId } = logEntry;

      try {
        const questioner = await client.users.fetch(questionerId);
        await questioner.send("안녕하세요. 귀하의 질문이 거절되었습니다.");

        const rejectEmbed = new EmbedBuilder()
          .setColor("#ff0000")
          .setTitle("❌ 질문 거절됨")
          .setDescription("질문이 거절되었습니다.");

        await interaction.update({
          embeds: [rejectEmbed],
          components: [],
          ephemeral: true,
        });
      } catch (error) {
        console.error(`질문자 '${questionerId}'에게 DM을 보내는 중 오류 발생:`, error);

        const dmErrorEmbed = new EmbedBuilder()
          .setColor("#ff0000")
          .setTitle("🚫 DM 전송 오류")
          .setDescription("질문자에게 DM을 보내는 중 오류가 발생했습니다.");

        await interaction.reply({
          embeds: [dmErrorEmbed],
          ephemeral: true,
        });
      }
    }
  }

  if (
    interaction.type === InteractionType.ModalSubmit &&
    interaction.customId.startsWith("답변모달")
  ) {
    const answer = interaction.fields.getTextInputValue("answerInput");
    const questionId = interaction.customId.split("_")[1];

    const logEntry = questionLog.get(questionId);
    if (!logEntry) {
      console.error(`질문 ID '${questionId}'에 대한 정보를 찾을 수 없습니다.`);
      return;
    }
    const { questionerId } = logEntry;

    try {
      const questioner = await client.users.fetch(questionerId);

      const answerEmbed = new EmbedBuilder()
        .setColor("#00ff00")
        .setTitle("✅ 답변 전송 완료")
        .setDescription(`질문에 대한 답변이 성공적으로 전송되었습니다!`);

      await questioner.send(
        `안녕하세요. 귀하의 질문에 대한 답변입니다:\n\n${answer}\n\n답변자: <@${interaction.user.id}>`
      );
      await interaction.reply({
        embeds: [answerEmbed],
        ephemeral: true,
      });
    } catch (error) {
      console.error(`질문자 '${questionerId}'에게 DM을 보내는 중 오류 발생:`, error);

      const dmErrorEmbed = new EmbedBuilder()
        .setColor("#ff0000")
        .setTitle("🚫 DM 전송 오류")
        .setDescription("질문자에게 DM을 보내는 중 오류가 발생했습니다.");

      await interaction.reply({
        embeds: [dmErrorEmbed],
        ephemeral: true,
      });
    }
  }

  if (
    interaction.type === InteractionType.ModalSubmit &&
    interaction.customId === "질문모달"
  ) {
    try {
      const question = interaction.fields.getTextInputValue("questionInput");
      const userId = interaction.user.id;
      const timestamp = Math.floor(Date.now() / 1000);
      const guild = interaction.guild;

      if (!guild) {
        const guildErrorEmbed = new EmbedBuilder()
          .setColor("#ff0000")
          .setTitle("🚫 오류 발생")
          .setDescription("서버 정보를 가져올 수 없습니다.");

        await interaction.reply({
          embeds: [guildErrorEmbed],
          ephemeral: true,
        });
        return;
      }

      const invite = await guild.invites.create(
        guild.systemChannelId ||
          guild.channels.cache.filter((channel) => channel.isText()).first().id,
        {
          maxAge: 0, // Permanent
          maxUses: 0, // Unlimited
        }
      );

      const questionId = generateRandomCode();
      const logEntry = {
        questionerId: userId,
        question,
        guildName: guild.name,
        guildId: guild.id,
        timestamp,
        inviteLink: invite.url,
      };

      questionLog.set(questionId, logEntry);

      const questionEmbed = new EmbedBuilder()
        .setColor("#553f62")
        .setTitle(`📨 새로운 질문이 도착했습니다!`)
        .setDescription(`**질문 내용:**\n${question}`)
        .addFields(
          { name: "보낸 사람", value: `<@${userId}>`, inline: true },
          { name: "보낸 시간", value: `<t:${timestamp}:F>`, inline: true },
          { name: "서버 이름", value: guild.name, inline: true },
          { name: "서버 ID", value: guild.id, inline: true },
          { name: "서버 초대 링크", value: `[여기 클릭](${invite.url})`, inline: true },
          { name: "질문 ID", value: `\`${questionId}\``, inline: true }
        )
        .setTimestamp()
        .setFooter({
          text: "원격 질문 시스템",
          iconURL: "YOUR_ICON_URL_HERE",
        });

      const answerButton = new ButtonBuilder()
        .setCustomId(`answerButton_${questionId}`)
        .setLabel("답변하기")
        .setStyle(ButtonStyle.Primary);

      const rejectButton = new ButtonBuilder()
        .setCustomId(`rejectButton_${questionId}`)
        .setLabel("거절하기")
        .setStyle(ButtonStyle.Danger);

      const row = new ActionRowBuilder().addComponents(answerButton, rejectButton);

      const targetChannel = client.channels.cache.get(targetChannelId);
      if (!targetChannel || !targetChannel.isTextBased()) {
        console.error("Target channel is not text-based or not found");
        return;
      }

      await targetChannel.send({ embeds: [questionEmbed], components: [row] });

      const successEmbed = new EmbedBuilder()
        .setColor("#00ff00")
        .setTitle("✅ 질문 전송 완료")
        .setDescription("질문이 성공적으로 전송되었습니다!");

      await interaction.reply({
        embeds: [successEmbed],
        ephemeral: true,
      });
    } catch (error) {
      console.error("Error handling modal submit interaction:", error);

      const errorEmbed = new EmbedBuilder()
        .setColor("#ff0000")
        .setTitle("🚫 오류 발생")
        .setDescription("질문을 전송하는 중 오류가 발생했습니다.");

      await interaction.reply({
        embeds: [errorEmbed],
        ephemeral: true,
      });
    }
  }
});

function generateRandomCode() {
  return Math.random().toString(36).substring(2, 15);
}

client.login(token);
