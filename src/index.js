import dotenv from "dotenv";
import { Telegraf, Markup } from "telegraf";
import puppeteer from "puppeteer";
import * as cheerio from "cheerio";

dotenv.config();
const bot = new Telegraf(process.env.BOT_TOKEN);

bot.start((ctx) => {
  console.log("User started the bot:", ctx.from);
  ctx.reply(
    "Welcome to DoorDash Store checker! \n\nI can help you check if Doordash stores are eligible for ordering. \n\nSend /check or directly send the store URL.",
    Markup.keyboard(["/check"]).resize()
  );
});

bot.command("check", (ctx) => {
  ctx.reply("Please send the Doordash store URL to check.");
});

bot.on("text", async (ctx) => {
  const url = ctx.message.text.trim();
  console.log("Received URL:", url);

  if (url.startsWith("https://www.doordash.com/store/")) {
    ctx.reply("Checking store status...");

    try {
      // Launch a headless browser instance
      const browser = await puppeteer.launch({ headless: true });
      const page = await browser.newPage();

      // Set a realistic User-Agent
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
      );

      // Navigate to the URL
      await page.goto(url, { waitUntil: "networkidle0", timeout: 30000 });

      // Get the page content
      const content = await page.content();
      await browser.close();

      // Parse the content with cheerio
      const $ = cheerio.load(content);
      const storeName = $("h1").first().text().trim() || "Store";
      console.log("Extracted store name:", storeName);

      // Check store availability
      const storeStatus = !content.includes("This store is currently unavailable")
        ? "Open"
        : "Closed";
      console.log("Computed store status:", storeStatus);

      if (storeStatus === "Open") {
        await ctx.replyWithHTML(
          `✅ <b>${storeName}</b> is <b>Eligible</b> for orders!\n\n<a href="${url}">View Store</a>`,
          Markup.inlineKeyboard([
            [
              Markup.button.url("Order Now", url),
              Markup.button.callback("Check Again", "check_again"),
            ],
          ])
        );
      } else {
        await ctx.replyWithHTML(
          `❌ <b>${storeName}</b> is <b>Not Eligible</b> for orders.`,
          Markup.inlineKeyboard([
            [Markup.button.url("View on DoorDash", url)],
            [Markup.button.callback("Check Again", "check_again")],
          ])
        );
      }
    } catch (error) {
      console.error("Error fetching URL with Puppeteer:", error);
      ctx.reply("An error occurred while checking the store. Please try again later.");
    }
  } else {
    ctx.reply("Please send a valid Doordash store URL that starts with https://www.doordash.com/store/");
  }
});

bot.action("check_again", (ctx) => {
  console.log("Check Again action triggered");
  ctx.reply("Please send the Doordash store URL to check.");
});

bot.launch();
console.log("Bot is running...");
