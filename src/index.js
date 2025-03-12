import dotenv from "dotenv";
import { Telegraf, Markup } from "telegraf";
import puppeteer from "puppeteer";
import express from "express";

dotenv.config();
const bot = new Telegraf(process.env.BOT_TOKEN);
const PORT = process.env.PORT || 3000;
const app = express();

app.use(bot.webhookCallback("/webhook"));
const WEBHOOK_URL = process.env.WEBHOOK_URL || "sadly-promoted-pony.ngrok-free.app";
bot.telegram.setWebhook(`${WEBHOOK_URL}/webhook`);

bot.start((ctx) => {
  console.log("User started the bot:", ctx.from);
  ctx.reply(
    "Welcome to DoorDash Store checker!\n\nI can help you check if a DoorDash store has an associated order.online store.\n\nSend /check or directly send the DoorDash store URL.",
    Markup.keyboard(["/check"]).resize()
  );
});

bot.command("check", (ctx) => {
  ctx.reply("Please send the DoorDash store URL to check.");
});

bot.on("text", async (ctx) => {
  const url = ctx.message.text.trim();
  console.log("Received URL:", url);

  // Ensure the URL is a DoorDash store URL
  if (!url.startsWith("https://www.doordash.com/store/")) {
    ctx.reply("Please send a valid DoorDash store URL that starts with https://www.doordash.com/store/");
    return;
  }

  // Extract the store name from the URL.
  let storeName = "Store";
  try {
    const parsedUrl = new URL(url);
    const pathParts = parsedUrl.pathname.split("/");
    if (pathParts.length >= 3) {
      storeName = pathParts[2];
    }
  } catch (error) {
    console.error("Error parsing URL:", error);
    ctx.reply("There was an error processing your URL.");
    return;
  }

  ctx.reply("Checking DoorDash store status...");

  try {
    // Launch Puppeteer to load the DoorDash store page
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    // Increase default navigation timeout to 60 seconds
    page.setDefaultNavigationTimeout(60000);
    await page.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
    );
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
    const content = await page.content();
    await browser.close();

    // Determine store status based on page content
    const storeStatus = !content.includes("This store is currently unavailable") ? "Open" : "Closed";
    console.log("Computed DoorDash store status:", storeStatus);

    // Build a Google search query using the extracted store name and "order.online"
    const query = encodeURIComponent(`${storeName} order.online`);
    const googleSearchUrl = `https://www.google.com/search?q=${query}`;
    console.log("Google search URL:", googleSearchUrl);

    // Launch Puppeteer to perform the Google search
    const browser2 = await puppeteer.launch({ headless: true });
    const page2 = await browser2.newPage();
    page2.setDefaultNavigationTimeout(60000);
    await page2.setUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
    );
    await page2.goto(googleSearchUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    
    // Use evaluate to scan the rendered DOM for an order.online link.
    const orderOnlineLink = await page2.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll("a"));
      for (const a of anchors) {
        if (a.href && a.href.includes("order.online")) {
          return a.href;
        }
      }
      return null;
    });
    await browser2.close();
    
    console.log("Found order.online link:", orderOnlineLink);

    // Build the reply message
    let replyText = "";
    if (storeStatus === "Open") {
      replyText = `✅ <b>${storeName}</b> is <b>Eligible</b> for orders on DoorDash!\n\n<a href="${url}">View DoorDash Store</a>`;
    } else {
      replyText = `❌ <b>${storeName}</b> is <b>Not Eligible</b> for orders on DoorDash.\n\n<a href="${url}">View DoorDash Store</a>`;
    }

    if (orderOnlineLink) {
      replyText += `\n\nFound associated order.online store: <a href="${orderOnlineLink}">Order Online</a>`;
    } else {
      replyText += `\n\nNo associated order.online store was found.`;
    }

    await ctx.replyWithHTML(
      replyText,
      Markup.inlineKeyboard([
        [
          Markup.button.url("DoorDash Store", url),
          Markup.button.callback("Check Again", "check_again")
        ]
      ])
    );
  } catch (error) {
    console.error("Error processing URL:", error);
    ctx.reply("An error occurred while checking the store. Please try again later.");
  }
});

bot.action("check_again", (ctx) => {
  console.log("Check Again action triggered");
  ctx.reply("Please send the DoorDash store URL to check.");
});

console.log("Bot is running...");
app.get("/", (req, res) => {
  res.send("DoorDash Checker is running");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
