const {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  PermissionFlagsBits,
  EmbedBuilder
} = require("discord.js");

const fs = require("fs");
require("dotenv").config();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers
  ]
});

const DATA_FILE = "./players.json";

// إنشاء ملف البيانات لو مش موجود
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, "{}");
}

function loadData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// تحويل الملي ثانية إلى ساعات ودقائق
function formatTime(ms) {
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  return `${hours} ساعة و ${minutes} دقيقة`;
}

// أوامر السلاش
const commands = [
  new SlashCommandBuilder()
    .setName("سجلني")
    .setDescription("بدء تسجيل وقت عضو")
    .addUserOption(option =>
      option
        .setName("العضو")
        .setDescription("العضو الذي تريد تسجيله")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("شيلني")
    .setDescription("إيقاف تسجيل وقت عضو")
    .addUserOption(option =>
      option
        .setName("العضو")
        .setDescription("العضو الذي تريد إيقاف تسجيله")
        .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  new SlashCommandBuilder()
    .setName("وقتي")
    .setDescription("عرض وقت لعب عضو")
    .addUserOption(option =>
      option
        .setName("العضو")
        .setDescription("العضو الذي تريد معرفة وقته")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("المتصدرين")
    .setDescription("عرض أكثر الأعضاء لعبًا")
].map(command => command.toJSON());

client.once("ready", async () => {
  console.log(`✅ البوت شغال باسم ${client.user.tag}`);

  const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

  try {
    for (const guild of client.guilds.cache.values()) {
      await rest.put(
        Routes.applicationGuildCommands(client.user.id, guild.id),
        { body: commands }
      );

      console.log(`✅ تم تسجيل أوامر السلاش في سيرفر: ${guild.name}`);
    }
  } catch (error) {
    console.error("❌ حصل خطأ في تسجيل الأوامر:", error);
  }
});

client.on("interactionCreate", async interaction => {
  if (!interaction.isChatInputCommand()) return;

  const command = interaction.commandName;
  const data = loadData();

  // =========================
  // /سجلني
  // =========================
  if (command === "سجلني") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        content: "❌ الأمر ده للمشرفين فقط.",
        ephemeral: true
      });
    }

    const user = interaction.options.getUser("العضو");
    const id = user.id;

    if (!data[id]) {
      data[id] = {
        name: user.username,
        total: 0,
        start: null
      };
    }

    data[id].name = user.username;

    if (data[id].start) {
      return interaction.reply({
        content: `⚠️ **${user.username}** مسجل بالفعل!`,
        ephemeral: true
      });
    }

    data[id].start = Date.now();

    saveData(data);

    return interaction.reply(
      `🟢 تم تسجيل **${user}** وبدأ حساب وقت اللعب.`
    );
  }

  // =========================
  // /شيلني
  // =========================
  if (command === "شيلني") {
    if (!interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
      return interaction.reply({
        content: "❌ الأمر ده للمشرفين فقط.",
        ephemeral: true
      });
    }

    const user = interaction.options.getUser("العضو");
    const id = user.id;

    if (!data[id] || !data[id].start) {
      return interaction.reply({
        content: `⚠️ **${user.username}** مش مسجل حاليًا.`,
        ephemeral: true
      });
    }

    const session = Date.now() - data[id].start;

    data[id].total += session;
    data[id].start = null;
    data[id].name = user.username;

    saveData(data);

    return interaction.reply(
      `🔴 تم إيقاف تسجيل **${user}**.\n\n` +
      `⏱️ وقت الجلسة: **${formatTime(session)}**\n` +
      `📊 إجمالي الوقت: **${formatTime(data[id].total)}**`
    );
  }

  // =========================
  // /وقتي
  // =========================
  if (command === "وقتي") {
    const user = interaction.options.getUser("العضو");
    const id = user.id;

    if (!data[id]) {
      return interaction.reply({
        content: `📊 **${user.username}** مفيش له وقت مسجل.`,
        ephemeral: true
      });
    }

    let total = data[id].total;

    if (data[id].start) {
      total += Date.now() - data[id].start;
    }

    return interaction.reply(
      `📊 وقت لعب **${user}**\n\n` +
      `⏱️ الإجمالي: **${formatTime(total)}**`
    );
  }

  // =========================
  // /المتصدرين
  // =========================
  if (command === "المتصدرين") {
    const players = Object.entries(data);

    players.sort((a, b) => {
      let timeA = a[1].total;
      let timeB = b[1].total;

      if (a[1].start) {
        timeA += Date.now() - a[1].start;
      }

      if (b[1].start) {
        timeB += Date.now() - b[1].start;
      }

      return timeB - timeA;
    });

    if (players.length === 0) {
      return interaction.reply("🏆 مفيش أعضاء مسجلين لسه.");
    }

    let text = "";

    players.slice(0, 10).forEach(([id, player], index) => {
      let total = player.total;

      if (player.start) {
        total += Date.now() - player.start;
      }

      text += `${index + 1}. <@${id}> — **${formatTime(total)}**\n`;
    });

    const embed = new EmbedBuilder()
      .setTitle("🏆 المتصدرين")
      .setDescription(text)
      .setTimestamp();

    return interaction.reply({
      embeds: [embed]
    });
  }
});

client.login(process.env.TOKEN);