```js
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

// =========================
// إعدادات البوت
// =========================

// حط ID روم الـ Warn هنا
const WARN_CHANNEL_ID = "حط_ايدي_روم_الورن_هنا";

// =========================
// ملف البيانات
// =========================

const DATA_FILE = "./players.json";

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

// =========================
// التاريخ بتوقيت مصر
// =========================

function getEgyptDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

// =========================
// أوامر البوت
// =========================

const commands = [

  // =========================
  // الحضور
  // =========================

  new SlashCommandBuilder()
    .setName("حضور")
    .setDescription("تسجيل حضور عضو")
    .addUserOption(option =>
      option
        .setName("العضو")
        .setDescription("العضو")
        .setRequired(false)
    ),

  // =========================
  // الانصراف
  // =========================

  new SlashCommandBuilder()
    .setName("انصراف")
    .setDescription("تسجيل انصراف عضو")
    .addUserOption(option =>
      option
        .setName("العضو")
        .setDescription("العضو")
        .setRequired(false)
    ),

  // =========================
  // حضوراتي
  // =========================

  new SlashCommandBuilder()
    .setName("حضوراتي")
    .setDescription("عرض سجل حضورك"),

  // =========================
  // الغيابات
  // =========================

  new SlashCommandBuilder()
    .setName("الغيابات")
    .setDescription("عرض الأعضاء الغائبين")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

].map(command => command.toJSON());

// =========================
// تشغيل البوت
// =========================

client.once("ready", async () => {

  console.log(`✅ البوت شغال باسم ${client.user.tag}`);

  const rest = new REST({ version: "10" })
    .setToken(process.env.TOKEN);

  try {

    for (const guild of client.guilds.cache.values()) {

      await rest.put(
        Routes.applicationGuildCommands(
          client.user.id,
          guild.id
        ),
        {
          body: commands
        }
      );

      console.log(
        `✅ تم تسجيل الأوامر في: ${guild.name}`
      );
    }

  } catch (error) {

    console.error(
      "❌ حصل خطأ في تسجيل الأوامر:",
      error
    );

  }

  // تشغيل فحص الغياب
  checkAbsence();

  // فحص كل ساعة
  setInterval(checkAbsence, 60 * 60 * 1000);
});

// =========================
// التعامل مع الأوامر
// =========================

client.on("interactionCreate", async interaction => {

  if (!interaction.isChatInputCommand()) return;

  const command = interaction.commandName;

  const data = loadData();

  // =========================
  // تحديد العضو
  // =========================

  let user = interaction.options.getUser("العضو");

  // لو مفيش عضو محدد
  // الأمر يشتغل على الشخص نفسه

  if (!user) {
    user = interaction.user;
  }

  const id = user.id;

  // إنشاء بيانات العضو

  if (!data[id]) {

    data[id] = {
      name: user.username,
      presentToday: false,
      currentSession: false,
      attendance: [],
      warns: [],
      lastAttendance: null
    };

  }

  data[id].name = user.username;

  // =========================
  // /حضور
  // =========================

  if (command === "حضور") {

    // لو بيحاول يسجل شخص تاني
    // لازم يكون مشرف

    if (
      user.id !== interaction.user.id &&
      !interaction.member.permissions.has(
        PermissionFlagsBits.ManageGuild
      )
    ) {

      return interaction.reply({
        content: "❌ مينفعش تسجل حضور شخص تاني.",
        ephemeral: true
      });

    }

    const today = getEgyptDate();

    // منع التسجيل مرتين

    if (data[id].presentToday) {

      return interaction.reply({
        content:
          `⚠️ **${user.username}** مسجل حضور بالفعل النهارده.`,
        ephemeral: true
      });

    }

    data[id].presentToday = true;
    data[id].currentSession = true;
    data[id].lastAttendance = today;

    // إضافة اليوم لسجل الحضور

    if (!data[id].attendance.includes(today)) {
      data[id].attendance.push(today);
    }

    saveData(data);

    return interaction.reply(
      `🟢 تم تسجيل حضور ${user}\n📅 اليوم: **${today}**`
    );
  }

  // =========================
  // /انصراف
  // =========================

  if (command === "انصراف") {

    if (
      user.id !== interaction.user.id &&
      !interaction.member.permissions.has(
        PermissionFlagsBits.ManageGuild
      )
    ) {

      return interaction.reply({
        content: "❌ مينفعش تسجل انصراف شخص تاني.",
        ephemeral: true
      });

    }

    if (!data[id].currentSession) {

      return interaction.reply({
        content:
          `⚠️ **${user.username}** مش مسجل حضور حاليًا.`,
        ephemeral: true
      });

    }

    data[id].currentSession = false;

    saveData(data);

    return interaction.reply(
      `🔴 تم تسجيل انصراف ${user}`
    );
  }

  // =========================
  // /حضوراتي
  // =========================

  if (command === "حضوراتي") {

    const memberData = data[interaction.user.id];

    if (
      !memberData ||
      memberData.attendance.length === 0
    ) {

      return interaction.reply({
        content: "📋 مفيش سجل حضور ليك لسه.",
        ephemeral: true
      });

    }

    const attendanceList =
      memberData.attendance
        .slice(-14)
        .map(date => `📅 ${date}`)
        .join("\n");

    const embed = new EmbedBuilder()
      .setTitle("📋 سجل حضورك")
      .setDescription(attendanceList)
      .setFooter({
        text:
          `إجمالي أيام الحضور: ${memberData.attendance.length}`
      })
      .setTimestamp();

    return interaction.reply({
      embeds: [embed],
      ephemeral: true
    });
  }

  // =========================
  // /الغيابات
  // =========================

  if (command === "الغيابات") {

    if (
      !interaction.member.permissions.has(
        PermissionFlagsBits.ManageGuild
      )
    ) {

      return interaction.reply({
        content: "❌ الأمر ده للإدارة فقط.",
        ephemeral: true
      });

    }

    const today = getEgyptDate();

    const absentPlayers = [];

    for (const [playerId, player] of Object.entries(data)) {

      if (!player.presentToday) {

        absentPlayers.push(
          `<@${playerId}>`
        );

      }

    }

    if (absentPlayers.length === 0) {

      return interaction.reply(
        "✅ مفيش غياب مسجل حاليًا."
      );

    }

    const embed = new EmbedBuilder()
      .setTitle("❌ قائمة الغياب")
      .setDescription(
        `📅 **${today}**\n\n` +
        absentPlayers.join("\n")
      )
      .setTimestamp();

    return interaction.reply({
      embeds: [embed]
    });
  }

});

// =========================
// فحص الغياب
// =========================

function checkAbsence() {

  const data = loadData();

  const today = getEgyptDate();

  let changed = false;

  for (const [id, player] of Object.entries(data)) {

    if (!player.attendance) {
      player.attendance = [];
    }

    if (!player.warns) {
      player.warns = [];
    }

    // =========================
    // حساب آخر يوم حضور
    // =========================

    const lastAttendance =
      player.lastAttendance;

    if (!lastAttendance) continue;

    // تحويل التاريخ
    const last = new Date(
      `${lastAttendance}T00:00:00+03:00`
    );

    const now = new Date(
      `${today}T00:00:00+03:00`
    );

    const difference =
      Math.floor(
        (now - last) /
        (1000 * 60 * 60 * 24)
      );

    // =========================
    // يومين غياب
    // =========================

    if (difference >= 2) {

      const alreadyWarned =
        player.warns.some(
          warn =>
            warn.reason ===
              "الغياب يومين متتاليين" &&
            warn.date === today
        );

      if (!alreadyWarned) {

        player.warns.push({
          reason: "الغياب يومين متتاليين",
          date: today,
          automatic: true
        });

        changed = true;

        sendAbsenceWarn(id);
      }
    }
  }

  // =========================
  // بداية يوم جديد
  // =========================

  for (const player of Object.values(data)) {

    if (player.lastReset !== today) {

      player.presentToday = false;
      player.lastReset = today;

      changed = true;

    }

  }

  if (changed) {
    saveData(data);
  }
}

// =========================
// إرسال Warn
// =========================

async function sendAbsenceWarn(userId) {

  try {

    const channel =
      await client.channels.fetch(
        WARN_CHANNEL_ID
      );

    if (!channel) return;

    const embed = new EmbedBuilder()
      .setTitle("⚠️ Warn تلقائي")
      .setDescription(
        `<@${userId}> حصل على **Warn** بسبب الغياب يومين متتاليين.`
      )
      .setTimestamp();

    await channel.send({
      content: `<@${userId}>`,
      embeds: [embed]
    });

  } catch (error) {

    console.error(
      "❌ فشل إرسال Warn:",
      error
    );

  }
}

// =========================
// تسجيل الدخول
// =========================

client.login(process.env.TOKEN);
```
